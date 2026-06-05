import UIKit\r
import Capacitor\r
import UserNotifications\r
\r
@UIApplicationMain\r
class AppDelegate: UIResponder, UIApplicationDelegate {\r
\r
    var window: UIWindow?\r
\r
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {\r
        // Register for remote (push) notifications\r
        registerForPushNotifications(application)\r
        return true\r
    }\r
\r
    func applicationWillResignActive(_ application: UIApplication) {}\r
    func applicationDidEnterBackground(_ application: UIApplication) {}\r
    func applicationWillEnterForeground(_ application: UIApplication) {}\r
    func applicationDidBecomeActive(_ application: UIApplication) {\r
        // Clear badge count when user opens the app\r
        application.applicationIconBadgeNumber = 0\r
    }\r
    func applicationWillTerminate(_ application: UIApplication) {}\r
\r
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {\r
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)\r
    }\r
\r
    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {\r
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)\r
    }\r
\r
    // MARK: - Push Notifications\r
\r
    /// Register for push notifications.\r
    /// On iOS 10+, we use UNUserNotificationCenter to request authorization.\r
    /// The APNs token is then forwarded to FCM by the Firebase SDK in the WebView.\r
    private func registerForPushNotifications(_ application: UIApplication) {\r
        let center = UNUserNotificationCenter.current()\r
        center.delegate = self\r
\r
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in\r
            if let error = error {\r
                print("PLYSHIP: Push notification authorization error: \\(error.localizedDescription)")\r
                return\r
            }\r
\r
            if granted {\r
                DispatchQueue.main.async {\r
                    application.registerForRemoteNotifications()\r
                }\r
            }\r
        }\r
    }\r
\r
    /// Called when APNs registration succeeds.\r
    /// The token is handled by Firebase SDK in the WebView layer.\r
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\r
        // The FCM Web SDK in the WebView handles token mapping.\r
        // For native FCM integration, you would call:\r
        // Messaging.messaging().apnsToken = deviceToken\r
        // But since we use the Web SDK via WebView, the token is managed there.\r
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }\r
        let token = tokenParts.joined()\r
        print("PLYSHIP: APNs device token: \\(token)")\r
    }\r
\r
    /// Called if APNs registration fails.\r
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\r
        print("PLYSHIP: Failed to register for remote notifications: \\(error.localizedDescription)")\r
    }\r
}\r
\r
// MARK: - UNUserNotificationCenterDelegate\r
\r
extension AppDelegate: UNUserNotificationCenterDelegate {\r
\r
    /// Called when a notification is received while the app is in the foreground.\r
    /// We show it as a banner so the user sees it even when the app is open.\r
    func userNotificationCenter(\r
        _ center: UNUserNotificationCenter,\r
        willPresent notification: UNNotification,\r
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void\r
    ) {\r
        // Show banner + sound even when app is in foreground\r
        if #available(iOS 14.0, *) {\r
            completionHandler([.banner, .badge, .sound])\r
        } else {\r
            completionHandler([.alert, .badge, .sound])\r
        }\r
    }\r
\r
    /// Called when the user taps a notification.\r
    /// We don't need to navigate since the app opens to the WebView which\r
    /// handles its own routing.\r
    func userNotificationCenter(\r
        _ center: UNUserNotificationCenter,\r
        didReceive response: UNNotificationResponse,\r
        withCompletionHandler completionHandler: @escaping () -> Void\r
    ) {\r
        // The WebView will handle navigation based on the current state.\r
        // Clear badge on tap.\r
        UIApplication.shared.applicationIconBadgeNumber = 0\r
        completionHandler()\r
    }\r
}\r
