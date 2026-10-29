package io.freemytv

import com.facebook.react.bridge.Dynamic
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableType
import kotlin.math.floor

/**
 * The app's own preference files: `settings` (the household's settings) and `home-ui` (the home
 * screen's own file, where the favourites list lives).
 *
 * Only those two files are reachable from here. The parent PIN's file goes through the parent_pin
 * module, so that nothing else can read or write a hash it does not understand.
 */
class PrefsModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "prefs"

    /** The value, with the type it was stored with. Null when the key is not there. */
    @ReactMethod
    fun get(file: String, key: String, promise: Promise) {
        if (!TvPrefs.allowedFromJavascript(file)) {
            promise.reject("prefs_unknown_file", "not a preference file this app reads: " + file)
            return
        }
        try {
            val prefs = TvPrefs.file(reactApplicationContext.applicationContext, file)
            if (!prefs.contains(key)) {
                promise.resolve(null)
                return
            }
            promise.resolve(readable(prefs.all[key]))
        } catch (e: Exception) {
            promise.reject("prefs_get_failed", e)
        }
    }

    /** Writes the value, keeping the type it was given. */
    @ReactMethod
    fun set(file: String, key: String, value: Dynamic, promise: Promise) {
        if (!TvPrefs.allowedFromJavascript(file)) {
            promise.reject("prefs_unknown_file", "not a preference file this app writes: " + file)
            return
        }
        try {
            val editor = TvPrefs.file(reactApplicationContext.applicationContext, file).edit()
            when (value.type) {
                ReadableType.Null -> editor.remove(key)
                ReadableType.Boolean -> editor.putBoolean(key, value.asBoolean())
                ReadableType.Number -> {
                    val number = value.asDouble()
                    if (number == floor(number) && number.isFinite()) {
                        editor.putLong(key, number.toLong())
                    } else {
                        editor.putFloat(key, number.toFloat())
                    }
                }
                ReadableType.String -> editor.putString(key, value.asString() ?: "")
                else -> {
                    promise.reject("prefs_unsupported_value",
                            "only strings, numbers and booleans are stored")
                    return
                }
            }
            editor.apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("prefs_set_failed", e)
        }
    }

    /** The value in a form the bridge can carry: the numbers as numbers, the rest as they are. */
    private fun readable(value: Any?): Any? = when (value) {
        null -> null
        is Boolean -> value
        is Number -> value.toDouble()
        is String -> value
        is Set<*> -> value.joinToString(",")
        else -> value.toString()
    }
}
