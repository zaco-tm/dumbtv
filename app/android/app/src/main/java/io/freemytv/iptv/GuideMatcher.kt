package io.freemytv.iptv

/**
 * Putting a provider's channels and a guide together, and working out what is on.
 *
 * A guide names its channels its own way, and a provider names them its own way. The
 * two are joined by the guide's id when the provider gives one, and by the name when it
 * does not — the name being folded the way OpenTV folds it, so the channel this app
 * finds is the channel the upstream patch would find.
 *
 * Pure Kotlin, so the JVM test proves the join with no television and no network.
 */
object GuideMatcher {

    /**
     * The guide's channel for a provider's channel, or nothing when the guide does not
     * have it.
     */
    fun match(channel: IptvChannel, guide: Guide): GuideChannel? {
        if (channel.epgId.isNotEmpty()) {
            val byId = guide.channels.firstOrNull { it.id == channel.epgId }
            if (byId != null) {
                return byId
            }
        }
        return matchByName(channel, guide)
    }

    /**
     * The guide's channel for a provider's channel, by name.
     *
     * The names are folded first, so "BBC One" finds "BBC1". When the folded names are
     * not equal, one containing the other is accepted — but only when the shorter is
     * long enough to be a name and not a coincidence, because "ITV" inside "ITV2" is
     * two channels and not one.
     */
    fun matchByName(channel: IptvChannel, guide: Guide): GuideChannel? {
        val key = NameKey.of(channel.name)
        if (key.isEmpty()) {
            return null
        }
        for (candidate in guide.channels) {
            if (NameKey.of(candidate.name) == key) {
                return candidate
            }
        }
        for (candidate in guide.channels) {
            val other = NameKey.of(candidate.name)
            if (other.length >= 3 && key.length >= 3 && (other.contains(key) || key.contains(other))) {
                return candidate
            }
        }
        return null
    }

    /** The programmes for a guide channel, in time order. */
    fun programmesFor(guideChannel: GuideChannel, guide: Guide): List<IptvProgramme> =
        guide.programmes.filter { it.channelId == guideChannel.id }.sortedBy { it.from }

    /**
     * What is on now, and what is next.
     *
     * A programme is on now when it has started and has not finished. A programme that
     * has finished is not "on now" even if the guide has no successor, because the
     * television is showing nothing rather than something that ended.
     */
    fun nowAndNext(programmes: List<IptvProgramme>, now: Long): Pair<IptvProgramme?, IptvProgramme?> {
        var onNow: IptvProgramme? = null
        var next: IptvProgramme? = null
        for (programme in programmes) {
            if (programme.from <= now && programme.to > now) {
                onNow = programme
                next = programmes.firstOrNull { it.from > now }
                break
            }
            if (programme.from > now && next == null) {
                next = programme
            }
        }
        return Pair(onNow, next)
    }

    /**
     * How far through a programme we are, from 0 to 1.
     *
     * A programme with no length has no progress to show, and the bar stays empty rather
     * than pretending to be at the end.
     */
    fun progress(programme: IptvProgramme?, now: Long): Double {
        if (programme == null) {
            return 0.0
        }
        val length = programme.to - programme.from
        if (length <= 0L) {
            return 0.0
        }
        val done = now - programme.from
        if (done <= 0L) {
            return 0.0
        }
        if (done >= length) {
            return 1.0
        }
        return done.toDouble() / length.toDouble()
    }
}
