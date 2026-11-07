package com.nantty.android.security.chatcrypto

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import org.json.JSONTokener
import java.util.Base64

/** JSON-shaped protocol records persisted through the encrypted RN-compatible key/value stores. */
data class ProtocolPreKeyCounters(
    val nextOneTimePreKeyId: Int,
    val currentSignedPreKeyId: Int,
    val previousSignedPreKeyIds: List<Int>,
)

data class ProtocolSessionRecord(
    /** Ratchet state is kept as a JSON object until the Android ratchet implementation is interoperable. */
    val current: Map<String, Any?>?,
    val archived: List<Map<String, Any?>>,
    /** RN's bounded replay guard for initial X3DH/prekey messages. */
    val seenBaseKeys: List<String> = emptyList(),
)

data class ProtocolCachedPlaintext(
    val payload: Map<String, Any?>?,
    val failure: String?,
    /** ISO-8601 timestamp, matching the React Native record contract. */
    val expiresAt: String? = null,
)

data class ProtocolStoredGroupKey(val key: String, val at: String)

/**
 * Android counterpart of packages/chatCrypto/src/protocolStore.ts.
 * Key names and namespaces intentionally match the RN implementation exactly.
 */
class ProtocolStore(private val storage: ChatCryptoStorage) {
    fun loadIdentity(): Map<String, Any?>? = readObject(storage.secrets, IDENTITY_KEY)
    fun saveIdentity(identity: Map<String, Any?>) = write(storage.secrets, IDENTITY_KEY, identity)

    fun loadCounters(): ProtocolPreKeyCounters? = read(storage.records, COUNTERS_KEY) { value ->
        val objectValue = value.asObject()
        ProtocolPreKeyCounters(
            nextOneTimePreKeyId = objectValue.requiredInt("nextOneTimePreKeyId"),
            currentSignedPreKeyId = objectValue.requiredInt("currentSignedPreKeyId"),
            previousSignedPreKeyIds = objectValue.requiredArray("previousSignedPreKeyIds").map { it.asInt() },
        )
    }

    fun saveCounters(counters: ProtocolPreKeyCounters) = write(storage.records, COUNTERS_KEY, mapOf(
        "nextOneTimePreKeyId" to counters.nextOneTimePreKeyId,
        "currentSignedPreKeyId" to counters.currentSignedPreKeyId,
        "previousSignedPreKeyIds" to counters.previousSignedPreKeyIds,
    ))

    fun loadSignedPreKey(keyId: Int): Map<String, Any?>? = readObject(storage.secrets, "spk:$keyId")
    fun saveSignedPreKey(key: Map<String, Any?>) = write(storage.secrets, "spk:${key.requiredInt("keyId")}", key)
    fun removeSignedPreKey(keyId: Int) = storage.secrets.delete("spk:$keyId")

    fun loadOneTimePreKey(keyId: Int): Map<String, Any?>? = readObject(storage.records, "opk:$keyId")
    fun saveOneTimePreKey(key: Map<String, Any?>) = write(storage.records, "opk:${key.requiredInt("keyId")}", key)
    fun removeOneTimePreKey(keyId: Int) = storage.records.delete("opk:$keyId")

    fun loadSession(userId: String, deviceId: String): ProtocolSessionRecord =
        read(storage.records, "session:${address(userId, deviceId)}") { value ->
            val objectValue = value.asObject()
            ProtocolSessionRecord(
                current = objectValue.optionalObject("current"),
                archived = objectValue.requiredArray("archived").map { it.asObject() },
                seenBaseKeys = objectValue.optionalArray("seenBaseKeys")?.map { it.asString() }.orEmpty().also {
                    require(it.size <= MAX_SEEN_BASE_KEYS) { "Too many remembered prekey base keys" }
                    it.forEach { encoded ->
                        require(ChatCryptoPrimitives.decodeBase64(encoded).size == 32) { "Invalid remembered prekey base key" }
                    }
                },
            )
        } ?: ProtocolSessionRecord(current = null, archived = emptyList())

    fun saveSession(userId: String, deviceId: String, record: ProtocolSessionRecord) =
        write(storage.records, sessionKey(userId, deviceId), sessionValue(record))

    /** Commits first-session ratchet state and one-time-prekey consumption as one storage batch. */
    fun saveSessionAndConsumeOneTimePreKey(
        userId: String,
        deviceId: String,
        record: ProtocolSessionRecord,
        preKeyId: Int,
    ) {
        require(preKeyId in 1..MAXIMUM_ONE_TIME_PREKEY_ID) { "One-time prekey id is invalid" }
        storage.records.applyBatch(
            listOf(
                ChatCryptoKeyValueMutation.Set(sessionKey(userId, deviceId), stringify(sessionValue(record))),
                ChatCryptoKeyValueMutation.Delete("opk:$preKeyId"),
            ),
        )
    }

    fun deleteSession(userId: String, deviceId: String) = storage.records.delete("session:${address(userId, deviceId)}")
    fun sessionDeviceIds(userId: String): List<String> {
        val prefix = "session:$userId:"
        return storage.records.keys(prefix).map { it.substring(prefix.length) }
    }

    fun loadOwnSenderKey(conversationId: String): Map<String, Any?>? = readObject(storage.records, "senderKey:own:$conversationId")
    fun saveOwnSenderKey(conversationId: String, key: Map<String, Any?>) = write(storage.records, "senderKey:own:$conversationId", key)
    fun deleteOwnSenderKey(conversationId: String) = storage.records.delete("senderKey:own:$conversationId")

    fun loadPeerSenderKey(conversationId: String, userId: String, deviceId: String): Map<String, Any?>? =
        readObject(storage.records, "senderKey:peer:$conversationId:${address(userId, deviceId)}")

    fun savePeerSenderKey(conversationId: String, userId: String, deviceId: String, record: Map<String, Any?>) =
        write(storage.records, "senderKey:peer:$conversationId:${address(userId, deviceId)}", record)

    fun loadTrust(userId: String): Map<String, Any?>? = read(storage.records, "trust:$userId") { value ->
        val objectValue = value.asObject()
        val devices = objectValue.requiredObject("devices").mapValues { (_, identityKey) -> identityKey.asString() }
        val changedAt = objectValue.optionalString("changedAt")
        val acknowledgedAt = objectValue.optionalString("acknowledgedAt")
        mapOf("devices" to devices, "changedAt" to changedAt, "acknowledgedAt" to acknowledgedAt)
    }

    fun saveTrust(userId: String, record: Map<String, Any?>) = write(storage.records, "trust:$userId", record)

    fun loadGroupKeys(conversationId: String): List<ProtocolStoredGroupKey> =
        read(storage.secrets, "groupKeys:$conversationId") { value ->
            value.asArray().map { entry ->
                val item = entry.asObject()
                ProtocolStoredGroupKey(item.requiredString("key"), item.requiredString("at"))
            }
        } ?: emptyList()

    fun addGroupKey(conversationId: String, entry: ProtocolStoredGroupKey): Boolean {
        val current = loadGroupKeys(conversationId)
        if (current.any { it.key == entry.key }) return false
        val next = (current + entry).sortedByDescending { it.at }.take(MAX_GROUP_KEYS)
        write(storage.secrets, "groupKeys:$conversationId", next.map { mapOf("key" to it.key, "at" to it.at) })
        return true
    }

    fun loadPlaintext(messageId: String): ProtocolCachedPlaintext? = read(storage.records, "plain:$messageId") { value ->
        val objectValue = value.asObject()
        ProtocolCachedPlaintext(
            payload = objectValue.optionalObject("payload"),
            failure = objectValue.optionalString("failure"),
            expiresAt = objectValue.optionalString("expiresAt"),
        )
    }

    fun savePlaintext(messageId: String, cached: ProtocolCachedPlaintext) = write(
        storage.records,
        "plain:$messageId",
        mapOf("payload" to cached.payload, "failure" to cached.failure, "expiresAt" to cached.expiresAt),
    )

    fun deletePlaintext(messageId: String) = storage.records.delete("plain:$messageId")
    fun plaintextMessageIds(): List<String> = storage.records.keys(PLAINTEXT_PREFIX).map { it.substring(PLAINTEXT_PREFIX.length) }

    fun clearEverything() {
        listOf(storage.secrets, storage.records).forEach { store ->
            store.keys("").forEach(store::delete)
        }
    }

    private fun readObject(store: ChatCryptoKeyValueStore, key: String): Map<String, Any?>? = read(store, key) { it.asObject() }

    private fun <T> read(store: ChatCryptoKeyValueStore, key: String, decode: (Any?) -> T): T? {
        val encoded = store.get(key) ?: return null
        return try {
            decode(parse(encoded))
        } catch (error: Exception) {
            throw IllegalStateException("Stored chat protocol record '$key' is malformed", error)
        }
    }

    private fun write(store: ChatCryptoKeyValueStore, key: String, value: Any?) {
        store.set(key, stringify(value))
    }

    private fun parse(text: String): Any? = fromJson(JSONTokenerCompat.parse(text))

    private fun stringify(value: Any?): String = toJson(value).toString()

    companion object {
        private const val IDENTITY_KEY = "identity"
        private const val COUNTERS_KEY = "prekeys:counters"
        private const val PLAINTEXT_PREFIX = "plain:"
        private const val MAX_GROUP_KEYS = 8
        private const val MAX_SEEN_BASE_KEYS = 64
        private const val MAXIMUM_ONE_TIME_PREKEY_ID = 0x7fff_ffff

        private fun address(userId: String, deviceId: String) = "$userId:$deviceId"

        private fun sessionKey(userId: String, deviceId: String) = "session:${address(userId, deviceId)}"

        private fun sessionValue(record: ProtocolSessionRecord) = mapOf(
            "current" to record.current,
            "archived" to record.archived,
            "seenBaseKeys" to record.seenBaseKeys.takeLast(MAX_SEEN_BASE_KEYS),
        )

        private fun toJson(value: Any?): Any = when (value) {
            null -> JSONObject.NULL
            is ByteArray -> JSONObject().put("\$b64", Base64.getEncoder().encodeToString(value))
            is Map<*, *> -> JSONObject().apply {
                value.forEach { (key, item) -> put(requireNotNull(key as? String) { "Protocol record object keys must be strings" }, toJson(item)) }
            }
            is Iterable<*> -> JSONArray().apply { value.forEach { put(toJson(it)) } }
            is Array<*> -> JSONArray().apply { value.forEach { put(toJson(it)) } }
            is String, is Number, is Boolean -> value
            else -> throw IllegalArgumentException("Unsupported protocol record value: ${value::class.java.name}")
        }

        private fun fromJson(value: Any?): Any? = when (value) {
            JSONObject.NULL -> null
            is JSONObject -> {
                if (value.has("\$b64") && value.opt("\$b64") is String) {
                    try {
                        Base64.getDecoder().decode(value.getString("\$b64"))
                    } catch (error: IllegalArgumentException) {
                        throw JSONException("Invalid base64 protocol record field").apply { initCause(error) }
                    }
                } else buildMap { value.keys().forEach { key -> put(key, fromJson(value.get(key))) } }
            }
            is JSONArray -> (0 until value.length()).map { index -> fromJson(value.get(index)) }
            else -> value
        }

        private fun Any?.asObject(): Map<String, Any?> {
            val entries = this as? Map<*, *> ?: throw JSONException("Expected protocol record object")
            if (entries.keys.any { it !is String }) throw JSONException("Protocol record object keys must be strings")
            return entries.entries.associate { (key, value) -> (key as String) to value }
        }

        private fun Any?.asArray(): List<Any?> = (this as? List<*>)?.toList() ?: throw JSONException("Expected protocol record array")
        private fun Any?.asString(): String = this as? String ?: throw JSONException("Expected protocol record string")
        private fun Any?.asInt(): Int {
            val number = this as? Number ?: throw JSONException("Expected protocol record integer")
            return number.toInt().takeIf { it.toDouble() == number.toDouble() }
                ?: throw JSONException("Expected protocol record integer")
        }
        private fun Map<String, Any?>.requiredString(key: String) = (this[key] ?: throw JSONException("Missing $key")).asString()
        private fun Map<String, Any?>.requiredInt(key: String) = (this[key] ?: throw JSONException("Missing $key")).asInt()
        private fun Map<String, Any?>.requiredArray(key: String) = (this[key] ?: throw JSONException("Missing $key")).asArray()
        private fun Map<String, Any?>.optionalArray(key: String) = this[key]?.asArray()
        private fun Map<String, Any?>.requiredObject(key: String) = (this[key] ?: throw JSONException("Missing $key")).asObject()
        private fun Map<String, Any?>.optionalObject(key: String): Map<String, Any?>? = this[key]?.asObject()
        private fun Map<String, Any?>.optionalString(key: String): String? = this[key]?.asString()
    }
}

/** Avoids org.json's permissive trailing-token behavior and rejects empty/malformed records. */
private object JSONTokenerCompat {
    fun parse(text: String): Any? {
        val tokener = JSONTokener(text)
        val value = tokener.nextValue()
        if (tokener.nextClean() != '\u0000') throw JSONException("Trailing data in protocol record")
        return value
    }
}
