package io.freemytv

import android.os.SystemClock
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.math.roundToInt

/**
 * The sleep timer.
 *
 * The real timer blanks the screen (SleepBlank) and shows the minutes left over the other apps
 * (SleepOverlay); in the Java app those are two other processes, and they are task 8's work. What the
 * stub does is the part that is a contract: it writes the end of the timer into the settings file,
 * in the same keys and the same format the Java app uses, so that the native side can pick it up.
 */
class SleepModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "sleep"

    /** Starts the timer. Zero minutes or less turns it off, as it does in the Java app. */
    @ReactMethod
    fun start(minutes: Double, promise: Promise) {
        try {
            val whole = minutes.roundToInt()
            if (whole <= 0) {
                write(0L)
            } else {
                write(System.currentTimeMillis() + whole * 60_000L)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("sleep_start_failed", e)
        }
    }

    /** Turns the timer off. */
    @ReactMethod
    fun cancel(promise: Promise) {
        try {
            write(0L)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("sleep_cancel_failed", e)
        }
    }

    /**
     * The end of the timer, in the settings file: `sleepAt` is the wall clock, `sleepFrom` the
     * uptime clock, both as the Java app writes them.
     */
    private fun write(at: Long) {
        TvPrefs.file(reactApplicationContext.applicationContext, TvPrefs.SETTINGS)
                .edit()
                .putLong(KEY_AT, at)
                .putLong(KEY_FROM, SystemClock.elapsedRealtime())
                .apply()
    }

    private companion object {
        const val KEY_AT = "sleepAt"
        const val KEY_FROM = "sleepFrom"
    }
}
