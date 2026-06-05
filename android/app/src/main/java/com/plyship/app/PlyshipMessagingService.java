package com.plyship.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Firebase Messaging Service for PLYSHIP.
 *
 * Handles:
 * 1. Incoming push notifications (both data-only and notification+data)
 * 2. FCM token refresh — when the token rotates, the WebView JS will
 *    pick it up on next app launch via the FCM client SDK.
 *
 * The server sends notifications via FCM Admin SDK as "notification+data"
 * messages, so Android auto-displays them when the app is in background.
 * This service handles the foreground case — when the user is actively
 * using the app, we show a heads-up notification.
 */
public class PlyshipMessagingService extends FirebaseMessagingService {

    private static final String TAG = "PlyshipFCM";
    private static final String CHANNEL_ID = "plyship_digest";
    private static final String CHANNEL_NAME = "PLYSHIP Updates";
    private static final String CHANNEL_DESC = "New messages, meeting updates, and activity digests";

    /**
     * Called when a new FCM token is generated.
     * This happens on first app start, after uninstall/reinstall, or when
     * the previous token is invalidated.
     *
     * The WebView FCM client library (firebase/messaging) also tracks tokens,
     * so we don't need to manually push this to Firestore from native code.
     * The JS layer handles it on next page load.
     */
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "FCM token refreshed");
        // Token will be picked up by the WebView FCM client on next load.
        // No native-to-Firestore sync needed since the app is a WebView wrapper.
    }

    /**
     * Called when a message is received while the app is in the foreground.
     *
     * When the app is in the background, the system tray handles
     * "notification" type messages automatically. This method is only
     * called for foreground delivery.
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());

        // Extract notification content
        String title = "PLYSHIP";
        String body = "You have a new update";

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle() != null
                    ? remoteMessage.getNotification().getTitle() : title;
            body = remoteMessage.getNotification().getBody() != null
                    ? remoteMessage.getNotification().getBody() : body;
        }

        // Fallback to data payload if notification payload is empty
        if (remoteMessage.getData().containsKey("title")) {
            title = remoteMessage.getData().get("title");
        }
        if (remoteMessage.getData().containsKey("body")) {
            body = remoteMessage.getData().get("body");
        }

        // Show the notification
        showNotification(title, body, remoteMessage.getData().get("type"));
    }

    /**
     * Build and show a local notification.
     * Creates the notification channel on Android 8+ if it doesn't exist.
     */
    private void showNotification(String title, String body, String type) {
        // Create notification channel (required for Android 8+)
        createNotificationChannel();

        // Build intent to open the app when notification is tapped
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (type != null) {
            intent.putExtra("notification_type", type);
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        // Default notification sound
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        // Build the notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher) // Use app icon
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setColor(getResources().getColor(R.color.plyship_green, null))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body));

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (notificationManager != null) {
            // Use a consistent tag so digest notifications replace each other
            // (only the latest digest is shown, not stacking old ones)
            notificationManager.notify("plyship_digest", 0, builder.build());
        }
    }

    /**
     * Create the notification channel for Android 8+.
     * Channels are required — without one, notifications are silently dropped.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{100, 50, 200});

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
