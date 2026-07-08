# iOS Native Phone Auth (reCAPTCHA-free) — implementation & release notes

**Goal:** remove the Google **reCAPTCHA** from phone-number login in the iOS app.

**Status:** ✅ Working — verified end-to-end in the iOS Simulator with a Firebase
test number (`1111111111` / `000000`): Send OTP → **no reCAPTCHA** → verify → role
selection. Real numbers on a real device use silent-APNs verification (no reCAPTCHA).

---

## Why reCAPTCHA appeared
The web app (`src/context/AuthContext.js`) uses the Firebase **JS SDK**
(`signInWithPhoneNumber` + `RecaptchaVerifier`). The JS SDK **always** requires
reCAPTCHA. To skip it on iOS, verification must run through the **native Firebase
iOS SDK**, which verifies the app with a **silent APNs push** instead.
(Android is unchanged — still uses the web reCAPTCHA flow.)

## How it now works
1. Web `sendOTP` detects the native bridge and calls
   `window.webkit.messageHandlers.phoneAuthVerify.postMessage("+91…")`.
2. Native `PlyshipViewController` runs `PhoneAuthProvider.verifyPhoneNumber(_, uiDelegate: nil)`
   (no reCAPTCHA) and returns a `verificationId`.
3. Web `verifyOTP` builds `PhoneAuthProvider.credential(verificationId, code)` and
   `signInWithCredential(auth, …)` — so Firestore auth state is unchanged.

## Bugs found & fixed along the way (all in this change)
- **`Main.storyboard` launched `CAPBridgeViewController`, not `PlyshipViewController`** →
  the entire custom native controller (push, contacts, location, popup handling, phone
  auth) was dead code. Repointed to `PlyshipViewController`.
- **`GoogleService-Info.plist` was never bundled** into the app target → `FirebaseApp.configure()`
  crashed once the VC ran. Added it to the Xcode target's resources.
- **Bundle ID mismatch**: Xcode built `com.plyship.app` while Firebase / APNs key /
  GoogleService / capacitor appId all use `com.agxfactor.plyship`. Fixed Xcode to
  `com.agxfactor.plyship`.
- **Message-handler bridges weren't exposed** to remote content — they were added to
  `webView.configuration.userContentController` *after* creation. Moved to the
  `webView(with:configuration:)` factory override (fixes push & contacts bridges too).
- **Missing Firebase URL scheme** → `PhoneAuthProvider` crashed with "register custom URL
  scheme …". Added `app-1-109538013062-ios-2847dfd71ec3b1535a8607` to `CFBundleURLTypes`.
- **Simulator has no APNs** → added `isAppVerificationDisabledForTesting = true` under
  `#if targetEnvironment(simulator)` so test numbers work in the sim. Compiled out of
  device/App Store builds.

## What YOU still need to do

### 1. APNs Auth Key — ✅ already done
Confirmed uploaded in Firebase → Project settings → Cloud Messaging (Key ID `C66GK278PF`,
Team ID `724CZLMJJ5`, Dev + Prod). Nothing to do.

### 2. Push Notifications capability + entitlement (for the real build)
The signed build must have the **Push Notifications** capability and an
`aps-environment` entitlement (development / production). Without it, both push and
native phone-auth verification fail on device. (In the simulator you'll see
"no valid aps-environment entitlement" — that's expected and harmless there.)

### 3. Firebase test phone numbers (QA)
Firebase Console → Authentication → Sign-in method → Phone → "Phone numbers for testing":
add `+91 1111111111` … `1111111118` → `000000`. These verify with no reCAPTCHA/APNs.

### 4. Deploy the web change
The app loads the **live** `https://plyship.com`. The `AuthContext.js` change must be
**deployed to production (Vercel)** before the app uses the native path. Until then the
app falls back to the web reCAPTCHA flow (no crash).

## How to verify
- **Simulator:** works with **test numbers only** (no APNs). Test number → OTP screen
  with **no reCAPTCHA** → `000000` signs in.
- **Real device:** real numbers verify via silent APNs push → **no reCAPTCHA** → real SMS
  code signs in.
