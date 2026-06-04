export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/razorpay/verify-order
 *
 * Server-side order status check — fetches the order directly from Razorpay
 * and verifies if payment was captured. This handles the iOS edge case where
 * the Razorpay handler callback doesn't fire after a UPI intent flow because
 * the WKWebView context may be invalidated when the user switches apps.
 *
 * Called by the client when:
 * - The Razorpay modal is dismissed (onDismiss)
 * - The app resumes from background (visibilitychange)
 *
 * If the order is "paid", the server returns the payment details so the
 * client can credit the wallet.
 */
export async function POST(request) {
    try {
        const { orderId, userId } = await request.json();

        if (!orderId) {
            return Response.json(
                { error: 'Missing orderId' },
                { status: 400 }
            );
        }

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            return Response.json(
                { error: 'Payment gateway not configured' },
                { status: 503 }
            );
        }

        // Fetch order details directly from Razorpay
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

        const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
            },
        });

        if (!orderRes.ok) {
            return Response.json(
                { error: 'Failed to fetch order status from Razorpay' },
                { status: 502 }
            );
        }

        const order = await orderRes.json();

        // Check if order is paid
        if (order.status !== 'paid') {
            return Response.json({
                success: false,
                orderStatus: order.status,
                message: order.status === 'created'
                    ? 'Payment not yet completed'
                    : `Order status: ${order.status}`,
            });
        }

        // Order is paid — fetch the payment(s) for this order
        const paymentsRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
            },
        });

        if (!paymentsRes.ok) {
            return Response.json(
                { error: 'Failed to fetch payment details' },
                { status: 502 }
            );
        }

        const paymentsData = await paymentsRes.json();
        const payments = paymentsData.items || [];

        // Find the captured payment
        const capturedPayment = payments.find(p => p.status === 'captured');

        if (!capturedPayment) {
            return Response.json({
                success: false,
                orderStatus: 'paid',
                message: 'Order paid but no captured payment found',
            });
        }

        // Return the payment details so the client can credit the wallet
        return Response.json({
            success: true,
            orderStatus: 'paid',
            paymentId: capturedPayment.id,
            amount: Math.floor(capturedPayment.amount / 100), // paise → rupees
            method: capturedPayment.method,
            orderId: orderId,
        });
    } catch (error) {
        console.error('verify-order error:', error);
        return Response.json(
            { error: 'Failed to verify order status' },
            { status: 500 }
        );
    }
}
