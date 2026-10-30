package io.freemytv.iptv

/**
 * The public EPG feeds.
 *
 * When the household has no provider login — or the provider's own guide is empty or
 * unreachable — the guide comes from a public feed instead. These are the same feeds
 * OpenTV ships, so the guide on the television is the guide OpenTV would show.
 *
 * The country decides the feed, and the country is the television's own answer: its time
 * zone says where it is.
 */
object PublicFeeds {

    /** A feed: a name to show, and the URL it is fetched from. */
    data class Feed(val name: String, val url: String)

    /**
     * The UK's feed: the Freeview guide, which is the free-to-air channels.
     *
     * This is also the fallback for a country with no feed of its own, because it is the
     * one the plan names.
     */
    val UK = Feed("Freeview", "https://raw.githubusercontent.com/dp247/Freeview-EPG/master/epg.xml")

    /** The UK's Sky lineup, for a household with a Sky subscription. */
    val UK_SKY = Feed("Sky lineup", "https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz")

    /** The United States. */
    val USA = Feed("USA", "https://epgshare01.online/epgshare01/epg_ripper_US1.xml.gz")

    /** Canada. */
    val CANADA = Feed("Canada", "https://epgshare01.online/epgshare01/epg_ripper_CA1.xml.gz")

    /** Australia. */
    val AUSTRALIA = Feed("Australia", "https://epgshare01.online/epgshare01/epg_ripper_AU1.xml.gz")

    /**
     * The feed for a country.
     *
     * An unknown country gets the UK's feed, because the plan names it as the fallback
     * and a guide for the wrong country is better than no guide.
     */
    fun forCountry(country: String): Feed = when (country.trim().uppercase()) {
        "GB", "UK" -> UK
        "US", "USA" -> USA
        "CA", "CAN" -> CANADA
        "AU", "AUS" -> AUSTRALIA
        else -> UK
    }
}
