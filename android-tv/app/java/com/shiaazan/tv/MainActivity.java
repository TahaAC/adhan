package com.shiaazan.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.util.Log;

import org.json.JSONObject;

/**
 * Shia Azan — Android TV shell.
 *
 * A single fullscreen WebView around the bundled TV web app
 * (assets/tv.html). Key behaviours:
 *  - JavaScript + DOM storage enabled (settings persistence)
 *  - mediaPlaybackRequiresUserGesture(false) so the adhan can autoplay
 *  - FLAG_KEEP_SCREEN_ON so the TV acts as a prayer clock
 *  - D-pad navigation (WebView maps it to arrow keys / Enter)
 *  - Back button is forwarded to the page first (window.__handleBack)
 *
 *  Background adhan:
 *  - A JavaScript interface ("Android") receives the user's settings
 *    snapshot (location, method, reciter, prayer-enabled flags) and
 *    today's prayer times from the WebView, persists them to
 *    SharedPreferences, and tells AzanScheduler to set AlarmManager
 *    alarms for every enabled prayer for the next 7 days.
 *  - The WebView's own audio play path is overridden to call
 *    Android.playAdhan(name), which starts AzanService — the same
 *    service that fires from the alarm. This way adhan plays through
 *    the TV speakers whether the app is open or closed.
 *  - The persistent foreground service is started on app launch and
 *    on device boot (BootReceiver).
 */
public class MainActivity extends Activity implements ValueCallback {

    private static final String TAG = "MainActivity";
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the screen on — the app doubles as a prayer clock.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setWebChromeClient(new WebChromeClient());
        // Use a NAMED inner class for WebViewClient — d8 in build-tools
        // 33/34 throws an internal NPE on anonymous WebViewClient subclasses
        // that touch outer-class state (see the existing raw-ValueCallback
        // comment below for a related d8 quirk).
        web.setWebViewClient(new AzanWebViewClient(this));
        web.setBackgroundColor(0xFF03150E);
        web.addJavascriptInterface(new AzanBridge(this), "AndroidBridge");

        web.loadUrl("file:///android_asset/tv.html");
        setContentView(web);

        // Ask for POST_NOTIFICATIONS on Android 13+ so the foreground
        // service notification is visible (default-deny on phones,
        // default-allow on most Android TVs but ask to be safe).
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1001);
            }
        }

        // Start the persistent foreground service so alarms fire on time.
        startAzanService();
    }

    private void startAzanService() {
        Intent svc = new Intent(this, AzanService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc);
            else                              startService(svc);
        } catch (Exception e) {
            Log.w(TAG, "startAzanService failed", e);
        }
    }

    /** Inject a small bridge that:
     *   1. Sends the current settings + prayer times from the page to
     *      native (so the scheduler can compute alarms with the Java
     *      PrayTime port).
     *   2. Overrides the page's adhan play path so it goes through
     *      the native service (works in foreground and background). */
    private void installBridge(WebView v) {
        v.evaluateJavascript(
            "(function(){\n" +
            "  try {\n" +
            "    function snapshot(){\n" +
            "      var S = window.S || {};\n" +
            "      var out = {\n" +
            "        lat: S.lat||0, lng: S.lng||0,\n" +
            "        method: S.method||'Tehran',\n" +
            "        asr: S.asr||'Standard',\n" +
            "        reciterId: S.reciterId||'Moazzen-Zadeh',\n" +
            "        volume: (typeof S.volume==='number')?S.volume:1,\n" +
            "        adhanEnabled: (typeof S.adhan==='boolean')?S.adhan:true,\n" +
            "        prayerEnabled: S.azanEnabled||{fajr:true,sunrise:false,dhuhr:true,asr:true,maghrib:true,isha:true,midnight:false}\n" +
            "      };\n" +
            "      return JSON.stringify(out);\n" +
            "    }\n" +
            "    // Push settings to native now and whenever they change.\n" +
            "    if (window.AndroidBridge && AndroidBridge.saveSettings) {\n" +
            "      AndroidBridge.saveSettings(snapshot());\n" +
            "    }\n" +
            "    // Override the page's adhan trigger. The page's playAzan()\n" +
            "    // function exists once tv.html has booted; we replace it so\n" +
            "    // playback goes through the native service (background-safe).\n" +
            "    if (typeof window.playAzan === 'function' && window.__azanBridgeInstalled !== true) {\n" +
            "      var origPlayAzan = window.playAzan;\n" +
            "      window.playAzan = function(name, isTest){\n" +
            "        if (isTest) { origPlayAzan(name, isTest); return; }\n" +
            "        if (window.AndroidBridge && AndroidBridge.playAdhan) {\n" +
            "          AndroidBridge.playAdhan(name);\n" +
            "        }\n" +
            "      };\n" +
            "      window.__azanBridgeInstalled = true;\n" +
            "    }\n" +
            "    // Hook settings save so we re-push when the user changes them.\n" +
            "    if (window.saveSettings && window.__azanSaveHooked !== true) {\n" +
            "      var origSave = window.saveSettings;\n" +
            "      window.saveSettings = function(){\n" +
            "        var r = origSave.apply(this, arguments);\n" +
            "        try { if (window.AndroidBridge) AndroidBridge.saveSettings(snapshot()); } catch(e){}\n" +
            "        return r;\n" +
            "      };\n" +
            "      window.__azanSaveHooked = true;\n" +
            "    }\n" +
            "    // Re-run periodically (the page may not have S defined at first paint)\n" +
            "    setTimeout(function(){\n" +
            "      try { if (window.AndroidBridge && AndroidBridge.saveSettings) AndroidBridge.saveSettings(snapshot()); } catch(e){}\n" +
            "    }, 1500);\n" +
            "  } catch(e) { /* ignore */ }\n" +
            "})();",
            null);
    }

    /** Named WebViewClient that installs the JS bridge once the page
     *  has finished loading. (Anonymous WebViewClient subclasses trip
     *  d8's NPE; see comment near its instantiation.) */
    private static class AzanWebViewClient extends WebViewClient {
        private final MainActivity ctx;
        AzanWebViewClient(MainActivity ctx) { this.ctx = ctx; }

        @Override
        public void onPageFinished(WebView v, String url) {
            super.onPageFinished(v, url);
            ctx.installBridge(v);
        }
    }

    /** JS interface exposed as window.AndroidBridge. */
    private static class AzanBridge {
        private final MainActivity ctx;
        AzanBridge(MainActivity ctx) { this.ctx = ctx; }

        @JavascriptInterface
        public void saveSettings(final String json) {
            try {
                JSONObject o = new JSONObject(json);
                Settings s = new Settings();
                s.lat = o.optDouble("lat", 0);
                s.lng = o.optDouble("lng", 0);
                s.method = o.optString("method", "Tehran");
                s.asr = o.optString("asr", "Standard");
                s.reciterId = o.optString("reciterId", "Moazzen-Zadeh");
                s.volume = o.optDouble("volume", 1.0);
                s.adhanEnabled = o.optBoolean("adhanEnabled", true);
                JSONObject pe = o.optJSONObject("prayerEnabled");
                if (pe != null) {
                    String[] keys = {"fajr","sunrise","dhuhr","asr","maghrib","isha","midnight"};
                    for (String k : keys) if (pe.has(k)) s.prayerEnabled.put(k, pe.getBoolean(k));
                }
                Settings.save(ctx, s);
                AzanScheduler.scheduleAll(ctx);
                Log.i(TAG, "settings saved + schedule refreshed");
            } catch (Exception e) {
                Log.w(TAG, "saveSettings parse failed", e);
            }
        }

        @JavascriptInterface
        public void playAdhan(String prayer) {
            Intent svc = new Intent(ctx, AzanService.class)
                    .setAction(AzanScheduler.ACTION_PLAY)
                    .putExtra(AzanScheduler.EXTRA_PRAYER, prayer);
            try {
                if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(svc);
                else                              ctx.startService(svc);
            } catch (Exception e) {
                Log.w(TAG, "playAdhan: start service failed", e);
            }
        }

        @JavascriptInterface
        public void log(String msg) {
            Log.i(TAG, "[js] " + msg);
        }
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        // Let the page close its overlays first; if it declines,
        // send the app to the background instead of finishing it so
        // the adhan scheduler keeps running.
        web.evaluateJavascript(
            "(window.__handleBack ? window.__handleBack() : false)", this);
    }

    /** Result of window.__handleBack() above. Raw ValueCallback: the
     *  generic form trips an NPE in build-tools' d8 (R8) dexer. */
    @Override
    public void onReceiveValue(Object value) {
        if (value == null || !"\"true\"".equals(value)) {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        // Refresh schedule each time we come back to the foreground.
        try { AzanScheduler.scheduleAll(this); } catch (Exception ignore) {}
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
