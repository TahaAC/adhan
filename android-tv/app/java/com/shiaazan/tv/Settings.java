package com.shiaazan.tv;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/**
 * Persisted app settings used by the background scheduler.
 *
 * The WebView (tv.html) is the source of truth while the app is open;
 * it pushes a JSON snapshot here via the JavaScript interface, and the
 * native scheduler uses the snapshot to compute prayer times with the
 * Java PrayTime port — so alarms fire even when the WebView is gone.
 */
public class Settings {
    private static final String PREFS = "shiaazan";
    private static final String KEY_JSON = "settings_json";

    public double lat = 0, lng = 0;
    public String method = "Tehran";
    public String asr = "Standard";
    public String reciterId = "Moazzen-Zadeh";
    public double volume = 1.0;
    public boolean adhanEnabled = true;
    public Map<String, Boolean> prayerEnabled = new HashMap<>();
    {
        prayerEnabled.put("fajr",    true);
        prayerEnabled.put("sunrise", false);
        prayerEnabled.put("dhuhr",   true);
        prayerEnabled.put("asr",     true);
        prayerEnabled.put("maghrib", true);
        prayerEnabled.put("isha",    true);
        prayerEnabled.put("midnight",false);
    }

    public boolean isValid() {
        return lat != 0 || lng != 0;
    }

    public boolean isPrayerEnabled(String name) {
        Boolean b = prayerEnabled.get(name);
        return b != null && b && adhanEnabled;
    }

    /** Save as JSON. */
    public static void save(Context ctx, Settings s) {
        try {
            JSONObject o = new JSONObject();
            o.put("lat", s.lat);
            o.put("lng", s.lng);
            o.put("method", s.method);
            o.put("asr", s.asr);
            o.put("reciterId", s.reciterId);
            o.put("volume", s.volume);
            o.put("adhanEnabled", s.adhanEnabled);
            JSONObject pe = new JSONObject();
            for (Map.Entry<String, Boolean> e : s.prayerEnabled.entrySet()) {
                pe.put(e.getKey(), e.getValue());
            }
            o.put("prayerEnabled", pe);
            prefs(ctx).edit().putString(KEY_JSON, o.toString()).apply();
        } catch (Exception e) {
            // best-effort
        }
    }

    /** Load from JSON, or null if never saved. */
    public static Settings load(Context ctx) {
        String json = prefs(ctx).getString(KEY_JSON, null);
        if (json == null) return null;
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
                for (String k : new String[]{"fajr","sunrise","dhuhr","asr","maghrib","isha","midnight"}) {
                    if (pe.has(k)) s.prayerEnabled.put(k, pe.getBoolean(k));
                }
            }
            return s;
        } catch (Exception e) {
            return null;
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
