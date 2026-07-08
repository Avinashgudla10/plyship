export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getMeetingFee, DEFAULT_MEETING_FEE } from '../../../../lib/meetingFee';

const DATABASE_ID = 'plyshipdatabase';

// Lazily init the Firebase Admin app (only needed for server-side fee validation).
// Returns null if the service-account key isn't configured — in that case we skip
// meeting-fee validation rather than block payments.
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

// The fee a meeting SHOULD cost, computed server-side (never trust the client amount).
// Prefers the fee stored on the meeting; falls back to deriving it from the seeker's
// property type. Returns null if it can't be determined (admin not configured / no meeting).
async function getExpectedMeetingFee(meetingId) {
    const app = getAdminApp();
    if (!app) return null;
    try {
        const db = getFirestore(app, DATABASE_ID);
        const snap = await db.collection('meetings').doc(meetingId).get();
        if (!snap.exists) return null;
        const meeting = snap.data();
        if (meeting.meetingFee) return Number(meeting.meetingFee);
        // Legacy meeting without a stored fee — derive from the seeker's property type.
        const seekerSnap = await db.collection('seekers').doc(meeting.seekerId).get();
        const propertyType = seekerSnap.exists ? seekerSnap.data()?.profile?.propertyType : null;
        return getMeetingFee(propertyType);
    } catch {
        return null;
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { amount, userId, meetingId, currency = 'INR' } = body;

        // Check if keys are configured
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            return Response.json(
                { error: 'Payment gateway not configured. Please contact support.' },
                { status: 503 }
            );
        }

        // Validate amount (floor)
        if (!amount || amount < 500) {
            return Response.json(
                { error: 'Minimum top-up amount is ₹500' },
                { status: 400 }
            );
        }

        // Meeting-fee validation: if this order is for a specific meeting, the amount MUST
        // equal that meeting's server-computed fee (from the seeker's property type). This
        // stops a tampered client from paying less than the real fee.
        if (meetingId) {
            const expected = await getExpectedMeetingFee(meetingId);
            if (expected != null && Number(amount) !== Number(expected)) {
                return Response.json(
                    { error: `Invalid amount for this meeting. The meeting fee is ₹${expected}.` },
                    { status: 400 }
                );
            }
        }

        // Use fetch to call Razorpay API directly instead of SDK
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

        const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify({
                amount: amount * 100, // Razorpay expects paise
                currency,
                receipt: `wallet_${userId}_${Date.now()}`.substring(0, 40),
                notes: {
                    userId: userId || 'unknown',
                    meetingId: meetingId || '',
                    type: meetingId ? 'MEETING_FEE' : 'WALLET_TOP_UP',
                },
            }),
        });

        const order = await orderResponse.json();

        if (!orderResponse.ok) {
            return Response.json(
                { error: order.error?.description || 'Failed to create order' },
                { status: 400 }
            );
        }

        return Response.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: keyId,
        });
    } catch (error) {
        return Response.json(
            { error: 'Failed to create payment order' },
            { status: 500 }
        );
    }
}
