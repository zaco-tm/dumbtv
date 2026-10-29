package io.freemytv

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Whether this app is the television's home screen, and the switch that makes it so.
 *
 * The real switch (the Java app's HomeMode) talks to the television over its own ADB: it turns the
 * TV's launcher off and puts this one in its place. That is task 8's work. What this module answers
 * is what it can answer without the television: whether the system gives this app the HOME role,
 * and it records a request to change it, so that the JavaScript and the native side have the same
 * shape to work with.
 */
class HomeModeModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "home_mode"

    /** Whether the system resolves the HOME role to this app. */
    @ReactMethod
    fun isHome(promise: Promise) {
        try {
            promise.resolve(resolvesHome())
        } catch (e: Exception) {
            promise.reject("home_mode_is_home_failed", e)
        }
    }

    /**
     * Asks for this app to be the home screen.
     *
     * The switch itself is not done here: it needs the television's own ADB, which the preview app
     * does not have, and doing it would take the household's home screen away. The request is
     * recorded in the settings file, where the native side will read it.
     */
    @ReactMethod
    fun setHome(on: Boolean, promise: Promise) {
        try {
            settings().edit().putBoolean(KEY_REQUESTED, on).apply()
            requestedState = on
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("home_mode_set_home_failed", e)
        }
    }

    /** Reads the state again: the request in the settings file, and the system's own answer. */
    @ReactMethod
    fun refresh(promise: Promise) {
        try {
            // Reading the file again, as the Java app's Prefs.reload() does: another process may
            // have changed it.
            requestedState = settings().getBoolean(KEY_REQUESTED, false)
            homeState = resolvesHome()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("home_mode_refresh_failed", e)
        }
    }

    /** Whether the last request was for this app to be the home screen. */
    fun requested(): Boolean = requestedState

    /** Whether the system resolves the HOME role to this app, as it was at the last refresh. */
    fun home(): Boolean = homeState

    private var requestedState: Boolean = false

    private var homeState: Boolean = false

    private fun settings() = TvPrefs.file(reactApplicationContext.applicationContext, TvPrefs.SETTINGS)

    private fun resolvesHome(): Boolean {
        val manager = reactApplicationContext.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            manager.resolveActivity(intent, PackageManager.ResolveInfoFlags.of(0L))
        } else {
            @Suppress("DEPRECATION")
            manager.resolveActivity(intent, 0)
        }
        return resolved?.activityInfo?.packageName == reactApplicationContext.packageName
    }

    private companion object {
        const val KEY_REQUESTED = "homeModeRequested"
    }
}
