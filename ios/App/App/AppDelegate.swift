import UIKit
import Capacitor
import UserNotifications
import FirebaseAuth

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Register for remote (push) notifications
        registerForPushNotifications(application)
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {
        // Clear badge count when user opens the app
        application.applicationIconBadgeNumber = 0
    }
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // MARK: - Push Notifications

    /// Register for push notifications.
    /// On iOS 10+, we use UNUserNotificationCenter to request authorization.
    /// The APNs token is then forwarded to FCM by the Firebase SDK in the WebView.
    private func registerForPushNotifications(_ application: UIApplication) {
        let center = UNUserNotificationCenter.current()
        center.delegate = self

        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error = error {
                print("PLYSHIP: Push notification authorization error: \(error.localizedDescription)")
                return
            }

            if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }
    }

    /// Called when APNs registration succeeds.
    /// The token is forwarded to Firebase Auth so native Phone Auth can verify
    /// the app via a silent APNs push (no reCAPTCHA). FCM token mapping is still
    /// handled by the Web SDK in the WebView.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Native Firebase Phone Auth: hand the APNs token to FirebaseAuth so it
        // can perform silent-push app verification instead of showing reCAPTCHA.
        // Use .unknown so Firebase auto-detects sandbox vs. production APNs.
        Auth.auth().setAPNSToken(deviceToken, type: .unknown)

        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("PLYSHIP: APNs device token: \(token)")
    }

    /// Called if APNs registration fails.
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("PLYSHIP: Failed to register for remote notifications: \(error.localizedDescription)")
    }

    /// Firebase Phone Auth verifies the app by sending a silent push notification.
    /// We must let FirebaseAuth intercept it here; otherwise verification falls
    /// back to reCAPTCHA. Returns early if the push was an auth-verification push.
    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        if Auth.auth().canHandleNotification(userInfo) {
            completionHandler(.noData)
            return
        }
        // Not an auth push — nothing else to fetch.
        completionHandler(.newData)
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate: UNUserNotificationCenterDelegate {

    /// Called when a notification is received while the app is in the foreground.
    /// We show it as a banner so the user sees it even when the app is open.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner + sound even when app is in foreground
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .badge, .sound])
        } else {
            completionHandler([.alert, .badge, .sound])
        }
    }

    /// Called when the user taps a notification.
    /// We don't need to navigate since the app opens to the WebView which
    /// handles its own routing.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // The WebView will handle navigation based on the current state.
        // Clear badge on tap.
        UIApplication.shared.applicationIconBadgeNumber = 0
        completionHandler()
    }
}
