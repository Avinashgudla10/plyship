# Native Phone Auth — setup & release checklist

The app now uses **native phone verification** on Android/iOS (no web reCAPTCHA),
while the web/PWA keeps the existing invisible-reCAPTCHA flow. The UI is unchanged.

## What's already done (in code)
- Installed `@capacitor-firebase/authentication@8.3.0` and ran `npx cap sync` (android + ios).
- `capacitor.config.ts`: `FirebaseAuthentication` plugin with `skipNativeAuth: true`, `providers: ['phone']`.
  (Native verifies the phone; the Firebase **JS SDK** stays the source of truth via `signInWithCredential`.)
- `src/context/AuthContext.js`: `sendOTP` / `verifyOTP` branch to native **only when the plugin is
  present** (`Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseAuthentication')`).
  Old app builds without the plugin safely fall back to reCAPTCHA — so deploying the web bundle
  will NOT break existing installed apps.

## What YOU must do before it works on device

### Firebase Console
- **Android:** add the app's **SHA-1 and SHA-256** signing fingerprints (debug + Play release keys)
  under Project Settings → your Android app. Then download the updated `google-services.json` into
  `android/app/`. Ensure the **Play Integrity API** is enabled for the project.
- **iOS:** upload an **APNs authentication key** (Project Settings → Cloud Messaging). Phone auth on
  iOS uses a silent push to verify the device.
- Phone sign-in must be enabled (it already is) and keep the **test numbers** (111…) for QA.

### iOS project
- Add a URL scheme equal to your **REVERSED_CLIENT_ID** (from `GoogleService-Info.plist`) in Xcode →
  App target → Info → URL Types. This is the reCAPTCHA/silent-push fallback path.

### Build & test (must be a real device / emulator with Play Services)
1. `npm run build` (web) — the native app loads `plyship.com`, so the web bundle with the native
   branch must be **deployed** for the in-app WebView to use it.
2. `npx cap sync`
3. Android: open `android/` in Android Studio, run on a device. iOS: open `ios/App` in Xcode (Mac), run.
4. Test: send OTP (no reCAPTCHA challenge should appear), enter code, verify login. Also test Android
   **auto-retrieval** (code may auto-fill / auto-verify).

## Release sequencing (important)
1. Deploy the web bundle first (safe — guarded fallback).
2. Then ship the rebuilt native apps (with the plugin) to the stores.
Until a user updates the native app, they keep using reCAPTCHA; after updating, they get native auth.
