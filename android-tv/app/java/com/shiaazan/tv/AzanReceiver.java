package com.shiaazan.tv;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Fires when AlarmManager delivers an adhan alarm.
 *
 * Forwards to AzanService with the prayer name. The service then
 * becomes foreground and plays the reciter audio through the TV
 * speakers. We also reschedule here so the schedule is self-healing
 * even if the app's UI never reopens.
 */
public class AzanReceiver extends android.content.BroadcastReceiver {

    private static final String TAG = "AzanReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String prayer = intent.getStringExtra(AzanScheduler.EXTRA_PRAYER);
        Log.i(TAG, "adhan alarm fired: " + prayer);

        // Reschedule in case some alarms got cleared (e.g. app upgrade).
        try {
            AzanScheduler.scheduleAll(context);
        } catch (Exception e) {
            Log.w(TAG, "reschedule failed", e);
        }

        Intent svc = new Intent(context, AzanService.class)
                .setAction(AzanScheduler.ACTION_PLAY)
                .putExtra(AzanScheduler.EXTRA_PRAYER, prayer);
        // Android 8+: startForegroundService() so the service has 5s
        // to call startForeground().
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            context.startForegroundService(svc);
        } else {
            context.startService(svc);
        }
    }
}
