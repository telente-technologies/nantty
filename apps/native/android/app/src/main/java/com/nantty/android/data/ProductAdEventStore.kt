package com.nantty.android.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.MessageDigest
import java.time.Instant
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONArray
import org.json.JSONObject

/** Small signed event payload retained only until the server acknowledges it or its ad token expires. */
data class PendingProductAdEvent(
    val eventId: String,
    val campaignId: String,
    val placement: String,
    val type: String,
    val itemId: String,
    val token: String,
    val expiresAt: String,
    val occurredAt: String,
) {
    fun requestJson(): JSONObject = JSONObject()
        .put("eventId", eventId)
        .put("campaignId", campaignId)
        .put("placement", placement)
        .put("type", type)
        .put("itemId", itemId)
        .put("token", token)
        .put("occurredAt", occurredAt)

    fun storageJson(): JSONObject = requestJson().put("expiresAt", expiresAt)

    companion object {
        fun fromStorageJson(row: JSONObject): PendingProductAdEvent? = runCatching {
            PendingProductAdEvent(
                eventId = row.optString("eventId").takeIf(SAFE_EVENT_ID::matches) ?: return null,
                campaignId = row.optString("campaignId").takeIf(SAFE_ID::matches) ?: return null,
                placement = row.optString("placement").takeIf { it in ALLOWED_PLACEMENTS } ?: return null,
                type = row.optString("type").takeIf { it == "impression" || it == "click" } ?: return null,
                itemId = row.optString("itemId").takeIf(SAFE_ID::matches) ?: return null,
                token = row.optString("token").takeIf(SAFE_TOKEN::matches) ?: return null,
                expiresAt = row.optString("expiresAt").takeIf(String::isNotBlank) ?: return null,
                occurredAt = row.optString("occurredAt").takeIf(String::isNotBlank) ?: return null,
            ).also { Instant.parse(it.expiresAt); Instant.parse(it.occurredAt) }
        }.getOrNull()

        private val SAFE_EVENT_ID = Regex("^[A-Za-z0-9_-]{16,128}$")
        private val SAFE_ID = Regex("^[A-Za-z0-9_:-]{1,128}$")
        private val SAFE_TOKEN = Regex("^[A-Za-z0-9_.~-]{8,4096}$")
        private val ALLOWED_PLACEMENTS = setOf("mart", "search", "feed")
    }
}

/** Persistence boundary keyed by the authenticated account, never by its rotating bearer token. */
interface ProductAdEventStore {
    fun read(accountId: String): List<PendingProductAdEvent>
    fun write(accountId: String, events: List<PendingProductAdEvent>)
}

internal class InMemoryProductAdEventStore : ProductAdEventStore {
    private val eventsByAccount = mutableMapOf<String, List<PendingProductAdEvent>>()

    @Synchronized
    override fun read(accountId: String): List<PendingProductAdEvent> = eventsByAccount[accountId].orEmpty().toList()

    @Synchronized
    override fun write(accountId: String, events: List<PendingProductAdEvent>) {
        if (events.isEmpty()) eventsByAccount.remove(accountId)
        else eventsByAccount[accountId] = events.takeLast(ProductAdsRepository.MAXIMUM_PENDING_EVENTS)
    }
}

/** Encrypted SharedPreferences queue; signed impression tokens are bearer-like and must not be stored in clear text. */
internal class EncryptedProductAdEventStore(context: Context) : ProductAdEventStore {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    override fun read(accountId: String): List<PendingProductAdEvent> {
        val key = storageKey(accountId)
        val encoded = preferences.getString(key, null) ?: return emptyList()
        return runCatching {
            val packed = Base64.decode(encoded, Base64.NO_WRAP)
            require(packed.size > IV_LENGTH_BYTES)
            val iv = packed.copyOfRange(0, IV_LENGTH_BYTES)
            val ciphertext = packed.copyOfRange(IV_LENGTH_BYTES, packed.size)
            val cipher = Cipher.getInstance(TRANSFORMATION).apply {
                init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(TAG_LENGTH_BITS, iv))
            }
            val rows = JSONArray(String(cipher.doFinal(ciphertext), Charsets.UTF_8))
            buildList {
                for (index in 0 until rows.length()) {
                    rows.optJSONObject(index)?.let(PendingProductAdEvent::fromStorageJson)?.let(::add)
                }
            }.takeLast(ProductAdsRepository.MAXIMUM_PENDING_EVENTS)
        }.getOrElse {
            preferences.edit().remove(key).commit()
            emptyList()
        }
    }

    @Synchronized
    override fun write(accountId: String, events: List<PendingProductAdEvent>) {
        val key = storageKey(accountId)
        val bounded = events.asSequence()
            .filter { PendingProductAdEvent.fromStorageJson(it.storageJson()) != null }
            .toList()
            .takeLast(ProductAdsRepository.MAXIMUM_PENDING_EVENTS)
        val editor = preferences.edit()
        if (bounded.isEmpty()) {
            check(editor.remove(key).commit()) { "Could not clear the product-ad event queue." }
            return
        }
        val plaintext = JSONArray().apply { bounded.forEach { put(it.storageJson()) } }.toString().toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, secretKey()) }
        val encoded = Base64.encodeToString(cipher.iv + cipher.doFinal(plaintext), Base64.NO_WRAP)
        check(editor.putString(key, encoded).commit()) { "Could not persist the encrypted product-ad event queue." }
    }

    private fun storageKey(accountId: String): String {
        require(accountId.isNotBlank())
        val digest = MessageDigest.getInstance("SHA-256").digest(accountId.toByteArray(Charsets.UTF_8))
        return QUEUE_KEY_PREFIX + digest.joinToString("") { "%02x".format(it) }
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

    companion object {
        private const val PREFERENCES_NAME = "nantty.productAdEvents.v1"
        private const val QUEUE_KEY_PREFIX = "account."
        private const val KEY_ALIAS = "com.nantty.android.product-ad-events.v1"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_LENGTH_BYTES = 12
        private const val TAG_LENGTH_BITS = 128
    }
}
