package com.shiaazan.tv;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;
import java.util.TimeZone;

/**
 * Java port of PrayTime.js v3.2 (MIT, Hamid Zarrabi-Zadeh).
 *
 * Faithful port of the algorithm in public/praytime.js — used by the
 * background adhan service so prayer times can be computed without
 * the WebView running.
 *
 * Method encoding (per-method override, 0 = inherit from defaults):
 *   {fajrAngle, isha (pos=deg, neg=-min, 0=inherit),
 *    maghrib (pos=deg, neg=-min, 0=inherit), midnight (0=Std, 1=Jafari)}
 *
 * Defaults: isha=14deg, maghrib=1min, midnight=Standard.
 */
public class PrayTime {

    private static final double[] DEFAULTS = new double[]{ 0, 14, -1, 0 };

    private static final Map<String, double[]> METHODS = new HashMap<>();
    static {
        METHODS.put("MWL",       new double[]{ 18.0,   17.0,  0, 0});
        METHODS.put("ISNA",      new double[]{ 15.0,   15.0,  0, 0});
        METHODS.put("Egypt",     new double[]{ 19.5,   17.5,  0, 0});
        METHODS.put("Makkah",    new double[]{ 18.5,  -90.0,  0, 0}); // isha = 90 min after maghrib
        METHODS.put("Karachi",   new double[]{ 18.0,   18.0,  0, 0});
        METHODS.put("Tehran",    new double[]{ 17.7,    0.0,  4.5, 1}); // maghrib 4.5 deg, Jafari midnight
        METHODS.put("Jafari",    new double[]{ 16.0,    0.0,  4.0, 1});
        METHODS.put("France",    new double[]{ 12.0,   12.0,  0, 0});
        METHODS.put("Russia",    new double[]{ 16.0,   15.0,  0, 0});
        METHODS.put("Malaysia",  new double[]{ 20.0,   18.0,  0, 0});
        METHODS.put("Singapore", new double[]{ 20.0,   18.0,  0, 0});
    }

    // Resolved settings (after defaults + method overrides)
    private double fajr = 0;
    private double ishaAngle = 14;
    private boolean ishaIsMin = false;
    private double ishaMin = 0;
    private double maghribAngle = 0;     // valid when !maghribIsMin
    private boolean maghribIsMin = true;
    private double maghribMin = 1;
    private boolean midnightJafari = false;
    private double dhuhrMin = 0;
    private String asrMode = "Standard"; // "Standard" | "Hanafi"
    private String highLats = "NightMiddle";
    private String rounding = "nearest";
    private double lat = 0, lng = 0;
    private long utcTime;
    private boolean adjusted;

    public PrayTime() {
        setMethod("MWL");
    }

    public PrayTime setMethod(String m) {
        apply(DEFAULTS);
        double[] p = METHODS.get(m);
        if (p != null) apply(p);
        return this;
    }

    private void apply(double[] p) {
        if (p[0] != 0) fajr = p[0];
        if (p[1] != 0) {
            if (p[1] < 0) { ishaIsMin = true;  ishaMin = -p[1]; }
            else          { ishaIsMin = false; ishaAngle = p[1]; }
        }
        if (p[2] != 0) {
            if (p[2] < 0) { maghribIsMin = true;  maghribMin = -p[2]; }
            else          { maghribIsMin = false; maghribAngle = p[2]; }
        }
        midnightJafari = (p[3] == 1);
    }

    public PrayTime setLocation(double lat, double lng) {
        this.lat = lat; this.lng = lng; return this;
    }
    public PrayTime setAsr(String mode) { this.asrMode = mode; return this; }
    public PrayTime setHighLats(String mode) { this.highLats = mode; return this; }
    public PrayTime setRounding(String r) { this.rounding = r; return this; }
    public PrayTime setDhuhrOffsetMinutes(double m) { this.dhuhrMin = m; return this; }

    /** Compute prayer times for the given calendar day. Returns name -> epoch millis. */
    public Map<String, Long> getTimes(Calendar date) {
        int y = date.get(Calendar.YEAR);
        int mo = date.get(Calendar.MONTH) + 1;
        int d = date.get(Calendar.DAY_OF_MONTH);
        utcTime = utcMillis(y, mo, d);

        Map<String, Double> times = new HashMap<>();
        times.put("fajr",    5.0);
        times.put("sunrise", 6.0);
        times.put("dhuhr",  12.0);
        times.put("asr",    13.0);
        times.put("sunset", 18.0);
        times.put("maghrib",18.0);
        times.put("isha",   18.0);
        times.put("midnight",24.0);

        times = processTimes(times);
        adjustHighLats(times);
        updateTimes(times);
        convertTimes(times);

        Map<String, Long> out = new HashMap<>();
        for (Map.Entry<String, Double> e : times.entrySet()) {
            double v = e.getValue();
            out.put(e.getKey(), Double.isNaN(v) ? 0L : (long) Math.floor(v));
        }
        return out;
    }

    public Map<String, Long> getTimesToday() {
        return getTimes(Calendar.getInstance());
    }

    /** Returns epoch millis for the next occurrence of the given prayer after now. */
    public long getNextPrayerTime(String prayerName, long nowMillis) {
        Calendar cal = Calendar.getInstance();
        Map<String, Long> t = getTimes(cal);
        long v = t.get(prayerName);
        if (v > nowMillis) return v;
        cal.add(Calendar.DAY_OF_YEAR, 1);
        t = getTimes(cal);
        return t.get(prayerName);
    }

    // ---------- compute / process ----------

    private Map<String, Double> processTimes(Map<String, Double> times) {
        double horizon = 0.833;
        Map<String, Double> r = new HashMap<>();
        r.put("fajr",    angleTime(fajr, times.get("fajr"), -1));
        r.put("sunrise", angleTime(horizon, times.get("sunrise"), -1));
        r.put("dhuhr",  midDay(times.get("dhuhr")));
        r.put("asr",    angleTime(asrAngle(times.get("asr")), times.get("asr"), 1));
        r.put("sunset", angleTime(horizon, times.get("sunset"), 1));
        // Use the resolved raw value (degree angle or the minute value as a number;
        // JS does this.value(angle) which extracts the number from e.g. '1 min').
        r.put("maghrib",angleTime(maghribIsMin ? maghribMin : maghribAngle, times.get("maghrib"), 1));
        r.put("isha",   angleTime(ishaIsMin ? ishaMin : ishaAngle,          times.get("isha"),    1));
        r.put("midnight",midDay(times.get("midnight")) + 12);
        return r;
    }

    private void updateTimes(Map<String, Double> times) {
        if (maghribIsMin) {
            times.put("maghrib", times.get("sunset") + maghribMin / 60.0);
        }
        if (ishaIsMin) {
            times.put("isha", times.get("maghrib") + ishaMin / 60.0);
        }
        if (midnightJafari) {
            double nextFajr = angleTime(fajr, 29.0, -1) + 24;
            times.put("midnight", (times.get("sunset") + (adjusted ? times.get("fajr") + 24 : nextFajr)) / 2.0);
        }
        times.put("dhuhr", times.get("dhuhr") + dhuhrMin / 60.0);
    }

    private void convertTimes(Map<String, Double> times) {
        for (Map.Entry<String, Double> e : times.entrySet()) {
            double time = e.getValue() - lng / 15.0;
            double timestamp = utcTime + Math.floor(time * 3600000.0);
            e.setValue((double) roundTime((long) timestamp));
        }
    }

    private long roundTime(long timestamp) {
        if ("none".equals(rounding)) return timestamp;
        long oneMin = 60000L;
        if ("up".equals(rounding))    return (long) Math.ceil(timestamp / (double) oneMin) * oneMin;
        if ("down".equals(rounding))  return (long) Math.floor(timestamp / (double) oneMin) * oneMin;
        return (long) Math.round(timestamp / (double) oneMin) * oneMin;
    }

    // ---------- sun position ----------

    private double[] sunPosition(double time) {
        double D = utcTime / 86400000.0 - 10957.5 + time / 24.0 - lng / 360.0;
        double g = mod(357.529 + 0.98560028 * D, 360);
        double q = mod(280.459 + 0.98564736 * D, 360);
        double L = mod(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
        double e = 23.439 - 0.00000036 * D;
        double RA = mod(arctan2(cos(e) * sin(L), cos(L)) / 15.0, 24);
        double decl = arcsin(sin(e) * sin(L));
        double eqt = q / 15.0 - RA;
        return new double[]{ decl, eqt };
    }

    private double midDay(double time) {
        double eqt = sunPosition(time)[1];
        return mod(12 - eqt, 24);
    }

    private double angleTime(double angle, double time, int direction) {
        double decl = sunPosition(time)[0];
        double numerator = -sin(angle) - sin(lat) * sin(decl);
        double denom = cos(lat) * cos(decl);
        double ratio = denom == 0 ? Double.NaN : numerator / denom;
        // Do NOT clamp: Math.acos(out-of-range) returns NaN, which JS relies on
        // for high-latitude fall-through into adjustHighLats().
        double diff = arccos(ratio) / 15.0;
        return midDay(time) + diff * direction;
    }

    private double asrAngle(double time) {
        double shadowFactor = "Hanafi".equals(asrMode) ? 2.0 : 1.0;
        double decl = sunPosition(time)[0];
        return -arccot(shadowFactor + tan(Math.abs(lat - decl)));
    }

    // ---------- higher latitudes ----------

    private void adjustHighLats(Map<String, Double> times) {
        if ("None".equals(highLats)) return;
        adjusted = false;
        double night = 24 + times.get("sunrise") - times.get("sunset");
        times.put("fajr",    adjustTime(times.get("fajr"),    times.get("sunrise"), fajr,                                  night, -1));
        times.put("isha",    adjustTime(times.get("isha"),    times.get("sunset"),  ishaIsMin ? 0 : ishaAngle,             night, 1));
        times.put("maghrib", adjustTime(times.get("maghrib"), times.get("sunset"),  maghribIsMin ? 0 : maghribAngle,       night, 1));
    }

    private double adjustTime(double time, double base, double angle, double night, int direction) {
        double portion;
        if ("NightMiddle".equals(highLats))        portion = night / 2.0;
        else if ("OneSeventh".equals(highLats))    portion = night / 7.0;
        else if ("AngleBased".equals(highLats))    portion = night * angle / 60.0;
        else                                       portion = night / 2.0;
        double timeDiff = (time - base) * direction;
        if (Double.isNaN(time) || timeDiff > portion) {
            time = base + portion * direction;
            adjusted = true;
        }
        return time;
    }

    // ---------- trig (degrees) ----------

    private static double dtr(double d) { return d * Math.PI / 180.0; }
    private static double rtd(double r) { return r * 180.0 / Math.PI; }
    private static double sin(double d) { return Math.sin(dtr(d)); }
    private static double cos(double d) { return Math.cos(dtr(d)); }
    private static double tan(double d) { return Math.tan(dtr(d)); }
    private static double arcsin(double d) { return rtd(Math.asin(d)); }
    private static double arccos(double d) { return rtd(Math.acos(d)); }
    private static double arccot(double x) { return rtd(Math.atan(1.0 / x)); }
    private static double arctan2(double y, double x) { return rtd(Math.atan2(y, x)); }

    private static double mod(double a, double b) { return ((a % b) + b) % b; }

    private static long utcMillis(int y, int m, int d) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.clear();
        c.set(Calendar.YEAR, y);
        c.set(Calendar.MONTH, m - 1);
        c.set(Calendar.DAY_OF_MONTH, d);
        return c.getTimeInMillis();
    }
}
