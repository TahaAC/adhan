package com.shiaazan.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * Restart the background scheduler after the TV boots or reboots.
 *
 * AlarmManager alarms are cleared on reboot, so we must reschedule
 * them. We also start AzanService so the persistent notification
 * comes back, signalling to the user that adhan will fire.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)) return;

        Log.i(TAG, "boot completed — rescheduling adhan");
        try {
            AzanScheduler.scheduleAll(context);
        } catch (Exception e) {
            Log.w(TAG, "scheduleAll failed on boot", e);
        }

        Settings s = Settings.load(context);
        if (s != null && s.isValid()) {
            Intent svc = new Intent(context, AzanService.class);
            if (Build.VERSION.SDK_INT >= 26) {
                try { context.startForegroundService(svc); } catch (Exception e) {
                    Log.w(TAG, "startForegroundService failed on boot", e);
                }
            } else {
                try { context.startService(svc); } catch (Exception e) {
                    Log.w(TAG, "startService failed on boot", e);
                }
            }
        }
    }
}
