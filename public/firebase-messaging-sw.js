/**
 * Firebase Messaging Service Worker
 * 
 * This service worker handles push notifications when the app is in the background.
 * It is registered by the FCM client library and receives push messages via FCM.
 * 
 * For foreground messages, the main app (fcm.js) handles display via in-app toasts.
 */

/* eslint-disable no-undef */

// Import Firebase scripts for the service worker environment
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyDE3lwuYJdTYj7dIYJUqcRBtdP_MNXJ0DE",
    authDomain: "plyship-277bf.firebaseapp.com",
    projectId: "plyship-277bf",
    storageBucket: "plyship-277bf.firebasestorage.app",
    messagingSenderId: "109538013062",
    appId: "1:109538013062:web:4394fc1e6b50bb405a8607",
    measurementId: "G-LXDZ80TMM5"
});

const messaging = firebase.messaging();

/**
 * Handle background messages.
 * This is called when:
 * - The app is in the background (minimized/different tab)
 * - The app is completely closed (service worker still runs)
 * 
 * For "notification" type messages sent from the server, the browser
 * auto-displays them. This handler is for "data" messages that
 * need custom display logic.
 */
messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || payload.data?.title || 'PLYSHIP';
    const notificationBody = payload.notification?.body || payload.data?.body || 'You have a new update';

    const notificationOptions = {
        body: notificationBody,
        icon: '/icon-192.png',
        badge: '/favicon.png',
        tag: payload.data?.tag || 'plyship-notification',
        // Vibration pattern: short-pause-long
        vibrate: [100, 50, 200],
        // Auto-close after 10 seconds
        requireInteraction: false,
        // Data to pass when notification is clicked
        data: {
            url: payload.data?.url || 'https://plyship.com',
            type: payload.data?.type || 'general',
            ...payload.data,
        },
        // Actions (Android supports these in Chrome)
        actions: payload.data?.type === 'message' ? [
            { action: 'reply', title: '💬 Open Chat' }
        ] : payload.data?.type === 'meeting' ? [
            { action: 'view', title: '📅 View Meeting' }
        ] : [],
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handle notification click.
 * Opens the app to the relevant page when the user taps the notification.
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || 'https://plyship.com';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If the app is already open, focus it and navigate
            for (const client of clientList) {
                if (client.url.includes('plyship.com') && 'focus' in client) {
                    client.focus();
                    // Post a message to the app to navigate to the right tab
                    client.postMessage({
                        type: 'NOTIFICATION_CLICK',
                        data: event.notification.data,
                    });
                    return;
                }
            }
            // Otherwise, open a new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
