import UIKit
import Capacitor
import WebKit

/// Custom Capacitor WebView controller for PLYSHIP.
/// - Pull-to-refresh via native UIRefreshControl
/// - External links open in Safari
/// - plyship.com navigation stays inside app
class PlyshipViewController: CAPBridgeViewController {

    // Domains that should stay inside the app
    private static let internalHosts: Set<String> = [
        "plyship.com",
        "www.plyship.com"
    ]

    override func viewDidLoad() {
        super.viewDidLoad()
        setupPullToRefresh()
        webView?.navigationDelegate = self
    }

    // MARK: - Pull to Refresh

    private func setupPullToRefresh() {
        guard let scrollView = webView?.scrollView else { return }

        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1.0)
        refreshControl.addTarget(self, action: #selector(handleRefresh(_:)), for: .valueChanged)

        scrollView.refreshControl = refreshControl
        scrollView.bounces = true
        scrollView.alwaysBounceVertical = true
    }

    @objc private func handleRefresh(_ sender: UIRefreshControl) {
        webView?.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            sender.endRefreshing()
        }
    }

    // MARK: - Helpers

    private func isInternalURL(_ url: URL) -> Bool {
        // Allow Capacitor internals, data URIs, etc.
        guard let scheme = url.scheme else { return true }
        if ["about", "capacitor", "blob", "data"].contains(scheme) { return true }

        guard let host = url.host?.lowercased() else { return true }

        // plyship.com and subdomains
        if Self.internalHosts.contains(host) || host.hasSuffix(".plyship.com") { return true }

        // Firebase auth (needed for Google sign-in)
        if host.hasSuffix(".firebaseapp.com") || host.hasSuffix(".googleapis.com") || host.hasSuffix(".google.com") { return true }

        // Razorpay payments
        if host.hasSuffix(".razorpay.com") { return true }

        return false
    }
}

// MARK: - WKNavigationDelegate

extension PlyshipViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if isInternalURL(url) {
            decisionHandler(.allow)
        } else {
            // Open external links in Safari
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }
}
