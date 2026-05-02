import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.plyship.app',
    appName: 'PLYSHIP',
    webDir: 'out',
    server: {
        // Point to your live Vercel deployment
        // This makes the app load your deployed website inside a native WebView
        url: 'https://plyship.com',
        cleartext: false,
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: true,
            launchShowDuration: 2000,
            backgroundColor: '#0A0A0F',
            showSpinner: false,
        },
        StatusBar: {
            // Use DARK style = dark text on light background (for white headers)
            style: 'DARK',
            backgroundColor: '#FFFFFF',
            overlaysWebView: false,
        },
    },
    android: {
        allowMixedContent: false,
        backgroundColor: '#FFFFFF',
    },
    ios: {
        contentInset: 'automatic',
        backgroundColor: '#FFFFFF',
        scrollEnabled: true,
        preferredContentMode: 'mobile',
    },
};

export default config;
