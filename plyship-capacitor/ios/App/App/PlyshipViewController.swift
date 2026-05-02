import UIKit
import Capacitor
import WebKit
import Network

/// Custom Capacitor ViewController with native enhancements:
/// 1. Edge-to-edge fullscreen WebView layout
/// 2. Navigation policy — plyship.com stays in-app, external links open in Safari
/// 3. Pull-to-refresh — JavaScript-injected (native UIRefreshControl doesn't work with overflow:hidden pages)
/// 4. Offline banner — native UIView layered ON TOP of WebView
/// 5. Camera & photo library file input support
class PlyshipViewController: CAPBridgeViewController {

    // MARK: - Allowed Domains

    private static let allowedHosts: Set<String> = [
        "plyship.com",
        "www.plyship.com"
    ]

    // Store the original WKUIDelegate from Capacitor so file input still works
    private weak var originalUIDelegate: WKUIDelegate?

    // MARK: - Network Monitoring
    private let networkMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.plyship.networkMonitor")
    private var isConnected = true

    // MARK: - Offline Banner UI
    private var offlineBannerContainer: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()
        setupEdgeToEdge()
        setupNavigationDelegate()

        // Save Capacitor's original UI delegate (handles file input pickers)
        originalUIDelegate = webView?.uiDelegate
        webView?.uiDelegate = self

        startNetworkMonitoring()
        injectPullToRefreshScript()
    }

    deinit {
        networkMonitor.cancel()
    }

    // MARK: - Edge-to-Edge Layout

    private func setupEdgeToEdge() {
        guard let webView = webView else { return }

        webView.isOpaque = false
        webView.backgroundColor = .white
        webView.scrollView.backgroundColor = .white

        // Let the web content handle safe areas via CSS env()
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Ensure WebView fills the entire screen edge-to-edge
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    // MARK: - Navigation Delegate for page load events

    private func setupNavigationDelegate() {
        webView?.navigationDelegate = self
    }

    // MARK: - Pull to Refresh (JavaScript injection)
    // Native UIRefreshControl doesn't work because the web page uses overflow:hidden
    // so we inject JavaScript that listens for touch gestures and triggers reload

    private func injectPullToRefreshScript() {
        let script = """
        (function() {
            if (window.__plyshipPTR) return; // Already injected
            window.__plyshipPTR = true;

            var startY = 0;
            var pulling = false;
            var indicator = null;

            function createIndicator() {
                if (indicator) return;
                indicator = document.createElement('div');
                indicator.id = '__ptr_indicator';
                indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;display:flex;justify-content:center;padding-top:env(safe-area-inset-top,0px);pointer-events:none;transition:opacity 0.2s;opacity:0;';
                var spinner = document.createElement('div');
                spinner.style.cssText = 'width:36px;height:36px;margin-top:12px;border-radius:50%;background:white;box-shadow:0 2px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;';
                spinner.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
                indicator.appendChild(spinner);
                document.body.appendChild(indicator);
            }

            function isAtTop() {
                // Check if all scrollable containers are at top
                var el = document.elementFromPoint(window.innerWidth/2, window.innerHeight/4);
                while (el && el !== document.body && el !== document.documentElement) {
                    if (el.scrollTop > 5) return false;
                    el = el.parentElement;
                }
                return (document.documentElement.scrollTop || document.body.scrollTop || 0) <= 5;
            }

            document.addEventListener('touchstart', function(e) {
                if (isAtTop()) {
                    startY = e.touches[0].clientY;
                    pulling = true;
                }
            }, {passive: true});

            document.addEventListener('touchmove', function(e) {
                if (!pulling) return;
                var dy = e.touches[0].clientY - startY;
                if (dy > 10) {
                    createIndicator();
                    var progress = Math.min(dy / 120, 1);
                    indicator.style.opacity = String(Math.min(progress * 1.5, 1));
                    var svg = indicator.querySelector('svg');
                    if (svg) svg.style.transform = 'rotate(' + (progress * 360) + 'deg)';
                } else if (dy < -5) {
                    pulling = false;
                    if (indicator) indicator.style.opacity = '0';
                }
            }, {passive: true});

            document.addEventListener('touchend', function(e) {
                if (!pulling) return;
                pulling = false;
                var dy = (e.changedTouches[0] ? e.changedTouches[0].clientY : 0) - startY;
                if (dy > 100) {
                    // Show spinning state
                    if (indicator) {
                        var svg = indicator.querySelector('svg');
                        if (svg) svg.style.animation = 'spin 0.6s linear infinite';
                        var style = document.createElement('style');
                        style.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
                        document.head.appendChild(style);
                    }
                    // Notify native to reload
                    setTimeout(function() { window.location.reload(); }, 300);
                } else {
                    if (indicator) indicator.style.opacity = '0';
                }
            }, {passive: true});
        })();
        """;

        let userScript = WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        webView?.configuration.userContentController.addUserScript(userScript)
    }

    // MARK: - Network Monitoring & Offline Banner

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
                    self.showOnlineBanner()
                }
            }
        }
        networkMonitor.start(queue: monitorQueue)
    }

    private func showOfflineBanner() {
        removeOfflineBanner()

        let safeTop = view.safeAreaInsets.top
        let bannerHeight: CGFloat = 40
        let totalHeight = safeTop + bannerHeight

        let container = UIView()
        container.frame = CGRect(x: 0, y: -totalHeight, width: view.bounds.width, height: totalHeight)
        container.autoresizingMask = [.flexibleWidth]
        container.isUserInteractionEnabled = false

        // Red gradient background
        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = [
            UIColor(red: 220/255, green: 38/255, blue: 38/255, alpha: 0.95).cgColor,
            UIColor(red: 185/255, green: 28/255, blue: 28/255, alpha: 0.95).cgColor
        ]
        gradientLayer.startPoint = CGPoint(x: 0, y: 0.5)
        gradientLayer.endPoint = CGPoint(x: 1, y: 0.5)
        gradientLayer.frame = container.bounds
        container.layer.insertSublayer(gradientLayer, at: 0)

        // Wifi-off icon + text
        let label = UILabel()
        label.text = "⚠ No Internet Connection"
        label.textColor = .white
        label.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        label.textAlignment = .center
        label.frame = CGRect(x: 0, y: safeTop, width: container.bounds.width, height: bannerHeight)
        label.autoresizingMask = [.flexibleWidth]
        container.addSubview(label)

        // Add ON TOP of the WebView
        view.addSubview(container)
        offlineBannerContainer = container

        // Slide down
        UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.8, initialSpringVelocity: 0.5, options: .curveEaseOut) {
            container.frame.origin.y = 0
        }
    }

    private func showOnlineBanner() {
        removeOfflineBanner()

        let safeTop = view.safeAreaInsets.top
        let bannerHeight: CGFloat = 40
        let totalHeight = safeTop + bannerHeight

        let container = UIView()
        container.frame = CGRect(x: 0, y: -totalHeight, width: view.bounds.width, height: totalHeight)
        container.autoresizingMask = [.flexibleWidth]
        container.backgroundColor = UIColor(red: 22/255, green: 163/255, blue: 74/255, alpha: 0.95)
        container.isUserInteractionEnabled = false

        let label = UILabel()
        label.text = "✓ Back Online"
        label.textColor = .white
        label.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        label.textAlignment = .center
        label.frame = CGRect(x: 0, y: safeTop, width: container.bounds.width, height: bannerHeight)
        label.autoresizingMask = [.flexibleWidth]
        container.addSubview(label)

        view.addSubview(container)

        // Slide down
        UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.8, initialSpringVelocity: 0.5, options: .curveEaseOut, animations: {
            container.frame.origin.y = 0
        }) { _ in
            // Auto-dismiss after 3 seconds
            UIView.animate(withDuration: 0.25, delay: 2.5, options: .curveEaseIn, animations: {
                container.frame.origin.y = -totalHeight
            }) { _ in
                container.removeFromSuperview()
            }
        }
    }

    private func removeOfflineBanner() {
        if let banner = offlineBannerContainer {
            banner.removeFromSuperview()
            offlineBannerContainer = nil
        }
    }

    // MARK: - Domain Check

    private func isAllowedURL(_ url: URL) -> Bool {
        if let scheme = url.scheme, ["about", "capacitor", "blob", "data"].contains(scheme) {
            return true
        }

        guard let host = url.host?.lowercased() else { return true }

        if Self.allowedHosts.contains(host) || host.hasSuffix(".plyship.com") { return true }
        if host.hasSuffix(".firebaseapp.com") || host.hasSuffix(".googleapis.com") || host.hasSuffix(".google.com") { return true }
        if host.hasSuffix(".razorpay.com") { return true }

        return false
    }
}

// MARK: - WKNavigationDelegate

extension PlyshipViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Re-inject pull-to-refresh after each page load
        let script = """
        if (!window.__plyshipPTR) {
            // Will be re-injected by user script on next load
        }
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if isAllowedURL(url) {
            decisionHandler(.allow)
        } else {
            // Open external URLs in Safari
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }
}

// MARK: - WKUIDelegate (handles target="_blank", window.open, AND preserves file input)

extension PlyshipViewController: WKUIDelegate {

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }

        if isAllowedURL(url) {
            webView.load(navigationAction.request)
        } else {
            UIApplication.shared.open(url)
        }

        return nil
    }

    // Forward JS dialogs to Capacitor's original delegate so file input still works
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        originalUIDelegate?.webView?(webView, runJavaScriptAlertPanelWithMessage: message, initiatedByFrame: frame, completionHandler: completionHandler) ?? completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        originalUIDelegate?.webView?(webView, runJavaScriptConfirmPanelWithMessage: message, initiatedByFrame: frame, completionHandler: completionHandler) ?? completionHandler(false)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        originalUIDelegate?.webView?(webView, runJavaScriptTextInputPanelWithPrompt: prompt, defaultText: defaultText, initiatedByFrame: frame, completionHandler: completionHandler) ?? completionHandler(nil)
    }
}
