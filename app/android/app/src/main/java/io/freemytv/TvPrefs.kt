package io.freemytv

import android.content.Context
import android.content.SharedPreferences

/**
 * The preference files the app and the native side share.
 *
 * The names and the formats are a contract. The final install is in place (the same application id,
 * the same signing key), so the household's settings survive the swap only if the app reads and
 * writes the same names and the same formats as the Java app in variant/ does today.
 */
object TvPrefs {

    /** The household's settings: language, units, theme, the sleep timer, the remote's buttons. */
    const val SETTINGS = "settings"

    /** The home screen's own file: the favourites list, the notice that was already seen. */
    const val HOME_UI = "home-ui"

    /** The parent PIN's file. It holds a salted hash, never the PIN. */
    const val PARENT_PIN = "parent_pin"

    /**
     * The files the JavaScript may read and write. The PIN's file is not among them: it goes
     * through the parent_pin module, so that nothing else can read or write a hash it does not
     * understand.
     */
    private val FROM_JAVASCRIPT = setOf(SETTINGS, HOME_UI)

    fun file(context: Context, name: String): SharedPreferences =
            context.getSharedPreferences(name, Context.MODE_PRIVATE)

    fun allowedFromJavascript(name: String): Boolean = FROM_JAVASCRIPT.contains(name)
}
