/**
 * Firebase Cloud Messaging (FCM) utilities for push notifications.
 * 
 * Handles THREE environments:
 * 1. Native Android WebView → uses window.PlyshipPush.getToken() bridge
 * 2. Native iOS WebView → uses window.webkit.messageHandlers.getPushToken bridge
 * 3. Web browser/PWA → uses firebase/messaging SDK with service workers
 * 
 * Push notification flow:
 * 1. User logs in → requestAndSaveFCMToken() is called
 * 2. Detects platform → gets FCM token via the appropriate method
 * 3. Token is saved to Firestore under fcmTokens/{userId}
 * 4. Server-side cron job reads tokens and sends notifications via FCM Admin SDK
 * 5. Native app shows notification via OS notification system
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// ── Platform Detection ──

/**
 * Detect if we're running inside a native Android WebView
 */
function isAndroidNative() {
    return typeof window !== 'undefined' && !!window.PlyshipPush;
}

/**
 * Detect if we're running inside a native iOS WebView (WKWebView)
 */
function isIOSNative() {
    return typeof window !== 'undefined' &&
        !!window.webkit?.messageHandlers?.getPushToken;
}

/**
 * Detect if we're running in a regular web browser (not native WebView)
 */
function isWebBrowser() {
    return typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        !isAndroidNative() &&
        !isIOSNative();
}

/**
 * Detect the current platform for tagging tokens
 * @returns {'ios' | 'android' | 'web'}
 */
function detectPlatform() {
    if (isAndroidNative()) return 'android';
    if (isIOSNative()) return 'ios';
    return 'web';
}

// ── Token Retrieval (Platform-Specific) ──

/**
 * Get FCM token from Android native bridge.
 * The bridge is synchronous (runs on a background thread in Java).
 * @returns {Promise<string|null>}
 */
async function getAndroidToken() {
    try {
        const token = window.PlyshipPush.getToken();
        if (token && token !== 'ERROR') {
            return token;
        }
        return null;
    } catch (error) {
        console.error('Android FCM bridge error:', error);
        return null;
    }
}

/**
 * Get FCM token from iOS native bridge.
 * Uses WKScriptMessageHandler — the result comes back via a callback.
 * @returns {Promise<string|null>}
 */
function getIOSToken() {
    return new Promise((resolve) => {
        // Set up callback that iOS will call with the token
        window.__plyship_push_callback = (token) => {
            window.__plyship_push_callback = null;
            if (token && token !== 'ERROR') {
                resolve(token);
            } else {
                resolve(null);
            }
        };

        // Timeout after 10 seconds
        setTimeout(() => {
            if (window.__plyship_push_callback) {
                window.__plyship_push_callback = null;
                resolve(null);
            }
        }, 10000);

        // Request token from native
        window.webkit.messageHandlers.getPushToken.postMessage('fetch');
    });
}

/**
 * Get FCM token from web browser using firebase/messaging SDK.
 * Requires service worker and notification permission.
 * @returns {Promise<string|null>}
 */
async function getWebToken() {
    try {
        // Dynamically import firebase/messaging only when needed
        // (avoids errors in native WebViews where service workers don't exist)
        const { getMessaging, getToken } = await import('firebase/messaging');
        const { default: app } = await import('./firebase');

        const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY || '';
        if (!VAPID_KEY) {
            console.warn('FCM VAPID key not configured');
            return null;
        }

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return null;
        }

        // Register service worker
        let swRegistration = null;
        if ('serviceWorker' in navigator) {
            try {
                swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            } catch (e) {
                console.warn('Service worker registration failed:', e);
            }
        }

        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration || undefined,
        });

        return token || null;
    } catch (error) {
        console.error('Web FCM token error:', error);
        return null;
    }
}

// ── Firestore Token Storage ──

/**
 * Save an FCM token to Firestore for a user.
 * Stores multiple tokens per user (one per device/browser).
 * 
 * Document structure: fcmTokens/{userId}
 * {
 *   tokens: [
 *     { token: "...", platform: "ios|android|web", createdAt: "...", lastRefresh: "..." }
 *   ],
 *   updatedAt: "..."
 * }
 */
async function saveTokenToFirestore(userId, token) {
    if (!userId || !token) return;

    const platform = detectPlatform();
    const now = new Date().toISOString();
    const tokenDocRef = doc(db, 'fcmTokens', userId);

    try {
        const tokenDoc = await getDoc(tokenDocRef);

        if (tokenDoc.exists()) {
            const data = tokenDoc.data();
            const existingTokens = data.tokens || [];

            // Check if this token already exists — if so, just update lastRefresh
            const existingIdx = existingTokens.findIndex(t => t.token === token);

            if (existingIdx >= 0) {
                existingTokens[existingIdx].lastRefresh = now;
                await setDoc(tokenDocRef, {
                    tokens: existingTokens,
                    updatedAt: now,
                }, { merge: true });
            } else {
                // New token — keep max 5 per user to avoid stale accumulation
                const updatedTokens = [
                    ...existingTokens.slice(-4),
                    { token, platform, createdAt: now, lastRefresh: now }
                ];
                await setDoc(tokenDocRef, {
                    tokens: updatedTokens,
                    updatedAt: now,
                }, { merge: true });
            }
        } else {
            // First token for this user
            await setDoc(tokenDocRef, {
                tokens: [{ token, platform, createdAt: now, lastRefresh: now }],
                updatedAt: now,
            });
        }
    } catch (error) {
        console.error('Error saving FCM token:', error);
    }
}

/**
 * Remove an FCM token from Firestore (on logout)
 */
async function removeTokenFromFirestore(userId, token) {
    if (!userId || !token) return;

    const tokenDocRef = doc(db, 'fcmTokens', userId);

    try {
        const tokenDoc = await getDoc(tokenDocRef);
        if (tokenDoc.exists()) {
            const data = tokenDoc.data();
            const filteredTokens = (data.tokens || []).filter(t => t.token !== token);
            await setDoc(tokenDocRef, {
                tokens: filteredTokens,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error removing FCM token:', error);
    }
}

// ── Public API ──

/**
 * Main entry point: Detect platform, get token, save to Firestore.
 * Call this when the user logs in or the app loads for an authenticated user.
 * 
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<string|null>} The FCM token, or null if not available
 */
export async function requestAndSaveFCMToken(userId) {
    if (typeof window === 'undefined') return null;

    let token = null;

    if (isAndroidNative()) {
        // Android native — use Java bridge
        token = await getAndroidToken();
    } else if (isIOSNative()) {
        // iOS native — use WKScriptMessageHandler bridge
        token = await getIOSToken();
    } else if (isWebBrowser()) {
        // Web browser — use firebase/messaging SDK
        token = await getWebToken();
    } else {
        // Unsupported environment
        return null;
    }

    if (!token) {
        return null;
    }

    // Save to Firestore
    await saveTokenToFirestore(userId, token);

    // Store locally for cleanup on logout
    try {
        localStorage.setItem('plyship_fcm_token', token);
    } catch (e) {
        // localStorage not available
    }

    return token;
}

/**
 * Clean up FCM token on logout.
 * Removes the current device's token from Firestore.
 * 
 * @param {string} userId 
 */
export async function cleanupFCMToken(userId) {
    if (!userId) return;

    try {
        const token = localStorage.getItem('plyship_fcm_token');
        if (token) {
            await removeTokenFromFirestore(userId, token);
            localStorage.removeItem('plyship_fcm_token');
        }
    } catch (error) {
        console.error('Error cleaning up FCM token:', error);
    }
}

/**
 * Set up foreground message handler for web browsers.
 * On native apps, foreground notifications are handled by the native layer.
 * 
 * @param {function} onMessageCallback - Called with the message payload
 * @returns {function} Unsubscribe function
 */
export function setupForegroundMessaging(onMessageCallback) {
    // Only works in web browsers, not native WebViews
    if (!isWebBrowser()) return () => {};

    try {
        // Dynamic import to avoid errors in native WebViews
        import('firebase/messaging').then(({ getMessaging, onMessage }) => {
            import('./firebase').then(({ default: app }) => {
                const messaging = getMessaging(app);
                onMessage(messaging, (payload) => {
                    if (onMessageCallback) {
                        onMessageCallback(payload);
                    }
                });
            });
        });
    } catch (error) {
        console.error('Error setting up foreground messaging:', error);
    }

    return () => {};
}

/**
 * Set up native iOS token refresh listener.
 * When iOS refreshes the FCM token, the native layer calls
 * window.__plyship_push_token_refresh(newToken).
 * We listen for that and update Firestore.
 * 
 * @param {string} userId - The authenticated user's ID
 */
export function setupNativeTokenRefresh(userId) {
    if (typeof window === 'undefined' || !userId) return;

    window.__plyship_push_token_refresh = async (newToken) => {
        if (newToken && newToken !== 'ERROR') {
            await saveTokenToFirestore(userId, newToken);
            try {
                localStorage.setItem('plyship_fcm_token', newToken);
            } catch (e) {}
        }
    };
}
