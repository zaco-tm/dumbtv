package io.freemytv.iptv

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent

/**
 * The hand-off to OpenTV.
 *
 * OpenTV is the app that plays the channels. AverageTV holds the guide and OpenTV does
 * the playing, so pressing a programme opens OpenTV on that channel.
 *
 * OpenTV exports exactly one thing — `app.opentv.MainActivity` — and understands two
 * extras:
 *
 *  - `opentv.play_channel`, a **Long**: OpenTV's own id for the channel, which is a row
 *    in OpenTV's private database. This app cannot know it: OpenTV's database is private
 *    and there is no way to read it from outside.
 *  - `opentv.play_channel_name`, a **String**: the channel's name. Today's OpenTV does
 *    not read it — the upstream patch in `patches/opentv-play-channel-by-name.patch` adds
 *    it — so both are sent: the id when it is known, and the name always.
 *
 * Until the patch is in an OpenTV release, the hand-off opens OpenTV and the viewer
 * picks. That is the degradation the plan asks for, and it is not a failure: the guide
 * is here and the player is there.
 */
object OpenTv {

    /** OpenTV's package. */
    const val PACKAGE = "app.opentv"

    /** OpenTV's only exported activity. */
    const val ACTIVITY = "app.opentv.MainActivity"

    /** The extra that names a channel. */
    const val EXTRA_NAME = "opentv.play_channel_name"

    /** The extra that carries OpenTV's own channel id. */
    const val EXTRA_ID = "opentv.play_channel"

    /** Whether OpenTV is on the television at all. */
    fun isInstalled(context: Context): Boolean = try {
        context.packageManager.getPackageInfo(PACKAGE, 0)
        true
    } catch (e: Exception) {
        false
    }

    /**
     * Opens OpenTV on a channel.
     *
     * @param channelId OpenTV's own id for the channel, when it is known.
     * @param name the channel's name, which is what goes when the id is not.
     * @return whether OpenTV was opened.
     */
    fun watch(context: Context, channelId: Long?, name: String): Boolean {
        val intent = Intent().setClassName(PACKAGE, ACTIVITY)
        if (channelId != null) {
            intent.putExtra(EXTRA_ID, channelId)
        }
        if (name.isNotEmpty()) {
            intent.putExtra(EXTRA_NAME, name)
        }
        if (context !is Activity) {
            // Starting an activity from the application needs its own task.
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            context.startActivity(intent)
            true
        } catch (e: ActivityNotFoundException) {
            // OpenTV is not on the television. Nothing to hand off to.
            false
        }
    }
}
