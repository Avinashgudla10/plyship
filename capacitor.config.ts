import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.agxfactor.plyship',
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
        // Native phone auth (Android Play Integrity / iOS silent APNs) — no web reCAPTCHA.
        // skipNativeAuth keeps the Firebase JS SDK as the single source of truth: the
        // plugin only verifies the phone number natively; we create the JS session via
        // signInWithCredential so the rest of the app (auth.currentUser) is unchanged.
        FirebaseAuthentication: {
            skipNativeAuth: true,
            providers: ['phone'],
        },
    },
    android: {
        allowMixedContent: false,
        backgroundColor: '#FFFFFF',
    },
    ios: {
        contentInset: 'never',
        backgroundColor: '#000000',
        allowsLinkPreview: false,
        preferredContentMode: 'mobile',
    },
};

export default config;
