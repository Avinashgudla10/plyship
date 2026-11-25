/**
 * Meeting ratings for the PlyShip WhatsApp assistant (server-to-server, shared secret).
 * GET  → confirmed meetings from the last 7 days with who still has to rate (and their WhatsApp numbers).
 * POST { meetingId, uid, stars, comment? } → saves a rating (same rules as the app).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { authorised, db, validUid } from '../_admin';
import { rateMeeting, RATEABLE } from '../../../../lib/server/meetingFeedback';

const DAY = 86400000;

export async function GET(request) {
    if (!authorised(request)) return Response.json({ ok: false }, { status: 401 });
    const d = db();
    const since = Date.now() - 7 * DAY;
    const snaps = await Promise.all(RATEABLE.map((s) => d.collection('meetings').where('status', '==', s).get()));
    const recent = snaps.flatMap((q) => q.docs).map((x) => ({ id: x.id, ...x.data() }))
        .filter((m) => new Date(m.confirmedAt || m.updatedAt || 0).getTime() > since && m.seekerId && m.companyId).slice(0, 200);
    const phone = async (uid) => (await d.collection('contacts').doc(uid).get()).data()?.phone || null;
    const meetings = [];
    for (const m of recent) {
        const [review, fb, sp, cp] = await Promise.all([
            m.seekerRated ? null : d.collection('reviews').doc(`${m.seekerId}_${m.companyId}`).get(),
            m.companyRated ? null : d.collection('meetingFeedback').doc(`${m.id}_${m.companyId}`).get(),
            phone(m.seekerId), phone(m.companyId),
        ]);
        const seekerRated = !!m.seekerRated || !!(review?.exists && review.data().relatedId === m.id);
        const companyRated = !!m.companyRated || !!fb?.exists;
        if (seekerRated && companyRated) continue;
        meetings.push({
            id: m.id, confirmedAt: m.confirmedAt || null,
            seeker: { uid: m.seekerId, name: m.seekerName || '', phone: sp }, company: { uid: m.companyId, name: m.companyName || '', phone: cp },
            seekerRated, companyRated,
        });
    }
    return Response.json({ ok: true, meetings });
}

export async function POST(request) {
    if (!authorised(request)) return Response.json({ ok: false }, { status: 401 });
    let b;
    try { b = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
    if (!validUid(b?.uid)) return Response.json({ ok: false, error: 'uid required' }, { status: 400 });
    const r = await rateMeeting(db(), { meetingId: String(b.meetingId || ''), uid: b.uid, stars: b.stars, comment: b.comment });
    return Response.json(r, { status: r.ok ? 200 : r.status || 400 });
}
