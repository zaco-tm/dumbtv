package io.freemytv.iptv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Putting a provider's channels and a guide together, proved on the JVM.
 *
 * This is the join that decides whether the Live TV page says anything at all: a
 * provider's channel and a guide's channel are two records about the same thing, and
 * nothing guarantees that they agree on its name.
 */
class GuideMatcherTest {

    private val guide = Xmltv.parse(Fixtures.read("guide.xml"))

    @Test
    fun aChannelWithTheGuidesIdIsMatchedByIt() {
        val channel = IptvChannel(id = "1", name = "Whatever The Provider Called It", epgId = "bbc-one.uk")
        val matched = GuideMatcher.match(channel, guide)
        assertNotNull("the guide's id was not used", matched)
        assertEquals("bbc-one.uk", matched!!.id)
    }

    @Test
    fun aChannelWithoutAnIdIsMatchedByItsName() {
        val channel = IptvChannel(id = "1", name = "BBC One")
        val matched = GuideMatcher.match(channel, guide)
        assertNotNull("the name was not used", matched)
        assertEquals("bbc-one.uk", matched!!.id)
    }

    @Test
    fun aNameIsFoldedBeforeItIsCompared() {
        // The provider says "BBC1" and the guide says "BBC One": the same channel.
        val channel = IptvChannel(id = "1", name = "BBC1")
        val matched = GuideMatcher.match(channel, guide)
        assertNotNull("the folded names did not match", matched)
        assertEquals("bbc-one.uk", matched!!.id)
    }

    @Test
    fun oneNameInsideAnotherIsAccepted() {
        // The provider says "ITV" and the guide says "ITV1".
        val channel = IptvChannel(id = "1", name = "ITV")
        val matched = GuideMatcher.match(channel, guide)
        assertNotNull("the name inside the name did not match", matched)
        assertEquals("itv.uk", matched!!.id)
    }

    @Test
    fun aShortNameIsNotMatchedInsideALongerOne() {
        // "TV" is inside "ITV1", but two letters is a coincidence, not a channel.
        val channel = IptvChannel(id = "1", name = "TV")
        assertNull("a two letter name was matched", GuideMatcher.match(channel, guide))
    }

    @Test
    fun aChannelTheGuideDoesNotHaveIsNotMatched() {
        val channel = IptvChannel(id = "1", name = "A Channel Nobody Broadcasts")
        assertNull("a channel with no guide was matched", GuideMatcher.match(channel, guide))
    }

    @Test
    fun theProgrammesOfAChannelAreInTimeOrder() {
        val bbc = guide.channels.first { it.id == "bbc-one.uk" }
        val programmes = GuideMatcher.programmesFor(bbc, guide)
        assertEquals("the wrong number of programmes", 2, programmes.size)
        assertEquals("The News at Six", programmes[0].title)
        assertEquals("Match of the Day", programmes[1].title)
    }

    @Test
    fun whatIsOnNowIsWhatIsOn() {
        val bbc = guide.channels.first { it.id == "bbc-one.uk" }
        val programmes = GuideMatcher.programmesFor(bbc, guide)

        // Halfway through The News at Six.
        val during = Xmltv.parseTime("20260101181500 +0000")
        val (now, next) = GuideMatcher.nowAndNext(programmes, during)
        assertEquals("the wrong programme is on", "The News at Six", now?.title)
        assertEquals("the wrong programme is next", "Match of the Day", next?.title)
    }

    @Test
    fun aProgrammeThatHasFinishedIsNotOn() {
        val bbc = guide.channels.first { it.id == "bbc-one.uk" }
        val programmes = GuideMatcher.programmesFor(bbc, guide)

        // The day after both programmes have finished.
        val later = Xmltv.parseTime("20260103000000 +0000")
        val (now, _) = GuideMatcher.nowAndNext(programmes, later)
        assertNull("a programme that ended is still on", now)
    }

    @Test
    fun aProgrammeThatHasNotStartedIsNotOn() {
        val bbc = guide.channels.first { it.id == "bbc-one.uk" }
        val programmes = GuideMatcher.programmesFor(bbc, guide)

        val before = Xmltv.parseTime("20260101000000 +0000")
        val (now, next) = GuideMatcher.nowAndNext(programmes, before)
        assertNull("a programme that has not started is on", now)
        assertEquals("the first programme is not the next one", "The News at Six", next?.title)
    }

    @Test
    fun theProgressIsHowFarThroughWeAre() {
        val bbc = guide.channels.first { it.id == "bbc-one.uk" }
        val programmes = GuideMatcher.programmesFor(bbc, guide)

        val start = Xmltv.parseTime("20260101180000 +0000")
        val end = Xmltv.parseTime("20260101183000 +0000")
        val news = programmes[0]

        assertEquals("the start is not no progress", 0.0, GuideMatcher.progress(news, start), 0.001)
        assertEquals(
            "halfway is not half",
            0.5,
            GuideMatcher.progress(news, start + (end - start) / 2),
            0.001,
        )
        assertEquals("the end is not all of it", 1.0, GuideMatcher.progress(news, end), 0.001)
    }

    @Test
    fun aProgrammeWithNoLengthHasNoProgress() {
        val programme = IptvProgramme("bbc-one.uk", "Nothing", 100L, 100L)
        assertEquals("a programme with no length has progress", 0.0, GuideMatcher.progress(programme, 100L), 0.001)
        assertEquals("nothing on is no progress", 0.0, GuideMatcher.progress(null, 100L), 0.001)
    }
}
