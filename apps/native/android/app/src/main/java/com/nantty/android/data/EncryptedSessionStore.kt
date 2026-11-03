package com.nantty.android.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

interface SessionStore {
    fun read(): AccountSession?
    fun write(session: AccountSession)
    fun clear()
}

class EncryptedSessionStore(context: Context) : SessionStore {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    override fun read(): AccountSession? {
        val encoded = preferences.getString(SESSION_KEY, null) ?: return null
        return try {
            val packed = Base64.decode(encoded, Base64.NO_WRAP)
            require(packed.size > IV_LENGTH_BYTES)
            val iv = packed.copyOfRange(0, IV_LENGTH_BYTES)
            val ciphertext = packed.copyOfRange(IV_LENGTH_BYTES, packed.size)
            val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(TAG_LENGTH_BITS, iv)) }
            val json = JSONObject(String(cipher.doFinal(ciphertext), Charsets.UTF_8))
            val user = JSONObject().apply {
                put("id", json.getString("id"))
                put("name", json.getString("name"))
                put("username", json.getString("username"))
                put("email", json.optString("email").takeIf(String::isNotBlank))
                put("avatarUrl", json.optString("avatarUrl").takeIf(String::isNotBlank))
                put("roles", json.optJSONArray("roles") ?: JSONArray())
            }
            parseAccountSession(mapOf(
                "accessToken" to json.getString("accessToken"),
                "refreshToken" to json.getString("refreshToken"),
                "user" to user.toSessionMap(),
            ))
        } catch (_: Exception) {
            clear()
            runCatching { KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }.deleteEntry(KEY_ALIAS) }
            null
        }
    }

    @Synchronized
    override fun write(session: AccountSession) {
        val json = JSONObject().apply {
            put("accessToken", session.accessToken)
            put("refreshToken", session.refreshToken)
            put("id", session.user.id)
            put("name", session.user.name)
            put("username", session.user.username)
            put("email", session.user.email)
            put("avatarUrl", session.user.avatarUrl)
            put("roles", JSONArray(session.user.roles))
        }
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, secretKey()) }
        val encrypted = cipher.doFinal(json.toString().toByteArray(Charsets.UTF_8))
        val packed = cipher.iv + encrypted
        check(preferences.edit().putString(SESSION_KEY, Base64.encodeToString(packed, Base64.NO_WRAP)).commit())
    }

    @Synchronized
    override fun clear() {
        val cleared = preferences.edit().remove(SESSION_KEY).commit()
        runCatching { KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }.deleteEntry(KEY_ALIAS) }
        check(cleared) { "Could not clear the encrypted account session." }
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    private fun JSONObject.toSessionMap(): Map<String, Any?> = mapOf(
        "id" to optString("id"),
        "name" to optString("name"),
        "username" to optString("username"),
        "email" to optString("email").takeIf(String::isNotBlank),
        "avatarUrl" to optString("avatarUrl").takeIf(String::isNotBlank),
        "roles" to optJSONArray("roles")?.let { array -> (0 until array.length()).map { array.optString(it) } }.orEmpty(),
    )

    companion object {
        private const val PREFERENCES_NAME = "nantty_account_session_v1"
        private const val SESSION_KEY = "encrypted_session"
        private const val KEY_ALIAS = "com.nantty.android.account-session.v1"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_LENGTH_BYTES = 12
        private const val TAG_LENGTH_BITS = 128
    }
}
