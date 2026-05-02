export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
    try {
        const body = await request.json();
        const { amount, userId, currency = 'INR' } = body;

        // Check if keys are configured
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            return Response.json(
                { error: 'Payment gateway not configured. Please contact support.' },
                { status: 503 }
            );
        }

        // Validate amount
        if (!amount || amount < 500) {
            return Response.json(
                { error: 'Minimum top-up amount is ₹500' },
                { status: 400 }
            );
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
                    type: 'WALLET_TOP_UP',
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
