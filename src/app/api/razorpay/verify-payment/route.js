export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            userId,
            amount
        } = await request.json();

        // Check if key is configured
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return Response.json(
                { error: 'Payment gateway not configured' },
                { status: 503 }
            );
        }

        // Dynamic import crypto
        const crypto = await import('crypto');

        // Verify signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature;

        if (!isAuthentic) {
            return Response.json(
                { error: 'Invalid payment signature' },
                { status: 400 }
            );
        }

        // ── Amount cross-check (defense in depth) ──
        // The signature proves the payment is authentic for this order, but the
        // client separately tells us `amount`. Fetch the order from Razorpay and
        // confirm the claimed amount matches what was actually paid, so a tampered
        // client can't claim a larger credit than it paid for. If the lookup fails
        // (transient API issue), we fall back to signature-only verification rather
        // than block a legitimate payment. `verifiedAmount` is authoritative.
        let verifiedAmount = amount;
        try {
            const keyId = process.env.RAZORPAY_KEY_ID;
            const keySecret = process.env.RAZORPAY_KEY_SECRET;
            if (keyId && keySecret) {
                const authB64 = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
                const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
                    headers: { 'Authorization': `Basic ${authB64}` },
                });
                if (orderRes.ok) {
                    const order = await orderRes.json();
                    const orderRupees = Math.floor((order.amount || 0) / 100);
                    verifiedAmount = orderRupees;
                    if (amount != null && Number(amount) !== orderRupees) {
                        return Response.json(
                            { error: 'Payment amount mismatch', verifiedAmount: orderRupees },
                            { status: 400 }
                        );
                    }
                }
            }
        } catch {
            // Non-fatal: keep signature-only verification.
        }

        // Payment verified successfully
        return Response.json({
            success: true,
            verified: true,
            paymentId: razorpay_payment_id,
            verifiedAmount,
        });
    } catch (error) {
        return Response.json(
            { error: 'Payment verification failed' },
            { status: 500 }
        );
    }
}
