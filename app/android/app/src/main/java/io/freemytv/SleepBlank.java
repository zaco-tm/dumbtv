package io.freemytv;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.IBinder;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;

/**
 * The sleep timer's end: the screen goes dark, over whatever is on it. Ours, not upstream's: upstream puts the TV to
 * sleep through the TV's own ADB, which the fork's Guard took over, and the fork has no ADB to use.
 *
 * A foreground service in the sleep timer's own process (:sleep), with the overlay permission the app already holds: a
 * black window over the whole screen, with the panel's brightness at its lowest (screenBrightness, the public way to
 * do it) — Android lets no ordinary app put a TV to sleep, so the picture goes black and the backlight goes down, and
 * the TV stays on. The window keeps the screen on (FLAG_KEEP_SCREEN_ON), so the TV's own screen timeout does not
 * wake the screen behind the blank.
 *
 * Any key brings the picture back, on the same press: the window has the focus, so it gets the keys, and the screen
 * coming back on (ACTION_SCREEN_ON) takes the window off as well, for a TV that was turned off with the remote.
 */
public class SleepBlank extends Service {
    private View view;
    private WindowManager window;
    private boolean gone;   // the window is off and the service is stopping
    private AudioManager audio;
    private AudioFocusRequest audioFocus;
    private BroadcastReceiver screenOn;

    /** The timer ended (the main process): the screen goes dark. */
    static void start(Context c) {
        c.startForegroundService(new Intent(c, SleepBlank.class));
    }

    @Override public void onCreate() {
        super.onCreate();
        // In the foreground first: a quick stop right after the start must not find it still in the background.
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("sleep", Ui.tr("Sleep Timer"), NotificationManager.IMPORTANCE_MIN));
        startForeground(2, new Notification.Builder(this, "sleep").setSmallIcon(R.drawable.icon)
                .setContentTitle(Ui.tr("Sleep Timer")).build());
        window = getSystemService(WindowManager.class);
        view = new View(this);
        view.setBackgroundColor(Color.BLACK);
        view.setFocusable(true);
        view.setFocusableInTouchMode(true);
        // Any key: the picture comes back, on the same press.
        view.setOnKeyListener((v, code, event) -> {
            if (event.getAction() != KeyEvent.ACTION_DOWN) return false;
            dismiss();
            return true;
        });
        WindowManager.LayoutParams layout = new WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,   // the screen does not time out behind the blank
                PixelFormat.OPAQUE);
        layout.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_OFF;   // the panel's lowest
        window.addView(view, layout);
        view.requestFocus();
        pauseTheSound();
        // The screen coming back on takes the window off too: a TV that was turned off with the remote while the
        // timer was up must not come back to a black picture.
        screenOn = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                dismiss();
            }
        };
        registerReceiver(screenOn, new IntentFilter(Intent.ACTION_SCREEN_ON));
    }

    /** The window goes off: the picture is back, and whatever was playing plays again. */
    private void dismiss() {
        if (gone) return;
        gone = true;
        removeView();
        resumeTheSound();
        stopSelf();
    }

    private void removeView() {
        if (view == null) return;
        try {
            window.removeView(view);
        } catch (IllegalArgumentException e) {
            AppLog.w("Sleep timer: " + e.getMessage());   // the window was already gone
        }
        view = null;
    }

    /**
     * Whatever is playing pauses while the screen is dark: the room goes quiet as well. A transient focus, so it
     * resumes when the picture comes back.
     */
    private void pauseTheSound() {
        try {
            audio = getSystemService(AudioManager.class);
            audioFocus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
                    .build();
            audio.requestAudioFocus(audioFocus);
        } catch (Exception e) {
            AppLog.w("Sleep timer: sound: " + e.getMessage());
        }
    }

    private void resumeTheSound() {
        if (audio == null) return;
        try {
            audio.abandonAudioFocusRequest(audioFocus);
        } catch (Exception e) {
            AppLog.w("Sleep timer: sound: " + e.getMessage());
        }
        audio = null;
        audioFocus = null;
    }

    @Override public void onDestroy() {
        if (screenOn != null) {
            try {
                unregisterReceiver(screenOn);
            } catch (IllegalArgumentException e) {
                AppLog.w("Sleep timer: " + e.getMessage());   // it was already gone
            }
            screenOn = null;
        }
        removeView();
        resumeTheSound();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) {
        return null;
    }
}
