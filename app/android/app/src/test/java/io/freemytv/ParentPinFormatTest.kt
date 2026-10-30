package io.freemytv

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.lang.reflect.Method

/**
 * The parent PIN's format, held against the Java app's own code.
 *
 * The household's PIN survives the swap only if the app writes the same bytes as the Java app
 * that comes before it. The Java app's format, in variant/src/io/freemytv/Prefs.java, is
 *
 *     hex(salt) + ":" + sha256(salt, pin)
 *
 * with a sixteen byte salt, the SHA-256 of the PIN (UTF-8) over the salt, and both parts in lower
 * case hex. That is a comment in a test; this is the proof:
 *
 *  - the app carries the Java app's Prefs.java byte for byte, so the code in the APK is the code
 *    the test holds against;
 *  - the app's own hashing and the Java app's own hashing are asked for the same salt and the
 *    same PIN, and their answers have to be the same bytes;
 *  - and both ways round: a hash the app writes is one the Java app accepts, and a hash the Java
 *    app writes is one the app accepts.
 */
class ParentPinFormatTest {

    /** The app carries the Java app's Prefs, unchanged. */
    @Test
    fun theAppCarriesTheVendoredPrefs() {
        val vendored = File(repoRoot(), "variant/src/io/freemytv/Prefs.java")
        val carried = File(repoRoot(), "app/android/app/src/main/java/io/freemytv/Prefs.java")
        assertTrue("the vendored Prefs.java is not where it should be: $vendored", vendored.isFile)
        assertTrue("the app does not carry Prefs.java: $carried", carried.isFile)
        assertArrayEquals(
                "the app's Prefs.java is not the Java app's Prefs.java, byte for byte",
                vendored.readBytes(),
                carried.readBytes())
    }

    /** The two hash the same PIN over the same salt to the same bytes. */
    @Test
    fun theFormatIsTheVendoredOne() {
        for ((salt, pin) in vectors()) {
            val vendored = hex.invoke(null, salt) as String + ":" + sha256.invoke(null, salt, pin) as String
            val ours = ParentPin.hex(salt) + ":" + ParentPin.hex(ParentPin.sha256(salt, pin))
            assertEquals("the format differs for the pin '$pin'", vendored, ours)
        }
    }

    /** A hash the app writes is one the Java app lets in. */
    @Test
    fun theJavaAppAcceptsWhatTheAppWrites() {
        for (pin in listOf("1234", "0000", "9999", "hunter2", "a longer pin")) {
            val stored = ParentPin.hash(pin)
            assertEquals("the Java app does not accept the app's hash for '$pin'",
                    true, matches.invoke(null, pin, stored))
        }
    }

    /** A hash the Java app writes is one the app lets in. */
    @Test
    fun theAppAcceptsWhatTheJavaAppWrites() {
        for (pin in listOf("1234", "0000", "9999", "hunter2", "a longer pin")) {
            val stored = hashPin.invoke(null, pin) as String
            assertEquals("the app does not accept the Java app's hash for '$pin'",
                    true, ParentPin.matches(pin, stored))
        }
    }

    /** The salt is sixteen bytes and the answer is two parts of hex. */
    @Test
    fun theShapeIsTheVendoredOne() {
        val stored = ParentPin.hash("1234")
        val parts = stored.split(":")
        assertEquals("the stored value is not salt:hash", 2, parts.size)
        assertEquals("the salt is not sixteen bytes", 32, parts[0].length)
        assertEquals("the hash is not a SHA-256 in hex", 64, parts[1].length)
        assertEquals("the hex is not lower case", stored, stored.lowercase())
    }

    /** The private methods of the Java app's Prefs, as they are there. */
    private val sha256: Method =
            declared("sha256", ByteArray::class.java, String::class.java)

    private val hex: Method =
            declared("hex", ByteArray::class.java)

    private val matches: Method =
            declared("matches", String::class.java, String::class.java)

    private val hashPin: Method =
            declared("hashPin", String::class.java)

    private fun declared(name: String, vararg types: Class<*>): Method {
        val method = Prefs::class.java.getDeclaredMethod(name, *types)
        method.isAccessible = true
        return method
    }

    /** Salts and pins to try: an empty salt, a salt of zeroes, and a random one. */
    private fun vectors(): List<Pair<ByteArray, String>> = listOf(
            ByteArray(0) to "",
            ByteArray(16) to "1234",
            ByteArray(16) { it.toByte() } to "0000",
            byteArrayOf(0x0f, 0xa0.toByte(), 0xff.toByte(), 0x7f) to "a pin with ümlauts and 日本語")

    /** The root of the repository, found by walking up from where the test runs. */
    private fun repoRoot(): File {
        var dir: File? = File("").absoluteFile
        while (dir != null) {
            if (File(dir, "variant/src/io/freemytv/Prefs.java").isFile) return dir
            dir = dir.parentFile
        }
        throw IllegalStateException("the repository root is not above ${File("").absolutePath}")
    }
}
