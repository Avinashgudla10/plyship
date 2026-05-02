import UIKit
import Capacitor
import WebKit

/// Custom Capacitor ViewController with native enhancements:
/// 1. Edge-to-edge fullscreen WebView layout
/// 2. Navigation policy — plyship.com stays in-app, external links open in Safari
/// 3. Pull-to-refresh — native UIRefreshControl for page reload
class PlyshipViewController: CAPBridgeViewController {

    // MARK: - Allowed Domains

    private static let allowedHosts: Set<String> = [
        "plyship.com",
        "www.plyship.com"
    ]

    override func viewDidLoad() {
        super.viewDidLoad()
        setupEdgeToEdge()
        setupPullToRefresh()
        webView?.uiDelegate = self
    }

    // MARK: - Edge-to-Edge Layout

    private func setupEdgeToEdge() {
        guard let webView = webView else { return }

        // Remove any white background gaps
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

        return false
    }
}

// MARK: - WKUIDelegate (handles target="_blank" and window.open)

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
}
