package io.freemytv

import android.content.SharedPreferences
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Locale

/**
 * The parent PIN, in front of the settings and in front of the children's face.
 *
 * The PIN itself is never stored. What is kept is a salted SHA-256 hash in the `parent_pin`
 * preference file, in the format the Java app uses today: `salt:hash`, both hex, the salt sixteen
 * random bytes and the hash the SHA-256 of the PIN over the salt. The format is a contract: the
 * file has to be readable by the app that replaces this one, and by the Java app that comes before
 * it.
 */
class ParentPinModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "parent_pin"

    /** Whether the PIN is the one in use. False when there is no PIN yet. */
    @ReactMethod
    fun check(pin: String, promise: Promise) {
        try {
            promise.resolve(matches(pin, stored()))
        } catch (e: Exception) {
            promise.reject("parent_pin_check_failed", e)
        }
    }

    /** Sets the PIN, replacing the one in use. */
    @ReactMethod
    fun set(pin: String, promise: Promise) {
        try {
            // commit(), not apply(): the PIN is on the disk before anyone is let in.
            val written = pin().edit().putString(KEY_PIN, hash(pin)).commit()
            if (!written) throw IllegalStateException("the parent_pin file did not take the write")
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("parent_pin_set_failed", e)
        }
    }

    private fun pin(): SharedPreferences =
            TvPrefs.file(reactApplicationContext.applicationContext, TvPrefs.PARENT_PIN)

    private fun stored(): String = pin().getString(KEY_PIN, "") ?: ""

    /** A new salt and the hash of the PIN over it: `salt:hash`, both hex. */
    private fun hash(pin: String): String {
        val salt = ByteArray(SALT_BYTES)
        SecureRandom().nextBytes(salt)
        return hex(salt) + ":" + hex(sha256(salt, pin))
    }

    /** Whether the PIN hashes to the stored one, with the stored salt. */
    private fun matches(pin: String, stored: String): Boolean {
        val cut = stored.indexOf(':')
        if (cut <= 0) return false
        val salt = unhex(stored.substring(0, cut)) ?: return false
        val expected = stored.substring(cut + 1).toByteArray(Charsets.US_ASCII)
        val actual = hex(sha256(salt, pin)).toByteArray(Charsets.US_ASCII)
        return MessageDigest.isEqual(actual, expected)
    }

    private fun sha256(salt: ByteArray, pin: String): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        digest.update(salt)
        return digest.digest(pin.toByteArray(Charsets.UTF_8))
    }

    private fun hex(bytes: ByteArray): String {
        val sb = StringBuilder()
        for (b in bytes) sb.append(String.format(Locale.ROOT, "%02x", b))
        return sb.toString()
    }

    private fun unhex(text: String): ByteArray? {
        if (text.isEmpty() || text.length % 2 != 0) return null
        return try {
            ByteArray(text.length / 2) { i -> text.substring(2 * i, 2 * i + 2).toInt(16).toByte() }
        } catch (e: NumberFormatException) {
            null
        }
    }

    private companion object {
        const val KEY_PIN = "pin"
        const val SALT_BYTES = 16
    }
}
