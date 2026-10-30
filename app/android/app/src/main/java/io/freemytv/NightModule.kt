package io.freemytv

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Whether it is night where the television is.
 *
 * The answer is the Java app's own: night is from sunset to sunrise, and the theme the parent
 * picked ("auto", "light" or "dark") has the last word. The sun times come from the last forecast
 * the native side fetched; without one, sunrise is at 06:00 and sunset at 18:00.
 */
class NightModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "night"

    /** Whether it is night. */
    @ReactMethod
    fun isNight(promise: Promise) {
        try {
            val context: Context = reactApplicationContext.applicationContext
            promise.resolve(HomeData.get(context).isNight(System.currentTimeMillis()))
        } catch (e: Exception) {
            promise.reject("night_is_night_failed", e)
        }
    }
}
