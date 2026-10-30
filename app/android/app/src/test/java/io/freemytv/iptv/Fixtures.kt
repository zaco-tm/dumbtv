package io.freemytv.iptv

/**
 * The test fixtures.
 *
 * They live in the test's own resources so that a test reads the same bytes every time,
 * and so that nothing in the repository holds a real provider's host or a real
 * password. Every host in them is under `.invalid`, which by the DNS rules can never
 * resolve.
 */
object Fixtures {

    /** A file from the test's resources. */
    fun read(name: String): String {
        val stream = Fixtures::class.java.getResourceAsStream("/iptv/$name")
            ?: throw IllegalStateException("the fixture '$name' is not in the test's resources")
        return stream.use { it.readBytes().toString(Charsets.UTF_8) }
    }
}
