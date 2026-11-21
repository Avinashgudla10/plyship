/**
 * GET /api/contact?userId=<uid> — the other person's phone number, for the Call button in chat.
 *
 * Phone numbers are private (contacts/{uid}, readable only by the owner and admin). They are revealed only
 * to someone who has a meeting with that person (any status — same rule the chat screen always used), or to
 * the admin. Checked here on the server, so they can't be scraped from profiles.
 * Auth: "Authorization: Bearer <Firebase ID token>".
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID = 'plyshipdatabase';
const ADMIN_PHONES = ['+918465834152'];

function adminApp() {
    if (admin.apps.length) return admin.apps[0];
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
    return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(key, 'base64').toString('utf-8'))), projectId: 'plyship-277bf' });
}

export async function GET(request) {
    const target = new URL(request.url).searchParams.get('userId') || '';
    if (!target || /[/.]/.test(target)) return Response.json({ ok: false, error: 'userId required' }, { status: 400 });
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return Response.json({ ok: false, error: 'Sign in required' }, { status: 401 });
    try {
        const app = adminApp();
        let caller;
        try { caller = await admin.auth(app).verifyIdToken(token); } catch { return Response.json({ ok: false, error: 'Sign in required' }, { status: 401 }); }
        const db = getFirestore(app, DATABASE_ID);

        const isAdmin = ADMIN_PHONES.includes(caller.phone_number);
        if (!isAdmin && caller.uid !== target) {
            // Any meeting between the two of them, in either direction.
            const [a, b] = await Promise.all([
                db.collection('meetings').where('companyId', '==', caller.uid).where('seekerId', '==', target).limit(1).get(),
                db.collection('meetings').where('companyId', '==', target).where('seekerId', '==', caller.uid).limit(1).get(),
            ]);
            if (a.empty && b.empty) return Response.json({ ok: false, error: 'Book a meeting to see the phone number' }, { status: 403 });
        }

        const contact = (await db.collection('contacts').doc(target).get()).data();
        let phone = contact?.phone || '';
        if (!phone) {
            // Older accounts not yet moved: read it from the profile (server-side only).
            for (const col of ['companies', 'seekers']) {
                const d = (await db.collection(col).doc(target).get()).data();
                phone = d?.phone || d?.profile?.phone || '';
                if (phone) break;
            }
        }
        return Response.json({ ok: true, phone: phone || null }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
        console.error('Contact lookup failed:', e.message);
        return Response.json({ ok: false, error: 'Something went wrong' }, { status: 500 });
    }
}
