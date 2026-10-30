package io.freemytv.iptv

/**
 * The M3U playlist.
 *
 * A playlist is a text file: a header, and then one entry per channel. Each entry is an
 * `#EXTINF` line carrying the channel's attributes, and the stream's URL on the line
 * after it:
 *
 *     #EXTM3U
 *     #EXTINF:-1 tvg-id="bbc-one.uk" tvg-name="BBC One" tvg-logo="http://…/bbc.png" group-title="News",1
 *     http://…/bbc-one
 *
 * The number is what comes after the last comma that is not inside a quoted value, and
 * the name is what comes before it.
 *
 * The parser is pure Kotlin with no Android in it, so the JVM test proves it without a
 * television and without a network.
 */
object M3u {

    /** The channels in a playlist. */
    fun parse(text: String): List<IptvChannel> {
        val channels = mutableListOf<IptvChannel>()
        var pending: Pending? = null

        for (raw in text.lines()) {
            val line = raw.trim()
            if (line.isEmpty()) {
                continue
            }
            if (line.startsWith("#EXTINF:", ignoreCase = true)) {
                pending = parseExtInf(line.substring("#EXTINF:".length))
                continue
            }
            if (line.startsWith("#")) {
                // Any other tag: a comment, or an attribute line for the entry above.
                continue
            }
            // A URL: it belongs to the entry above it.
            val entry = pending
            pending = null
            if (entry == null) {
                continue
            }
            channels.add(
                IptvChannel(
                    id = entry.tvgId.ifEmpty { entry.name.ifEmpty { entry.number.toString() } },
                    name = entry.name,
                    number = entry.number,
                    group = entry.group,
                    logo = entry.logo,
                    url = line,
                    // In a playlist the guide's id for the channel is the same `tvg-id`:
                    // that is what the attribute is for.
                    epgId = entry.tvgId,
                ),
            )
        }
        return channels
    }

    /** The parts of an `#EXTINF` line. */
    private data class Pending(
        val name: String,
        val number: Int,
        val group: String,
        val logo: String,
        val tvgId: String,
    )

    private fun parseExtInf(body: String): Pending {
        // The line is: attributes, a comma, and then either the title or the number.
        //
        // Two shapes are in the wild and a playlist may use either:
        //
        //     #EXTINF:-1,Channel Name
        //     #EXTINF:-1 tvg-name="Channel Name" group-title="News",1
        //
        // So the part after the comma is read as a number when it is one, and as the title
        // when it is not; and the name comes from `tvg-name` when the part after the
        // comma is a number.
        val split = lastCommaOutsideQuotes(body)
        val head = if (split < 0) body else body.substring(0, split)
        val tail = if (split < 0) "" else body.substring(split + 1)

        // Attributes may sit on either side of the comma.
        val tailParts = splitAtSemicolon(tail)
        val attributes = LinkedHashMap<String, String>()
        for (match in ATTRIBUTE.findAll(head)) {
            attributes[match.groupValues[1]] = match.groupValues[2]
        }
        for (match in ATTRIBUTE.findAll(tailParts.second)) {
            attributes[match.groupValues[1]] = match.groupValues[2]
        }

        val title = tailParts.first.trim()
        val number = title.toIntOrNull()
        val name = when {
            number != null -> attributes["tvg-name"] ?: attributes["display-name"] ?: ""
            else -> title
        }

        return Pending(
            name = name,
            number = number ?: 0,
            group = attributes["group-title"].orEmpty(),
            logo = attributes["tvg-logo"].orEmpty(),
            tvgId = attributes["tvg-id"].orEmpty(),
        )
    }

    /** Where the last comma is that is not inside a quoted value. */
    private fun lastCommaOutsideQuotes(text: String): Int {
        var inQuotes = false
        var found = -1
        for (i in text.indices) {
            when (text[i]) {
                '"' -> inQuotes = !inQuotes
                ',' -> if (!inQuotes) found = i
            }
        }
        return found
    }

    /** Where the first semicolon is that is not inside a quoted value. */
    private fun splitAtSemicolon(text: String): Pair<String, String> {
        var inQuotes = false
        for (i in text.indices) {
            when (text[i]) {
                '"' -> inQuotes = !inQuotes
                ';' -> if (!inQuotes) return Pair(text.substring(0, i), text.substring(i + 1))
            }
        }
        return Pair(text, "")
    }

    /** `key="value"`, the way a playlist writes an attribute. */
    private val ATTRIBUTE = Regex("([A-Za-z0-9_-]+)=\"([^\"]*)\"")
}
