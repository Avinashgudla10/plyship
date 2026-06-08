/**
 * WhatsApp Business API — Webhook Endpoint
 * 
 * Handles two responsibilities:
 * 1. GET  → Meta webhook verification (hub.verify_token challenge)
 * 2. POST → Incoming messages & status updates from WhatsApp
 * 
 * Environment variable required:
 *   WHATSAPP_VERIFY_TOKEN — must match the token you entered in Meta Dashboard
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── GET: Webhook Verification ──
// Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge
// We must respond with the challenge value if the token matches.

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ WhatsApp webhook verified successfully');
        return new Response(challenge, { status: 200 });
    }

    console.warn('❌ WhatsApp webhook verification failed', { mode, token });
    return new Response('Forbidden', { status: 403 });
}

// ── POST: Incoming Messages & Status Updates ──
// Meta delivers message events, delivery receipts, and read receipts here.

export async function POST(request) {
    try {
        const body = await request.json();

        // Meta always wraps data in body.entry[].changes[]
        const entries = body?.entry || [];
        for (const entry of entries) {
            const changes = entry?.changes || [];
            for (const change of changes) {
                const value = change?.value;
                if (!value) continue;

                // ── Incoming Messages ──
                const messages = value.messages || [];
                for (const message of messages) {
                    console.log('📩 WhatsApp message received:', {
                        from: message.from,
                        type: message.type,
                        timestamp: message.timestamp,
                        text: message.text?.body || '(non-text)',
                        id: message.id,
                    });

                    // TODO: Process incoming messages
                    // e.g., auto-reply, store in Firestore, forward to support, etc.
                }

                // ── Status Updates (sent, delivered, read, failed) ──
                const statuses = value.statuses || [];
                for (const status of statuses) {
                    console.log('📊 WhatsApp status update:', {
                        recipientId: status.recipient_id,
                        status: status.status,
                        timestamp: status.timestamp,
                        messageId: status.id,
                    });
                }
            }
        }

        // Meta expects a 200 response — anything else triggers retries
        return Response.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error('WhatsApp webhook error:', error);
        // Still return 200 to prevent Meta from retrying bad payloads
        return Response.json({ success: true }, { status: 200 });
    }
}
