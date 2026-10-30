package io.freemytv.iptv

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import io.freemytv.TelevisionPlace

/**
 * Live TV: the provider's channels, the guide, and the hand-off to OpenTV.
 *
 * The module is the native half of the Live TV page, and it is native for two reasons:
 * the household's credentials are not JavaScript's business, and a guide is tens of
 * megabytes of XML that should be read once and not carried across a bridge.
 *
 * The JavaScript sees plain data: the channels with what is on them, and the events of
 * the evening.
 */
class IptvModule(reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "iptv"

    private val credentials by lazy { Credentials(reactApplicationContext) }
    private val provider by lazy { Provider() }

    /**
     * Stores an Xtream Codes source.
     *
     * The password is sealed with the Keystore's key before it is written, and it is
     * never sent back to the JavaScript.
     */
    @ReactMethod
    fun saveProvider(host: String, user: String, password: String, promise: Promise) {
        try {
            credentials.saveProvider(host, user, password)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("iptv_save_failed", e)
        }
    }

    /** Stores an M3U playlist. A playlist has no login, so there is nothing to seal. */
    @ReactMethod
    fun savePlaylist(url: String, promise: Promise) {
        try {
            credentials.savePlaylist(url)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("iptv_save_failed", e)
        }
    }

    /** Forgets the source. */
    @ReactMethod
    fun clear(promise: Promise) {
        try {
            credentials.clear()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("iptv_clear_failed", e)
        }
    }

    /** What is stored, without the secret. */
    @ReactMethod
    fun source(promise: Promise) {
        val stored = credentials.source()
        if (stored == null) {
            promise.resolve(null)
            return
        }
        val map = Arguments.createMap()
        map.putString("kind", stored.kind)
        map.putString("host", stored.host)
        map.putString("user", stored.user)
        map.putString("url", stored.url)
        // Whether the provider is reached over an encrypted connection. The app says so
        // when it is not: the release build does not allow cleartext, so a plain http
        // provider works in a debug build and fails in the shipping one.
        map.putBoolean("secure", provider.isSecure(stored.host))
        promise.resolve(map)
    }

    /**
     * The channels, with what is on them now.
     *
     * A channel the guide does not have still comes: it is a channel, and it is on the
     * television. It simply has no programme to say.
     */
    @ReactMethod
    fun channels(promise: Promise) {
        try {
            val stored = credentials.source()
            if (stored == null) {
                promise.resolve(Arguments.createArray())
                return
            }
            val secret = credentials.secret()
            val guide = provider.guide(stored, secret, TelevisionPlace.country())
            val now = System.currentTimeMillis()

            val out: WritableArray = Arguments.createArray()
            for (channel in provider.channels(stored, secret)) {
                val map = Arguments.createMap()
                map.putString("id", channel.id)
                map.putString("name", channel.name)
                map.putInt("number", channel.number)
                map.putString("group", channel.group)
                map.putString("logo", channel.logo)

                val matched = GuideMatcher.match(channel, guide)
                val programmes = if (matched == null) {
                    emptyList()
                } else {
                    GuideMatcher.programmesFor(matched, guide)
                }
                val nowAndNext = GuideMatcher.nowAndNext(programmes, now)
                map.putMap("now", programme(nowAndNext.first))
                map.putMap("next", programme(nowAndNext.second))
                out.pushMap(map)
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.reject("iptv_channels_failed", e)
        }
    }

    /**
     * The evening's events.
     *
     * Each event carries the channel's name, because the guide names channels its own
     * way and the household knows them by the provider's names.
     */
    @ReactMethod
    fun guide(promise: Promise) {
        try {
            val stored = credentials.source()
            if (stored == null) {
                promise.resolve(Arguments.createArray())
                return
            }
            val secret = credentials.secret()
            val guide = provider.guide(stored, secret, TelevisionPlace.country())
            val channels = provider.channels(stored, secret)

            // The guide's channel id to the name the household knows it by.
            val names = HashMap<String, String>()
            for (channel in channels) {
                val matched = GuideMatcher.match(channel, guide) ?: continue
                names[matched.id] = channel.name
            }

            val out: WritableArray = Arguments.createArray()
            for (item in guide.programmes) {
                val map = Arguments.createMap()
                map.putString("title", item.title)
                map.putDouble("from", item.from.toDouble())
                map.putDouble("to", item.to.toDouble())
                map.putString("category", item.category)
                map.putString("channelId", item.channelId)
                map.putString("channelName", names[item.channelId] ?: item.channelId)
                out.pushMap(map)
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.reject("iptv_guide_failed", e)
        }
    }

    /**
     * Opens OpenTV on a channel.
     *
     * The name always goes; the id goes when it is known, which today it never is.
     */
    @ReactMethod
    fun watch(channelId: String, name: String, promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            val context = activity ?: reactApplicationContext
            val id = channelId.toLongOrNull()
            promise.resolve(OpenTv.watch(context, id, name))
        } catch (e: Exception) {
            promise.reject("iptv_watch_failed", e)
        }
    }

    /** Whether OpenTV is on the television. */
    @ReactMethod
    fun openTvInstalled(promise: Promise) {
        promise.resolve(OpenTv.isInstalled(reactApplicationContext))
    }

    /** A programme, for the bridge. */
    private fun programme(item: IptvProgramme?): WritableMap? {
        if (item == null) {
            return null
        }
        val map = Arguments.createMap()
        map.putString("title", item.title)
        map.putDouble("from", item.from.toDouble())
        map.putDouble("to", item.to.toDouble())
        map.putString("category", item.category)
        return map
    }
}
