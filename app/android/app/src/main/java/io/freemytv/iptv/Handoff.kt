package io.freemytv.iptv

/**
 * What the hand-off to OpenTV carries.
 *
 * OpenTV's channel ids are rows in **its own** private database, and this app cannot
 * read them: there is no way to know one. The provider's own id for the same channel is
 * a *different* number — it is the provider's numbering, not OpenTV's — and putting it
 * in OpenTV's id extra would make OpenTV play whichever channel happens to carry that
 * number in its own list: the wrong channel, with nothing to say so.
 *
 * So the name goes and the id does not, until OpenTV's id for a channel is knowable.
 * The name is what OpenTV can resolve — its own upstream patch
 * (`patches/opentv-play-channel-by-name.patch`) looks a channel up by name for exactly
 * this reason: an outside app knows the name, not the id.
 *
 * Pure Kotlin, so the JVM test proves it with no television and no device.
 */
object Handoff {

    /** The extra that names a channel. */
    const val EXTRA_NAME = "opentv.play_channel_name"

    /** The extra that carries OpenTV's own channel id. */
    const val EXTRA_ID = "opentv.play_channel"

    /**
     * The extras the hand-off carries.
     *
     * The name always goes. The id goes only when OpenTV's own id for the channel is
     * known — which today it never is.
     *
     * @param name the channel's name, as the household knows it.
     * @param openTvId OpenTV's own id for the channel, when it is known.
     */
    fun extras(name: String, openTvId: Long?): Map<String, Any> {
        val extras = mutableMapOf<String, Any>()
        if (openTvId != null) {
            extras[EXTRA_ID] = openTvId
        }
        if (name.isNotEmpty()) {
            extras[EXTRA_NAME] = name
        }
        return extras
    }
}
