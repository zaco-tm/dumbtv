package io.freemytv.iptv

/**
 * The guide's data, and the provider's channels.
 *
 * These are plain data with no Android in them, so the parsers and the matcher can be
 * proved on the JVM — no television, no network, no device.
 */

/**
 * A channel the provider lists.
 *
 * @param id the provider's own id for the channel. It is what the guide is matched on,
 *   and what would be handed to OpenTV if OpenTV knew it — which it does not, so the
 *   name is what goes instead.
 * @param name the name the household sees.
 * @param number the channel number, when the provider gives one. Zero when it does not.
 * @param group the group ("Sports", "Kids"), when the provider gives one.
 * @param logo the logo's URL, when the provider gives one.
 * @param url the stream's URL. An M3U source gives one; a provider source gives the id.
 */
data class IptvChannel(
    val id: String,
    val name: String,
    val number: Int = 0,
    val group: String = "",
    val logo: String = "",
    val url: String = "",
    /**
     * The guide's own id for this channel, when the provider gives one.
     *
     * This is the join that matters: a provider says `epg_channel_id` and the guide
     * calls the same channel by that id, so the two are put together by an id rather
     * than by guessing at names. Only when there is no id do the names have to be
     * matched, and that is where [NameKey] earns its keep.
     */
    val epgId: String = "",
)

/**
 * A programme in the guide.
 *
 * @param channelId the guide's own id for the channel this is on.
 * @param from when it starts, in milliseconds since the epoch.
 * @param to when it ends, in milliseconds since the epoch.
 */
data class IptvProgramme(
    val channelId: String,
    val title: String,
    val from: Long,
    val to: Long,
    val description: String = "",
    val category: String = "",
)

/** A channel the guide names. */
data class GuideChannel(
    val id: String,
    val name: String,
    val logo: String = "",
)

/** A whole guide: the channels it names and the programmes it holds. */
data class Guide(
    val channels: List<GuideChannel> = emptyList(),
    val programmes: List<IptvProgramme> = emptyList(),
)

/**
 * The key two names are compared by.
 *
 * A guide and a provider rarely spell a channel the same way: "BBC One" in one and
 * "BBC1" in the other. Folding a name to its letters and digits, lowercased, with the
 * number words turned into their digits, makes those two the same name.
 *
 * It is the folding OpenTV uses to match a channel it is asked to play by name
 * (`ChannelNameNormalizer`), so a channel the upstream patch finds and a channel this
 * app finds are found by the same rule — which is the whole point of sending the name
 * rather than an id.
 */
object NameKey {

    /**
     * The number words that are turned into digits.
     *
     * Only whole words: "Stone" must not become "st1ne".
     */
    private val NUMBER_WORDS = mapOf(
        "one" to "1",
        "two" to "2",
        "three" to "3",
        "four" to "4",
        "five" to "5",
        "six" to "6",
        "seven" to "7",
        "eight" to "8",
        "nine" to "9",
        "ten" to "10",
        "eleven" to "11",
        "twelve" to "12",
    )

    /** The key for a name. */
    fun of(name: String): String {
        val out = StringBuilder()
        for (word in name.split(WORD_BREAK)) {
            if (word.isEmpty()) {
                continue
            }
            val lower = word.lowercase()
            out.append(NUMBER_WORDS[lower] ?: lower)
        }
        return out.toString()
    }

    /** Anything that is not a letter or a digit ends a word. */
    private val WORD_BREAK = Regex("[^A-Za-z0-9]+")
}
