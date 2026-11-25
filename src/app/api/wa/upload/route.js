/**
 * POST /api/wa/upload — store one portfolio photo sent on WhatsApp during sign-up (shared secret).
 * body: { phone, data (base64), mime } → { ok, url } (a Firebase Storage download URL, like the app's uploads).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import crypto from 'node:crypto';
import admin from 'firebase-admin';
import { authorised, adminApp } from '../_admin';

const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'plyship-277bf.firebasestorage.app';

export async function POST(request) {
    if (!authorised(request)) return Response.json({ ok: false }, { status: 401 });
    let b;
    try { b = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
    const phone = String(b?.phone || '');
    if (!/^\+91[6-9]\d{9}$/.test(phone)) return Response.json({ ok: false, error: 'phone' }, { status: 400 });
    const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(b?.mime) ? b.mime : null;
    const buf = Buffer.from(String(b?.data || ''), 'base64');
    if (!mime || buf.length < 1000 || buf.length > 3_500_000) return Response.json({ ok: false, error: 'Send a photo (JPG or PNG, under 3 MB)' }, { status: 400 });
    const token = crypto.randomUUID();
    const path = `wa-signup/${phone.slice(-10)}/portfolio_${Date.now()}.${mime.split('/')[1]}`;
    const file = admin.storage(adminApp()).bucket(BUCKET).file(path);
    await file.save(buf, { contentType: mime, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    return Response.json({ ok: true, url });
}
