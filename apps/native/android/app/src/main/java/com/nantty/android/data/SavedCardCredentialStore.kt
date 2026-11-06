package com.nantty.android.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.MessageDigest
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Masked display metadata plus the server-issued Nantty card ID; never contains PAN or provider auth data. */
internal data class DeviceSavedCard(
    val savedCardId: String,
    val brand: String,
    val last4: String,
    val expiryMonth: Int,
    val expiryYear: Int,
)

internal interface SavedCardCredentialStore {
    fun readDisplay(): DeviceSavedCard?
    fun readSavedCardIdAfterUserConfirmation(): String?
    fun save(card: DeviceSavedCard)
    fun remove()
}

/** Encrypts the local card ID and masked display using an app-scoped Android Keystore AES key. */
internal class AndroidSavedCardCredentialStore(
    context: Context,
    private val accountIdProvider: () -> String?,
) : SavedCardCredentialStore {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    override fun readDisplay(): DeviceSavedCard? = readRecord()

    /** Call only from the success callback of the checkout biometric confirmation prompt. */
    @Synchronized
    override fun readSavedCardIdAfterUserConfirmation(): String? = readRecord()?.savedCardId

    @Synchronized
    override fun save(card: DeviceSavedCard) {
        val accountScope = requireAccountScope()
        require(isValidSavedCardId(card.savedCardId))
        require(card.brand.isNotBlank() && card.brand.length <= MAX_BRAND_LENGTH)
        require(card.last4.matches(Regex("[0-9]{4}")))
        require(card.expiryMonth in 1..12 && card.expiryYear in MIN_YEAR..MAX_YEAR)

        val plaintext = JSONObject()
            .put("savedCardId", card.savedCardId)
            .put("brand", card.brand)
            .put("last4", card.last4)
            .put("expiryMonth", card.expiryMonth)
            .put("expiryYear", card.expiryYear)
            .toString()
            .toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.ENCRYPT_MODE, secretKey(accountScope))
        }
        val packed = cipher.iv + cipher.doFinal(plaintext)
        check(preferences.edit().putString(recordKey(accountScope), Base64.encodeToString(packed, Base64.NO_WRAP)).commit()) {
            "Could not save the card on this device."
        }
    }

    @Synchronized
    override fun remove() {
        val accountScope = accountScope() ?: return
        check(preferences.edit().remove(recordKey(accountScope)).commit()) { "Could not remove the saved card from this device." }
        runCatching { KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }.deleteEntry(keyAlias(accountScope)) }
    }

    private fun readRecord(): DeviceSavedCard? {
        val accountScope = accountScope() ?: return null
        val encoded = preferences.getString(recordKey(accountScope), null) ?: return null
        return runCatching {
            val packed = Base64.decode(encoded, Base64.NO_WRAP)
            require(packed.size > GCM_IV_BYTES)
            val iv = packed.copyOfRange(0, GCM_IV_BYTES)
            val encrypted = packed.copyOfRange(GCM_IV_BYTES, packed.size)
            val plaintext = Cipher.getInstance(TRANSFORMATION).run {
                init(Cipher.DECRYPT_MODE, secretKey(accountScope), GCMParameterSpec(GCM_TAG_BITS, iv))
                doFinal(encrypted)
            }
            JSONObject(String(plaintext, Charsets.UTF_8)).let { json ->
                DeviceSavedCard(
                    savedCardId = json.getString("savedCardId").also { require(isValidSavedCardId(it)) },
                    brand = json.getString("brand").also { require(it.isNotBlank() && it.length <= MAX_BRAND_LENGTH) },
                    last4 = json.getString("last4").also { require(it.matches(Regex("[0-9]{4}"))) },
                    expiryMonth = json.getInt("expiryMonth").also { require(it in 1..12) },
                    expiryYear = json.getInt("expiryYear").also { require(it in MIN_YEAR..MAX_YEAR) },
                )
            }
        }.getOrElse {
            remove()
            null
        }
    }

    private fun secretKey(accountScope: String): SecretKey {
        val alias = keyAlias(accountScope)
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    private fun accountScope(): String? = accountIdProvider()?.trim()?.takeIf(String::isNotEmpty)

    private fun requireAccountScope(): String = requireNotNull(accountScope()) {
        "Sign in to save a card on this device."
    }

    private fun recordKey(accountScope: String): String = "${RECORD_KEY}_${accountScope.hashForStorage()}"

    private fun keyAlias(accountScope: String): String = "${KEY_ALIAS}_${accountScope.hashForStorage()}"

    private companion object {
        const val PREFERENCES_NAME = "nantty_saved_card_v1"
        const val RECORD_KEY = "encrypted_saved_card_record"
        const val KEY_ALIAS = "nantty_saved_card_encryption_v1"
        const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val GCM_IV_BYTES = 12
        const val GCM_TAG_BITS = 128
        const val MAX_BRAND_LENGTH = 40
        const val MIN_YEAR = 2000
        const val MAX_YEAR = 2200

        fun isValidSavedCardId(value: String): Boolean =
            value.length in 1..128 && value.matches(Regex("[A-Za-z0-9_-]{1,128}"))
    }
}

private fun String.hashForStorage(): String = MessageDigest.getInstance("SHA-256")
    .digest(toByteArray(Charsets.UTF_8))
    .take(12)
    .joinToString("") { byte -> "%02x".format(byte) }
