package io.freemytv

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.math.roundToInt

/**
 * The sleep timer.
 *
 * The timer itself is the Java app's, unchanged: `SleepTimer.set` writes the end of the timer into
 * the settings file (`sleepAt` the wall clock, `sleepFrom` the uptime clock, the same keys and the
 * same format the Java app writes), sets the alarm that ends it, and asks the overlay (the minutes
 * left, over the other apps) to show itself.
 *
 * When the alarm goes off, the screen goes dark: `SleepBlank` puts a black window over whatever is
 * playing and the panel's brightness at its lowest.
 */
class SleepModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "sleep"

    /** Starts the timer. Zero minutes or less turns it off, as it does in the Java app. */
    @ReactMethod
    fun start(minutes: Double, promise: Promise) {
        try {
            val whole = minutes.roundToInt()
            SleepTimer.set(context(), if (whole <= 0) 0 else whole)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("sleep_start_failed", e)
        }
    }

    /** Turns the timer off. */
    @ReactMethod
    fun cancel(promise: Promise) {
        try {
            SleepTimer.set(context(), 0)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("sleep_cancel_failed", e)
        }
    }

    /** The minutes left, rounded up. Zero when the timer is off. */
    @ReactMethod
    fun minutesLeft(promise: Promise) {
        try {
            promise.resolve(SleepTimer.minutesLeft(context()))
        } catch (e: Exception) {
            promise.reject("sleep_minutes_left_failed", e)
        }
    }

    private fun context(): Context = reactApplicationContext.applicationContext
}
