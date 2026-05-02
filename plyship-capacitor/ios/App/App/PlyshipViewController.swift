import UIKit
import Capacitor
import WebKit

/// Custom Capacitor ViewController with native enhancements:
/// 1. Edge-to-edge fullscreen WebView layout
/// 2. Navigation policy — plyship.com stays in-app, external links open in Safari
/// 3. Pull-to-refresh — native UIRefreshControl for page reload
/// 4. Camera & photo library file input support
class PlyshipViewController: CAPBridgeViewController {

    // MARK: - Allowed Domains

    private static let allowedHosts: Set<String> = [
        "plyship.com",
        "www.plyship.com"
    ]

    // Store the original WKUIDelegate from Capacitor so file input still works
    private weak var originalUIDelegate: WKUIDelegate?

    override func viewDidLoad() {
        super.viewDidLoad()
        setupEdgeToEdge()
        setupPullToRefresh()

        // Save Capacitor's original UI delegate (handles file input pickers)
        // then set ourselves as delegate, forwarding unhandled calls back
        originalUIDelegate = webView?.uiDelegate
        webView?.uiDelegate = self
    }

    // MARK: - Edge-to-Edge Layout

    private func setupEdgeToEdge() {
        guard let webView = webView else { return }

        // Use white background to match the app theme
        webView.isOpaque = false
        webView.backgroundColor = .white
        webView.scrollView.backgroundColor = .white

        // Disable automatic safe area inset adjustments — let the web content
        // handle safe areas via CSS env(safe-area-inset-*) and viewport-fit=cover
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

    // MARK: - Pull to Refresh

    private func setupPullToRefresh() {
        guard let scrollView = webView?.scrollView else { return }

        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1.0) // #22C55E brand green
        refreshControl.addTarget(self, action: #selector(handleRefresh(_:)), for: .valueChanged)

        scrollView.bounces = true
        scrollView.alwaysBounceVertical = true
        scrollView.refreshControl = refreshControl
    }

    @objc private func handleRefresh(_ sender: UIRefreshControl) {
        webView?.reload()

        // Safety timeout — end refreshing if page takes too long
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            sender.endRefreshing()
        }
    }

    // MARK: - Domain Check

    private func isAllowedURL(_ url: URL) -> Bool {
        // Internal schemes (Capacitor bridge, data URIs, etc.)
        if let scheme = url.scheme, ["about", "capacitor", "blob", "data"].contains(scheme) {
            return true
        }

        guard let host = url.host?.lowercased() else { return true }

        // plyship.com and subdomains
        if Self.allowedHosts.contains(host) || host.hasSuffix(".plyship.com") {
            return true
        }

        // Firebase auth domains (needed for Google sign-in flow)
        if host.hasSuffix(".firebaseapp.com") || host.hasSuffix(".googleapis.com") || host.hasSuffix(".google.com") {
            return true
        }

        // Razorpay payment domains
        if host.hasSuffix(".razorpay.com") {
            return true
        }

        return false
    }
}

// MARK: - WKUIDelegate (handles target="_blank", window.open, AND file input)

extension PlyshipViewController: WKUIDelegate {

    // Handle target="_blank" links and window.open()
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }

        if isAllowedURL(url) {
            webView.load(navigationAction.request)
        } else {
            UIApplication.shared.open(url)
        }

        return nil
    }

    // CRITICAL: Forward file input requests to Capacitor's original delegate
    // This is what makes <input type="file"> work for camera and photo library
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
