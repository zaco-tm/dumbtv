package io.freemytv.iptv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The M3U playlist, proved on the JVM.
 *
 * A playlist is the simplest of the two formats and the easiest to get wrong: the name
 * and the number share a line and a comma, and a title with a comma in it breaks the
 * usual way of splitting them.
 */
class M3uTest {

    @Test
    fun itReadsTheChannelsOfAPlaylist() {
        val channels = M3u.parse(fixture())
        assertEquals("the wrong number of channels", 5, channels.size)

        val bbc = channels[0]
        assertEquals("BBC One", bbc.name)
        assertEquals(1, bbc.number)
        assertEquals("News", bbc.group)
        assertEquals("http://logos.example.invalid/bbc-one.png", bbc.logo)
        assertEquals("http://streams.example.invalid/bbc-one", bbc.url)
        assertEquals("bbc-one.uk", bbc.id)
    }

    @Test
    fun theGuidesIdIsTheIdTheAttributeIsFor() {
        val channels = M3u.parse(fixture())
        assertEquals("bbc-one.uk", channels[0].epgId)
        assertEquals("itv.uk", channels[1].epgId)
    }

    @Test
    fun aChannelWithNoIdFallsBackToItsName() {
        val channels = M3u.parse(fixture())
        val last = channels.last()
        assertEquals("No Id Channel", last.name)
        assertEquals("No Id Channel", last.id)
        assertEquals("the guide id must stay empty when there is none", "", last.epgId)
    }

    @Test
    fun aNameWithACommaIsNotCutInHalf() {
        val channels = M3u.parse(fixture())
        val fourth = channels[3]
        assertEquals("Channel 4, The Main One", fourth.name)
        assertEquals("the number is after the last comma, not the first", 4, fourth.number)
    }

    @Test
    fun aLineThatIsNotAChannelIsSkipped() {
        val channels = M3u.parse(
            """
            #EXTM3U
            # this is a comment
            #EXTINF:-1 tvg-name="One",1
            http://streams.example.invalid/one
            """.trimIndent(),
        )
        assertEquals("the comment made a channel", 1, channels.size)
        assertEquals("One", channels[0].name)
    }

    @Test
    fun anEntryWithNoUrlIsNotAChannel() {
        val channels = M3u.parse(
            """
            #EXTM3U
            #EXTINF:-1 tvg-name="No URL",1
            #EXTINF:-1 tvg-name="One",1
            http://streams.example.invalid/one
            """.trimIndent(),
        )
        assertEquals("an entry with no stream is not a channel", 1, channels.size)
        assertEquals("One", channels[0].name)
    }

    @Test
    fun anEmptyPlaylistIsEmpty() {
        assertTrue("an empty playlist is not empty", M3u.parse("").isEmpty())
        assertTrue("a header on its own is not a channel", M3u.parse("#EXTM3U").isEmpty())
    }

    /** The playlist the test reads. */
    private fun fixture(): String =
        Fixtures.read("playlist.m3u")
}
