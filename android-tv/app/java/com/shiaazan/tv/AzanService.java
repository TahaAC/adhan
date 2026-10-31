package com.shiaazan.tv;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Foreground service that plays the adhan through the TV speakers at
 * prayer time — even when the app is closed or the TV was rebooted.
 *
 * Two modes:
 *  - ACTION_PLAY (from AzanReceiver / JS bridge): become foreground
 *    with a "playing" notification, stream the reciter MP3 from
 *    praytimes.org via MediaPlayer, and release on completion.
 *  - Default start (from MainActivity / BootReceiver): a quiet
 *    persistent foreground that keeps the process alive between
 *    alarms, so alarms fire on time.
 *
 * The persistent notification is essential: a foreground service on
 * Android TV is far less likely to be killed by the system, and a
 * mains-powered TV has no battery-optimisation reason to kill it.
 */
public class AzanService extends Service implements MediaPlayer.OnCompletionListener,
        MediaPlayer.OnErrorListener, MediaPlayer.OnPreparedListener {

    private static final String TAG = "AzanService";
    private static final String CHAN_ID = "azan";
    private static final int NOTIF_ID_PERSISTENT = 1;
    private static final int NOTIF_ID_PLAYING    = 2;

    private MediaPlayer player = null;
    private boolean prepared = false;
    private boolean playing = false;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
        // Become foreground immediately with a persistent "running"
        // notification, so the OS keeps us alive between alarms.
        startForeground(NOTIF_ID_PERSISTENT, persistentNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && AzanScheduler.ACTION_PLAY.equals(intent.getAction())) {
            String prayer = intent.getStringExtra(AzanScheduler.EXTRA_PRAYER);
            Log.i(TAG, "play adhan: " + prayer);
            // Switch the foreground notification to "playing"
            startForeground(NOTIF_ID_PLAYING, playingNotification(prayer));
            playAdhan(prayer);
        }
        // START_STICKY: rebuild if killed; alarms will restart us anyway.
        return START_STICKY;
    }

    // ---------- audio playback ----------

    private void playAdhan(String prayer) {
        Settings s = Settings.load(this);
        if (s == null) {
            Log.w(TAG, "no settings, cannot play");
            stopAdhanAndIdle();
            return;
        }
        // Some users disable certain prayers; respect that even here.
        if (!s.isPrayerEnabled(prayer)) {
            Log.i(TAG, "prayer " + prayer + " disabled, skipping");
            stopAdhanAndIdle();
            return;
        }

        String reciterId = s.reciterId;
        String url = "https://praytimes.org/audio/shia/" + reciterId + ".mp3";

        releasePlayer();
        try {
            player = new MediaPlayer();
            player.setOnPreparedListener(this);
            player.setOnCompletionListener(this);
            player.setOnErrorListener(this);
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            player.setLooping(false);
            // Wake lock so the CPU stays up to stream while the screen
            // may be off (TV in standby).
            player.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            float vol = (float) Math.max(0, Math.min(1, s.volume));
            player.setVolume(vol, vol);
            player.setDataSource(url);
            prepared = false;
            playing = false;
            player.prepareAsync();
            Log.i(TAG, "preparing adhan stream: " + url);
        } catch (Exception e) {
            Log.e(TAG, "MediaPlayer setup failed", e);
            stopAdhanAndIdle();
        }
    }

    @Override
    public void onPrepared(MediaPlayer mp) {
        prepared = true;
        playing = true;
        try { mp.start(); } catch (Exception e) { Log.e(TAG, "start failed", e); }
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        Log.i(TAG, "adhan completed");
        stopAdhanAndIdle();
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        Log.e(TAG, "MediaPlayer error what=" + what + " extra=" + extra);
        stopAdhanAndIdle();
        return true;
    }

    private void releasePlayer() {
        if (player != null) {
            try { if (prepared) player.stop(); } catch (Exception ignore) {}
            try { player.release(); } catch (Exception ignore) {}
            player = null;
        }
        prepared = false;
        playing = false;
    }

    /** Stop playback and drop back to the persistent idle notification. */
    private void stopAdhanAndIdle() {
        releasePlayer();
        // Demote the foreground notification back to the persistent
        // "running" one. We can't call stopForeground(STOP_FOREGROUND_REMOVE)
        // and re-call startForeground in the same cycle reliably across
        // Android versions, so we just update the notification content.
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID_PERSISTENT, persistentNotification());
        // Cancel the "playing" notification (different ID).
        if (nm != null) nm.cancel(NOTIF_ID_PLAYING);
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        super.onDestroy();
    }

    // ---------- notifications ----------

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHAN_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHAN_ID, "Adhan", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Prayer-time adhan reminders");
                nm.createNotificationChannel(ch);
            }
        }
    }

    private Notification persistentNotification() {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) b = new Notification.Builder(this, CHAN_ID);
        else                             b = new Notification.Builder(this).setPriority(Notification.PRIORITY_LOW);
        return b
                .setContentTitle("Shia Azan")
                .setContentText("Background adhan active")
                .setSmallIcon(android.R.drawable.ic_menu_recent_history)
                .setOngoing(true)
                .build();
    }

    private Notification playingNotification(String prayer) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) b = new Notification.Builder(this, CHAN_ID);
        else                             b = new Notification.Builder(this).setPriority(Notification.PRIORITY_HIGH);
        return b
                .setContentTitle("Adhan — " + prayer)
                .setContentText("Playing through TV speakers")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .build();
    }
}
