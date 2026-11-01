package io.freemytv.iptv

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The XMLTV guide, proved on the JVM.
 *
 * The guide is the format the public feeds and the provider's own guide are written in,
 * and the two things that go wrong in it are the times (a zone that is not written down
 * anywhere else) and the fact that a guide is enormous.
 */
class XmltvTest {

    @Test
    fun itReadsTheChannelsOfAGuide() {
        val guide = Xmltv.parse(Fixtures.read("guide.xml"))
        assertEquals("the wrong number of channels", 3, guide.channels.size)

        val bbc = guide.channels[0]
        assertEquals("bbc-one.uk", bbc.id)
        assertEquals("BBC One", bbc.name)
        assertEquals("http://logos.example.invalid/bbc-one.png", bbc.logo)
    }

    @Test
    fun itReadsTheProgrammesOfAGuide() {
        val guide = Xmltv.parse(Fixtures.read("guide.xml"))
        assertEquals("the wrong number of programmes", 4, guide.programmes.size)

        val news = guide.programmes[0]
        assertEquals("bbc-one.uk", news.channelId)
        assertEquals("The News at Six", news.title)
        assertEquals("The headlines, and the weather.", news.description)
        assertEquals("News", news.category)
    }

    @Test
    fun aTimeIsReadWithItsZone() {
        // 18:00 at +0000 is 18:00 UTC.
        assertEquals(
            "the time was not read as UTC",
            Xmltv.parseTime("20260101180000 +0000"),
            Xmltv.parseTime("20260101180000Z"),
        )
        // 18:00 at -0500 is 23:00 UTC: five hours later.
        assertEquals(
            "the zone was not applied",
            5 * 60 * 60 * 1000L,
            Xmltv.parseTime("20260101180000 -0500") - Xmltv.parseTime("20260101180000 +0000"),
        )
        // 18:00 with no zone at all is read as UTC.
        assertEquals(
            "a time with no zone is not UTC",
            Xmltv.parseTime("20260101180000 +0000"),
            Xmltv.parseTime("20260101180000"),
        )
    }

    @Test
    fun aBrokenTimeIsZero() {
        assertEquals("a broken time is not zero", 0L, Xmltv.parseTime(null))
        assertEquals("a broken time is not zero", 0L, Xmltv.parseTime(""))
        assertEquals("a broken time is not zero", 0L, Xmltv.parseTime("not a time"))
        assertEquals("a short time is not zero", 0L, Xmltv.parseTime("202601"))
    }

    @Test
    fun theTimesOfTheFixtureAreWhatTheySay() {
        val guide = Xmltv.parse(Fixtures.read("guide.xml"))
        val news = guide.programmes[0]
        assertEquals(
            "the programme does not start when it says",
            Xmltv.parseTime("20260101180000 +0000"),
            news.from,
        )
        assertEquals(
            "the programme does not end when it says",
            Xmltv.parseTime("20260101183000 +0000"),
            news.to,
        )
    }

    @Test
    fun aGuideWithADoctypeIsStillRead() {
        // XMLTV files carry a DOCTYPE often enough that refusing one would throw away
        // every provider's own guide. The DOCTYPE is allowed; what it points at is not
        // fetched.
        val guide = Xmltv.parse(
            """
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE tv SYSTEM "xmltv.dtd">
            <tv generator-info-name="none">
              <channel id="bbc-one.uk"><display-name>BBC One</display-name></channel>
              <programme start="20260101180000 +0000" stop="20260101183000 +0000" channel="bbc-one.uk">
                <title>The News at Six</title><category>News</category>
              </programme>
            </tv>
            """.trimIndent(),
        )
        assertEquals("the guide with a DOCTYPE was not read", 1, guide.channels.size)
        assertEquals("the channel was not read", "bbc-one.uk", guide.channels[0].id)
        assertEquals("the programme was not read", 1, guide.programmes.size)
        assertEquals("the title was not read", "The News at Six", guide.programmes[0].title)
    }

    @Test
    fun aGuideThatPointsAtAFileDoesNotReadIt() {
        // The DOCTYPE is allowed, but nothing outside the guide is fetched to resolve
        // it: a guide is a file from the internet, and it must not be able to make the
        // parser open one of the television's own files.
        val guide = Xmltv.parse(
            """
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE tv SYSTEM "file:///etc/passwd">
            <tv generator-info-name="none">
              <channel id="bbc-one.uk"><display-name>BBC One</display-name></channel>
            </tv>
            """.trimIndent(),
        )
        assertEquals("the guide was not read", 1, guide.channels.size)
        assertEquals("the channel was not read", "BBC One", guide.channels[0].name)
    }
}
