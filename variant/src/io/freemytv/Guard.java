package io.freemytv;

import android.accessibilityservice.AccessibilityService;
import android.app.ActivityOptions;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;

/**
 * Fire OS keeps HOME bound to Amazon's protected launcher and handles the HOME key before any
 * accessibility filter sees it, so this service waits for Amazon's home window and replaces it
 * with the fork's own home screen.
 *
 * <p>This is the Guard of dumbtv home, ported. The mechanism is the one that works on a Fire TV,
 * piece for piece: the alarm-fired launch, the cover overlay, and the rule that the launch waits
 * until the cover has reached the window manager.
 *
 * <p>A plain startActivity right after a HOME press is held back by Android's five-second
 * app-switch delay. An alarm-fired PendingIntent is sent by system_server, which is exempt,
 * so {@link #home} launches through an alarm. That alarm only fires at once with
 * {@code min_futurity=0}, which the install path sets: in the global
 * {@code alarm_manager_constants} up to Android 11, in DeviceConfig {@code alarm_manager} from
 * Android 12.
 *
 * <p>Amazon's home is covered with a plain overlay until ours has drawn, so it never shows.
 *
 * <p>Android 11 refuses an activity start from an app with no visible window, even one sent
 * through system_server by an alarm ("Background activity start ... callingUidHasAnyVisibleWindow:
 * false"). The cover is such a window, so the launch waits until the cover has reached the
 * window manager: {@link #launchWhenCovered} fires it from the cover's first draw pass.
 *
 * <p>Waking from standby resumes whatever was on screen without a new window event. If the last
 * window was Amazon's home screen, ours is brought up at once. Amazon's other launcher screens,
 * such as its settings grid, are left alone, as is a wake before any window was seen.
 *
 * <p>It is dumbtv home's Guard, ported, and it differs from it in these ways:
 *
 * <ul>
 *   <li>the package, and the activity it starts: the fork's own {@link HomeActivity},
 *       not dumbtv home's Home;</li>
 *   <li>the cover's colour. dumbtv home reads its own configured background colour;
 *       the fork has no such setting, so the cover uses the colour the home screen is
 *       about to paint — its day or its night background, which is the same question the
 *       home screen asks itself;</li>
 *   <li>the cover comes off when the home screen's window appears. dumbtv home's activity
 *       calls {@code Guard.shown()} once it has drawn; the fork's home activity is
 *       upstream's file and cannot be edited, so the window event is what says the home
 *       screen is up;</li>
 *   <li>dumbtv home's activity cancels a queued launch when it resumes
 *       ({@code Guard.arrived(this)} in its {@code onResume}). The fork's activity is
 *       upstream's file and cannot call it, so this port cancels the queued launch when
 *       the home screen's own window appears instead — the same moment, reached a
 *       different way;</li>
 *   <li>there is no Keeper here: that is dumbtv home's answer for Fire OS 6.7, which
 *       refuses third-party accessibility services. The fork needs Android 8 or later,
 *       and the accessibility service is the only way there;</li>
 *   <li>{@link #pause()} and {@link #amazon()} have no caller in the fork. In dumbtv home
 *       they are the escape hatch that leaves Amazon's home on screen. Nothing in the fork
 *       opens Amazon's home, so they are kept for the shape of the thing and are inert;
 *       the {@code paused} latch is therefore never set.</li>
 * </ul>
 */
public final class Guard extends AccessibilityService {
    static final String AMAZON = "com.amazon.tv.launcher";
    private static final String AMAZON_HOME = "com.amazon.tv.launcher.ui.HomeActivity_vNext";
    /** The fork's home activity: the window that says the home screen is up. */
    private static final String HOME_ACTIVITY = "HomeActivity";
    private static final long COVER_MAX_MS = 1500;
    private static final long REPEAT_MS = 1000;
    private static final long LAUNCH_FALLBACK_MS = 150;
    /** The home screen's background by day, and the one it fades to at night. */
    private static final int DAY_BACKGROUND = 0xFFEBEBF0;
    private static final int NIGHT_BACKGROUND = 0xFF141416;
    /**
     * How long the cover stays once the home screen's window is up. The window is there
     * before its first frame is drawn, and the cover is what keeps Amazon's home from
     * showing in that gap.
     */
    private static final long UNCOVER_DELAY_MS = 250;

    private static volatile boolean paused;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable uncover = this::uncover;
    private final Runnable launch = () -> home(this);
    private View cover;
    private long lastLaunch;
    private boolean onAmazonHome;
    private final BroadcastReceiver screenOn = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            if (!paused && onAmazonHome) launchWhenCovered();
        }
    };

    /** Lets Amazon's home stay on screen until the user leaves it. */
    static void pause() {
        paused = true;
    }

    static void home(Context c) {
        AlarmManager alarms = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        alarms.setExact(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime(), launch(c));
    }

    /** Drops a queued launch, so it cannot pull the user back after they opened an app. */
    static void arrived(Context c) {
        AlarmManager alarms = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        alarms.cancel(launch(c));
    }

    private static PendingIntent launch(Context c) {
        Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                .setClass(c, HomeActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT,
                ActivityOptions.makeCustomAnimation(c, 0, 0).toBundle());
    }

    static void amazon(Context c) {
        pause();
        Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                .setPackage(AMAZON).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            c.startActivity(i);
        } catch (ActivityNotFoundException e) {
            paused = false;
        }
    }

    @Override
    protected void onServiceConnected() {
        View view = new View(this);
        view.setVisibility(View.GONE);
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.OPAQUE);
        lp.windowAnimations = 0;
        ((WindowManager) getSystemService(WINDOW_SERVICE)).addView(view, lp);
        cover = view;
        registerReceiver(screenOn, new IntentFilter(Intent.ACTION_SCREEN_ON));
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(uncover);
        handler.removeCallbacks(launch);
        try {
            unregisterReceiver(screenOn);
        } catch (IllegalArgumentException ignored) {
        }
        if (cover != null) ((WindowManager) getSystemService(WINDOW_SERVICE)).removeView(cover);
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        CharSequence pkg = e.getPackageName(), cls = e.getClassName();
        if (pkg == null) return;
        if (!AMAZON.contentEquals(pkg)) {
            if ("com.android.systemui".contentEquals(pkg) || "android".contentEquals(pkg)) return;
            onAmazonHome = false;
            paused = false;
            if (getPackageName().contentEquals(pkg)) {
                // Our own home screen. The cover has done its job; it comes off in a
                // moment, so Amazon's home is never seen behind it.
                if (cls != null && HOME_ACTIVITY.equals(simpleName(cls))) homeShown();
            } else {
                arrived(this);
            }
            return;
        }
        onAmazonHome = cls != null && AMAZON_HOME.contentEquals(cls);
        if (paused || !onAmazonHome) return;
        long now = SystemClock.uptimeMillis();
        if (now - lastLaunch < REPEAT_MS) return;
        lastLaunch = now;
        launchWhenCovered();
    }

    /** The home screen's window is up: the cover comes off a moment later. */
    private void homeShown() {
        // dumbtv home's activity cancels a queued launch when it resumes. This port
        // cannot be called from the activity (upstream's file), so the cancel happens
        // here instead: the home screen is in front, so no launch is owed to the user.
        arrived(this);
        handler.removeCallbacks(launch);
        handler.postDelayed(uncover, UNCOVER_DELAY_MS);
    }

    /**
     * Shows the cover, then starts the launch once that window is visible to the window manager.
     * A cover that is already on screen (a repeat within {@link #COVER_MAX_MS}) gets no new draw
     * pass, so the launch goes out at once; otherwise it waits for the first pre-draw, which runs
     * after the window's relayout. A short fallback covers a window that never draws.
     */
    private void launchWhenCovered() {
        handler.removeCallbacks(launch);
        if (cover == null) {
            home(this);
            return;
        }
        boolean shown = cover.getVisibility() == View.VISIBLE;
        cover();
        if (shown) {
            home(this);
            return;
        }
        final ViewTreeObserver observer = cover.getViewTreeObserver();
        observer.addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
            @Override
            public boolean onPreDraw() {
                cover.getViewTreeObserver().removeOnPreDrawListener(this);
                handler.removeCallbacks(launch);
                home(Guard.this);
                return true;
            }
        });
        handler.postDelayed(launch, LAUNCH_FALLBACK_MS);
    }

    /** The overlay window exists from service start; a GONE root keeps its surface hidden. */
    private void cover() {
        if (cover == null) return;
        cover.setBackgroundColor(background());
        cover.setVisibility(View.VISIBLE);
        handler.removeCallbacks(uncover);
        handler.postDelayed(uncover, COVER_MAX_MS);
    }

    /**
     * The colour the home screen is about to paint: its day background, or its night one.
     *
     * <p>The home screen blends {@code #EBEBF0} into {@code #141416} as the sun goes down, and
     * it asks itself the same question this asks: {@link HomeData#isNight(long)}. The fork has
     * no background setting to read, so asking is the honest answer — a cover painted with the
     * day colour flashes white on a dark television at night.
     */
    private int background() {
        boolean night;
        try {
            night = HomeData.get(this).isNight(System.currentTimeMillis());
        } catch (RuntimeException e) {
            night = false;
        }
        return night ? NIGHT_BACKGROUND : DAY_BACKGROUND;
    }

    private void uncover() {
        handler.removeCallbacks(uncover);
        if (cover != null) cover.setVisibility(View.GONE);
    }

    /** The class name without its package: the window's class is the activity's, with its package. */
    private static String simpleName(CharSequence cls) {
        String name = cls.toString();
        int dot = name.lastIndexOf('.');
        return dot < 0 ? name : name.substring(dot + 1);
    }

    @Override
    public void onInterrupt() {}
}
