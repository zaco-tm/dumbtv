package io.freemytv.iptv

/**
 * Where a source is reached.
 *
 * A host is written however the owner wrote it — with or without a scheme — and the
 * scheme is what decides whether the connection is encrypted. Everything that needs to
 * know a source's address, or whether that address is encrypted, asks here, so the two
 * can never disagree about the same source.
 *
 * A source written without a scheme is reached over **https**. The recommendation is
 * that a provider must be https, and defaulting to http would make a provider that
 * works in a development build fail in the shipping one — the very failure the app is
 * meant to warn about rather than to cause.
 *
 * Pure Kotlin, so the JVM test proves it with no television and no network.
 */
object Address {

    /**
     * The root of a provider's addresses: a host, with a scheme and no trailing slash.
     */
    fun base(host: String): String {
        val trimmed = host.trim().trimEnd('/')
        if (trimmed.isEmpty()) {
            return ""
        }
        if (hasScheme(trimmed)) {
            return trimmed
        }
        return "https://$trimmed"
    }

    /**
     * A playlist's address: a URL of its own, with a scheme.
     *
     * A playlist is fetched whole, so its path is kept; only the scheme is added when
     * the owner left it out.
     */
    fun address(url: String): String {
        val trimmed = url.trim()
        if (trimmed.isEmpty() || hasScheme(trimmed)) {
            return trimmed
        }
        return "https://$trimmed"
    }

    /** Whether an address is reached over an encrypted connection. */
    fun isSecure(address: String): Boolean =
            address.trim().startsWith("https://", ignoreCase = true)

    /**
     * The address a stored source is reached at.
     *
     * A provider is reached at its host and a playlist at its own address, so the kind
     * decides which one is the address: a playlist has no host at all, and asking about
     * the host of a playlist would call every playlist insecure.
     */
    fun of(source: Credentials.StoredSource): String = when (source.kind) {
        SOURCE_PROVIDER -> base(source.host)
        SOURCE_PLAYLIST -> address(source.url)
        else -> ""
    }

    /** Whether a host was written with a scheme at all. */
    private fun hasScheme(text: String): Boolean =
            text.startsWith("http://", ignoreCase = true) ||
                    text.startsWith("https://", ignoreCase = true)
}
