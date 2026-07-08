export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/wallet/credit
 *
 * Server-authoritative wallet top-up. This is the trusted money-IN path: the wallet
 * balance is credited HERE (via the Admin SDK), only after the Razorpay order is
 * confirmed paid — never on the client. The credited amount is taken from the paid
 * order, so a tampered client cannot claim more than it paid.
 *
 * Auth: caller presents their Firebase ID token; we credit THAT uid's wallet.
 * Idempotent per orderId (safe to retry / recover).
 *
 * Mirrors the previous client-side topUpWallet: settles any owed project commission
 * (1% admin + 3% each project's seeker) out of the top-up before adding the remainder
 * to the company's usable balance.
 */

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID = 'plyshipdatabase';

function getAdminApp() {
    if (admin.apps.length > 0) return admin.apps[0];
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!b64) return null;
    try {
        const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
        return admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'plyship-277bf',
        });
    } catch {
        return null;
    }
}

// Confirm the order is paid and return the authoritative rupee amount + captured paymentId.
async function getPaidOrder(orderId) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return { error: 'gateway' };
    const authB64 = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
        headers: { Authorization: `Basic ${authB64}` },
    });
    if (!orderRes.ok) return { error: 'order_fetch' };
    const order = await orderRes.json();
    if (order.status !== 'paid') return { error: 'not_paid', status: order.status };

    const payRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
        headers: { Authorization: `Basic ${authB64}` },
    });
    const payData = payRes.ok ? await payRes.json() : { items: [] };
    const captured = (payData.items || []).find((p) => p.status === 'captured');
    return { amount: Math.floor((order.amount || 0) / 100), paymentId: captured?.id || null };
}

export async function POST(request) {
    try {
        const app = getAdminApp();
        if (!app) return Response.json({ error: 'Wallet service not configured' }, { status: 503 });
        const db = getFirestore(app, DATABASE_ID);

        // ── Auth: credit the token owner's wallet (never a body-supplied userId) ──
        const authHeader = request.headers.get('authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) return Response.json({ error: 'Missing authentication token' }, { status: 401 });
        let uid;
        try {
            uid = (await admin.auth(app).verifyIdToken(idToken)).uid;
        } catch {
            return Response.json({ error: 'Invalid authentication token' }, { status: 401 });
        }

        const { orderId } = await request.json();
        if (!orderId) return Response.json({ error: 'Missing orderId' }, { status: 400 });

        // ── Authoritative amount from the PAID order ──
        const paid = await getPaidOrder(orderId);
        if (paid.error === 'not_paid') {
            return Response.json({ success: false, error: 'Payment not completed', orderStatus: paid.status }, { status: 400 });
        }
        if (paid.error) {
            return Response.json({ error: 'Could not verify payment with gateway' }, { status: 502 });
        }
        const amount = paid.amount;
        const paymentId = paid.paymentId;
        if (!amount || amount <= 0) {
            return Response.json({ error: 'Invalid paid amount' }, { status: 400 });
        }

        // ── Idempotency: already credited this order? ──
        // orderId is globally unique per Razorpay order, so a single-field query
        // suffices (and needs no composite index).
        const dup = await db.collection('transactions')
            .where('orderId', '==', orderId)
            .limit(1).get();
        if (!dup.empty) {
            const wSnap = await db.collection('wallets').doc(uid).get();
            return Response.json({
                success: true,
                alreadyCredited: true,
                newBalance: wSnap.exists ? (wSnap.data().balance || 0) : 0,
            });
        }

        // ── Credit the wallet (settle owed commission first) ──
        const walletRef = db.collection('wallets').doc(uid);
        const walletSnap = await walletRef.get();
        const currentBalance = walletSnap.exists ? (walletSnap.data().balance || 0) : 0;
        const commissionOwed = walletSnap.exists ? (walletSnap.data().commissionOwed || 0) : 0;

        const settledCommission = Math.min(commissionOwed, amount);
        const netCredit = amount - settledCommission;
        const newBalance = currentBalance + netCredit;
        const nowIso = new Date().toISOString();

        await walletRef.set({
            balance: newBalance,
            commissionOwed: commissionOwed - settledCommission,
            updatedAt: nowIso,
            lastTopUp: { amount, paymentId, orderId, timestamp: nowIso },
        }, { merge: true });

        await db.collection('transactions').add({
            userId: uid,
            type: 'CREDIT',
            amount,
            reason: 'TOP_UP',
            paymentId: paymentId || null,
            orderId,
            status: 'COMPLETED',
            createdAt: nowIso,
        });

        // ── Distribute settled commission: 3% → each pending project's seeker, 1% → admin ──
        if (settledCommission > 0) {
            try {
                const pendingProjSnap = await db.collection('projects')
                    .where('companyId', '==', uid)
                    .where('commissionStatus', '==', 'PENDING')
                    .get();

                let adminShareTotal = 0;
                for (const d of pendingProjSnap.docs) {
                    const p = d.data();
                    const total = p.commissionAmount || 0;
                    const seekerShare = (p.seekerCommission != null) ? p.seekerCommission : 0;
                    const adminShare = (p.adminCommission != null) ? p.adminCommission : total;
                    adminShareTotal += adminShare;

                    if (seekerShare > 0 && p.seekerId) {
                        const sRef = db.collection('wallets').doc(p.seekerId);
                        const sSnap = await sRef.get();
                        const sBal = sSnap.exists ? (sSnap.data().balance || 0) : 0;
                        const sEarn = sSnap.exists ? (sSnap.data().totalEarnings || 0) : 0;
                        await sRef.set({
                            balance: sBal + seekerShare,
                            totalEarnings: sEarn + seekerShare,
                            updatedAt: nowIso,
                        }, { merge: true });
                        await db.collection('transactions').add({
                            userId: p.seekerId, type: 'CREDIT', amount: seekerShare,
                            reason: 'PROJECT_COMMISSION_REWARD', relatedProjectId: d.id,
                            relatedUserId: uid, status: 'COMPLETED', createdAt: nowIso,
                        });
                        await db.collection('notifications').doc(p.seekerId).collection('items').add({
                            type: 'wallet_credit',
                            title: '🎉 Project reward credited!',
                            message: `₹${seekerShare} project reward has been added to your wallet.`,
                            data: { amount: seekerShare, projectId: d.id },
                            read: false,
                            createdAt: nowIso,
                        });
                    }

                    await d.ref.update({ commissionStatus: 'COLLECTED', commissionCollectedAt: nowIso });
                }

                const adminCredit = adminShareTotal > 0 ? adminShareTotal : settledCommission;
                const adminRef = db.collection('wallets').doc('admin_wallet');
                const adminSnap = await adminRef.get();
                const adminBalance = adminSnap.exists ? (adminSnap.data().balance || 0) : 0;
                const adminEarnings = adminSnap.exists ? (adminSnap.data().totalEarnings || 0) : 0;
                await adminRef.set({
                    userId: 'admin_wallet', type: 'ADMIN',
                    balance: adminBalance + adminCredit,
                    totalEarnings: adminEarnings + adminCredit,
                    updatedAt: nowIso,
                }, { merge: true });

                await db.collection('transactions').add({
                    userId: uid, type: 'DEBIT', amount: settledCommission,
                    reason: 'PROJECT_COMMISSION', paymentId: paymentId || null, status: 'COMPLETED', createdAt: nowIso,
                });
                await db.collection('transactions').add({
                    userId: 'admin_wallet', type: 'CREDIT', amount: adminCredit,
                    reason: 'PROJECT_COMMISSION', relatedUserId: uid, status: 'COMPLETED', createdAt: nowIso,
                });
            } catch (e) {
                console.error('Commission settlement failed:', e);
            }
        }

        // Notify the company about the top-up.
        try {
            await db.collection('notifications').doc(uid).collection('items').add({
                type: 'wallet_credit',
                title: '💰 Wallet Topped Up!',
                message: settledCommission > 0
                    ? `₹${amount} received — ₹${settledCommission} settled as project commission, ₹${netCredit} added to your balance.`
                    : `₹${amount} added to your wallet. New balance: ₹${newBalance}`,
                data: { amount, newBalance, settledCommission },
                read: false,
                createdAt: nowIso,
            });
        } catch { /* non-fatal */ }

        return Response.json({ success: true, newBalance, settledCommission, amount });
    } catch (error) {
        console.error('wallet/credit error:', error);
        return Response.json({ error: 'Failed to credit wallet' }, { status: 500 });
    }
}
