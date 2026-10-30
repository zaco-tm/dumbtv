package io.freemytv

/**
 * What the Live TV module needs from the Java app's own place.
 *
 * `Place` is the Java app's own class and it is package-private, so the module — which
 * lives in its own package — cannot reach it directly. This is the one door between the
 * two: the place the Java app already works out from the television's time zone, and the
 * region it already uses for the streaming picks.
 *
 * Nothing here is a copy of the Java app's logic. It is the same answer, asked once.
 */
object TelevisionPlace {

    /**
     * The country the television is in, as a country code.
     *
     * It is the app's own region — the one the streaming picks use — which is the
     * television's country unless the owner chose a different one for the films.
     */
    fun country(): String = Place.region().trim().uppercase()

    /** The city the television is in. */
    fun city(): String = Place.city().trim()
}
