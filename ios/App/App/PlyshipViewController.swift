import UIKit
import Capacitor
import WebKit
import Network
import CoreLocation
import Contacts
import FirebaseCore
import FirebaseMessaging

/// Custom Capacitor WebView controller for PLYSHIP.
/// Features:
/// 1. Pull-to-refresh via injected JavaScript (native UIRefreshControl doesn't work with overflow:hidden pages)
/// 2. External links open in Safari, plyship.com stays in-app
/// 3. Network monitoring with offline banner + error page handling
/// 4. Auto-reload when connectivity is restored
/// 5. Native CLLocationManager authorization so WebView navigator.geolocation works
class PlyshipViewController: CAPBridgeViewController {

    // MARK: - Properties

    private static let internalHosts: Set<String> = [
        "plyship.com",
        "www.plyship.com"
    ]

    private let networkMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.plyship.network")
    private var isConnected = true
    private var didFailToLoad = false

    // Offline UI
    private var offlineBanner: UIView?
    private var offlineFullScreen: UIView?

    // Location: WKWebView's navigator.geolocation silently fails unless the
    // native app has requested CLLocationManager authorization first.
    // We hold a strong reference to keep the manager alive.
    private lazy var locationManager: CLLocationManager = {
        let mgr = CLLocationManager()
        mgr.delegate = self
        mgr.desiredAccuracy = kCLLocationAccuracyBest
        return mgr
    }()

    // Contacts: CNContactStore for reading device address book
    private let contactStore = CNContactStore()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        // Configure Firebase SDK (required for FCM push tokens)
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        Messaging.messaging().delegate = self
        webView?.navigationDelegate = self
        webView?.uiDelegate = self
        startNetworkMonitoring()
        requestNativeLocationPermission()
        registerContactsBridge()
        registerPushBridge()
    }

    /// Request native location authorization. This ensures the OS-level
    /// "Allow <App> to use your location?" prompt fires. Once the user
    /// grants "While Using the App", we escalate to "Always" so the
    /// option appears in Settings.
    private func requestNativeLocationPermission() {
        let status = locationManager.authorizationStatus
        switch status {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse:
            // Escalate to "Always" — iOS will show the upgrade prompt
            locationManager.requestAlwaysAuthorization()
        default:
            break
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Inject pull-to-refresh script after WebView is visible
        injectPullToRefreshScript()
    }

    deinit {
        networkMonitor.cancel()
    }

    // MARK: - Pull to Refresh (JavaScript Injection)
    // Native UIRefreshControl doesn't work because the web page uses overflow:hidden
    // on its main container, so the WKWebView scrollView never bounces.

    private func injectPullToRefreshScript() {
        let js = """
        (function() {
            if (window.__plyPTR) return;
            window.__plyPTR = true;

            var startY = 0, pulling = false, el = null;

            function mkEl() {
                if (el) return;
                el = document.createElement('div');
                el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;display:flex;justify-content:center;padding-top:env(safe-area-inset-top,44px);pointer-events:none;opacity:0;transition:opacity 0.2s;';
                var dot = document.createElement('div');
                dot.style.cssText = 'width:36px;height:36px;margin-top:8px;border-radius:50%;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;';
                dot.innerHTML = '<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#22C55E\" stroke-width=\"2.5\" stroke-linecap=\"round\"><polyline points=\"23 4 23 10 17 10\"/><path d=\"M20.49 15a9 9 0 1 1-2.12-9.36L23 10\"/></svg>';
                el.appendChild(dot);
                document.body.appendChild(el);
            }

            function atTop() {
                var t = document.elementFromPoint(window.innerWidth / 2, 100);
                while (t && t !== document.body && t !== document.documentElement) {
                    if (t.scrollTop > 5) return false;
                    t = t.parentElement;
                }
                return (document.documentElement.scrollTop || 0) <= 5;
            }

            document.addEventListener('touchstart', function(e) {
                // Global kill switch — set by overlay views (e.g. ProfileDetail)
                if (window.__plyPTR_disabled) return;
                // Skip pull-to-refresh inside elements marked with data-no-ptr
                var target = e.target;
                while (target && target !== document.body) {
                    if (target.hasAttribute && target.hasAttribute('data-no-ptr')) return;
                    target = target.parentElement;
                }
                if (atTop()) { startY = e.touches[0].clientY; pulling = true; }
            }, {passive:true});

            document.addEventListener('touchmove', function(e) {
                if (!pulling) return;
                var dy = e.touches[0].clientY - startY;
                if (dy > 10) {
                    mkEl();
                    var p = Math.min(dy / 120, 1);
                    el.style.opacity = String(Math.min(p * 1.5, 1));
                    var svg = el.querySelector('svg');
                    if (svg) svg.style.transform = 'rotate(' + (p * 360) + 'deg)';
                } else if (dy < -5) {
                    pulling = false;
                    if (el) el.style.opacity = '0';
                }
            }, {passive:true});

            document.addEventListener('touchend', function(e) {
                if (!pulling) return;
                pulling = false;
                var dy = (e.changedTouches[0] ? e.changedTouches[0].clientY : 0) - startY;
                if (dy > 100) {
                    if (el) {
                        var svg = el.querySelector('svg');
                        if (svg) svg.style.animation = 'spin 0.6s linear infinite';
                        if (!document.getElementById('__ptr_style')) {
                            var s = document.createElement('style');
                            s.id = '__ptr_style';
                            s.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
                            document.head.appendChild(s);
                        }
                    }
                    setTimeout(function() { window.location.reload(); }, 300);
                } else {
                    if (el) el.style.opacity = '0';
                }
            }, {passive:true});
        })();
        """

        let userScript = WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        webView?.configuration.userContentController.addUserScript(userScript)

        // Also inject into the currently loaded page
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - Network Monitoring

    private func startNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied
            DispatchQueue.main.async {
                guard let self = self else { return }
                let wasConnected = self.isConnected
                self.isConnected = connected

                if !connected && wasConnected {
                    self.showOfflineBanner()
                } else if connected && !wasConnected {
                    self.hideOfflineBanner()
                    self.hideOfflineFullScreen()
                    // Auto-reload if previous load failed
                    if self.didFailToLoad {
                        self.didFailToLoad = false
                        self.webView?.reload()
                    }
                }
            }
        }
        networkMonitor.start(queue: monitorQueue)
    }

    // MARK: - Offline Banner (top bar notification)

    private func showOfflineBanner() {
        guard offlineBanner == nil else { return }

        let safeTop = view.safeAreaInsets.top
        let bannerH: CGFloat = 36
        let totalH = safeTop + bannerH

        let container = UIView(frame: CGRect(x: 0, y: -totalH, width: view.bounds.width, height: totalH))
        container.autoresizingMask = [.flexibleWidth]
        container.backgroundColor = UIColor(red: 220/255, green: 38/255, blue: 38/255, alpha: 0.95)
        container.isUserInteractionEnabled = false

        let label = UILabel(frame: CGRect(x: 0, y: safeTop, width: view.bounds.width, height: bannerH))
        label.text = "No Internet Connection"
        label.textColor = .white
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        label.textAlignment = .center
        label.autoresizingMask = [.flexibleWidth]
        container.addSubview(label)

        view.addSubview(container)
        offlineBanner = container

        UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0.5, options: .curveEaseOut) {
            container.frame.origin.y = 0
        }
    }

    private func hideOfflineBanner() {
        guard let banner = offlineBanner else { return }
        let h = banner.bounds.height
        UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseIn, animations: {
            banner.frame.origin.y = -h
        }) { _ in
            banner.removeFromSuperview()
            self.offlineBanner = nil
        }

        // Flash a brief "Back Online" toast
        showOnlineToast()
    }

    private func showOnlineToast() {
        let safeTop = view.safeAreaInsets.top
        let toast = UIView(frame: CGRect(x: 0, y: -50, width: view.bounds.width, height: safeTop + 36))
        toast.autoresizingMask = [.flexibleWidth]
        toast.backgroundColor = UIColor(red: 22/255, green: 163/255, blue: 74/255, alpha: 0.95)
        toast.isUserInteractionEnabled = false

        let label = UILabel(frame: CGRect(x: 0, y: safeTop, width: view.bounds.width, height: 36))
        label.text = "Back Online"
        label.textColor = .white
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        label.textAlignment = .center
        label.autoresizingMask = [.flexibleWidth]
        toast.addSubview(label)

        view.addSubview(toast)

        UIView.animate(withDuration: 0.3, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0.5, options: .curveEaseOut, animations: {
            toast.frame.origin.y = 0
        }) { _ in
            UIView.animate(withDuration: 0.25, delay: 2.0, options: .curveEaseIn, animations: {
                toast.frame.origin.y = -(toast.bounds.height)
            }) { _ in
                toast.removeFromSuperview()
            }
        }
    }

    // MARK: - Offline Full-Screen (when app opens with no internet)

    private func showOfflineFullScreen() {
        guard offlineFullScreen == nil else { return }

        let overlay = UIView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.backgroundColor = .white

        // Icon
        let iconLabel = UILabel()
        iconLabel.text = "📡"
        iconLabel.font = .systemFont(ofSize: 56)
        iconLabel.textAlignment = .center
        iconLabel.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(iconLabel)

        // Title
        let title = UILabel()
        title.text = "No Internet Connection"
        title.font = .systemFont(ofSize: 20, weight: .bold)
        title.textColor = UIColor(red: 30/255, green: 30/255, blue: 30/255, alpha: 1)
        title.textAlignment = .center
        title.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(title)

        // Subtitle
        let subtitle = UILabel()
        subtitle.text = "Please check your connection and try again"
        subtitle.font = .systemFont(ofSize: 15)
        subtitle.textColor = .gray
        subtitle.textAlignment = .center
        subtitle.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(subtitle)

        // Retry button
        let retryBtn = UIButton(type: .system)
        retryBtn.setTitle("  Retry  ", for: .normal)
        retryBtn.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        retryBtn.setTitleColor(.white, for: .normal)
        retryBtn.backgroundColor = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1)
        retryBtn.layer.cornerRadius = 12
        retryBtn.contentEdgeInsets = UIEdgeInsets(top: 12, left: 32, bottom: 12, right: 32)
        retryBtn.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        retryBtn.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(retryBtn)

        NSLayoutConstraint.activate([
            iconLabel.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            iconLabel.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -60),
            title.topAnchor.constraint(equalTo: iconLabel.bottomAnchor, constant: 16),
            title.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 8),
            subtitle.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            retryBtn.topAnchor.constraint(equalTo: subtitle.bottomAnchor, constant: 24),
            retryBtn.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
        ])

        view.addSubview(overlay)
        offlineFullScreen = overlay
    }

    private func hideOfflineFullScreen() {
        guard let overlay = offlineFullScreen else { return }
        UIView.animate(withDuration: 0.3, animations: {
            overlay.alpha = 0
        }) { _ in
            overlay.removeFromSuperview()
            self.offlineFullScreen = nil
        }
    }

    @objc private func retryTapped() {
        if isConnected {
            hideOfflineFullScreen()
            webView?.reload()
        }
    }

    // MARK: - Helpers

    private func isInternalURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return true }
        if ["about", "capacitor", "blob", "data"].contains(scheme) { return true }

        // UPI scheme URLs should NOT be treated as internal ΓÇö they need
        // special handling in decidePolicyFor to launch the native UPI app
        if ["upi", "intent", "phonepe", "gpay", "paytm", "tez"].contains(scheme) {
            return false
        }

        guard let host = url.host?.lowercased() else { return true }

        if Self.internalHosts.contains(host) || host.hasSuffix(".plyship.com") { return true }
        if host.hasSuffix(".firebaseapp.com") || host.hasSuffix(".googleapis.com") || host.hasSuffix(".google.com") { return true }
        if host == "razorpay.com" || host.hasSuffix(".razorpay.com") { return true }
        // reCAPTCHA / Firebase Auth domains ΓÇö required for Phone OTP to work in WebView
        if host.hasSuffix(".gstatic.com") { return true }
        if host.hasSuffix(".recaptcha.net") { return true }

        return false
    }

    // MARK: - Contacts Bridge

    /// Register a script message handler so the WebView can request contacts
    /// via window.webkit.messageHandlers.getContacts.postMessage('fetch').
    private func registerContactsBridge() {
        webView?.configuration.userContentController.add(self, name: "getContacts")
    }

    /// Register a script message handler so the WebView can request the FCM push token
    /// via window.webkit.messageHandlers.getPushToken.postMessage('fetch').
    /// The token is returned via window.__plyship_push_callback(token).
    private func registerPushBridge() {
        webView?.configuration.userContentController.add(self, name: "getPushToken")
    }
}

// MARK: - WKNavigationDelegate

extension PlyshipViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        let scheme = url.scheme?.lowercased() ?? ""

        // Handle UPI intent URLs — launch the native UPI app (GPay, PhonePe, etc.)
        // The user completes payment in the UPI app and is returned to PLYSHIP.
        if ["upi", "intent", "phonepe", "gpay", "paytm", "tez"].contains(scheme) {
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            decisionHandler(.cancel)
            return
        }

        // Handle Maps URL schemes — open in Apple Maps or Google Maps app.
        // geo: is the standard cross-platform scheme; maps: and comgooglemaps: are
        // Apple Maps and Google Maps deep-link schemes respectively.
        if ["geo", "maps", "comgooglemaps"].contains(scheme) {
            // For geo: URIs, convert to Apple Maps URL which iOS handles natively
            if scheme == "geo" {
                // geo:lat,lng?q=lat,lng → maps://maps.apple.com/?q=lat,lng
                let geoString = url.absoluteString
                // Extract coordinates: geo:lat,lng?q=... or geo:0,0?q=address
                if let qRange = geoString.range(of: "?q=") {
                    let query = String(geoString[qRange.upperBound...])
                    if let mapsUrl = URL(string: "https://maps.apple.com/?q=\(query)") {
                        UIApplication.shared.open(mapsUrl, options: [:], completionHandler: nil)
                    }
                } else {
                    // Just coordinates: geo:lat,lng
                    let coords = geoString.replacingOccurrences(of: "geo:", with: "")
                    if let mapsUrl = URL(string: "https://maps.apple.com/?q=\(coords)") {
                        UIApplication.shared.open(mapsUrl, options: [:], completionHandler: nil)
                    }
                }
            } else {
                // maps: or comgooglemaps: — open directly
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            decisionHandler(.cancel)
            return
        }

        // Handle Google Maps HTTPS links — open in Google Maps app if installed,
        // otherwise fall through to Apple Maps
        if scheme == "https" || scheme == "http" {
            let host = url.host?.lowercased() ?? ""
            if host.contains("maps.google.com") || host.contains("maps.apple.com")
                || host == "goo.gl" || host == "maps.app.goo.gl" {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                decisionHandler(.cancel)
                return
            }
        }

        // Handle target="_blank" links (no target frame).
        // If internal, load in current WebView; otherwise open externally.
        if navigationAction.targetFrame == nil {
            if isInternalURL(url) {
                webView.load(navigationAction.request)
            } else {
                // During Razorpay payment, bank redirect pages must stay in-app.
                // Check if the source is a Razorpay page before opening externally.
                let sourceHost = navigationAction.sourceFrame.webView?.url?.host?.lowercased() ?? ""
                let isFromRazorpay = sourceHost.hasSuffix(".razorpay.com") || sourceHost == "razorpay.com"
                if isFromRazorpay {
                    webView.load(navigationAction.request)
                } else {
                    UIApplication.shared.open(url)
                }
            }
            decisionHandler(.cancel)
            return
        }

        if isInternalURL(url) {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    // Page loaded successfully
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        didFailToLoad = false
        hideOfflineFullScreen()

        // Re-inject pull-to-refresh into the loaded page
        let reinject = "(function(){ if(!window.__plyPTR){ window.__plyPTR=false; } })();"
        webView.evaluateJavaScript(reinject, completionHandler: nil)
    }

    // Page failed to load (likely no internet)
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleLoadError(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleLoadError(error)
    }

    private func handleLoadError(_ error: Error) {
        let nsError = error as NSError
        // NSURLErrorNotConnectedToInternet, NSURLErrorTimedOut, NSURLErrorCannotFindHost, etc.
        if nsError.domain == NSURLErrorDomain {
            didFailToLoad = true
            showOfflineFullScreen()
        }
    }
}

// MARK: - WKUIDelegate (Popup / window.open handling)

extension PlyshipViewController: WKUIDelegate {

    /// Called when JavaScript calls window.open() or a link has target="_blank".
    /// We load the URL in the current WebView instead of opening Safari.
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }

        if isInternalURL(url) {
            webView.load(navigationAction.request)
        } else {
            // Razorpay checkout uses popups for bank redirects during payment.
            // Keep those in-app too.
            let currentHost = webView.url?.host?.lowercased() ?? ""
            let isPaymentFlow = currentHost.hasSuffix(".razorpay.com") || currentHost == "razorpay.com"
                || currentHost.hasSuffix(".plyship.com") || currentHost == "plyship.com"
            if isPaymentFlow {
                webView.load(navigationAction.request)
            } else {
                UIApplication.shared.open(url)
            }
        }
        // Return nil = don't create a new WebView; we handled it ourselves
        return nil
    }

    /// Auto-grant microphone and camera access for our domain (voice notes, profile photos).
    /// Required for iOS 15+ — without this, getUserMedia() always fails silently.
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let host = origin.host.lowercased()
        if host == "plyship.com" || host.hasSuffix(".plyship.com") || host == "localhost" {
            decisionHandler(.grant)
        } else {
            decisionHandler(.prompt)
        }
    }

    /// Auto-grant geolocation access for our domain (city detection during signup, profile location).
    /// Required for iOS 14+ — without this, navigator.geolocation calls fail silently in WKWebView.
    /// The system will still show the native iOS location permission prompt on first use.
    @available(iOS 14.0, *)
    func webView(_ webView: WKWebView,
                 requestGeolocationPermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let host = origin.host.lowercased()
        if host == "plyship.com" || host.hasSuffix(".plyship.com") || host == "localhost" {
            decisionHandler(.grant)
        } else {
            decisionHandler(.deny)
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension PlyshipViewController: CLLocationManagerDelegate {

    /// Called when the user responds to the native "Allow location?" prompt.
    /// If they grant "When In Use", escalate to "Always" and reload the WebView.
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        switch status {
        case .authorizedWhenInUse:
            // User granted "When In Use" — now request "Always" upgrade.
            // iOS will show a follow-up prompt or add the option to Settings.
            manager.requestAlwaysAuthorization()
            // Reload so the web page's pending geolocation request works
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.webView?.reload()
            }
        case .authorizedAlways:
            // Full access granted — reload so geolocation picks it up
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.webView?.reload()
            }
        default:
            break
        }
    }
}

// MARK: - WKScriptMessageHandler (Contacts Bridge)

extension PlyshipViewController: WKScriptMessageHandler {

    /// Called when JavaScript sends a message via window.webkit.messageHandlers.getContacts.postMessage('fetch').
    /// Reads device contacts using CNContactStore and calls back into JS with JSON data.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Handle push token request
        if message.name == "getPushToken" {
            Messaging.messaging().token { [weak self] token, error in
                DispatchQueue.main.async {
                    let result = token ?? "ERROR"
                    let escaped = result.replacingOccurrences(of: "'", with: "\\'")
                    self?.webView?.evaluateJavaScript(
                        "if(window.__plyship_push_callback) window.__plyship_push_callback('\(escaped)');",
                        completionHandler: nil
                    )
                }
            }
            return
        }

        guard message.name == "getContacts" else { return }

        let store = contactStore

        // Request access and fetch contacts
        store.requestAccess(for: .contacts) { [weak self] granted, error in
            guard let self = self else { return }

            if !granted {
                // Permission denied — call back with error
                DispatchQueue.main.async {
                    self.webView?.evaluateJavaScript(
                        "if(window.__plyship_contacts_callback) window.__plyship_contacts_callback('PERMISSION_DENIED');",
                        completionHandler: nil
                    )
                }
                return
            }

            // Fetch contacts with name and phone
            let keysToFetch: [CNKeyDescriptor] = [
                CNContactGivenNameKey as CNKeyDescriptor,
                CNContactFamilyNameKey as CNKeyDescriptor,
                CNContactPhoneNumbersKey as CNKeyDescriptor
            ]

            var contacts: [[String: String]] = []
            var seen = Set<String>()

            do {
                let request = CNContactFetchRequest(keysToFetch: keysToFetch)
                request.sortOrder = .givenName
                try store.enumerateContacts(with: request) { contact, _ in
                    let fullName = [contact.givenName, contact.familyName]
                        .filter { !$0.isEmpty }
                        .joined(separator: " ")

                    for phoneNumber in contact.phoneNumbers {
                        let phone = phoneNumber.value.stringValue
                        let key = fullName.lowercased() + "_" + phone.replacingOccurrences(of: "[^0-9+]", with: "", options: .regularExpression)
                        if seen.contains(key) || (fullName.isEmpty && phone.isEmpty) { continue }
                        seen.insert(key)
                        contacts.append(["name": fullName, "phone": phone])
                    }
                }
            } catch {
                // Return empty array on error
            }

            // Serialize to JSON and call back
            DispatchQueue.main.async {
                do {
                    let jsonData = try JSONSerialization.data(withJSONObject: contacts)
                    let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
                    let escaped = jsonString.replacingOccurrences(of: "'", with: "\\'")
                    self.webView?.evaluateJavaScript(
                        "if(window.__plyship_contacts_callback) window.__plyship_contacts_callback('\(escaped)');",
                        completionHandler: nil
                    )
                } catch {
                    self.webView?.evaluateJavaScript(
                        "if(window.__plyship_contacts_callback) window.__plyship_contacts_callback('[]');",
                        completionHandler: nil
                    )
                }
            }
        }
    }
}

// MARK: - MessagingDelegate (Firebase Cloud Messaging)

extension PlyshipViewController: MessagingDelegate {
    /// Called when the FCM registration token is updated.
    /// This can happen on first launch, token rotation, or reinstall.
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        print("PLYSHIP: FCM token refreshed: \(token.prefix(20))...")
        // Inject the token into the WebView so the JS layer can store it in Firestore
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(
                "if(window.__plyship_push_token_refresh) window.__plyship_push_token_refresh('\(token)');",
                completionHandler: nil
            )
        }
    }
}
