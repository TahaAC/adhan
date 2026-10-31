package com.shiaazan.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Shia Azan — Android TV shell.
 *
 * A single fullscreen WebView around the bundled TV web app
 * (assets/tv.html). Key behaviours:
 *  - JavaScript + DOM storage enabled (settings persistence)
 *  - mediaPlaybackRequiresUserGesture(false) so the adhan plays by
 *    itself at prayer time
 *  - FLAG_KEEP_SCREEN_ON so the TV acts as a prayer clock
 *  - D-pad works out of the box (WebView maps it to arrow keys /
 *    Enter, and the web app implements spatial navigation)
 *  - Back button is forwarded to the page first (window.__handleBack)
 *    so it closes overlays; otherwise the app goes to background.
 */
public class MainActivity extends Activity implements ValueCallback {

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
        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(0xFF03150E);

        web.loadUrl("file:///android_asset/tv.html");
        setContentView(web);
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
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
