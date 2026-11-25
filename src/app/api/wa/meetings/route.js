/**
 * GET /api/wa/meetings?uid=… — a person's meetings, for the PlyShip WhatsApp assistant (server-to-server,
 * shared secret). Returns meetings waiting for their reply and upcoming ones (names, times, places only).
 * Auth: "Authorization: Bearer <MARKETPLACE_PROXY_SECRET>".
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID = 'plyshipdatabase';
function adminApp() {
    if (admin.apps.length) return admin.apps[0];
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
    return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(key, 'base64').toString('utf-8'))), projectId: 'plyship-277bf' });
}
const OPEN = ['REQUESTED', 'PENDING_ACCEPTANCE', 'PROPOSED'];
const waitingOn = (m) => (m.status === 'PROPOSED' ? (m.proposedBy === m.companyId ? m.seekerId : m.companyId) : (m.requestedBy === m.companyId ? m.seekerId : m.companyId));

export async function GET(request) {
    const secret = process.env.MARKETPLACE_PROXY_SECRET || '';
    if (!(secret.length >= 16 && request.headers.get('authorization') === `Bearer ${secret}`)) return Response.json({ ok: false }, { status: 401 });
    const uid = new URL(request.url).searchParams.get('uid') || '';
    if (!uid || /[/.]/.test(uid)) return Response.json({ ok: false, error: 'uid required' }, { status: 400 });
    const db = getFirestore(adminApp(), DATABASE_ID);
    const [a, b] = await Promise.all([
        db.collection('meetings').where('companyId', '==', uid).get(),
        db.collection('meetings').where('seekerId', '==', uid).get(),
    ]);
    const all = [...a.docs, ...b.docs].map((d) => ({ id: d.id, ...d.data() }));
    const other = (m) => (m.companyId === uid ? m.seekerName : m.companyName) || 'PlyShip user';
    const now = Date.now();
    return Response.json({
        ok: true,
        waiting: all.filter((m) => OPEN.includes(m.status) && waitingOn(m) === uid).map((m) => ({ id: m.id, with: other(m), status: m.status, scheduledAt: m.scheduledAt || null })),
        upcoming: all.filter((m) => ['SCHEDULED', 'CONFIRMED', 'ACCEPTED'].includes(m.status) && m.scheduledAt && new Date(m.scheduledAt).getTime() > now - 2 * 3600000)
            .sort((x, y) => new Date(x.scheduledAt) - new Date(y.scheduledAt)).slice(0, 5)
            .map((m) => ({ id: m.id, with: other(m), scheduledAt: m.scheduledAt, place: String(m.location || '').split('||')[0] })),
    }, { headers: { 'Cache-Control': 'no-store' } });
}
