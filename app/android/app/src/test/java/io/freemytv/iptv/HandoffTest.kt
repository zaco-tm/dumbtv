package io.freemytv.iptv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * What the hand-off to OpenTV carries.
 *
 * OpenTV's channel ids are rows in its own private database, and this app cannot read
 * them. The provider's id for the same channel is a different number, so nothing goes
 * in that extra: an id that is not OpenTV's would make OpenTV play the wrong channel.
 *
 * Proved here, with no television and no device.
 */
class HandoffTest {

    @Test
    fun theHandOffCarriesTheName() {
        val extras = Handoff.extras("BBC One", null)
        assertEquals("the name did not go", "BBC One", extras[Handoff.EXTRA_NAME])
    }

    @Test
    fun theHandOffCarriesNoIdWhenNoneIsKnown() {
        val extras = Handoff.extras("BBC One", null)
        assertFalse("an id went that was not OpenTV's", extras.containsKey(Handoff.EXTRA_ID))
    }

    @Test
    fun theHandOffCarriesTheIdWhenItIsKnown() {
        val extras = Handoff.extras("BBC One", 42L)
        assertEquals("the id did not go", 42L, extras[Handoff.EXTRA_ID])
        assertEquals("the name did not go", "BBC One", extras[Handoff.EXTRA_NAME])
    }

    @Test
    fun theHandOffCarriesNoNameWhenThereIsNone() {
        val extras = Handoff.extras("", null)
        assertFalse("an empty name went", extras.containsKey(Handoff.EXTRA_NAME))
    }
}
