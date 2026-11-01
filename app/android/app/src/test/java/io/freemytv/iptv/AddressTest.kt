package io.freemytv.iptv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Where a source is reached.
 *
 * A decision that is wrong in a way nobody would see until a provider's guide refused
 * to parse, or until the shipping build could not reach the provider — so it is proved
 * here, with no television and no network.
 */
class AddressTest {

    @Test
    fun aHostWithNoSchemeIsReachedOverHttps() {
        // The shipping build refuses plain http, so a host written without a scheme
        // must not become a plain-http address: it would work in a development build
        // and fail in the one the household keeps.
        assertEquals(
            "the host was not given a scheme",
            "https://provider.example.invalid",
            Address.base("provider.example.invalid"),
        )
        assertTrue(
            "a scheme-less host was not seen as secure",
            Address.isSecure(Address.base("provider.example.invalid")),
        )
    }

    @Test
    fun aSchemeThatIsWrittenIsKept() {
        assertEquals(
            "the https scheme was not kept",
            "https://provider.example.invalid",
            Address.base("https://provider.example.invalid"),
        )
        assertEquals(
            "the http scheme was not kept",
            "http://provider.example.invalid",
            Address.base("http://provider.example.invalid"),
        )
    }

    @Test
    fun aPlainHttpHostIsNotSecure() {
        assertFalse(
            "a plain http host was seen as secure",
            Address.isSecure(Address.base("http://provider.example.invalid")),
        )
    }

    @Test
    fun theHostIsTrimmed() {
        assertEquals(
            "the host kept its spaces or its trailing slash",
            "https://provider.example.invalid",
            Address.base("  https://provider.example.invalid/  "),
        )
    }

    @Test
    fun anEmptyHostIsEmpty() {
        assertEquals("an empty host was not empty", "", Address.base(""))
        assertEquals("an empty host was not empty", "", Address.base("   "))
    }

    @Test
    fun aPlaylistKeepsItsPath() {
        // A playlist is fetched whole, so its path is part of the address; only the
        // scheme is added when the owner left it out.
        assertEquals(
            "the playlist's path was lost",
            "https://provider.example.invalid/list/playlist.m3u",
            Address.address("provider.example.invalid/list/playlist.m3u"),
        )
        assertEquals(
            "the playlist's scheme was not kept",
            "http://provider.example.invalid/list/playlist.m3u",
            Address.address("http://provider.example.invalid/list/playlist.m3u"),
        )
    }

    @Test
    fun aProviderIsReachedAtItsHost() {
        val source = Credentials.StoredSource(
            kind = SOURCE_PROVIDER,
            host = "provider.example.invalid",
            user = "someone",
        )
        assertEquals(
            "the provider was not reached at its host",
            "https://provider.example.invalid",
            Address.of(source),
        )
        assertTrue(
            "the provider was not seen as secure",
            Address.isSecure(Address.of(source)),
        )
    }

    @Test
    fun aPlaylistIsReachedAtItsOwnAddress() {
        // A playlist has no host at all, so it must not be judged by one: an https
        // playlist is an encrypted one.
        val source = Credentials.StoredSource(
            kind = SOURCE_PLAYLIST,
            url = "https://provider.example.invalid/list/playlist.m3u",
        )
        assertEquals(
            "the playlist was not reached at its address",
            "https://provider.example.invalid/list/playlist.m3u",
            Address.of(source),
        )
        assertTrue(
            "an https playlist was not seen as secure",
            Address.isSecure(Address.of(source)),
        )
    }

    @Test
    fun aPlainHttpPlaylistIsNotSecure() {
        val source = Credentials.StoredSource(
            kind = SOURCE_PLAYLIST,
            url = "http://provider.example.invalid/list/playlist.m3u",
        )
        assertFalse(
            "a plain http playlist was seen as secure",
            Address.isSecure(Address.of(source)),
        )
    }
}
