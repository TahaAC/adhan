package com.shiaazan.tv;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;
import java.util.Map;

/**
 * Schedules adhan alarms via AlarmManager.setAlarmClock().
 *
 * setAlarmClock is the most reliable alarm API on Android — it
 * survives Doze, does not require SCHEDULE_EXACT_ALARM permission,
 * and works on every API level we target (21+). It is the right
 * choice for prayer times: the user expects them at the exact minute.
 *
 * We schedule up to 7 days in advance so adhan keeps firing even if
 * the app is never reopened (e.g. the TV reboots and the user does
 * not launch the app). The BootReceiver also calls scheduleAll().
 */
public class AzanScheduler {

    private static final String TAG = "AzanScheduler";
    public  static final String EXTRA_PRAYER = "prayer";
    public  static final String ACTION_PLAY  = "com.shiaazan.tv.PLAY_ADHAN";

    // requestCode per prayer per day offset
    private static int rcFor(int dayOffset, String prayer) {
        // hash prayer name into 0..99
        int ph = (prayer.hashCode() & 0xff);
        return dayOffset * 1000 + ph;
    }

    /** Schedule adhan for all enabled prayers, today through +6 days. */
    public static void scheduleAll(Context ctx) {
        Settings s = Settings.load(ctx);
        if (s == null || !s.isValid()) {
            Log.i(TAG, "no settings yet, skipping schedule");
            return;
        }
        cancelAll(ctx);

        PrayTime pt = new PrayTime()
                .setMethod(s.method)
                .setAsr(s.asr)
                .setLocation(s.lat, s.lng);

        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        int scheduled = 0;

        String[] prayers = {"fajr","sunrise","dhuhr","asr","maghrib","isha","midnight"};

        for (int day = 0; day < 7; day++) {
            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.DAY_OF_YEAR, day);
            Map<String, Long> times = pt.getTimes(cal);

            for (String p : prayers) {
                if (!s.isPrayerEnabled(p)) continue;
                long t = times.get(p);
                if (t <= now) continue;
                Intent i = new Intent(ctx, AzanReceiver.class)
                        .setAction(ACTION_PLAY)
                        .putExtra(EXTRA_PRAYER, p);
                int rc = rcFor(day, p);
                PendingIntent pi = PendingIntent.getBroadcast(
                        ctx, rc, i,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                try {
                    AlarmManager.AlarmClockInfo info =
                            new AlarmManager.AlarmClockInfo(t, pi);
                    am.setAlarmClock(info, pi);
                    scheduled++;
                } catch (SecurityException se) {
                    Log.w(TAG, "setAlarmClock denied for " + p + " day " + day, se);
                }
            }
        }
        Log.i(TAG, "scheduled " + scheduled + " adhan alarms (method=" + s.method
                + " lat=" + s.lat + " lng=" + s.lng + ")");
    }

    /** Cancel every alarm we may have set. */
    public static void cancelAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        String[] prayers = {"fajr","sunrise","dhuhr","asr","maghrib","isha","midnight"};
        for (int day = 0; day < 7; day++) {
            for (String p : prayers) {
                Intent i = new Intent(ctx, AzanReceiver.class)
                        .setAction(ACTION_PLAY)
                        .putExtra(EXTRA_PRAYER, p);
                int rc = rcFor(day, p);
                PendingIntent pi = PendingIntent.getBroadcast(
                        ctx, rc, i,
                        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pi != null) am.cancel(pi);
            }
        }
    }
}
