import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.plyship.app',
    appName: 'PLYSHIP',
    webDir: 'www',

    server: {
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
            style: 'DARK',
            backgroundColor: '#0A0A0F',
        },
    },

    ios: {
        contentInset: 'never',
        backgroundColor: '#0A0A0F',
        allowsLinkPreview: false,
        preferredContentMode: 'mobile',
    },
};

export default config;
