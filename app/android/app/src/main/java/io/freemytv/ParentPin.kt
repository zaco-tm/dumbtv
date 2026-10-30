package io.freemytv

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Locale

/**
 * The parent PIN's format, in one place.
 *
 * The format is a contract with the Java app that comes before this one: the same file
 * (`parent_pin`), the same key (`pin`), and the same value, `hex(salt) + ":" + sha256(salt, pin)`
 * with a sixteen byte salt and the PIN in UTF-8. The household's PIN survives the swap only if
 * both sides write the same bytes, so the algorithm is not to be touched.
 *
 * It lives here, apart from the module, because it has no Android in it: a plain JVM test can
 * then hold this code and the Java app's own code side by side and compare them byte for byte.
 * See app/android/app/src/test/java/io/freemytv/ParentPinFormatTest.kt.
 */
object ParentPin {

    /** The salt's length, in bytes: the Java app's sixteen. */
    const val SALT_BYTES = 16

    /** A new salt and the hash of the PIN over it: `salt:hash`, both hex. */
    fun hash(pin: String): String {
        val salt = ByteArray(SALT_BYTES)
        SecureRandom().nextBytes(salt)
        return hex(salt) + ":" + hex(sha256(salt, pin))
    }

    /** Whether the PIN hashes to the stored one, with the stored salt. */
    fun matches(pin: String, stored: String): Boolean {
        val cut = stored.indexOf(':')
        if (cut <= 0) return false
        val salt = unhex(stored.substring(0, cut)) ?: return false
        val expected = stored.substring(cut + 1).toByteArray(Charsets.US_ASCII)
        val actual = hex(sha256(salt, pin)).toByteArray(Charsets.US_ASCII)
        return MessageDigest.isEqual(actual, expected)
    }

    /** The SHA-256 of the PIN over the salt. */
    fun sha256(salt: ByteArray, pin: String): ByteArray {
        val digest = MessageDigest.getInstance("SHA-256")
        digest.update(salt)
        return digest.digest(pin.toByteArray(Charsets.UTF_8))
    }

    /** The bytes as lower case hex, two characters each. */
    fun hex(bytes: ByteArray): String {
        val sb = StringBuilder()
        for (b in bytes) sb.append(String.format(Locale.ROOT, "%02x", b))
        return sb.toString()
    }

    /** The hex back into bytes. Null when the text is not hex. */
    fun unhex(text: String): ByteArray? {
        if (text.isEmpty() || text.length % 2 != 0) return null
        return try {
            ByteArray(text.length / 2) { i -> text.substring(2 * i, 2 * i + 2).toInt(16).toByte() }
        } catch (e: NumberFormatException) {
            null
        }
    }
}
