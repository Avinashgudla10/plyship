/**
 * Notification Digest — Server-side Cron Job
 * 
 * Runs daily via Vercel Cron (Hobby) or every 4 hours (Pro).
 * 
 * For each user with activity:
 * 1. Check for new messages received in the lookback window
 * 2. Check for meeting updates in the lookback window
 * 3. If there's activity → send push notification (FCM) + WhatsApp message
 * 
 * Limits:
 * - Push: max 6/day (controlled by cron frequency)
 * - WhatsApp: max 3/day (tracked in Firestore whatsappLog collection)
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// ── Firebase Admin Setup ──

function getAdminApp() {
    if (admin.apps.length > 0) {
        return admin.apps[0];
    }

    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountBase64) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
    );

    return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'plyship-277bf',
    });
}

// ── Constants ──

// Lookback window for activity detection.
// On Vercel Hobby plan: cron runs once/day → use 24 hours.
// On Vercel Pro plan: change to 4 hours and set vercel.json schedule to "0 */4 * * *"
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const DATABASE_ID = 'plyshipdatabase';
const MAX_WHATSAPP_PER_DAY = 3;

// WhatsApp Cloud API config
const WA_API_URL = 'https://graph.facebook.com/v21.0';
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// ── Main Handler ──

export async function GET(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const app = getAdminApp();
        const db = getFirestore(app, DATABASE_ID);
        const messaging = admin.messaging(app);

        const cutoffTime = new Date(Date.now() - LOOKBACK_MS).toISOString();
        const todayKey = new Date().toISOString().split('T')[0]; // "2026-06-05"
        const results = {
            push: { sent: 0, skipped: 0, errors: 0, staleTokensCleaned: 0 },
            whatsapp: { sent: 0, skipped: 0, limited: 0, errors: 0 },
        };

        // 1. Get all users from both collections
        const [seekersSnap, companiesSnap] = await Promise.all([
            db.collection('seekers').get(),
            db.collection('companies').get(),
        ]);

        const allUsers = [];
        for (const doc of seekersSnap.docs) {
            const data = doc.data();
            allUsers.push({ id: doc.id, phone: data.phone || data.phoneNumber, name: data.name || data.fullName || 'there' });
        }
        for (const doc of companiesSnap.docs) {
            const data = doc.data();
            allUsers.push({ id: doc.id, phone: data.phone || data.phoneNumber, name: data.companyName || data.name || 'there' });
        }

        // 2. Get FCM tokens map
        const tokensSnapshot = await db.collection('fcmTokens').get();
        const fcmTokensMap = {};
        for (const doc of tokensSnapshot.docs) {
            const data = doc.data();
            fcmTokensMap[doc.id] = (data.tokens || []).map(t => t.token).filter(Boolean);
        }

        // 3. Process each user
        for (const user of allUsers) {
            try {
                const activity = await checkUserActivity(db, user.id, cutoffTime);

                if (!activity.hasActivity) {
                    results.push.skipped++;
                    results.whatsapp.skipped++;
                    continue;
                }

                const notification = buildNotification(activity);

                // ── Push Notification ──
                const userTokens = fcmTokensMap[user.id] || [];
                if (userTokens.length > 0) {
                    const sendResult = await sendToTokens(messaging, userTokens, notification);
                    if (sendResult.successCount > 0) results.push.sent++;
                    if (sendResult.invalidTokens.length > 0) {
                        const tokenDoc = tokensSnapshot.docs.find(d => d.id === user.id);
                        if (tokenDoc) {
                            await cleanupInvalidTokens(db, user.id, tokenDoc.data().tokens, sendResult.invalidTokens);
                            results.push.staleTokensCleaned += sendResult.invalidTokens.length;
                        }
                    }
                } else {
                    results.push.skipped++;
                }

                // ── WhatsApp Notification ──
                if (user.phone && WA_PHONE_NUMBER_ID && WA_ACCESS_TOKEN) {
                    const waResult = await sendWhatsAppIfAllowed(db, user, notification, todayKey);
                    if (waResult === 'sent') results.whatsapp.sent++;
                    else if (waResult === 'limited') results.whatsapp.limited++;
                    else if (waResult === 'error') results.whatsapp.errors++;
                    else results.whatsapp.skipped++;
                } else {
                    results.whatsapp.skipped++;
                }

            } catch (userError) {
                console.error(`Error processing user ${user.id}:`, userError);
                results.push.errors++;
            }
        }

        return Response.json({
            success: true,
            message: `Digest complete. Push: ${results.push.sent}, WA: ${results.whatsapp.sent}`,
            results,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Digest error:', error);
        return Response.json(
            { error: error.message || 'Failed to process digest' },
            { status: 500 }
        );
    }
}

// ── Activity Checking ──

async function checkUserActivity(db, userId, cutoffTime) {
    const activity = {
        hasActivity: false,
        newMessageCount: 0,
        newMessageSenders: [],
        meetingUpdates: [],
    };

    // Check for new messages
    const chatsSnapshot = await db.collection('chats')
        .where('participants', 'array-contains', userId)
        .get();

    for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();

        if (chatData.lastMessageAt && chatData.lastMessageSenderId !== userId && chatData.lastMessageSenderId !== 'system') {
            let lastMsgTime;
            if (chatData.lastMessageAt?.toDate) {
                lastMsgTime = chatData.lastMessageAt.toDate().toISOString();
            } else if (typeof chatData.lastMessageAt === 'string') {
                lastMsgTime = chatData.lastMessageAt;
            } else {
                continue;
            }

            if (lastMsgTime > cutoffTime) {
                activity.hasActivity = true;
                activity.newMessageCount++;
                const senderId = chatData.lastMessageSenderId;
                if (senderId && !activity.newMessageSenders.includes(senderId)) {
                    activity.newMessageSenders.push(senderId);
                }
            }
        }
    }

    // Check for meeting updates
    const [seekerMeetings, companyMeetings] = await Promise.all([
        db.collection('meetings').where('seekerId', '==', userId).where('updatedAt', '>', cutoffTime).get(),
        db.collection('meetings').where('companyId', '==', userId).where('updatedAt', '>', cutoffTime).get(),
    ]);

    const processedMeetingIds = new Set();

    for (const meetingDoc of [...seekerMeetings.docs, ...companyMeetings.docs]) {
        if (processedMeetingIds.has(meetingDoc.id)) continue;
        processedMeetingIds.add(meetingDoc.id);

        const meeting = meetingDoc.data();
        if (meeting.updatedAt > cutoffTime) {
            activity.hasActivity = true;
            activity.meetingUpdates.push({
                id: meetingDoc.id,
                status: meeting.status,
                scheduledAt: meeting.scheduledAt,
            });
        }
    }

    return activity;
}

// ── Notification Building ──

function buildNotification(activity) {
    let title = '';
    let body = '';

    const hasMessages = activity.newMessageCount > 0;
    const hasMeetings = activity.meetingUpdates.length > 0;

    if (hasMessages && hasMeetings) {
        title = '💬 New messages & meeting updates';
        const msgPart = activity.newMessageCount === 1 ? '1 new message' : `${activity.newMessageCount} new messages`;
        const mtgPart = activity.meetingUpdates.length === 1 ? '1 meeting update' : `${activity.meetingUpdates.length} meeting updates`;
        body = `You have ${msgPart} and ${mtgPart}. Tap to check!`;
    } else if (hasMessages) {
        title = activity.newMessageCount === 1 ? '💬 New message' : `💬 ${activity.newMessageCount} new messages`;
        body = activity.newMessageCount === 1
            ? 'You have 1 new message. Tap to read it!'
            : `You have ${activity.newMessageCount} unread messages. Tap to catch up!`;
    } else if (hasMeetings) {
        const meeting = activity.meetingUpdates[0];
        if (activity.meetingUpdates.length === 1) {
            const statusLabels = {
                'REQUESTED': 'New meeting request',
                'PENDING_ACCEPTANCE': 'Meeting awaiting approval',
                'SCHEDULED': 'Meeting confirmed',
                'CANCELLED': 'Meeting cancelled',
                'COMPLETED': 'Meeting completed',
                'RESCHEDULED': 'Meeting rescheduled',
            };
            title = `📅 ${statusLabels[meeting.status] || 'Meeting update'}`;
            body = meeting.scheduledAt
                ? `Scheduled for ${new Date(meeting.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
                : 'Tap to view details';
        } else {
            title = `📅 ${activity.meetingUpdates.length} meeting updates`;
            body = 'You have new meeting activity. Tap to review!';
        }
    }

    return { title, body, type: hasMessages ? 'message' : 'meeting' };
}

// ── FCM Push Sending ──

async function sendToTokens(messaging, tokens, notification) {
    const result = { successCount: 0, invalidTokens: [] };
    if (tokens.length === 0) return result;

    const message = {
        notification: { title: notification.title, body: notification.body },
        data: { type: notification.type, url: 'https://plyship.com', tag: `plyship-digest-${Date.now()}` },
        android: {
            priority: 'high',
            notification: { channelId: 'plyship_digest', icon: 'ic_notification', color: '#22C55E', sound: 'default' },
        },
        apns: {
            headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
            payload: { aps: { alert: { title: notification.title, body: notification.body }, badge: 1, sound: 'default', 'mutable-content': 1 } },
        },
        webpush: {
            headers: { Urgency: 'high' },
            notification: { title: notification.title, body: notification.body, icon: '/icon-192.png', badge: '/favicon.png', tag: 'plyship-digest' },
            fcmOptions: { link: 'https://plyship.com' },
        },
        tokens,
    };

    try {
        const response = await messaging.sendEachForMulticast(message);
        result.successCount = response.successCount;
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const code = resp.error?.code;
                if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered' || code === 'messaging/unregistered') {
                    result.invalidTokens.push(tokens[idx]);
                }
            }
        });
    } catch (error) {
        console.error('Error sending multicast:', error);
    }
    return result;
}

async function cleanupInvalidTokens(db, userId, existingTokens, invalidTokenStrings) {
    const invalidSet = new Set(invalidTokenStrings);
    const validTokens = (existingTokens || []).filter(t => !invalidSet.has(t.token));
    try {
        await db.collection('fcmTokens').doc(userId).set({ tokens: validTokens, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
        console.error(`Error cleaning tokens for ${userId}:`, error);
    }
}

// ── WhatsApp Notifications ──

/**
 * Send a WhatsApp message if the user hasn't exceeded 3/day limit.
 * Tracks sent count in Firestore: whatsappLog/{userId}/{todayKey}
 * 
 * @returns {'sent' | 'limited' | 'error' | 'skipped'}
 */
async function sendWhatsAppIfAllowed(db, user, notification, todayKey) {
    const phone = normalizePhone(user.phone);
    if (!phone) return 'skipped';

    try {
        // Check daily limit
        const logRef = db.collection('whatsappLog').doc(user.id);
        const logDoc = await logRef.get();
        const logData = logDoc.exists ? logDoc.data() : {};
        const todayCount = logData[todayKey] || 0;

        if (todayCount >= MAX_WHATSAPP_PER_DAY) {
            return 'limited';
        }

        // Send WhatsApp message
        const sent = await sendWhatsAppMessage(phone, user.name, notification);

        if (sent) {
            // Increment daily counter
            await logRef.set({ [todayKey]: todayCount + 1, lastSentAt: new Date().toISOString() }, { merge: true });
            return 'sent';
        } else {
            return 'error';
        }
    } catch (error) {
        console.error(`WhatsApp error for ${user.id}:`, error);
        return 'error';
    }
}

/**
 * Normalize phone number to WhatsApp format (E.164 without +).
 * Indian numbers: +91XXXXXXXXXX → 91XXXXXXXXXX
 */
function normalizePhone(phone) {
    if (!phone) return null;
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    // Remove leading +
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }
    // Indian numbers without country code
    if (cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }
    // Must be at least 10 digits
    if (cleaned.length < 10) return null;
    return cleaned;
}

/**
 * Send a WhatsApp message via Meta Cloud API.
 * Uses a simple text message (not a template) for utility notifications.
 * 
 * Note: For business-initiated messages to users who haven't messaged you
 * in the last 24 hours, you need an approved template. We use a text
 * message here which works within the 24-hour customer service window,
 * and fall back to a template for users outside that window.
 */
async function sendWhatsAppMessage(phone, userName, notification) {
    try {
        // First try sending as a template message (works for all users)
        const templateResult = await sendWhatsAppTemplate(phone, userName, notification);
        return templateResult;
    } catch (error) {
        console.error('WhatsApp send error:', error);
        return false;
    }
}

/**
 * Send WhatsApp message using a template.
 * Template name: "plyship_update" — you must create this in Meta Business Manager.
 * 
 * Template format:
 *   Hi {{1}}, {{2}} Check it out: https://plyship.com
 * 
 * If the template doesn't exist yet, falls back to a plain text message
 * (which only works within the 24-hour service window).
 */
async function sendWhatsAppTemplate(phone, userName, notification) {
    const url = `${WA_API_URL}/${WA_PHONE_NUMBER_ID}/messages`;

    // Try template first
    const templatePayload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
            name: 'plyship_update',
            language: { code: 'en' },
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: userName || 'there' },
                        { type: 'text', text: notification.body },
                    ],
                },
            ],
        },
    };

    let response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
    });

    if (response.ok) {
        const data = await response.json();
        console.log(`WhatsApp template sent to ${phone}: ${data.messages?.[0]?.id}`);
        return true;
    }

    // Template might not exist yet — try plain text (works within 24hr window)
    const textPayload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: {
            body: `🔔 *PLYSHIP Update*\n\nHi ${userName || 'there'}, ${notification.body}\n\n👉 https://plyship.com`,
        },
    };

    response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(textPayload),
    });

    if (response.ok) {
        const data = await response.json();
        console.log(`WhatsApp text sent to ${phone}: ${data.messages?.[0]?.id}`);
        return true;
    }

    const errorData = await response.json().catch(() => ({}));
    console.error(`WhatsApp send failed for ${phone}:`, response.status, errorData);
    return false;
}
