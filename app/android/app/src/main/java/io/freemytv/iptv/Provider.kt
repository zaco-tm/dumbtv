package io.freemytv.iptv

import java.io.IOException
import java.io.InputStream
import java.io.PushbackInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.zip.GZIPInputStream
import org.json.JSONArray

/**
 * The provider's channels, and the guide.
 *
 * Two kinds of source, and both are ordinary HTTP:
 *
 *  - an **Xtream Codes** provider, which answers `player_api.php` with the channel list
 *    and `get.php` with the address of an XMLTV guide;
 *  - an **M3U playlist**, which is a text file of channels.
 *
 * And when there is no provider, or the provider's guide is empty or unreachable, the
 * guide comes from a [PublicFeeds] public feed instead. **A failed fetch must leave the
 * public feed in place, not raise**: the page shows a guide, not a failure.
 *
 * The HTTP is `HttpURLConnection`, because the app has no networking library and does not
 * need one.
 */
class Provider {

    /** The channels the source lists. */
    fun channels(source: Credentials.StoredSource, secret: Pair<String, String>?): List<IptvChannel> = try {
        when (source.kind) {
            SOURCE_PROVIDER -> providerChannels(source, secret)
            SOURCE_PLAYLIST -> M3u.parse(readText(source.url))
            else -> emptyList()
        }
    } catch (e: Exception) {
        // A provider that is down, or a playlist that cannot be fetched, is an empty
        // channel list rather than a crash: the page shows what it has.
        emptyList()
    }

    /**
     * The guide.
     *
     * The provider's own guide when there is one, and the public feed when there is not.
     *
     * The guide is kept for a while, because a public feed is tens of megabytes and the
     * television should not fetch it again every time the page is opened.
     */
    fun guide(source: Credentials.StoredSource, secret: Pair<String, String>?, country: String): Guide {
        val key = source.kind + "|" + source.host + "|" + source.user + "|" + country
        val now = System.currentTimeMillis()
        val held = cached
        if (held != null && held.first == key && now - cachedAt < CACHE_MS) {
            return held.second
        }

        val guide = if (source.kind == SOURCE_PROVIDER && secret != null) {
            try {
                val url = providerXmltvUrl(source, secret)
                if (url.isNotEmpty()) {
                    Xmltv.parse(open(url))
                } else {
                    publicGuide(country)
                }
            } catch (e: Exception) {
                // The provider's guide did not come. The public feed takes its place.
                publicGuide(country)
            }
        } else {
            publicGuide(country)
        }

        cached = Pair(key, guide)
        cachedAt = now
        return guide
    }

    /** The guide that was fetched, and the key it was fetched for. */
    private var cached: Pair<String, Guide>? = null

    /** When the guide was fetched. */
    private var cachedAt = 0L

    /** The public feed for the country, or an empty guide when it cannot be fetched. */
    fun publicGuide(country: String): Guide {
        val feed = PublicFeeds.forCountry(country)
        return try {
            Xmltv.parse(open(feed.url))
        } catch (e: Exception) {
            Guide()
        }
    }

    /** The provider's channel list, as the provider's JSON says it. */
    private fun providerChannels(
        source: Credentials.StoredSource,
        secret: Pair<String, String>?,
    ): List<IptvChannel> {
        if (secret == null) {
            return emptyList()
        }
        val url = StringBuilder(base(source.host))
            .append("/player_api.php?username=").append(encode(secret.first))
            .append("&password=").append(encode(secret.second))
            .append("&action=get_live_streams")
            .toString()

        val array = JSONArray(readText(url))
        val channels = mutableListOf<IptvChannel>()
        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i) ?: continue
            val streamId = item.optString("stream_id")
            if (streamId.isEmpty()) {
                continue
            }
            channels.add(
                IptvChannel(
                    id = streamId,
                    name = item.optString("name"),
                    number = item.optInt("num", 0),
                    group = item.optString("category_name"),
                    logo = item.optString("stream_icon"),
                    url = "",
                    // The provider's own id for the channel in the guide. It is the join
                    // that works without guessing at names.
                    epgId = item.optString("epg_channel_id"),
                ),
            )
        }
        return channels
    }

    /** Where the provider's guide lives. */
    private fun providerXmltvUrl(source: Credentials.StoredSource, secret: Pair<String, String>): String {
        val url = StringBuilder(base(source.host))
            .append("/get.php?username=").append(encode(secret.first))
            .append("&password=").append(encode(secret.second))
            .append("&type=m3u_plus&output=xmltv_url")
            .toString()
        return readText(url).trim()
    }

    /**
     * The root of a provider's addresses.
     *
     * A host is written however the owner wrote it — with or without a scheme — and the
     * scheme is what decides whether the connection is encrypted, so it is kept.
     */
    private fun base(host: String): String {
        val trimmed = host.trim().trimEnd('/')
        if (trimmed.isEmpty()) {
            return ""
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed
        }
        return "http://$trimmed"
    }

    /** Whether a host is reached over an encrypted connection. */
    fun isSecure(host: String): Boolean = host.trim().startsWith("https://", ignoreCase = true)

    /** A URL's query part, encoded. */
    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    /** A URL's body, as text. */
    private fun readText(url: String): String = open(url).use { it.readBytes().toString(Charsets.UTF_8) }

    /**
     * A URL's body, as a stream.
     *
     * The stream is decompressed when it is gzipped, because the public feeds are: the
     * epgshare guides are served as `.xml.gz`. The check is on the bytes rather than on
     * the file name, because a server may say it is gzipped in the header, in the name,
     * or in neither.
     */
    private fun open(url: String): InputStream {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = TIMEOUT_MS
        connection.readTimeout = TIMEOUT_MS
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("Accept-Encoding", "identity")
        try {
            val code = connection.responseCode
            if (code !in 200..299) {
                throw IOException("the server answered $code")
            }
            val stream = PushbackInputStream(connection.inputStream, 2)
            val first = stream.read()
            val second = stream.read()
            if (first < 0) {
                throw IOException("the server sent nothing")
            }
            stream.unread(second)
            stream.unread(first)
            return if (first == GZIP_MAGIC_FIRST && second == GZIP_MAGIC_SECOND) {
                GZIPInputStream(stream)
            } else {
                stream
            }
        } finally {
            // The connection is closed when the stream is: disconnecting here would cut
            // the body short.
        }
    }

    private companion object {
        const val TIMEOUT_MS = 20_000
        const val GZIP_MAGIC_FIRST = 0x1f
        const val GZIP_MAGIC_SECOND = 0x8b

        /** How long a fetched guide is kept. */
        const val CACHE_MS = 30 * 60 * 1000L
    }
}
