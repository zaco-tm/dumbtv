package io.freemytv

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

/**
 * Whether it is night where the television is.
 *
 * The Java app answers it from the weather it fetches: night is from sunset to sunrise, and the
 * theme the parent picked ("auto", "light" or "dark") has the last word. This stub reads the same
 * theme from the same settings file and, when there are no sun times cached yet, the same
 * fallbacks the Java app uses: sunrise at 06:00 and sunset at 18:00.
 */
class NightModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "night"

    /** Whether it is night. */
    @ReactMethod
    fun isNight(promise: Promise) {
        try {
            promise.resolve(isNightNow())
        } catch (e: Exception) {
            promise.reject("night_is_night_failed", e)
        }
    }

    private fun isNightNow(): Boolean {
        val prefs = TvPrefs.file(reactApplicationContext.applicationContext, TvPrefs.SETTINGS)
        val theme = (prefs.getString(KEY_THEME, "auto") ?: "auto").trim()
        if (theme == "dark") return true
        if (theme == "light") return false
        val now = System.currentTimeMillis()
        val sunrise = prefs.getLong(KEY_SUNRISE, 0L)
        val sunset = prefs.getLong(KEY_SUNSET, 0L)
        val time = timeOfDay(now, 0L)
        val rise = timeOfDay(sunrise, 6 * 60 * 60_000L)
        val set = timeOfDay(sunset, 18 * 60 * 60_000L)
        return time < rise || time >= set
    }

    /** The time of day, in milliseconds since midnight, of a moment in time. */
    private fun timeOfDay(at: Long, fallback: Long): Long {
        if (at == 0L) return fallback
        val calendar = Calendar.getInstance()
        calendar.timeInMillis = at
        return ((calendar.get(Calendar.HOUR_OF_DAY) * 60L + calendar.get(Calendar.MINUTE)) * 60 +
                calendar.get(Calendar.SECOND)) * 1000L
    }

    private companion object {
        const val KEY_THEME = "theme"
        const val KEY_SUNRISE = "sunrise"
        const val KEY_SUNSET = "sunset"
    }
}
