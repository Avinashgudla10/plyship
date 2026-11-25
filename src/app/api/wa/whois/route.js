/**
 * GET /api/wa/whois?phone=+91XXXXXXXXXX — is this WhatsApp number a PlyShip account? (shared secret)
 * Returns { ok, found, uid, role: 'COMPANY'|'SEEKER', profile } so the WhatsApp assistant can serve people who
 * only ever used the app. The phone is matched in the private contacts records.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { authorised, db } from '../_admin';

export async function GET(request) {
    if (!authorised(request)) return Response.json({ ok: false }, { status: 401 });
    const phone = new URL(request.url).searchParams.get('phone') || '';
    if (!/^\+91[6-9]\d{9}$/.test(phone)) return Response.json({ ok: false, error: 'phone must be +91XXXXXXXXXX' }, { status: 400 });
    const d = db();
    const c = await d.collection('contacts').where('phone', '==', phone).limit(1).get();
    if (c.empty) return Response.json({ ok: true, found: false });
    const uid = c.docs[0].id;
    for (const [col, role] of [['companies', 'COMPANY'], ['seekers', 'SEEKER']]) {
        const snap = await d.collection(col).doc(uid).get();
        if (snap.exists && snap.data().profileComplete !== false) {
            const x = snap.data();
            return Response.json({ ok: true, found: true, uid, role, name: x.name || '', profile: x.profile || {} }, { headers: { 'Cache-Control': 'no-store' } });
        }
    }
    return Response.json({ ok: true, found: true, uid, role: null, profile: null }); // signed up but profile not finished
}
