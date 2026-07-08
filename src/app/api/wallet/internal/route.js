export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/wallet/internal
 *
 * Server-authoritative internal wallet transfers (no Razorpay). These are the money
 * moves that used to run on the client and write wallet balances directly — now they
 * run here via the Admin SDK so the `wallets` balance/lockedBalance fields can be
 * locked to server + admin only (see firestore.rules), which is what closes the
 * self-crediting hole.
 *
 * Operations (op):
 *   - settle-meeting   : both parties confirmed (or company entered the seeker's OTP)
 *                        → debit company fee, credit seeker's locked share + admin share.
 *   - unlock-project   : the OTHER party accepts a project request → unlock the seeker's
 *                        locked earnings into spendable balance.
 *   - confirm-advance  : company confirms the advance payment → unlock seeker earnings and
 *                        accrue the 4% commission the company owes (settled on next top-up).
 *
 * Auth: caller presents their Firebase ID token; the server re-validates the state and
 * that the caller is a party to the meeting/project before moving any money.
 */

import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMeetingFee, getSeekerShare, getAdminShare, DEFAULT_MEETING_FEE } from '../../../../lib/meetingFee';

const DATABASE_ID = 'plyshipdatabase';
const ADMIN_WALLET_ID = 'admin_wallet';
const PROJECT_COMMISSION_RATE = 0.04;
const ADMIN_COMMISSION_RATE = 0.01;

function getAdminApp() {
    if (admin.apps.length > 0) return admin.apps[0];
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!b64) return null;
    try {
        const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
        return admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'plyship-277bf' });
    } catch {
        return null;
    }
}

// Deterministic chat id (must match the client's getChatId: sorted uid pair).
function getChatId(a, b) {
    return [a, b].sort().join('_');
}

export async function POST(request) {
    try {
        const app = getAdminApp();
        if (!app) return Response.json({ error: 'Wallet service not configured' }, { status: 503 });
        const db = getFirestore(app, DATABASE_ID);

        const authHeader = request.headers.get('authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) return Response.json({ error: 'Missing authentication token' }, { status: 401 });
        let uid;
        try {
            uid = (await admin.auth(app).verifyIdToken(idToken)).uid;
        } catch {
            return Response.json({ error: 'Invalid authentication token' }, { status: 401 });
        }

        const body = await request.json();
        const { op } = body;

        if (op === 'settle-meeting') return settleMeeting(db, uid, body);
        if (op === 'unlock-project') return unlockProject(db, uid, body);
        if (op === 'confirm-advance') return confirmAdvance(db, uid, body);
        return Response.json({ error: 'Unknown operation' }, { status: 400 });
    } catch (error) {
        console.error('wallet/internal error:', error);
        return Response.json({ error: 'Internal wallet operation failed' }, { status: 500 });
    }
}

// ── settle-meeting: debit company, credit seeker (locked) + admin ──
async function settleMeeting(db, uid, { meetingId, otp }) {
    if (!meetingId) return Response.json({ error: 'Missing meetingId' }, { status: 400 });

    const meetingRef = db.collection('meetings').doc(meetingId);
    const meetingSnap = await meetingRef.get();
    if (!meetingSnap.exists) return Response.json({ error: 'Meeting not found' }, { status: 404 });
    const meeting = meetingSnap.data();

    // Caller must be a party to this meeting.
    if (uid !== meeting.companyId && uid !== meeting.seekerId) {
        return Response.json({ error: 'Not a participant of this meeting' }, { status: 403 });
    }
    // Idempotency: already settled.
    if (meeting.status === 'CONFIRMED' || meeting.paymentStatus === 'PROCESSED') {
        return Response.json({ success: true, alreadyProcessed: true });
    }
    // Authorize the settlement: both confirmed, OR the correct OTP was supplied.
    const bothConfirmed = !!meeting.companyConfirmed && !!meeting.seekerConfirmed;
    const otpOk = otp != null && String(otp).trim() === String(meeting.meetingOTP);
    if (!bothConfirmed && !otpOk) {
        return Response.json({ error: 'Meeting is not ready to settle' }, { status: 400 });
    }

    const companyId = meeting.companyId;
    const seekerId = meeting.seekerId;
    const companyWalletRef = db.collection('wallets').doc(companyId);
    const seekerWalletRef = db.collection('wallets').doc(seekerId);
    const adminWalletRef = db.collection('wallets').doc(ADMIN_WALLET_ID);

    let fee, seekerShare, adminShare;
    try {
        await db.runTransaction(async (t) => {
            const companyWalletSnap = await t.get(companyWalletRef);
            const seekerWalletSnap = await t.get(seekerWalletRef);
            const adminWalletSnap = await t.get(adminWalletRef);
            const mSnap = await t.get(meetingRef);
            const m = mSnap.data();

            // Re-check idempotency inside the transaction.
            if (m.status === 'CONFIRMED' || m.paymentStatus === 'PROCESSED') {
                throw new Error('ALREADY_PROCESSED');
            }

            fee = (m.meetingFee) || DEFAULT_MEETING_FEE;
            seekerShare = getSeekerShare(fee);
            adminShare = getAdminShare(fee);

            if (!companyWalletSnap.exists) throw new Error('Company wallet not found');
            const companyWallet = companyWalletSnap.data();
            if ((companyWallet.balance || 0) < fee) throw new Error('Insufficient balance');

            const seekerWallet = seekerWalletSnap.exists ? seekerWalletSnap.data() : null;
            const adminWallet = adminWalletSnap.exists ? adminWalletSnap.data() : null;
            const nowIso = new Date().toISOString();

            if (!seekerWallet) {
                t.set(seekerWalletRef, {
                    userId: seekerId, type: 'SEEKER', balance: 0,
                    lockedBalance: seekerShare, totalEarnings: seekerShare,
                    createdAt: nowIso, updatedAt: nowIso,
                });
            } else {
                t.update(seekerWalletRef, {
                    lockedBalance: (seekerWallet.lockedBalance || 0) + seekerShare,
                    totalEarnings: (seekerWallet.totalEarnings || 0) + seekerShare,
                    updatedAt: nowIso,
                });
            }

            if (!adminWallet) {
                t.set(adminWalletRef, {
                    userId: ADMIN_WALLET_ID, type: 'ADMIN', balance: adminShare,
                    totalEarnings: adminShare, createdAt: nowIso, updatedAt: nowIso,
                });
            } else {
                t.update(adminWalletRef, {
                    balance: (adminWallet.balance || 0) + adminShare,
                    totalEarnings: (adminWallet.totalEarnings || 0) + adminShare,
                    updatedAt: nowIso,
                });
            }

            t.update(companyWalletRef, {
                balance: (companyWallet.balance || 0) - fee,
                totalSpent: (companyWallet.totalSpent || 0) + fee,
                updatedAt: nowIso,
            });

            t.update(meetingRef, {
                status: 'CONFIRMED', paymentStatus: 'PROCESSED',
                confirmedAt: nowIso, updatedAt: nowIso,
            });
        });
    } catch (e) {
        if (e.message === 'ALREADY_PROCESSED') return Response.json({ success: true, alreadyProcessed: true });
        try { await meetingRef.update({ paymentStatus: 'FAILED', paymentError: e.message, updatedAt: new Date().toISOString() }); } catch { /* ignore */ }
        return Response.json({ success: false, error: e.message, insufficientBalance: e.message === 'Insufficient balance' }, { status: 400 });
    }

    // Transaction records + chat sync + notifications (non-fatal if any fail).
    const now = new Date().toISOString();
    try {
        await Promise.all([
            db.collection('transactions').add({ userId: companyId, type: 'DEBIT', amount: fee, reason: 'MEETING_FEE', relatedMeetingId: meetingId, relatedUserId: seekerId, status: 'COMPLETED', createdAt: now }),
            db.collection('transactions').add({ userId: seekerId, type: 'LOCK', amount: seekerShare, reason: 'MEETING_EARNINGS', relatedMeetingId: meetingId, relatedUserId: companyId, status: 'COMPLETED', createdAt: now }),
            db.collection('transactions').add({ userId: ADMIN_WALLET_ID, type: 'CREDIT', amount: adminShare, reason: 'ADMIN_COMMISSION', relatedMeetingId: meetingId, relatedUserId: companyId, status: 'COMPLETED', createdAt: now }),
        ]);
        const chatId = getChatId(companyId, seekerId);
        await db.collection('chats').doc(chatId).set({ meetingStatus: 'CONFIRMED', meetingId }, { merge: true });
        await db.collection('chats').doc(chatId).collection('messages').add({
            senderId: 'system', senderName: 'PlyShip',
            text: '✅ Meeting confirmed! Payment has been processed.',
            type: 'meeting_update', createdAt: FieldValue.serverTimestamp(),
        });
        await db.collection('notifications').doc(companyId).collection('items').add({ type: 'wallet_debit', title: '💳 Meeting Payment', message: `₹${fee} debited for confirmed meeting`, data: { meetingId }, read: false, createdAt: now });
        await db.collection('notifications').doc(seekerId).collection('items').add({ type: 'wallet_credit', title: '💰 Earnings Received!', message: `₹${seekerShare} added to your locked balance for the meeting`, data: { meetingId }, read: false, createdAt: now });
    } catch (e) {
        console.error('settle-meeting post-write failed:', e);
    }

    return Response.json({ success: true, bothConfirmed: true, paymentProcessed: true, meetingFee: fee, seekerShare });
}

// ── unlock-project: the other party accepts a project request → unlock seeker earnings ──
async function unlockProject(db, uid, { projectId }) {
    if (!projectId) return Response.json({ error: 'Missing projectId' }, { status: 400 });

    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) return Response.json({ error: 'Project not found' }, { status: 404 });
    const project = projectSnap.data();

    if (project.companyId !== uid && project.seekerId !== uid) {
        return Response.json({ error: 'You are not part of this project' }, { status: 403 });
    }
    if (project.requestedBy === uid) {
        return Response.json({ error: 'Cannot accept your own request' }, { status: 400 });
    }
    if (project.status !== 'PENDING_ACCEPTANCE') {
        return Response.json({ error: 'Project is not pending acceptance' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    await projectRef.update({ status: 'ACCEPTED', acceptedBy: uid, acceptedAt: nowIso, updatedAt: nowIso });

    const seekerWalletRef = db.collection('wallets').doc(project.seekerId);
    const seekerWalletSnap = await seekerWalletRef.get();
    if (seekerWalletSnap.exists) {
        const w = seekerWalletSnap.data();
        await seekerWalletRef.update({
            isLocked: false,
            balance: (w.balance || 0) + (w.lockedBalance || 0),
            lockedBalance: 0,
            unlockedAt: nowIso,
            unlockedBy: projectId,
        });
    }

    return Response.json({ success: true });
}

// ── confirm-advance: company confirms advance → unlock seeker earnings + accrue commission ──
async function confirmAdvance(db, uid, { projectId, projectValue }) {
    if (!projectId) return Response.json({ error: 'Missing projectId' }, { status: 400 });

    const value = Math.round(Number(projectValue) || 0);
    if (value <= 0) return Response.json({ error: 'Please enter the total project value' }, { status: 400 });
    const commission = Math.round(value * PROJECT_COMMISSION_RATE);
    const adminCommission = Math.round(value * ADMIN_COMMISSION_RATE);
    const seekerCommission = Math.max(0, commission - adminCommission);

    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) return Response.json({ error: 'Project not found' }, { status: 404 });
    const project = projectSnap.data();

    if (project.companyId !== uid) {
        return Response.json({ error: 'This project is not assigned to you' }, { status: 403 });
    }
    if (project.status !== 'ADVANCE_RECORDED') {
        return Response.json({ error: 'Advance payment must be recorded first' }, { status: 400 });
    }

    const seekerId = project.seekerId;
    const seekerWalletRef = db.collection('wallets').doc(seekerId);
    const companyWalletRef = db.collection('wallets').doc(uid);

    await db.runTransaction(async (t) => {
        const seekerWalletSnap = await t.get(seekerWalletRef);
        const companyWalletSnap = await t.get(companyWalletRef);
        const nowIso = new Date().toISOString();

        t.update(projectRef, {
            status: 'CONFIRMED',
            companyConfirmedAdvance: true,
            projectValue: value,
            commissionAmount: commission,
            adminCommission,
            seekerCommission,
            commissionStatus: commission > 0 ? 'PENDING' : 'NONE',
            confirmedAt: nowIso,
            updatedAt: nowIso,
        });

        if (seekerWalletSnap.exists) {
            const seekerWallet = seekerWalletSnap.data();
            t.update(seekerWalletRef, {
                balance: (seekerWallet.balance || 0) + (seekerWallet.lockedBalance || 0),
                lockedBalance: 0,
                updatedAt: nowIso,
            });
        }

        if (commission > 0 && companyWalletSnap.exists) {
            const companyWallet = companyWalletSnap.data();
            t.update(companyWalletRef, {
                commissionOwed: (companyWallet.commissionOwed || 0) + commission,
                updatedAt: nowIso,
            });
        }
    });

    try {
        const seekerWalletAfter = await seekerWalletRef.get();
        const unlockedAmount = seekerWalletAfter.exists ? (seekerWalletAfter.data().balance || 0) : 0;
        await db.collection('transactions').add({
            userId: seekerId, type: 'UNLOCK', amount: unlockedAmount, reason: 'PROJECT_CONFIRMED',
            relatedProjectId: projectId, relatedUserId: uid, status: 'COMPLETED', createdAt: new Date().toISOString(),
        });
    } catch (e) {
        console.error('confirm-advance txn log failed:', e);
    }

    return Response.json({ success: true, earningsUnlocked: true });
}
