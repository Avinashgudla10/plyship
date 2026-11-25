/**
 * One PlyShip wallet for meetings AND Marketplace leads. The Marketplace (server-to-server, shared secret)
 * uses this to read a company's balance, charge a lead purchase, or credit a refund — in the same
 * wallets/{uid} and transactions the app uses for meeting fees.
 *
 * GET  ?uid=…                                   → { ok, balance }
 * POST { action: 'charge'|'credit', uid, amount, ref, note }
 *      charge: debits only if the balance covers it → { ok, balance } | { ok:false, insufficient:true, balance }
 *      credit: refund back into the wallet          → { ok, balance }
 * Idempotent per ref (transactions/mk_<action>_<ref>): a retry never charges or refunds twice.
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
const authorised = (request) => {
    const secret = process.env.MARKETPLACE_PROXY_SECRET || '';
    return secret.length >= 16 && request.headers.get('authorization') === `Bearer ${secret}`;
};
const validUid = (uid) => typeof uid === 'string' && uid.length > 0 && uid.length < 128 && !/[/.]/.test(uid);

export async function GET(request) {
    if (!authorised(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const uid = new URL(request.url).searchParams.get('uid');
    if (!validUid(uid)) return Response.json({ ok: false, error: 'uid required' }, { status: 400 });
    const db = getFirestore(adminApp(), DATABASE_ID);
    const w = (await db.collection('wallets').doc(uid).get()).data();
    return Response.json({ ok: true, balance: Number(w?.balance || 0) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
    if (!authorised(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    let b;
    try { b = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
    const { action, uid } = b || {};
    const amount = Math.round(Number(b?.amount));
    const ref = String(b?.ref || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!['charge', 'credit'].includes(action) || !validUid(uid) || !(amount > 0) || amount > 500000 || !ref) {
        return Response.json({ ok: false, error: 'bad request' }, { status: 400 });
    }
    const db = getFirestore(adminApp(), DATABASE_ID);
    const walletRef = db.collection('wallets').doc(uid);
    const txRef = db.collection('transactions').doc(`mk_${action}_${ref}`);
    try {
        const out = await db.runTransaction(async (t) => {
            const [wSnap, txSnap] = await Promise.all([t.get(walletRef), t.get(txRef)]);
            const w = wSnap.exists ? wSnap.data() : null;
            const balance = Number(w?.balance || 0);
            if (txSnap.exists) return { ok: true, duplicate: true, balance };
            const now = new Date().toISOString();
            if (action === 'charge') {
                if (!w || balance < amount) return { ok: false, insufficient: true, balance };
                t.update(walletRef, { balance: balance - amount, totalSpent: Number(w.totalSpent || 0) + amount, updatedAt: now });
                t.set(txRef, { userId: uid, type: 'DEBIT', amount, reason: 'LEAD_PURCHASE', ref, note: String(b.note || '').slice(0, 200), status: 'COMPLETED', createdAt: now });
                return { ok: true, balance: balance - amount };
            }
            // credit (refund of a Marketplace purchase)
            if (w) t.update(walletRef, { balance: balance + amount, updatedAt: now });
            else t.set(walletRef, { userId: uid, type: 'COMPANY', balance: amount, totalSpent: 0, createdAt: now, updatedAt: now });
            t.set(txRef, { userId: uid, type: 'CREDIT', amount, reason: 'LEAD_REFUND', ref, note: String(b.note || '').slice(0, 200), status: 'COMPLETED', createdAt: now });
            return { ok: true, balance: balance + amount };
        });
        return Response.json(out, { status: out.ok || out.insufficient ? 200 : 400 });
    } catch (e) {
        console.error('Wallet ledger failed:', e.message);
        return Response.json({ ok: false, error: 'wallet unavailable' }, { status: 500 });
    }
}
