# PlyShip iOS — Development & Release Handoff

Handoff for a Claude session running on a **Mac** to build, test, and ship the PlyShip iOS app. The Android app is **live on the Play Store** (v1.4); iOS is the remaining platform.

## What this app is
- **Capacitor** app: a native shell (WKWebView) that loads **`https://plyship.com`** remotely. The app UI *is* the web app; the native layer adds permissions, bridges (contacts/push), file upload, geolocation, offline handling, deep links.
- **iOS bundle id: `com.agxfactor.plyship`** (⚠️ differs from Android's `com.plyship.app`). This matches the Firebase iOS app and `capacitor.config.ts` `appId`.
- Firebase project: `plyship-277bf` (project number `109538013062`). Firebase iOS app already registered as `com.agxfactor.plyship`.
- Repo layout: web app in `src/` (Next.js), iOS project in `ios/App/`, shared config in `capacitor.config.ts`.

## What's ALREADY done in the repo (don't rebuild these)
- `@capacitor-firebase/authentication` plugin added; `capacitor.config.ts` has `FirebaseAuthentication { skipNativeAuth: true, providers: ['phone'] }` (native phone verify; Firebase JS SDK stays the session source of truth).
- **`ios/App/App/PlyshipViewController.swift`** — custom WKWebView controller with:
  - **Contacts bridge**: `WKScriptMessageHandler` named `getContacts` → `CNContactStore` → calls back `window.__plyship_contacts_callback(json)` (matches the web code in `src/components/ChatView.js`). iOS analog of the Android `window.PlyshipContacts` bridge.
  - **Push-token bridge**: message handler `getPushToken`.
- `ios/App/App/Info.plist` — usage strings incl. `NSContactsUsageDescription`.
- `ios/App/CapApp-SPM/Package.swift` — SPM plugin wiring.
- Web-side features (contacts picker, voice notes, meetings, location, commission) are **live on plyship.com** and shared with iOS — no iOS work needed for those.

## Prerequisites (on the Mac)
- macOS + **Xcode** (latest) + Command Line Tools.
- **Apple Developer Program** membership (for signing, push, TestFlight, App Store).
- **Node** (to run `npm install` / `npx cap sync`). CocoaPods may be needed depending on Capacitor version (this project uses SPM — check `ios/App/CapApp-SPM`).
- The repo cloned locally (this handoff assumes the latest `master`).

## Build & run
```bash
# from repo root
npm install
npx cap sync ios          # copies web config + updates native project (run from repo ROOT, not ios/)
npx cap open ios          # opens the project in Xcode
```
In Xcode:
1. Select the **App** target → **Signing & Capabilities** → set your **Team**; confirm bundle id `com.agxfactor.plyship`; let Xcode manage the provisioning profile.
2. Build & run on a **Simulator** first (fast sanity: does plyship.com load, does the UI render).
3. Then run on a **real device** (required for phone auth / push / camera / real testing).

## Firebase + native phone auth (the critical iOS-specific setup)
See also the repo's **`NATIVE_PHONE_AUTH_SETUP.md`**. For iOS specifically:
1. **`GoogleService-Info.plist`**: download it from Firebase Console → Project settings → the `com.agxfactor.plyship` iOS app → add it into `ios/App/App/` (and to the Xcode target). Do NOT commit it if it contains secrets you don't want in git (check current `.gitignore`).
2. **APNs auth key**: create an APNs key in the Apple Developer portal and **upload it to Firebase → Project settings → Cloud Messaging**. iOS phone auth verifies the device via a **silent push**, so this is required or OTP will fail / fall back to reCAPTCHA.
3. **URL scheme = `REVERSED_CLIENT_ID`**: copy `REVERSED_CLIENT_ID` from `GoogleService-Info.plist` → Xcode → App target → **Info → URL Types** → add a URL scheme with that value. (reCAPTCHA/silent-push fallback path for Firebase phone auth.)
4. **Capabilities** (Signing & Capabilities → +Capability): **Push Notifications** and **Background Modes → Remote notifications**.
5. Firebase Auth → Phone sign-in is already enabled; keep the **test numbers** `1111111111`–`1111111119` (OTP `000000`) for QA.

## Info.plist permission strings to confirm/add
WKWebView features prompt with these usage descriptions — make sure each exists with a user-facing reason:
- `NSContactsUsageDescription` (present) — share contacts in chat
- `NSMicrophoneUsageDescription` — voice notes
- `NSCameraUsageDescription` — photo capture / profile pic
- `NSPhotoLibraryUsageDescription` (or rely on PHPicker which needs none) — image upload
- `NSLocationWhenInUseUsageDescription` — meeting location / onboarding city

## Test checklist on device (mirror what was validated on Android)
- App loads `https://plyship.com` in the WKWebView; splash → landing.
- **Native phone login**: sign in with a real number → OTP with **no reCAPTCHA** (native silent-push path). If reCAPTCHA appears or OTP fails, APNs key / URL scheme is missing.
- **Contacts share** in a chat: `+ → Contact` should trigger the iOS Contacts permission prompt and list device contacts (via the `getContacts` bridge). Note: contact/location sharing only unlocks after a **meeting request** is sent in that chat (same gate as the call button) — send a meeting request first.
- **Image upload**: `+ → Photos` and profile picture — confirm the WKWebView file picker / PHPicker works and the image uploads to Firebase Storage.
- **Voice notes**: record + play. (The Android "volume pumping" bug was a shared web fix — AGC disabled in `ChatView.js` — already deployed; just confirm iOS capture/playback sounds fine.)
- **Maps**: meeting-location picker loads (Maps JS key is domain-locked to plyship.com — works because the WKWebView origin is plyship.com).
- **Deep links / Universal Links**: `https://plyship.com/profile/*` should open in-app. iOS Universal Links require an **`apple-app-site-association`** file hosted at `https://plyship.com/.well-known/apple-app-site-association` with this app's Team ID + bundle id, plus the **Associated Domains** capability (`applinks:plyship.com`). Verify/set this up (Android uses `assetlinks.json`; iOS needs its own AASA file).
- **Offline** behavior and **pull-to-refresh** parity with Android (check `PlyshipViewController.swift`).

## Release (App Store)
1. **App Store Connect**: create/confirm the app record for `com.agxfactor.plyship`.
2. Archive in Xcode (Product → Archive) → upload to **TestFlight**.
3. Test the TestFlight build on device (native login is the key check — TestFlight uses the real distribution signing).
4. Fill **privacy nutrition labels** (data collected: phone number, contacts (shared by user), location, photos, etc.), screenshots, description, age rating.
5. Submit for **App Store review**.

## Gotchas / notes
- **Bundle id is `com.agxfactor.plyship`** on iOS — don't copy the Android `com.plyship.app`.
- The web bundle loads remotely from **plyship.com** — it's already deployed, so you do NOT rebuild/deploy web to ship iOS. But any web change must be deployed (`npx vercel --prod`) to reach both apps.
- Native bridges must match the web's expected JS interface: contacts = `window.webkit.messageHandlers.getContacts.postMessage('fetch')` + `window.__plyship_contacts_callback`. If contacts return empty, verify the message handler name and the callback.
- iOS phone auth **requires** the APNs key + URL scheme; without them it silently degrades.
- Universal Links need the AASA file on plyship.com (server-side) — coordinate that with the web deploy.
- Config/plugin changes need `npx cap sync ios` from the repo root before rebuilding in Xcode.

## Cross-references (in this repo)
- `NATIVE_PHONE_AUTH_SETUP.md` — native phone auth checklist (Android + iOS).
- `capacitor.config.ts` — shared Capacitor config.
- `ios/App/App/PlyshipViewController.swift` — native bridges & WKWebView setup.
- `src/components/ChatView.js` — web side of contacts / voice notes / location.
