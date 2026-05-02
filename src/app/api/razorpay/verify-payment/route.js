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

        // Payment verified successfully
        return Response.json({
            success: true,
            verified: true,
            paymentId: razorpay_payment_id,
        });
    } catch (error) {
        return Response.json(
            { error: 'Payment verification failed' },
            { status: 500 }
        );
    }
}
