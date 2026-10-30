package io.freemytv.iptv

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The provider's credentials, encrypted where they lie.
 *
 * The household's IPTV login is the app's most private thing: it is the family's watch,
 * and it is the one secret that would let somebody else watch it. So it is never written
 * down in the clear. The password is sealed with an AES key that lives in the platform's
 * own **Android Keystore** — a key that never leaves the secure hardware and cannot be
 * read back out of it, so the ciphertext in the preference file is useless on its own and
 * useless on another television.
 *
 * The app has no androidx dependency and this needs none: `android.security.keystore` is
 * the platform's own.
 *
 * The file is the app's own — `iptv` — and not one of the Java app's contract files
 * (`settings`, `kids_settings`, `parent_pin`, `home-ui`, `homedata`, `recs`,
 * `recs_history`): those mean something to the app that comes before this one, and
 * nothing here should disturb them.
 */
class Credentials(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /**
     * What is stored, without the secret.
     *
     * The password is not in here, and never is: this is what the app shows, and what
     * crosses the bridge to the JavaScript.
     */
    fun source(): StoredSource? {
        val kind = prefs.getString(KEY_KIND, null) ?: return null
        return when (kind) {
            SOURCE_PROVIDER -> StoredSource(
                kind = SOURCE_PROVIDER,
                host = prefs.getString(KEY_HOST, "").orEmpty(),
                user = prefs.getString(KEY_USER, "").orEmpty(),
            )
            SOURCE_PLAYLIST -> StoredSource(
                kind = SOURCE_PLAYLIST,
                url = prefs.getString(KEY_URL, "").orEmpty(),
            )
            else -> null
        }
    }

    /** The user and the password, unsealed. Nothing else calls this. */
    fun secret(): Pair<String, String>? {
        val user = unseal(prefs.getString(KEY_USER_SEALED, null)) ?: return null
        val password = unseal(prefs.getString(KEY_PASSWORD_SEALED, null)) ?: return null
        return Pair(user, password)
    }

    /** Stores an Xtream Codes source. */
    fun saveProvider(host: String, user: String, password: String) {
        val editor = prefs.edit()
        editor.putString(KEY_KIND, SOURCE_PROVIDER)
        editor.putString(KEY_HOST, host.trim())
        editor.putString(KEY_USER, user.trim())
        editor.putString(KEY_URL, "")
        editor.putString(KEY_USER_SEALED, seal(user))
        editor.putString(KEY_PASSWORD_SEALED, seal(password))
        editor.apply()
    }

    /** Stores an M3U playlist. A playlist has no login, so there is nothing to seal. */
    fun savePlaylist(url: String) {
        val editor = prefs.edit()
        editor.putString(KEY_KIND, SOURCE_PLAYLIST)
        editor.putString(KEY_HOST, "")
        editor.putString(KEY_USER, "")
        editor.putString(KEY_URL, url.trim())
        editor.remove(KEY_USER_SEALED)
        editor.remove(KEY_PASSWORD_SEALED)
        editor.apply()
    }

    /** Forgets the source, and the secret with it. */
    fun clear() {
        prefs.edit().clear().apply()
    }

    /** Seals a value with the Keystore's key. */
    private fun seal(value: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val sealed = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
        val body = Base64.encodeToString(sealed, Base64.NO_WRAP)
        return "$iv.$body"
    }

    /** Opens a sealed value. Nothing when the key has gone, which is what a restore means. */
    private fun unseal(value: String?): String? {
        if (value.isNullOrEmpty()) {
            return null
        }
        val parts = value.split(".", limit = 2)
        if (parts.size != 2) {
            return null
        }
        return try {
            val iv = Base64.decode(parts[0], Base64.NO_WRAP)
            val sealed = Base64.decode(parts[1], Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, iv))
            String(cipher.doFinal(sealed), Charsets.UTF_8)
        } catch (e: Exception) {
            // The key is gone (the app's data was restored onto another television), or the
            // value was tampered with. Either way there is no secret to be had, and the
            // household has to sign in again.
            null
        }
    }

    /**
     * The Keystore's key for the credentials.
     *
     * It is made once and kept: a new key would leave the old ciphertext unreadable, and
     * the household would have to sign in again for no reason.
     */
    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        val existing = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
        if (existing != null) {
            return existing.secretKey
        }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    /** What is stored, without the secret. */
    data class StoredSource(
        val kind: String,
        val host: String = "",
        val user: String = "",
        val url: String = "",
    )

    private companion object {
        /** The preference file. The app's own. */
        const val FILE = "iptv"

        /** The Keystore's key name. */
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val KEY_ALIAS = "averagetv.iptv.credentials"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val TAG_BITS = 128

        const val KEY_KIND = "kind"
        const val KEY_HOST = "host"
        const val KEY_USER = "user"
        const val KEY_URL = "url"
        const val KEY_USER_SEALED = "user_sealed"
        const val KEY_PASSWORD_SEALED = "password_sealed"
    }
}
