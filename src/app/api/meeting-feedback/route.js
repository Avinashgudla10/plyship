/**
 * Rate a meeting from the app (both sides, optional). Signed-in user (Firebase ID token).
 * GET  ?meetingId=… → { ok, feedback: { rating, comment } | null }
 * POST { meetingId, stars, comment } → { ok } | { ok:false, error }
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import admin from 'firebase-admin';
import { adminApp, db } from '../wa/_admin';
import { rateMeeting, myMeetingFeedback } from '../../../lib/server/meetingFeedback';

async function uidOf(request) {
    const m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '');
    if (!m) return null;
    try { return (await admin.auth(adminApp()).verifyIdToken(m[1])).uid; } catch { return null; }
}

export async function GET(request) {
    const uid = await uidOf(request);
    if (!uid) return Response.json({ ok: false, error: 'Please sign in' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('meetingId') || '';
    return Response.json({ ok: true, feedback: await myMeetingFeedback(db(), id, uid) });
}

export async function POST(request) {
    const uid = await uidOf(request);
    if (!uid) return Response.json({ ok: false, error: 'Please sign in' }, { status: 401 });
    let b;
    try { b = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
    const r = await rateMeeting(db(), { meetingId: String(b?.meetingId || ''), uid, stars: b?.stars, comment: String(b?.comment ?? '') });
    return Response.json(r, { status: r.ok ? 200 : r.status || 400 });
}
