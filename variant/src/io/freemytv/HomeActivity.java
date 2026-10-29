package io.freemytv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.TextView;

/**
 * The Free My TV home screen (Android's "Home" role in Free My TV mode). It runs in the :home process: if it crashes,
 * the safety net in the main process keeps working. On the 3rd crash within 5 min, the Watchdog gives the home screen
 * back to the TV's original one.
 *
 * It holds two faces: the normal one (upstream's, the TMDB picks) and the kids one (ported from
 * suboss87/my-kids-tv: one title as the hero, the greeting, the space sky and the vetted catalogue). The
 * kids face is a mode of this screen, not a separate app: the parent PIN locks it, so a child cannot leave
 * it, and the Home button asks for the PIN instead of leaving.
 */
public class HomeActivity extends Activity {
    /** Opens All Apps (a remote's All Apps button, RemoteKeys). */
    static final String EXTRA_ALL_APPS = "io.freemytv.ALL_APPS";
    private HomeView home;          // the normal face (upstream's)
    private KidsView kids;           // the kids face (my-kids-tv's), behind the parent PIN
    private View face;               // whichever is on screen
    private int prefsVersion = Prefs.version;   // settings changed while we were away: start over

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Watchdog.install(this);
        SleepTimer.listen(this);
        SleepTimer.check(this);
        if (Watchdog.crashedTooOften(this)) {
            // Don't try to draw again: only show a notice while the main process restores the original home screen.
            HomeMode.requestRevertHome(this);
            TextView t = new TextView(this);
            t.setText(Ui.tr("Free My TV's home screen ran into a problem.\nGoing back to the TV's original home screen…"));
            t.setTextColor(Color.WHITE);
            t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
            t.setGravity(Gravity.CENTER);
            t.setBackgroundColor(Color.rgb(7, 11, 30));
            setContentView(t);
            return;
        }
        Ui.init(this);
        Prefs.migrateKids();   // the kids settings to their own file, once (in :home, the only writer)
        // The kids face is a mode of this screen: it comes back the way it was left (a child cannot leave it).
        if (Prefs.kidsMode()) kids = new KidsView(this);
        else home = new HomeView(this);
        face = kids != null ? kids : home;
        setContentView(face);
        getWindow().setBackgroundDrawable(null);
        if (getIntent().getBooleanExtra(EXTRA_ALL_APPS, false)) showAllApps();
    }

    /**
     * The kids face (my-kids-tv's): one title as the hero, the greeting with the weather, the space sky and
     * the vetted catalogue for the chosen band. Getting in is free; getting out asks for the parent PIN.
     */
    void showKids() {
        if (kids == null) kids = new KidsView(this);
        if (face == kids) return;
        if (home != null) home.pause();
        face = kids;
        Prefs.setKidsMode(true);
        setContentView(kids);
        kids.resume();
    }

    /** The normal face (upstream's): the TMDB picks, as they were before the kids face existed. */
    void showNormal() {
        if (home == null) home = new HomeView(this);
        if (face == home) return;
        if (kids != null) kids.pause();
        face = home;
        Prefs.setKidsMode(false);
        setContentView(home);
        home.resume();
    }

    /** The kids face is showing. */
    boolean inKidsMode() {
        return face == kids;
    }

    /** The parent PIN is in front of the kids face: a child cannot leave it without it. */
    void askParentPin() {
        if (kids == null) return;
        kids.askPin(new Runnable() {
            @Override public void run() { showNormal(); }
        });
    }

    /** All Apps, on whichever face is showing. */
    private void showAllApps() {
        if (kids != null && face == kids) kids.showAllApps();
        else if (home != null) home.showAllApps();
    }

    @Override protected void onResume() {
        super.onResume();
        // TCL's Android 11 records the home activity as translucent (occludesParent=false) whatever its theme says:
        // Android then keeps the app just left visible, and home tasks are layered under all others, so that app stays
        // on screen over ours. Opaque again on every resume (setTranslucent is public from Android 11).
        if (RemoteKeys.TCL && Build.VERSION.SDK_INT >= 30) setTranslucent(false);
        if (prefsVersion != Prefs.version) {
            prefsVersion = Prefs.version;
            HomeData.get(this).settingsChanged();
            recreate();   // a new language or city: draw everything again
            return;
        }
        if (face == kids) kids.resume();
        else if (home != null) home.resume();
        Updates.tellOnce(this);   // an update the week's check got ready: said once
    }

    @Override protected void onPause() {
        if (home != null) home.pause();
        if (kids != null) kids.pause();
        super.onPause();
    }

    /** Home button pressed on the home screen: back to the entry state (focus on the first app, sheet closed).
     *  In the kids face the Home button asks for the parent PIN: a child cannot leave that way. */
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (face == null) return;
        if (face == kids) {
            if (intent.getBooleanExtra(EXTRA_ALL_APPS, false)) kids.showAllApps();
            else kids.askParentPin();   // the Home button is not a way out: the PIN is
            return;
        }
        if (home == null) return;
        if (intent.getBooleanExtra(EXTRA_ALL_APPS, false)) home.showAllApps();
        else home.reset(true);
    }

    @Override protected void onDestroy() {
        if (home != null) home.destroy();
        if (kids != null) kids.destroy();
        super.onDestroy();
    }

    @Override public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level >= TRIM_MEMORY_COMPLETE) Recs.get(this).trim();
    }

    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        if (RemoteKeys.onKey(this, event)) return true;
        if (face == kids && kids.onKey(event)) return true;
        if (home != null && home.onKey(event)) return true;
        return super.dispatchKeyEvent(event);
    }

}
