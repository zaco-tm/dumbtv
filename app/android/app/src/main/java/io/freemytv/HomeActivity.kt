package io.freemytv

import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.ReactRootView
import com.facebook.react.bridge.ReactContext
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * The host of the two faces: the React root view (the normal one) and the kids face.
 *
 * The name is not free: the Guard (an accessibility service) compares the focused window's *simple*
 * class name with the literal "HomeActivity", so this class has to keep this exact name when the app
 * replaces the Java one. See docs/superpowers/plans/2026-10-29-averagetv-stage4.md.
 *
 * The kids face is the Java app's, unchanged: a mode of this screen, not a separate app. The parent
 * PIN locks it, so a child cannot leave it, and the Home button asks for the PIN instead of leaving.
 * The normal face is the React root view, so the two live side by side in one container and only one
 * of them is ever on the screen.
 *
 * Open, because the Java app's `FireHomeActivity` extends it: on Fire OS the home screen as an
 * app needs a manifest entry without `resumeWhilePausing`, or the remote's keys go to the launcher.
 */
open class HomeActivity : ReactActivity() {

    /** The container both faces live in. */
    private var host: FrameLayout? = null

    /** The kids face (the Java app's KidsView), behind the parent PIN. */
    private var kids: KidsView? = null

    /**
     * Whether the kids face is the one on screen.
     *
     * A flag and not a reference to the face that is up: the normal face is the React root
     * view, and React Native makes that one in its own time (after a permission prompt on
     * Android 17), so there is a moment where there is no face to point at.
     */
    private var kidsUp = false

    /** Settings changed while we were away: start over. */
    private var prefsVersion: Int = Prefs.version

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "AverageTV"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    /**
     * The React root view goes into the host, not over it.
     *
     * React Native's own delegate sets the root view as the activity's content view, which would
     * put it on top of the kids face and hide it. The root view is a child of the host instead, and
     * the kids face is the other child: one is shown, the other is hidden.
     */
    override fun setContentView(view: View?) {
        if (view is ReactRootView) {
            // At the bottom: the kids face, when it is up, is the other child and goes on top.
            host?.addView(view, 0)
            return
        }
        super.setContentView(view)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val container = FrameLayout(this)
        host = container
        super.onCreate(savedInstanceState)
        setContentView(container)
        Watchdog.install(this)
        SleepTimer.listen(this)
        SleepTimer.check(this)
        if (Watchdog.crashedTooOften(this)) {
            // Don't try to draw again: only show a notice while the main process restores the original home screen.
            HomeMode.requestRevertHome(this)
            val t = TextView(this)
            t.text = Ui.tr("AverageTV's home screen ran into a problem.\nGoing back to the TV's original home screen…")
            t.setTextColor(Color.WHITE)
            t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            t.gravity = Gravity.CENTER
            t.setBackgroundColor(Color.rgb(7, 11, 30))
            setContentView(t)
            return
        }
        Ui.init(this)
        Prefs.migrateKids()   // the kids settings to their own file, once (in :home, the only writer)
        // The kids face is a mode of this screen: it comes back the way it was left (a child cannot leave it).
        if (Prefs.kidsMode()) {
            showKidsFace()
        }
        window.setBackgroundDrawable(null)
        if (intent.getBooleanExtra(EXTRA_ALL_APPS, false)) showAllApps()
    }

    /**
     * The kids face: one title as the hero, the greeting with the weather, the space sky and the
     * vetted catalogue for the chosen band. Getting in is free; getting out asks for the parent PIN.
     */
    fun showKids() {
        if (kidsUp) return
        Prefs.setKidsMode(true)
        showKidsFace()
    }

    /** The kids face on the screen, and the React root view out of the way. */
    private fun showKidsFace() {
        val view = kids ?: KidsView(this).also { kids = it }
        kidsUp = true
        reactRootView()?.visibility = View.GONE
        host?.addView(view)
        view.resume()
    }

    /** The normal face: the React root view, as it was before the kids face came up. */
    fun showNormal() {
        if (!kidsUp) return
        kids?.pause()
        kidsUp = false
        Prefs.setKidsMode(false)
        kids?.let { host?.removeView(it) }
        reactRootView()?.visibility = View.VISIBLE
    }

    /** The kids face is showing. */
    fun inKidsMode(): Boolean = kidsUp

    /** The parent PIN is in front of the kids face: a child cannot leave it without it. */
    fun askParentPin() {
        val view = kids ?: return
        view.askPin { showNormal() }
    }

    /** All Apps, on whichever face is showing. */
    private fun showAllApps() {
        if (inKidsMode()) {
            kids?.showAllApps()
        } else {
            // The normal face's all apps is the streaming page: the television's own apps.
            emit("all-apps")
        }
    }

    override fun onResume() {
        super.onResume()
        // TCL's Android 11 records the home activity as translucent (occludesParent=false) whatever its theme says:
        // Android then keeps the app just left visible, and home tasks are layered under all others, so that app stays
        // on screen over ours. Opaque again on every resume (setTranslucent is public from Android 11).
        if (RemoteKeys.TCL && Build.VERSION.SDK_INT >= 30) setTranslucent(false)
        if (prefsVersion != Prefs.version) {
            prefsVersion = Prefs.version
            HomeData.get(this).settingsChanged()
            recreate()   // a new language or city: draw everything again
            return
        }
        if (inKidsMode()) kids?.resume()
        Updates.tellOnce(this)   // an update the week's check got ready: said once
    }

    override fun onPause() {
        kids?.pause()
        super.onPause()
    }

    /**
     * Home button pressed on the home screen: back to the entry state (focus on the first app, sheet closed).
     * In the kids face the Home button asks for the parent PIN: a child cannot leave that way.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (inKidsMode()) {
            if (intent.getBooleanExtra(EXTRA_ALL_APPS, false)) kids?.showAllApps()
            else askParentPin()   // the Home button is not a way out: the PIN is
            return
        }
        if (intent.getBooleanExtra(EXTRA_ALL_APPS, false)) showAllApps()
        else emit("reset")   // the normal face goes back to its entry state
    }

    override fun onDestroy() {
        kids?.destroy()
        super.onDestroy()
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= TRIM_MEMORY_COMPLETE) Recs.get(this).trim()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (RemoteKeys.onKey(this, event)) return true
        val view = kids
        if (kidsUp && view != null && view.onKey(event)) return true
        // The React face has its own keys: React Native's own dispatching, with the flags the
        // focus model needs, is the last word.
        return super.dispatchKeyEvent(event)
    }

    /** The React root view, once React Native has made it. */
    private fun reactRootView(): ReactRootView? = reactDelegate?.reactRootView

    /**
     * A word for the JavaScript: the Home button, or the remote's all apps button.
     *
     * The normal face is the JavaScript's, so the JavaScript is the one that knows what to do with
     * the Home button: back to the entry state, with the focus on the first app.
     */
    private fun emit(what: String) {
        val context: ReactContext =
            (application as? ReactApplication)?.reactHost?.currentReactContext ?: return
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_HOME, what)
    }

    private companion object {
        /** Opens All Apps (a remote's All Apps button, RemoteKeys). */
        const val EXTRA_ALL_APPS = "io.freemytv.ALL_APPS"

        /** The event the JavaScript listens to for the Home button. */
        const val EVENT_HOME = "home"
    }
}
