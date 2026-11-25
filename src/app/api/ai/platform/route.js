/**
 * PlyShip AI — the meetings side of plyship.com, for the daily website AI (which runs with the Marketplace).
 *
 * GET  → numbers about the meetings business + who could use a nudge (ids, names, cities; no chats).
 * POST → { notify: [{ userId, key, title, body, cooldownDays }] } → in-app notification + push to each person,
 *        at most once per key per cool-down (aiNudges/{userId}). Free channels only — never WhatsApp.
 *
 * It never moves money, changes fees or cancels meetings. Auth: "Authorization: Bearer <MARKETPLACE_PROXY_SECRET>".
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getMeetingFee } from '../../../../lib/meetingFee';

const DATABASE_ID = 'plyshipdatabase';
const DAY = 86400000;

function adminApp() {
    if (admin.apps.length) return admin.apps[0];
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
    return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(key, 'base64').toString('utf-8'))), projectId: 'plyship-277bf' });
}

function authorised(request) {
    const secret = process.env.MARKETPLACE_PROXY_SECRET || '';
    return secret.length >= 16 && request.headers.get('authorization') === `Bearer ${secret}`;
}

const ms = (iso) => (iso ? new Date(iso).getTime() : 0);
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
const OPEN = ['REQUESTED', 'PENDING_ACCEPTANCE', 'PROPOSED'];

// Whose turn is it on an open meeting? (same rule as the Home dashboard)
function waitingOn(m) {
    if (m.status === 'REQUESTED' || m.status === 'PENDING_ACCEPTANCE') return m.requestedBy === m.companyId ? m.seekerId : m.companyId;
    if (m.status === 'PROPOSED') return m.proposedBy === m.companyId ? m.seekerId : m.companyId;
    return null;
}

export async function GET(request) {
    if (!authorised(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    try {
        const db = getFirestore(adminApp(), DATABASE_ID);
        const now = Date.now();
        const [seekersSnap, companiesSnap, meetingsSnap, walletsSnap, withdrawalsSnap, deleteSnap, reviewsSnap] = await Promise.all([
            db.collection('seekers').get(), db.collection('companies').get(), db.collection('meetings').get(), db.collection('wallets').get(),
            db.collection('withdrawals').where('status', '==', 'PENDING').get(), db.collection('deleteRequests').where('status', '==', 'PENDING').get(),
            db.collection('reviews').get(),
        ]);
        const privatePhone = Object.fromEntries((await db.collection('contacts').get()).docs.map((d) => [d.id, d.data().phone]));
        const seekers = seekersSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.profileComplete !== false);
        const companies = companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.profileComplete !== false);
        const meetings = meetingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const wallet = Object.fromEntries(walletsSnap.docs.map((d) => [d.id, d.data()]));
        const nameOf = new Map([...seekers, ...companies].map((u) => [u.id, u.profile?.companyName || u.profile?.name || u.name || '']));

        const in30 = (m) => now - ms(m.createdAt) < 30 * DAY;
        const recent = meetings.filter(in30);
        const completed30 = meetings.filter((m) => m.status === 'COMPLETED' && now - ms(m.updatedAt || m.scheduledAt) < 30 * DAY);
        const statusCount = {};
        for (const m of meetings) statusCount[m.status] = (statusCount[m.status] || 0) + 1;

        // Open meetings waiting 48h+ for someone's reply.
        const waitingReply = meetings.filter((m) => OPEN.includes(m.status) && now - ms(m.updatedAt || m.createdAt) > 2 * DAY).map((m) => {
            const who = waitingOn(m);
            return who && {
                meetingId: m.id, userId: who, role: who === m.companyId ? 'COMPANY' : 'SEEKER', status: m.status,
                otherName: who === m.companyId ? (m.seekerName || nameOf.get(m.seekerId) || '') : (m.companyName || nameOf.get(m.companyId) || ''),
                hours: Math.round((now - ms(m.updatedAt || m.createdAt)) / 3600000),
            };
        }).filter(Boolean);

        // Meetings in the next 24 hours (reminders → fewer no-shows).
        const upcoming24h = meetings.filter((m) => ['SCHEDULED', 'CONFIRMED', 'ACCEPTED'].includes(m.status) && ms(m.scheduledAt) > now && ms(m.scheduledAt) - now < DAY)
            .map((m) => ({ meetingId: m.id, companyId: m.companyId, seekerId: m.seekerId, companyName: m.companyName || nameOf.get(m.companyId) || '', seekerName: m.seekerName || nameOf.get(m.seekerId) || '', scheduledAt: m.scheduledAt, location: String(m.location || '').split('||')[0] }));

        // Companies with an open meeting they can't pay for.
        const lowBalance = [];
        const seenLow = new Set();
        for (const m of meetings.filter((x) => OPEN.includes(x.status))) {
            const fee = Number(m.meetingFee) || getMeetingFee(m.propertyType);
            const bal = Number(wallet[m.companyId]?.balance || 0);
            if (bal < fee && !seenLow.has(m.companyId)) { seenLow.add(m.companyId); lowBalance.push({ companyId: m.companyId, balance: bal, needed: fee - bal }); }
        }

        // Seekers 3+ days old who never had a meeting (candidates for free Marketplace quotes).
        const withMeetings = new Set(meetings.flatMap((m) => [m.seekerId, m.companyId]));
        const seekersIdle = seekers.filter((u) => now - ms(u.createdAt) > 3 * DAY && !withMeetings.has(u.id))
            .map((u) => ({ id: u.id, phone: privatePhone[u.id] || u.phone || '', city: u.profile?.city || '' })).slice(0, 2000);

        const companiesList = companies.map((u) => ({
            id: u.id, phone: privatePhone[u.id] || u.phone || '', name: u.profile?.companyName || u.name || '', city: u.profile?.city || '',
            lat: num(u.profile?.lat), lng: num(u.profile?.lng), radiusKm: num(u.profile?.serviceRadius) || 50,
            activeDaysAgo: u.lastActiveAt ? Math.round((now - ms(u.lastActiveAt)) / DAY) : null,
        })).slice(0, 2000);

        const reviews30 = reviewsSnap.docs.map((d) => d.data()).filter((r) => now - ms(r.createdAt) < 30 * DAY);
        const oldestWithdrawal = withdrawalsSnap.docs.reduce((a, d) => Math.min(a, ms(d.data().createdAt) || now), now);

        return Response.json({
            ok: true,
            users: {
                seekers: seekers.length, companies: companies.length,
                newSeekers7: seekers.filter((u) => now - ms(u.createdAt) < 7 * DAY).length,
                newCompanies7: companies.filter((u) => now - ms(u.createdAt) < 7 * DAY).length,
                activeCompanies7: companies.filter((u) => now - ms(u.lastActiveAt) < 7 * DAY).length,
            },
            meetings30: {
                created: recent.length,
                completed: completed30.length,
                cancelledOrDeclined: recent.filter((m) => ['CANCELLED', 'DECLINED'].includes(m.status)).length,
                disputes: recent.filter((m) => m.status === 'DISPUTE').length,
                feesCollected: completed30.reduce((a, m) => a + (Number(m.meetingFee) || getMeetingFee(m.propertyType)), 0),
                plyshipShare: completed30.reduce((a, m) => a + (Number(m.meetingFee) || getMeetingFee(m.propertyType)), 0), // PlyShip keeps the whole fee
                openNow: statusCount,
            },
            reviews30: { count: reviews30.length, avg: reviews30.length ? Math.round((reviews30.reduce((a, r) => a + Number(r.rating || 0), 0) / reviews30.length) * 10) / 10 : null },
            withdrawalsPending: { count: withdrawalsSnap.size, oldestDays: withdrawalsSnap.size ? Math.round((now - oldestWithdrawal) / DAY) : 0 },
            deleteRequestsPending: deleteSnap.size,
            waitingReply, upcoming24h, lowBalance, seekersIdle, companies: companiesList,
        });
    } catch (e) {
        console.error('AI platform metrics failed:', e);
        return Response.json({ ok: false, error: e.message }, { status: 500 });
    }
}

// ---- Nudges: in-app notification + push, once per key per cool-down ----
async function pushTo(messaging, tokens, title, body) {
    if (!tokens.length) return 0;
    try {
        const r = await messaging.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: { type: 'ai_nudge', url: 'https://plyship.com' },
            android: { priority: 'high', notification: { channelId: 'plyship_digest', icon: 'ic_notification', color: '#22C55E' } },
            webpush: { notification: { title, body, icon: '/icon-192.png', badge: '/favicon.png' }, fcmOptions: { link: 'https://plyship.com' } },
        });
        return r.successCount;
    } catch (e) {
        console.error('AI nudge push failed:', e.message);
        return 0;
    }
}

export async function POST(request) {
    if (!authorised(request)) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    let body;
    try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
    const list = Array.isArray(body?.notify) ? body.notify.slice(0, 500) : [];
    const app = adminApp();
    const db = getFirestore(app, DATABASE_ID);
    const messaging = admin.messaging(app);
    const now = Date.now();
    const out = { sent: 0, pushed: 0, skipped: 0, invalid: 0 };
    for (const n of list) {
        const userId = String(n?.userId || '');
        const key = String(n?.key || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80);
        const title = String(n?.title || '').slice(0, 80);
        const text = String(n?.body || '').slice(0, 240);
        const cooldown = Math.min(60, Math.max(1, Number(n?.cooldownDays) || 7)) * DAY;
        if (!userId || !key || !title || /[/.]/.test(userId)) { out.invalid++; continue; }
        try {
            const ref = db.collection('aiNudges').doc(userId);
            const sentAt = (await ref.get()).data()?.[key];
            if (sentAt && now - ms(sentAt) < cooldown) { out.skipped++; continue; }
            await db.collection('notifications').doc(userId).collection('items').add({
                type: 'ai_nudge', title, message: text, data: { key, link: String(n?.link || '').slice(0, 200) }, read: false, createdAt: new Date().toISOString(),
            });
            await ref.set({ [key]: new Date().toISOString() }, { merge: true });
            const tokens = ((await db.collection('fcmTokens').doc(userId).get()).data()?.tokens || []).map((t) => t.token).filter(Boolean);
            out.pushed += (await pushTo(messaging, tokens, title, text)) ? 1 : 0;
            out.sent++;
        } catch (e) {
            console.error('AI nudge failed for', userId, e.message);
            out.invalid++;
        }
    }
    return Response.json({ ok: true, ...out });
}
