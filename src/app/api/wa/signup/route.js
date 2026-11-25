/**
 * POST /api/wa/signup — create a PlyShip account from a WhatsApp sign-up (shared secret).
 * The WhatsApp number IS the verified phone (WhatsApp proves the sender), so no OTP is needed here.
 * Same rules and the same account as the app's sign-up: Firebase login identity (phone), profile in
 * seekers/{uid} or companies/{uid}, private contacts/{uid}, username, empty wallet. Visible on plyship.com.
 *
 * body: { phone, role: 'SEEKER'|'COMPANY', profile } → { ok, uid } | { ok:false, errors:[field…] } | { ok:false, exists:true }
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import admin from 'firebase-admin';
import { authorised, adminApp, db } from '../_admin';
import { checkProfile } from '../../../../lib/profileOptions';

const slug = (s) => String(s || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';

export async function POST(request) {
    if (!authorised(request)) return Response.json({ ok: false }, { status: 401 });
    let b;
    try { b = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
    const phone = String(b?.phone || '');
    const role = b?.role === 'COMPANY' ? 'COMPANY' : b?.role === 'SEEKER' ? 'SEEKER' : null;
    if (!/^\+91[6-9]\d{9}$/.test(phone) || !role) return Response.json({ ok: false, error: 'bad request' }, { status: 400 });
    const { profile, errors } = checkProfile(role, b.profile || {});
    if (errors.length) return Response.json({ ok: false, errors }, { status: 400 });

    const auth = admin.auth(adminApp());
    const d = db();
    let uid;
    try { uid = (await auth.getUserByPhoneNumber(phone)).uid; }
    catch (e) { if (e.code !== 'auth/user-not-found') throw e; uid = (await auth.createUser({ phoneNumber: phone })).uid; }
    const [s1, s2] = await Promise.all([d.collection('seekers').doc(uid).get(), d.collection('companies').doc(uid).get()]);
    if ((s1.exists && s1.data().profileComplete) || (s2.exists && s2.data().profileComplete)) return Response.json({ ok: false, exists: true, uid });

    const now = new Date().toISOString();
    const name = role === 'SEEKER' ? profile.name : profile.companyName;
    // username, like the app
    let username = slug(name);
    for (let i = 0; i < 8; i++) {
        const cand = i ? `${slug(name)}${Math.floor(1000 + Math.random() * 9000)}` : slug(name);
        const ref = d.collection('usernames').doc(cand);
        const ok = await d.runTransaction(async (t) => { const s = await t.get(ref); if (s.exists) return false; t.set(ref, { userId: uid, createdAt: now }); return true; });
        if (ok) { username = cand; break; }
    }
    const col = role === 'SEEKER' ? 'seekers' : 'companies';
    await d.collection(col).doc(uid).set({ email: null, name, role, profileComplete: true, profile, username, createdAt: now, lastActiveAt: now, signedUpVia: 'whatsapp' });
    await d.collection('contacts').doc(uid).set({ phone, updatedAt: now }, { merge: true });
    const wallet = d.collection('wallets').doc(uid);
    if (!(await wallet.get()).exists) {
        await wallet.set({ userId: uid, type: role, balance: 0, createdAt: now, updatedAt: now, ...(role === 'COMPANY' ? { totalSpent: 0 } : {}) });
    }
    return Response.json({ ok: true, uid, username });
}
