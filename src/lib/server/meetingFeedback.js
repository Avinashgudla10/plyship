// Ratings & feedback after a meeting — from both sides, always optional. Used by the app (/api/meeting-feedback)
// and by WhatsApp (/api/wa/feedback). Server-side (firebase-admin), so the same checks apply everywhere:
//  • only the two people in the meeting, only once the meeting is confirmed (the code was entered);
//  • the homeowner's rating is their review of the company (reviews/{seekerId}_{companyId}, shown on its profile);
//  • the company's rating of the homeowner is private feedback for PlyShip (meetingFeedback/{meetingId}_{companyId}).
export const RATEABLE = ['CONFIRMED', 'COMPLETED'];
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const okId = (id) => typeof id === 'string' && id.length > 0 && id.length < 200 && !/[/.]/.test(id);

export async function myMeetingFeedback(db, meetingId, uid) {
    if (!okId(meetingId)) return null;
    const snap = await db.collection('meetings').doc(meetingId).get();
    if (!snap.exists) return null;
    const m = snap.data();
    if (uid !== m.seekerId && uid !== m.companyId) return null;
    if (uid === m.seekerId) {
        const r = await db.collection('reviews').doc(`${m.seekerId}_${m.companyId}`).get();
        return r.exists && r.data().relatedId === meetingId ? { rating: r.data().rating, comment: r.data().comment || '' } : null;
    }
    const f = await db.collection('meetingFeedback').doc(`${meetingId}_${uid}`).get();
    return f.exists ? { rating: f.data().rating || null, comment: f.data().comment || '' } : null;
}

/**
 * stars 1-5, or 0 = keep the earlier stars and only change the comment (comment undefined = keep it).
 * Returns { ok } | { ok:false, error, status }.
 */
export async function rateMeeting(db, { meetingId, uid, stars, comment }) {
    if (!okId(meetingId)) return { ok: false, error: 'Meeting not found', status: 404 };
    const ref = db.collection('meetings').doc(meetingId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'Meeting not found', status: 404 };
    const m = snap.data();
    const isSeeker = uid === m.seekerId, isCompany = uid === m.companyId;
    if (!isSeeker && !isCompany) return { ok: false, error: 'Not your meeting', status: 403 };
    if (!RATEABLE.includes(m.status)) return { ok: false, error: 'You can rate a meeting once it is confirmed.', status: 400 };
    const s = Number(stars) || 0;
    if (!(Number.isInteger(s) && s >= 0 && s <= 5)) return { ok: false, error: 'Rating must be 1 to 5 stars', status: 400 };
    const now = new Date().toISOString();
    const keep = (prev) => (comment === undefined ? (prev.exists ? prev.data().comment || '' : '') : clip(comment, 1000));

    if (isSeeker) {
        const rref = db.collection('reviews').doc(`${m.seekerId}_${m.companyId}`);
        const prev = await rref.get();
        const rating = s || (prev.exists ? prev.data().rating : 0);
        if (!rating) return { ok: false, error: 'Choose 1 to 5 stars', status: 400 };
        const seeker = (await db.collection('seekers').doc(uid).get()).data() || {};
        await rref.set({
            companyId: m.companyId, seekerId: m.seekerId, seekerName: seeker.profile?.name || seeker.name || m.seekerName || 'PlyShip user',
            type: 'MEETING', rating, comment: keep(prev), relatedId: meetingId, updatedAt: now, ...(prev.exists ? {} : { createdAt: now }),
        }, { merge: true });
        await ref.update({ seekerRated: true, updatedAt: now });
    } else {
        const fref = db.collection('meetingFeedback').doc(`${meetingId}_${uid}`);
        const prev = await fref.get();
        const rating = s || (prev.exists ? prev.data().rating : 0);
        if (!rating) return { ok: false, error: 'Choose 1 to 5 stars', status: 400 };
        await fref.set({
            meetingId, fromId: uid, toId: m.seekerId, role: 'COMPANY', rating, comment: keep(prev), updatedAt: now, ...(prev.exists ? {} : { createdAt: now }),
        }, { merge: true });
        await ref.update({ companyRated: true, updatedAt: now });
    }
    return { ok: true };
}
