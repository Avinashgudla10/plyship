/**
 * POST /api/wa/meeting-action — reply to a meeting from WhatsApp, with the SAME rules as the app
 * (src/context/AuthContext.js acceptMeeting / acceptAndScheduleMeeting / acceptProposedMeeting /
 * counterProposeMeeting / declineMeeting). Shared secret; the Marketplace has already identified the person by
 * their WhatsApp number.
 *
 * body: { uid, meetingId, action: 'accept' | 'propose' | 'decline', scheduledAt? (ISO, for 'propose') }
 * → { ok, status, otp? (to the seeker when the meeting is fixed), error?, insufficient? }
 * No money moves here: the company's wallet is only checked (the fee is taken when both confirm the meeting).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { FieldValue } from 'firebase-admin/firestore';
import { authorised, db, validUid } from '../_admin';

const DEFAULT_FEE = 500;
const chatIdOf = (a, b) => [a, b].sort().join('_');
const when = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export async function POST(request) {
    if (!authorised(request)) return Response.json({ ok: false }, { status: 401 });
    let b;
    try { b = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
    const { uid, meetingId, action } = b || {};
    if (!validUid(uid) || !validUid(meetingId) || !['accept', 'propose', 'decline'].includes(action)) return Response.json({ ok: false, error: 'bad request' }, { status: 400 });
    const d = db();
    const ref = d.collection('meetings').doc(meetingId);
    const snap = await ref.get();
    if (!snap.exists) return Response.json({ ok: false, error: 'Meeting not found' }, { status: 404 });
    const m = snap.data();
    if (uid !== m.companyId && uid !== m.seekerId) return Response.json({ ok: false, error: 'Not your meeting' }, { status: 403 });
    const isCompany = uid === m.companyId;
    const other = isCompany ? m.seekerId : m.companyId;
    const now = new Date().toISOString();
    const chatId = chatIdOf(m.companyId, m.seekerId);
    const say = async (text) => {
        await d.collection('chats').doc(chatId).collection('messages').add({ senderId: 'system', senderName: 'PlyShip', text, type: 'meeting_update', createdAt: FieldValue.serverTimestamp() }).catch(() => {});
        await d.collection('chats').doc(chatId).set({ lastMessage: text, lastMessageAt: FieldValue.serverTimestamp(), lastMessageSenderId: 'system' }, { merge: true }).catch(() => {});
    };
    const notify = (to, title, message, data = {}) => d.collection('notifications').doc(to).collection('items').add({ type: 'meeting_update', title, message, data: { meetingId, ...data }, read: false, createdAt: now }).catch(() => {});
    const fee = Number(m.meetingFee) || DEFAULT_FEE;
    const companyCanPay = async () => Number((await d.collection('wallets').doc(m.companyId).get()).data()?.balance || 0) >= fee;
    const myTurn = (m.status === 'PROPOSED' ? m.proposedBy !== uid : m.requestedBy !== uid);

    if (action === 'decline') {
        if (!['REQUESTED', 'PENDING_ACCEPTANCE', 'PROPOSED'].includes(m.status)) return Response.json({ ok: false, error: 'This meeting can no longer be declined here' });
        await ref.update({ status: 'DECLINED', declinedBy: uid, updatedAt: now });
        await d.collection('chats').doc(chatId).set({ meetingStatus: 'DECLINED', meetingId }, { merge: true });
        await say('❌ Meeting request declined.');
        await notify(other, 'Meeting declined', 'Your meeting request was declined.');
        return Response.json({ ok: true, status: 'DECLINED' });
    }

    if (action === 'propose') {
        const at = new Date(b.scheduledAt || '');
        if (isNaN(at) || at.getTime() < Date.now() + 30 * 60000) return Response.json({ ok: false, error: 'Pick a time at least 30 minutes from now' });
        if (!['REQUESTED', 'PENDING_ACCEPTANCE', 'PROPOSED'].includes(m.status) || !myTurn) return Response.json({ ok: false, error: 'It is not your turn on this meeting' });
        if (m.status === 'REQUESTED' && isCompany) return Response.json({ ok: false, error: 'The homeowner picks the first time' });
        if (!(await companyCanPay())) return Response.json({ ok: false, insufficient: true, error: isCompany ? `Add money to your wallet first — this meeting's fee is ₹${fee}.` : 'The company needs to add money to its wallet before this meeting can be fixed.' });
        await ref.update({ status: 'PROPOSED', scheduledAt: at.toISOString(), proposedBy: uid, proposalCount: Number(m.proposalCount || 0) + 1, lastProposedAt: now, updatedAt: now });
        await d.collection('chats').doc(chatId).set({ meetingStatus: 'PROPOSED', meetingId }, { merge: true });
        await say(`📅 Meeting time proposed: ${when(at.toISOString())}. Awaiting approval.`);
        await notify(other, 'New meeting time proposed', `Proposed: ${when(at.toISOString())}. Accept or suggest another time.`);
        return Response.json({ ok: true, status: 'PROPOSED' });
    }

    // accept
    if (!['PENDING_ACCEPTANCE', 'PROPOSED'].includes(m.status) || !myTurn) {
        return Response.json({ ok: false, error: m.status === 'REQUESTED' ? 'Pick a time to accept this request' : 'There is nothing to accept on this meeting right now' });
    }
    if (m.scheduledAt && new Date(m.scheduledAt) < new Date()) return Response.json({ ok: false, error: 'That time has passed — suggest a new time' });
    if (!(await companyCanPay())) return Response.json({ ok: false, insufficient: true, error: isCompany ? `Add money to your wallet first — this meeting's fee is ₹${fee}.` : 'The company needs to add money to its wallet before this meeting can be fixed.' });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await ref.update({ status: 'SCHEDULED', acceptedBy: uid, acceptedAt: now, meetingOTP: otp, updatedAt: now });
    await d.collection('chats').doc(chatId).set({ meetingStatus: 'SCHEDULED', meetingId }, { merge: true });
    await say(`✅ Both parties agreed! Meeting confirmed: ${m.scheduledAt ? when(m.scheduledAt) : ''}. OTP verification required upon meeting.`);
    await notify(m.seekerId, '🔐 Share OTP with Company', `Your meeting OTP is ${otp}. Share it only after the meeting.`, { otp });
    await notify(m.companyId, '🔐 Collect OTP at Meeting', 'Ask the homeowner for the 6-digit OTP when you meet.');
    return Response.json({ ok: true, status: 'SCHEDULED', otp: isCompany ? undefined : otp, scheduledAt: m.scheduledAt });
}
