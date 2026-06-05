package com.plyship.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.ContactsContract;
import android.provider.MediaStore;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Custom Capacitor Activity for PLYSHIP Android.
 * Features:
 * 1. Pull-to-refresh via injected JavaScript
 * 2. External links open in system browser, plyship.com stays in-app
 * 3. Network monitoring with offline banner + full-screen error page
 * 4. Auto-reload when connectivity is restored
 * 5. Proper status bar styling (white bg, dark icons)
 * 6. Geolocation, camera, mic, file-upload permission handling
 * 7. File chooser for image/document uploads from WebView
 */
public class MainActivity extends BridgeActivity {

    private static final int ALL_PERMISSIONS_REQUEST = 1001;
    private static final int FILE_CHOOSER_REQUEST = 1002;

    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean isConnected = true;
    private boolean didFailToLoad = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // File upload callback from WebChromeClient
    private ValueCallback<Uri[]> fileUploadCallback;

    // URI for camera-captured photo (camera returns result via this URI, not intent data)
    private Uri cameraPhotoUri;

    // Offline UI references
    private View offlineBanner;
    private View offlineFullScreen;

    // ==================== Lifecycle ====================

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupStatusBar();
        requestAllPermissions();
        // Delay setup to ensure Capacitor bridge is initialized
        mainHandler.postDelayed(this::setupAfterBridgeReady, 800);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (connectivityManager != null && networkCallback != null) {
            try { connectivityManager.unregisterNetworkCallback(networkCallback); }
            catch (Exception ignored) {}
        }
    }

    // ==================== Permissions ====================

    private void requestAllPermissions() {
        List<String> needed = new ArrayList<>();

        // Camera
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(android.Manifest.permission.CAMERA);
        }
        // Location
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(android.Manifest.permission.ACCESS_FINE_LOCATION);
            needed.add(android.Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        // Microphone (for voice notes)
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(android.Manifest.permission.RECORD_AUDIO);
        }
        // Contacts (for sharing contacts in chat)
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) {
            needed.add(android.Manifest.permission.READ_CONTACTS);
        }
        // Storage / Media
        if (Build.VERSION.SDK_INT >= 33) {
            // Android 13+ granular media permissions
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_MEDIA_IMAGES)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(android.Manifest.permission.READ_MEDIA_IMAGES);
            }
            // Android 13+ requires explicit notification permission
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(android.Manifest.permission.POST_NOTIFICATIONS);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(android.Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this,
                needed.toArray(new String[0]),
                ALL_PERMISSIONS_REQUEST);
        }
    }

    // ==================== Camera Helper ====================

    /**
     * Creates a temporary image file for the camera to write into.
     * The file is stored in the app's external pictures directory.
     */
    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        String imageFileName = "PLYSHIP_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    // ==================== File Upload Result ====================

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileUploadCallback == null) return;

            if (resultCode == Activity.RESULT_OK) {
                Uri[] results = null;

                // Check if result came from multi-select (via ClipData)
                if (data != null && data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
                // Single file selected via getData()
                else if (data != null && data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
                // If no data in intent, check if camera wrote to our pre-set URI
                else if (cameraPhotoUri != null) {
                    results = new Uri[]{cameraPhotoUri};
                }

                if (results != null && results.length > 0) {
                    fileUploadCallback.onReceiveValue(results);
                } else {
                    fileUploadCallback.onReceiveValue(null);
                }
            } else {
                fileUploadCallback.onReceiveValue(null);
            }
            fileUploadCallback = null;
            cameraPhotoUri = null;
        }
    }

    private void setupAfterBridgeReady() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                mainHandler.postDelayed(this::setupAfterBridgeReady, 500);
                return;
            }
            setupWebViewClient();
            setupWebChromeClient();
            registerContactsBridge();
            registerPushBridge();
            injectPullToRefreshScript();
            startNetworkMonitoring();
        } catch (Exception e) {
            mainHandler.postDelayed(this::setupAfterBridgeReady, 500);
        }
    }

    // ==================== Status Bar ====================

    private void setupStatusBar() {
        // Clear any translucent flags that would cause content to draw behind system bars
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);

        // Ensure WebView does NOT draw behind system bars
        View decorView = getWindow().getDecorView();
        decorView.setFitsSystemWindows(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.view.WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.setSystemBarsAppearance(
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int flags = decorView.getSystemUiVisibility();
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            decorView.setSystemUiVisibility(flags);
        }
    }

    // ==================== WebView Client ====================

    private void setupWebViewClient() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();

                // Handle geo: URIs — open Google Maps for meeting locations
                if (scheme != null && scheme.equalsIgnoreCase("geo")) {
                    try {
                        Intent mapIntent = new Intent(Intent.ACTION_VIEW, url);
                        mapIntent.setPackage("com.google.android.apps.maps");
                        if (mapIntent.resolveActivity(getPackageManager()) != null) {
                            startActivity(mapIntent);
                        } else {
                            // No Google Maps — try any maps app
                            startActivity(new Intent(Intent.ACTION_VIEW, url));
                        }
                    } catch (Exception e) {
                        // Fallback: open in browser with HTTPS Google Maps URL
                        try {
                            String query = url.getQueryParameter("q");
                            if (query == null) query = url.getSchemeSpecificPart();
                            Uri fallback = Uri.parse("https://www.google.com/maps/search/?api=1&query=" + Uri.encode(query));
                            startActivity(new Intent(Intent.ACTION_VIEW, fallback));
                        } catch (Exception ignored) {}
                    }
                    return true;
                }

                // Handle UPI intent URLs — these come from Razorpay checkout
                // when the user selects a UPI app (GPay, PhonePe, Paytm, etc.)
                if (scheme != null && (
                    scheme.equalsIgnoreCase("upi") ||
                    scheme.equalsIgnoreCase("intent") ||
                    scheme.equalsIgnoreCase("phonepe") ||
                    scheme.equalsIgnoreCase("gpay") ||
                    scheme.equalsIgnoreCase("paytm") ||
                    scheme.equalsIgnoreCase("tez")
                )) {
                    try {
                        Intent intent;
                        if (scheme.equalsIgnoreCase("intent")) {
                            // Parse intent:// URIs (used by some UPI apps)
                            intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                        } else {
                            intent = new Intent(Intent.ACTION_VIEW, url);
                        }
                        // Ensure the intent can be resolved before launching
                        if (intent.resolveActivity(getPackageManager()) != null) {
                            startActivity(intent);
                        } else {
                            // If no UPI app can handle this, let Razorpay fallback
                            // to QR code or other payment methods
                            return false;
                        }
                    } catch (Exception e) {
                        // Silently fail — Razorpay will show fallback options
                    }
                    return true;
                }

                if (isInternalURL(url)) {
                    return false;
                } else {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (Exception ignored) {}
                    return true;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                didFailToLoad = false;
                hideOfflineFullScreen();
                injectPullToRefreshScript();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    didFailToLoad = true;
                    showOfflineFullScreen();
                }
            }
        });
    }

    // ==================== WebChromeClient (File Upload, Geolocation, Mic) ====================

    private void setupWebChromeClient() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        // Critical WebView settings for media capture
        webView.getSettings().setGeolocationEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);

        webView.setWebChromeClient(new WebChromeClient() {

            // Handle <input type="file"> from web page — CRITICAL for image uploads
            @Override
            public boolean onShowFileChooser(WebView webView,
                                              ValueCallback<Uri[]> filePathCallback,
                                              FileChooserParams fileChooserParams) {
                // Cancel any previous callback
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                try {
                    // Detect if the <input> has capture attribute (i.e. "Take Photo")
                    boolean isCaptureMode = fileChooserParams.isCaptureEnabled();
                    String[] acceptTypes = fileChooserParams.getAcceptTypes();
                    boolean isImageAccept = false;
                    if (acceptTypes != null) {
                        for (String type : acceptTypes) {
                            if (type != null && (type.startsWith("image/") || type.equals("image/*"))) {
                                isImageAccept = true;
                                break;
                            }
                        }
                    }

                    if (isCaptureMode && isImageAccept) {
                        // "Take Photo" — launch camera directly
                        Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        if (cameraIntent.resolveActivity(getPackageManager()) != null) {
                            File photoFile = createImageFile();
                            cameraPhotoUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getApplicationContext().getPackageName() + ".fileprovider",
                                photoFile);
                            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                            startActivityForResult(cameraIntent, FILE_CHOOSER_REQUEST);
                        } else {
                            fileUploadCallback.onReceiveValue(null);
                            fileUploadCallback = null;
                            cameraPhotoUri = null;
                            return false;
                        }
                    } else {
                        // "Photo Library" or other file types — use gallery/file picker
                        // Also build a camera intent as a secondary option in the chooser
                        Intent galleryIntent = fileChooserParams.createIntent();

                        // Enable multi-select for portfolio uploads
                        // (the <input multiple> attribute signals this via the web page)
                        if (fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                            galleryIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                        }
                        // Try to add camera as an option too
                        Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        if (isImageAccept && cameraIntent.resolveActivity(getPackageManager()) != null) {
                            try {
                                File photoFile = createImageFile();
                                cameraPhotoUri = FileProvider.getUriForFile(
                                    MainActivity.this,
                                    getApplicationContext().getPackageName() + ".fileprovider",
                                    photoFile);
                                cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);

                                Intent chooser = Intent.createChooser(galleryIntent, "Select Image");
                                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                                startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                            } catch (IOException e) {
                                // Fallback to gallery only
                                startActivityForResult(galleryIntent, FILE_CHOOSER_REQUEST);
                            }
                        } else {
                            startActivityForResult(galleryIntent, FILE_CHOOSER_REQUEST);
                        }
                    }
                } catch (Exception e) {
                    fileUploadCallback = null;
                    cameraPhotoUri = null;
                    return false;
                }
                return true;
            }

            // Auto-grant geolocation for our domain
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (origin != null && origin.contains("plyship.com")) {
                    callback.invoke(origin, true, false);
                } else {
                    callback.invoke(origin, false, false);
                }
            }

            // Auto-grant ALL media capture permissions (mic, camera) for voice notes
            // This is called by WebView when getUserMedia() is invoked from JavaScript
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Grant all requested resources for our app
                request.grant(request.getResources());
            }
        });
    }

    // ==================== Contacts Bridge ====================

    /**
     * Registers a JavaScript interface that exposes device contacts to the WebView.
     * The web page can call window.PlyshipContacts.getContacts() to fetch all
     * contacts as a JSON string.
     */
    private void registerContactsBridge() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        webView.addJavascriptInterface(new ContactsBridge(), "PlyshipContacts");
    }

    /**
     * JavaScript interface for reading device contacts.
     * Called from web page via window.PlyshipContacts.getContacts().
     * Returns a JSON array of {name, phone} objects.
     */
    private class ContactsBridge {

        @JavascriptInterface
        public String getContacts() {
            if (ContextCompat.checkSelfPermission(MainActivity.this,
                    android.Manifest.permission.READ_CONTACTS)
                    != PackageManager.PERMISSION_GRANTED) {
                // Request permission on main thread
                mainHandler.post(() -> {
                    ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{android.Manifest.permission.READ_CONTACTS},
                        ALL_PERMISSIONS_REQUEST);
                });
                return "PERMISSION_DENIED";
            }

            JSONArray contactsArray = new JSONArray();
            ContentResolver cr = getContentResolver();
            Cursor cursor = null;
            try {
                cursor = cr.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    new String[]{
                        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                        ContactsContract.CommonDataKinds.Phone.NUMBER
                    },
                    null, null,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
                );

                if (cursor != null) {
                    int nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                    int phoneIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                    java.util.HashSet<String> seen = new java.util.HashSet<>();

                    while (cursor.moveToNext()) {
                        String name = nameIdx >= 0 ? cursor.getString(nameIdx) : "";
                        String phone = phoneIdx >= 0 ? cursor.getString(phoneIdx) : "";
                        if (name == null) name = "";
                        if (phone == null) phone = "";
                        // Deduplicate by name+phone
                        String key = name.trim().toLowerCase() + "_" + phone.replaceAll("[^0-9+]", "");
                        if (seen.contains(key) || (name.isEmpty() && phone.isEmpty())) continue;
                        seen.add(key);

                        try {
                            JSONObject contact = new JSONObject();
                            contact.put("name", name.trim());
                            contact.put("phone", phone.trim());
                            contactsArray.put(contact);
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception e) {
                // Return empty array on error
            } finally {
                if (cursor != null) cursor.close();
            }
            return contactsArray.toString();
        }
    }

    // ==================== Push Notifications Bridge ====================

    /**
     * Registers a JavaScript interface that exposes the native FCM push token
     * to the WebView. The web page calls window.PlyshipPush.getToken() to get
     * the FCM registration token for this device.
     *
     * This is necessary because the Web FCM SDK (firebase/messaging) relies on
     * service workers which don't work inside native WebViews. The native
     * Firebase Messaging SDK handles push registration instead.
     */
    private void registerPushBridge() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        webView.addJavascriptInterface(new PushBridge(), "PlyshipPush");
    }

    /**
     * JavaScript interface for push notification token.
     * Called from web page via window.PlyshipPush.getToken().
     * Returns the FCM registration token as a string, or "ERROR" on failure.
     */
    private class PushBridge {

        @JavascriptInterface
        public String getToken() {
            try {
                // Get FCM token synchronously (blocks until available, OK on JS bridge thread)
                String token = com.google.android.gms.tasks.Tasks.await(
                    com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken()
                );
                return token != null ? token : "ERROR";
            } catch (Exception e) {
                Log.e("PlyshipFCM", "Error getting FCM token: " + e.getMessage());
                return "ERROR";
            }
        }
    }

    private boolean isInternalURL(Uri url) {
        if (url == null) return true;
        String scheme = url.getScheme();
        if (scheme == null) return true;
        if ("about".equals(scheme) || "blob".equals(scheme) || "data".equals(scheme)) return true;

        String host = url.getHost();
        if (host == null) return true;
        host = host.toLowerCase();

        if ("plyship.com".equals(host) || host.endsWith(".plyship.com")) return true;
        if (host.endsWith(".firebaseapp.com")) return true;
        if (host.endsWith(".googleapis.com")) return true;
        if (host.endsWith(".google.com")) return true;
        if (host.endsWith(".razorpay.com")) return true;
        // reCAPTCHA / Firebase Auth domains — required for Phone OTP
        if (host.endsWith(".gstatic.com")) return true;
        if (host.endsWith(".recaptcha.net")) return true;

        return false;
    }

    // ==================== Pull to Refresh ====================

    private void injectPullToRefreshScript() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        String js = "(function(){" +
            "if(window.__plyPTR)return;window.__plyPTR=true;" +
            "var startY=0,pulling=false,el=null;" +
            "function mkEl(){if(el)return;el=document.createElement('div');" +
            "el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999999;display:flex;" +
            "justify-content:center;padding-top:env(safe-area-inset-top,24px);pointer-events:none;" +
            "opacity:0;transition:opacity 0.2s;';" +
            "var dot=document.createElement('div');" +
            "dot.style.cssText='width:36px;height:36px;margin-top:8px;border-radius:50%;background:#fff;" +
            "box-shadow:0 2px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;';" +
            "dot.innerHTML='<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" " +
            "stroke=\"#22C55E\" stroke-width=\"2.5\" stroke-linecap=\"round\">" +
            "<polyline points=\"23 4 23 10 17 10\"/>" +
            "<path d=\"M20.49 15a9 9 0 1 1-2.12-9.36L23 10\"/></svg>';" +
            "el.appendChild(dot);document.body.appendChild(el);}" +
            "function atTop(){var t=document.elementFromPoint(window.innerWidth/2,100);" +
            "while(t&&t!==document.body&&t!==document.documentElement){if(t.scrollTop>5)return false;" +
            "t=t.parentElement;}return(document.documentElement.scrollTop||0)<=5;}" +
            "document.addEventListener('touchstart',function(e){" +
            "if(atTop()){startY=e.touches[0].clientY;pulling=true;}},{passive:true});" +
            "document.addEventListener('touchmove',function(e){if(!pulling)return;" +
            "var dy=e.touches[0].clientY-startY;if(dy>10){mkEl();var p=Math.min(dy/120,1);" +
            "el.style.opacity=String(Math.min(p*1.5,1));var svg=el.querySelector('svg');" +
            "if(svg)svg.style.transform='rotate('+(p*360)+'deg)';}else if(dy<-5){pulling=false;" +
            "if(el)el.style.opacity='0';}},{passive:true});" +
            "document.addEventListener('touchend',function(e){if(!pulling)return;pulling=false;" +
            "var dy=(e.changedTouches[0]?e.changedTouches[0].clientY:0)-startY;" +
            "if(dy>100){if(el){var svg=el.querySelector('svg');" +
            "if(svg)svg.style.animation='spin 0.6s linear infinite';" +
            "if(!document.getElementById('__ptr_style')){var s=document.createElement('style');" +
            "s.id='__ptr_style';s.textContent='@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';" +
            "document.head.appendChild(s);}}setTimeout(function(){window.location.reload();},300);" +
            "}else{if(el)el.style.opacity='0';}},{passive:true});})();";

        webView.evaluateJavascript(js, null);
    }

    // ==================== Network Monitoring ====================

    private void startNetworkMonitoring() {
        connectivityManager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;

        // Check initial connectivity
        NetworkCapabilities caps = null;
        if (connectivityManager.getActiveNetwork() != null) {
            caps = connectivityManager.getNetworkCapabilities(connectivityManager.getActiveNetwork());
        }
        isConnected = caps != null && (
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                mainHandler.post(() -> {
                    if (!isConnected) {
                        isConnected = true;
                        hideOfflineBanner();
                        hideOfflineFullScreen();
                        showOnlineToast();
                        if (didFailToLoad) {
                            didFailToLoad = false;
                            WebView wv = getBridge().getWebView();
                            if (wv != null) wv.reload();
                        }
                    }
                });
            }

            @Override
            public void onLost(@NonNull Network network) {
                mainHandler.post(() -> {
                    isConnected = false;
                    showOfflineBanner();
                });
            }
        };

        NetworkRequest request = new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build();
        connectivityManager.registerNetworkCallback(request, networkCallback);
    }

    // ==================== Offline Banner ====================

    private void showOfflineBanner() {
        if (offlineBanner != null) return;

        int bannerH = dpToPx(40);
        int statusH = getStatusBarHeight();

        FrameLayout banner = new FrameLayout(this);
        banner.setBackgroundColor(Color.parseColor("#F2DC2626"));
        banner.setClickable(false);

        TextView label = new TextView(this);
        label.setText("No Internet Connection");
        label.setTextColor(Color.WHITE);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        label.setTypeface(null, Typeface.BOLD);
        label.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, bannerH);
        lp.topMargin = statusH;
        label.setLayoutParams(lp);
        banner.addView(label);

        FrameLayout.LayoutParams bannerParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, statusH + bannerH);
        bannerParams.gravity = Gravity.TOP;
        banner.setLayoutParams(bannerParams);

        banner.setTranslationY(-(statusH + bannerH));
        getRootContent().addView(banner);
        banner.animate().translationY(0).setDuration(350).start();
        offlineBanner = banner;
    }

    private void hideOfflineBanner() {
        if (offlineBanner == null) return;
        final View b = offlineBanner;
        offlineBanner = null;
        b.animate().translationY(-b.getHeight()).setDuration(250).withEndAction(() -> {
            getRootContent().removeView(b);
        }).start();
    }

    // ==================== Online Toast ====================

    private void showOnlineToast() {
        int toastH = dpToPx(40);
        int statusH = getStatusBarHeight();

        FrameLayout toast = new FrameLayout(this);
        toast.setBackgroundColor(Color.parseColor("#F216A34A"));
        toast.setClickable(false);

        TextView label = new TextView(this);
        label.setText("Back Online");
        label.setTextColor(Color.WHITE);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        label.setTypeface(null, Typeface.BOLD);
        label.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, toastH);
        lp.topMargin = statusH;
        label.setLayoutParams(lp);
        toast.addView(label);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, statusH + toastH);
        params.gravity = Gravity.TOP;
        toast.setLayoutParams(params);

        toast.setTranslationY(-(statusH + toastH));
        getRootContent().addView(toast);

        toast.animate().translationY(0).setDuration(300).withEndAction(() -> {
            mainHandler.postDelayed(() -> {
                toast.animate().translationY(-(statusH + toastH)).setDuration(250).withEndAction(() -> {
                    try { getRootContent().removeView(toast); } catch (Exception ignored) {}
                }).start();
            }, 2000);
        }).start();
    }

    // ==================== Offline Full Screen ====================

    private void showOfflineFullScreen() {
        if (offlineFullScreen != null) return;

        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(Color.WHITE);
        overlay.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        overlay.setClickable(true); // Block touches to WebView behind

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams contentParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        content.setLayoutParams(contentParams);

        // Icon
        TextView icon = new TextView(this);
        icon.setText("\uD83D\uDCE1"); // 📡
        icon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 56);
        icon.setGravity(Gravity.CENTER);
        content.addView(icon);

        // Title
        TextView title = new TextView(this);
        title.setText("No Internet Connection");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(null, Typeface.BOLD);
        title.setTextColor(Color.parseColor("#1E1E1E"));
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleP = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleP.topMargin = dpToPx(16);
        title.setLayoutParams(titleP);
        content.addView(title);

        // Subtitle
        TextView subtitle = new TextView(this);
        subtitle.setText("Please check your connection and try again");
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        subtitle.setTextColor(Color.GRAY);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subP = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subP.topMargin = dpToPx(8);
        subtitle.setLayoutParams(subP);
        content.addView(subtitle);

        // Retry button
        TextView retryBtn = new TextView(this);
        retryBtn.setText("Retry");
        retryBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        retryBtn.setTypeface(null, Typeface.BOLD);
        retryBtn.setTextColor(Color.WHITE);
        retryBtn.setGravity(Gravity.CENTER);
        retryBtn.setPadding(dpToPx(32), dpToPx(12), dpToPx(32), dpToPx(12));

        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(Color.parseColor("#22C55E"));
        btnBg.setCornerRadius(dpToPx(12));
        retryBtn.setBackground(btnBg);

        LinearLayout.LayoutParams btnP = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        btnP.topMargin = dpToPx(24);
        retryBtn.setLayoutParams(btnP);
        retryBtn.setOnClickListener(v -> {
            if (isConnected) {
                hideOfflineFullScreen();
                WebView wv = getBridge().getWebView();
                if (wv != null) wv.reload();
            }
        });
        content.addView(retryBtn);

        overlay.addView(content);
        getRootContent().addView(overlay);
        offlineFullScreen = overlay;
    }

    private void hideOfflineFullScreen() {
        if (offlineFullScreen == null) return;
        final View o = offlineFullScreen;
        offlineFullScreen = null;
        o.animate().alpha(0f).setDuration(300).withEndAction(() -> {
            try { getRootContent().removeView(o); } catch (Exception ignored) {}
        }).start();
    }

    // ==================== Helpers ====================

    private ViewGroup getRootContent() {
        return (ViewGroup) findViewById(android.R.id.content);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    private int getStatusBarHeight() {
        int result = 0;
        int resId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resId > 0) {
            result = getResources().getDimensionPixelSize(resId);
        }
        return result;
    }
}
