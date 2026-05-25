/**
 * Razorpay Helper — Centralised checkout launcher for PLYSHIP.
 *
 * Handles:
 * 1. UPI as the primary / default payment method
 * 2. `webview_intent: true` so UPI intent flow works inside Capacitor WebViews
 * 3. Dynamic script loading (only once)
 * 4. Fallback for devices without a UPI app (card, netbanking shown automatically)
 */

// Detect if we're running inside a Capacitor / native WebView
function isCapacitorApp() {
    return !!(
        window.Capacitor ||
        window.webkit?.messageHandlers?.bridge ||
        navigator.userAgent.includes('CapacitorApp')
    );
}

// Detect Android WebView specifically — webview_intent is Android-only
function isAndroidWebView() {
    return isCapacitorApp() && /android/i.test(navigator.userAgent);
}

/**
 * Build the Razorpay checkout options with UPI as the default method.
 *
 * @param {Object} params
 * @param {string} params.key        — Razorpay key_id (public)
 * @param {number} params.amount     — Amount in paise (server already sends this)
 * @param {string} params.currency   — "INR"
 * @param {string} params.orderId    — Razorpay order id
 * @param {string} params.name       — Business name shown in checkout
 * @param {string} params.description — Payment description
 * @param {Object} params.prefill    — { name, email, contact }
 * @param {Function} params.handler  — Success callback  (response) => {}
 * @param {Function} params.onDismiss — Modal dismiss callback
 * @returns {Object}  options ready for `new Razorpay(options).open()`
 */
export function buildRazorpayOptions({
    key,
    amount,
    currency,
    orderId,
    name = 'Plyship',
    description = 'Service Deposit — Interior Consultation',
    prefill = {},
    handler,
    onDismiss,
}) {
    const inWebView = isCapacitorApp();
    const inAndroidWebView = isAndroidWebView();

    const options = {
        key,
        amount,
        currency,
        name,
        description,
        order_id: orderId,
        handler,
        prefill: {
            ...prefill,
            method: 'upi',   // Default to UPI tab when checkout opens
        },
        theme: { color: '#22C55E' },

        // ──── UPI-first configuration ────
        // On mobile WebViews this triggers the UPI intent flow (opens
        // GPay / PhonePe / Paytm natively, then returns to the app).
        // On iOS the UPI Collect flow is still supported per NPCI exemptions
        // (iOS mobile apps are exempt from the Feb 2026 VPA deprecation).
        config: {
            display: {
                // Show UPI block first, then other methods
                blocks: {
                    banks: {
                        name: 'Pay via UPI',
                        instruments: [
                            { method: 'upi' },
                        ],
                    },
                },
                sequence: ['block.banks'],
                preferences: {
                    show_default_blocks: true, // also show card/netbanking below
                },
            },
        },

        // webview_intent is Android-only. On iOS it causes unwanted Safari
        // redirects. On Android it enables the native UPI intent deep-link.
        ...(inAndroidWebView && { webview_intent: true }),

        modal: {
            ondismiss: onDismiss || (() => {}),
            // Prevent the checkout modal from closing on an Escape press
            escape: true,
            // Confirm before closing during payment
            confirm_close: true,
            // Use animation
            animation: true,
        },
    };

    return options;
}

/**
 * Ensure the Razorpay checkout.js script is loaded, then open checkout.
 *
 * @param {Object} options — The options object from `buildRazorpayOptions`.
 */
export function openRazorpayCheckout(options) {
    if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
    }

    // Dynamically load the Razorpay script (only once)
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
        const rzp = new window.Razorpay(options);
        rzp.open();
    };
    document.body.appendChild(script);
}
