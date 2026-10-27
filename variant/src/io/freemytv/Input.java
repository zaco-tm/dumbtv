package io.freemytv;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.tv.TvContract;
import android.media.tv.TvInputManager;
import android.media.tv.TvView;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.util.List;

/**
 * Shows an HDMI, AV or other passthrough input inside the fork, through Android's TvView.
 *
 * Handing the passthrough channel URI to the TV's own app is not enough everywhere: on a Fire TV
 * Edition television that app is Amazon's Live TV, which lands in its channel-scan settings when
 * no channels are scanned, and Amazon's home opens inputs through a service that needs a system
 * permission. TvView is the public API for the same thing: it asks the TV input service for a
 * session and hands it this window's surface. No permission is involved, and the picture goes
 * away with this screen, so HOME and BACK behave like everywhere else in the home screen.
 *
 * Ours, not upstream's: it is the port of the launcher's input screen
 * (launcher/src/tv/dumbtv/home/Input.java), and it is listed in variant/our-files.txt.
 */
public final class Input extends Activity {
    private static final int MATCH = ViewGroup.LayoutParams.MATCH_PARENT;
    private static final int WRAP = ViewGroup.LayoutParams.WRAP_CONTENT;
    private static final String EXTRA_ID = "input", EXTRA_NAME = "name";
    private static final long NAME_MS = 2500, SIGNAL_MS = 6000;
    private static final String FAILED = "Could not open input", NO_SIGNAL = "No signal";
    private static final String AMAZON_LIVE_TV = "com.amazon.tv.livetv";
    /** The same two colours the launcher uses for text over a picture. */
    private static final int TEXT = 0xFFF2F2F3, MUTED = 0x99FFFFFF;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final AudioManager.OnAudioFocusChangeListener focus = change -> { };
    private TvView view;
    private TextView name, status;
    private String id;
    private final Runnable hideName = () -> name.animate().alpha(0f).setDuration(250)
            .withEndAction(() -> name.setVisibility(View.GONE)).start();
    private final Runnable noSignal = () -> status(NO_SIGNAL);

    private final TvView.TvInputCallback watch = new TvView.TvInputCallback() {
        @Override
        public void onConnectionFailed(String inputId) {
            status(FAILED);
        }

        @Override
        public void onDisconnected(String inputId) {
            status(FAILED);
        }

        @Override
        public void onVideoAvailable(String inputId) {
            status(null);
        }

        @Override
        public void onVideoUnavailable(String inputId, int reason) {
            // Tuning and buffering are on the way to a picture; everything else means none is coming.
            boolean pending = reason == TvInputManager.VIDEO_UNAVAILABLE_REASON_TUNING
                    || reason == TvInputManager.VIDEO_UNAVAILABLE_REASON_BUFFERING;
            if (!pending) status(NO_SIGNAL);
        }
    };

    /**
     * The intent that opens the input on this screen, or null when the TV's own app should get
     * the passthrough URI: when exactly one app claims it, and it is not Amazon's Live TV.
     *
     * <p>The launcher had three ways to answer that question behind a setting ({@code tv} always
     * handed over, {@code auto} handed over only for a single app other than Amazon's Live TV,
     * and the default never handed over). The fork has no such setting, so it takes the
     * {@code auto} one: hand the URI to a television app that wants it, but not to Amazon's
     * Live TV, which claims every passthrough URI and then redirects to a channel scan instead
     * of showing the picture. On this television that is the only app that claims it, so the
     * input is ours.
     */
    static Intent intent(Context c, HomeApps.Item it) {
        if (c.getSystemService(Context.TV_INPUT_SERVICE) == null) return null;
        Intent view = new Intent(Intent.ACTION_VIEW, TvContract.buildChannelUriForPassthroughInput(it.inputId));
        List<ResolveInfo> apps = c.getPackageManager().queryIntentActivities(view, 0);
        if (apps.size() == 1 && !viewerIsLiveTv(apps.get(0))) return null;
        return new Intent(c, Input.class).putExtra(EXTRA_ID, it.inputId).putExtra(EXTRA_NAME, it.label);
    }

    /**
     * Amazon's Live TV claims every passthrough URI, then redirects to its own settings or a
     * channel scan instead of showing the input (seen on Fire OS 7 and 8 televisions).
     */
    private static boolean viewerIsLiveTv(ResolveInfo app) {
        return app.activityInfo != null && AMAZON_LIVE_TV.equals(app.activityInfo.packageName);
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        id = getIntent().getStringExtra(EXTRA_ID);
        Ui.init(this);   // the font, if this screen is the first thing in its process
        // The video is a layer behind this window; a transparent window lets the text over it blend
        // instead of punching black boxes into the picture.
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));

        FrameLayout root = new FrameLayout(this);
        if (getSystemService(Context.TV_INPUT_SERVICE) != null) {
            view = new TvView(this);
            view.setCallback(watch);
            view.setFocusable(true);
            root.addView(view, new FrameLayout.LayoutParams(MATCH, MATCH));
        }

        status = text(22, MUTED);
        status.setVisibility(View.GONE);
        root.addView(status, new FrameLayout.LayoutParams(WRAP, WRAP, Gravity.CENTER));

        name = text(20, TEXT);
        name.setText(getIntent().getCharSequenceExtra(EXTRA_NAME));
        name.setPadding(dp(22), dp(10), dp(22), dp(10));
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(0xB3000000);
        pill.setCornerRadius(dp(10));
        name.setBackground(pill);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(WRAP, WRAP, Gravity.TOP | Gravity.START);
        lp.setMargins(dp(56), dp(40), 0, 0);
        root.addView(name, lp);
        setContentView(root);
    }

    @Override
    @SuppressWarnings("deprecation") // the AudioFocusRequest replacement is Android 8+, Fire OS 6 is 7.1
    protected void onStart() {
        super.onStart();
        showName();
        if (view == null || id == null) {
            status(FAILED);
            return;
        }
        ((AudioManager) getSystemService(Context.AUDIO_SERVICE))
                .requestAudioFocus(focus, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        view.setStreamVolume(1f);
        view.tune(id, TvContract.buildChannelUriForPassthroughInput(id));
        view.requestFocus();
        // Most input services report why there is no picture; this covers one that stays silent.
        ui.postDelayed(noSignal, SIGNAL_MS);
    }

    /** Releases the input so the TV stops routing it the moment this screen leaves. */
    @Override
    @SuppressWarnings("deprecation")
    protected void onStop() {
        ui.removeCallbacksAndMessages(null);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (view != null) {
            view.reset();
            ((AudioManager) getSystemService(Context.AUDIO_SERVICE)).abandonAudioFocus(focus);
        }
        super.onStop();
    }

    /** BACK leaves; Menu or Info shows the input's name again. Other keys go to the input. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        switch (e.getKeyCode()) {
            case KeyEvent.KEYCODE_BACK:
                if (e.getAction() == KeyEvent.ACTION_UP) finish();
                return true;
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_INFO:
                if (e.getAction() == KeyEvent.ACTION_DOWN) showName();
                return true;
            default:
                return super.dispatchKeyEvent(e);
        }
    }

    private void showName() {
        ui.removeCallbacks(hideName);
        name.animate().cancel();
        name.setAlpha(1f);
        name.setVisibility(View.VISIBLE);
        ui.postDelayed(hideName, NAME_MS);
    }

    /**
     * Keeps the TV awake while the input shows a picture, as Amazon's own input player does;
     * otherwise the screensaver and then sleep come on mid-film or mid-game. With no
     * signal the normal timeout applies again, so an input left on a dead source still sleeps.
     */
    private void status(String text) {
        AppLog.w("input " + id + ": " + (text == null ? "video" : text));
        if (text == null) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        ui.removeCallbacks(noSignal);
        status.setText(text);
        status.setVisibility(text == null ? View.GONE : View.VISIBLE);
    }

    /** A line of text in the app's own font, the way the home screen writes it. */
    private TextView text(float sp, int color) {
        TextView t = new TextView(this);
        t.setTextColor(color);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTypeface(Ui.medium);
        return t;
    }

    private int dp(float v) {
        return Math.round(getResources().getDisplayMetrics().density * v);
    }
}
