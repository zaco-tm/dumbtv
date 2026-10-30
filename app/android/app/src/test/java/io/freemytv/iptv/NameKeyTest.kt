package io.freemytv.iptv

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The name folding, proved on the JVM.
 *
 * The folding is the rule that decides whether "BBC One" and "BBC1" are the same
 * channel, and it is the rule OpenTV uses to match a channel it is asked to play by
 * name — so a mistake here is a mistake in both places at once.
 */
class NameKeyTest {

    @Test
    fun theLettersAndDigitsAreWhatIsLeft() {
        assertEquals("skysports", NameKey.of("Sky Sports!"))
        assertEquals("itv", NameKey.of("I.T.V."))
        assertEquals("channel4", NameKey.of("Channel 4"))
    }

    @Test
    fun theNumberWordsBecomeDigits() {
        assertEquals("bbc1", NameKey.of("BBC One"))
        assertEquals("bbc1", NameKey.of("BBC1"))
        assertEquals("channel4", NameKey.of("Channel Four"))
    }

    @Test
    fun onlyWholeWordsAreNumbers() {
        // "Stone" is not "St1ne".
        assertEquals("stone", NameKey.of("Stone"))
        assertEquals("stonebridge", NameKey.of("Stonebridge"))
        // "One" on its own is a number, though.
        assertEquals("1", NameKey.of("One"))
    }

    @Test
    fun theSameChannelFoldsToTheSameKey() {
        assertEquals(
            "BBC One and BBC1 are not the same key",
            NameKey.of("BBC One"),
            NameKey.of("BBC1"),
        )
    }

    @Test
    fun anEmptyNameHasAnEmptyKey() {
        assertEquals("", NameKey.of(""))
        assertEquals("", NameKey.of("!!!"))
    }
}
