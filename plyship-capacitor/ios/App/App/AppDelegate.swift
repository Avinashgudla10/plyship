import UIKit
import Capacitor
import Network

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    // MARK: - Network Monitoring
    private let networkMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.plyship.networkMonitor")
    private var offlineBanner: UIView?
    private var isConnected = true

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        startNetworkMonitoring()
        return true
    }

    // MARK: - Network Monitoring & Offline Banner

    private func startNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied
            DispatchQueue.main.async {
                guard let self = self else { return }
                let wasConnected = self.isConnected
                self.isConnected = connected

                if connected && !wasConnected {
                    self.hideOfflineBanner()
                } else if !connected && wasConnected {
                    self.showOfflineBanner()
                }
            }
        }
        networkMonitor.start(queue: monitorQueue)
    }

    private func showOfflineBanner() {
        guard offlineBanner == nil, let rootVC = window?.rootViewController else { return }

        let safeTop = rootVC.view.safeAreaInsets.top
        let bannerHeight: CGFloat = 36

        let banner = UIView()
        banner.backgroundColor = UIColor(red: 220/255, green: 38/255, blue: 38/255, alpha: 0.95)
        banner.frame = CGRect(x: 0, y: -(safeTop + bannerHeight), width: rootVC.view.bounds.width, height: safeTop + bannerHeight)
        banner.autoresizingMask = [.flexibleWidth]
        banner.isUserInteractionEnabled = false

        let label = UILabel()
        label.text = "No Internet Connection"
        label.textColor = .white
        label.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        label.textAlignment = .center
        label.frame = CGRect(x: 0, y: safeTop, width: banner.bounds.width, height: bannerHeight)
        label.autoresizingMask = [.flexibleWidth]
        banner.addSubview(label)

        rootVC.view.addSubview(banner)
        offlineBanner = banner

        UIView.animate(withDuration: 0.3, delay: 0, options: .curveEaseOut) {
            banner.frame.origin.y = 0
        }
    }

    private func hideOfflineBanner() {
        guard let banner = offlineBanner else { return }
        offlineBanner = nil

        UIView.animate(withDuration: 0.25, animations: {
            banner.frame.origin.y = -banner.bounds.height
        }) { _ in
            banner.removeFromSuperview()
        }
    }

    // MARK: - App Lifecycle

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}

    func applicationWillTerminate(_ application: UIApplication) {
        networkMonitor.cancel()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
