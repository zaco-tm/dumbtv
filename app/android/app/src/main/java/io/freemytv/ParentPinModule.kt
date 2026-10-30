package io.freemytv

import android.content.SharedPreferences
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The parent PIN, in front of the settings and in front of the children's face.
 *
 * The PIN itself is never stored. What is kept is a salted SHA-256 hash in the `parent_pin`
 * preference file, in the format the Java app uses today: `salt:hash`, both hex, the salt sixteen
 * random bytes and the hash the SHA-256 of the PIN over the salt. The format is a contract: the
 * file has to be readable by the app that replaces this one, and by the Java app that comes before
 * it. The format itself lives in [ParentPin], and a test holds it against the Java app's own code.
 */
class ParentPinModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "parent_pin"

    /** Whether the PIN is the one in use. False when there is no PIN yet. */
    @ReactMethod
    fun check(pin: String, promise: Promise) {
        try {
            promise.resolve(ParentPin.matches(pin, stored()))
        } catch (e: Exception) {
            promise.reject("parent_pin_check_failed", e)
        }
    }

    /** Sets the PIN, replacing the one in use. */
    @ReactMethod
    fun set(pin: String, promise: Promise) {
        try {
            // commit(), not apply(): the PIN is on the disk before anyone is let in.
            val written = pin().edit().putString(KEY_PIN, ParentPin.hash(pin)).commit()
            if (!written) throw IllegalStateException("the parent_pin file did not take the write")
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("parent_pin_set_failed", e)
        }
    }

    private fun pin(): SharedPreferences =
            TvPrefs.file(reactApplicationContext.applicationContext, TvPrefs.PARENT_PIN)

    private fun stored(): String = pin().getString(KEY_PIN, "") ?: ""

    private companion object {
        const val KEY_PIN = "pin"
    }
}
