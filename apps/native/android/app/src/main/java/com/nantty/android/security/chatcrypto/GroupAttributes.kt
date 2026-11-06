package com.nantty.android.security.chatcrypto

import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import kotlin.math.roundToInt

/** Wire-compatible encrypted group metadata from packages/chatCrypto/src/groupAttributes.ts. */
data class ChatGroupAttributes(
    val title: String,
    val description: String? = null,
    val avatar: ChatGroupAvatar? = null,
)

data class ChatGroupAvatar(val mediaId: String, val pointer: ChatGroupAttachmentPointer)

data class ChatGroupAttachmentPointer(
    val key: String,
    val digest: String,
    val sizeBytes: Long,
    val contentType: String,
    val fileName: String? = null,
    val width: Double? = null,
    val height: Double? = null,
    val durationSeconds: Double? = null,
    val pageCount: Double? = null,
    val thumbnail: String? = null,
    val waveform: List<Int>? = null,
)

object GroupAttributes {
    const val MAXIMUM_SEALED_LENGTH = 16_384
    private const val KEY_BYTES = 32
    private const val NONCE_BYTES = 12
    private const val GCM_TAG_BYTES = 16
    private const val VERSION = 1
    private val associatedData = "nantty-group-attributes-v1".toByteArray(StandardCharsets.UTF_8)
    private val thumbnailPattern = Regex("[A-Za-z0-9+/=]*")

    fun createGroupKey(random: (Int) -> ByteArray = ::secureRandomBytes): String {
        val key = random(KEY_BYTES)
        require(key.size == KEY_BYTES) { "Group key must be exactly $KEY_BYTES bytes." }
        return ChatCryptoPrimitives.encodeBase64(key)
    }

    fun sanitize(value: ChatGroupAttributes): ChatGroupAttributes? {
        val title = value.title.trim().take(80).takeIf(String::isNotEmpty) ?: return null
        val description = value.description?.trim()?.takeIf(String::isNotEmpty)?.take(500)
        val avatar = value.avatar?.let(::sanitizeAvatar)
        return ChatGroupAttributes(title, description, avatar)
    }

    fun seal(
        attributes: ChatGroupAttributes,
        groupKey: String,
        random: (Int) -> ByteArray = ::secureRandomBytes,
    ): String {
        val clean = sanitize(attributes) ?: throw IllegalArgumentException("A group needs a name.")
        val key = ChatCryptoPrimitives.decodeBase64(groupKey)
        require(key.size == KEY_BYTES) { "Group key must be exactly $KEY_BYTES bytes." }
        val nonce = random(NONCE_BYTES)
        require(nonce.size == NONCE_BYTES) { "Group attribute nonce must be exactly $NONCE_BYTES bytes." }
        val plaintext = clean.toWireJson().toByteArray(StandardCharsets.UTF_8)
        val ciphertext = ChatCryptoPrimitives.aes256GcmSeal(key, nonce, plaintext, associatedData)
        val sealed = ChatCryptoPrimitives.encodeBase64(nonce + ciphertext)
        require(sealed.length <= MAXIMUM_SEALED_LENGTH) { "The group details are too large." }
        return sealed
    }

    fun open(sealed: String?, groupKeys: List<String>): ChatGroupAttributes? {
        if (sealed.isNullOrBlank() || sealed.length > MAXIMUM_SEALED_LENGTH) return null
        val bytes = runCatching { ChatCryptoPrimitives.decodeBase64(sealed) }.getOrNull() ?: return null
        if (bytes.size < NONCE_BYTES + GCM_TAG_BYTES) return null
        val nonce = bytes.copyOfRange(0, NONCE_BYTES)
        val ciphertext = bytes.copyOfRange(NONCE_BYTES, bytes.size)
        for (encodedKey in groupKeys) {
            val key = runCatching { ChatCryptoPrimitives.decodeBase64(encodedKey) }.getOrNull()
                ?.takeIf { it.size == KEY_BYTES } ?: continue
            val plaintext = runCatching {
                ChatCryptoPrimitives.aes256GcmOpen(key, nonce, ciphertext, associatedData)
                    .let { String(it, StandardCharsets.UTF_8) }
            }.getOrNull() ?: continue
            val candidate = runCatching { JSONObject(plaintext).toAttributes() }.getOrNull() ?: continue
            return candidate
        }
        return null
    }

    private fun sanitizeAvatar(value: ChatGroupAvatar): ChatGroupAvatar? {
        val mediaId = value.mediaId.take(64)
        val pointer = sanitizePointer(value.pointer) ?: return null
        return ChatGroupAvatar(mediaId, pointer)
    }

    private fun sanitizePointer(value: ChatGroupAttachmentPointer): ChatGroupAttachmentPointer? {
        if (value.key.length != 44 || value.digest.length != 44 || value.sizeBytes < 0L) return null
        val waveform = value.waveform?.takeIf { it.isNotEmpty() && it.size <= 256 }
            ?.map { it.coerceIn(0, 255) }
        return value.copy(
            contentType = value.contentType.take(120),
            fileName = value.fileName?.take(300),
            width = value.width?.takeIf { it.isFinite() && it >= 0 },
            height = value.height?.takeIf { it.isFinite() && it >= 0 },
            durationSeconds = value.durationSeconds?.takeIf { it.isFinite() && it >= 0 },
            pageCount = value.pageCount?.takeIf { it.isFinite() && it >= 0 },
            thumbnail = value.thumbnail?.takeIf { it.length <= 6_000 && thumbnailPattern.matches(it) },
            waveform = waveform,
        )
    }

    private fun ChatGroupAttributes.toWireJson(): String = buildString {
        append("{\"v\":$VERSION,\"title\":${JSONObject.quote(title)},\"description\":")
        append(description?.let(JSONObject::quote) ?: "null")
        append(",\"avatar\":")
        append(avatar?.toWireJson() ?: "null")
        append('}')
    }

    private fun ChatGroupAvatar.toWireJson(): String =
        "{\"mediaId\":${JSONObject.quote(mediaId)},\"pointer\":${pointer.toWireJson()}}"

    private fun ChatGroupAttachmentPointer.toWireJson(): String = buildString {
        append("{\"key\":${JSONObject.quote(key)},\"digest\":${JSONObject.quote(digest)},\"sizeBytes\":$sizeBytes")
        append(",\"contentType\":${JSONObject.quote(contentType)}")
        append(",\"fileName\":${fileName?.let(JSONObject::quote) ?: "null"}")
        append(",\"width\":${width.jsonNumber()},\"height\":${height.jsonNumber()}")
        append(",\"durationSeconds\":${durationSeconds.jsonNumber()},\"pageCount\":${pageCount.jsonNumber()}")
        append(",\"thumbnail\":${thumbnail?.let(JSONObject::quote) ?: "null"}")
        waveform?.let { values -> append(",\"waveform\":[${values.joinToString(",")}]" ) }
        append('}')
    }

    private fun JSONObject.toAttributes(): ChatGroupAttributes? {
        if (optInt("v", -1) != VERSION) return null
        val title = opt("title") as? String ?: return null
        val description = opt("description") as? String
        val rawAvatar = opt("avatar") as? JSONObject
        val avatar = rawAvatar?.let { value ->
            val mediaId = value.opt("mediaId") as? String
            val pointer = value.optJSONObject("pointer")?.toPointer()
            if (mediaId == null || pointer == null) null else ChatGroupAvatar(mediaId, pointer)
        }
        return sanitize(ChatGroupAttributes(title, description, avatar))
    }

    private fun JSONObject.toPointer(): ChatGroupAttachmentPointer? {
        val key = opt("key") as? String ?: return null
        val digest = opt("digest") as? String ?: return null
        val rawSize = opt("sizeBytes") as? Number ?: return null
        val size = rawSize.toLong()
        if (size < 0 || rawSize.toDouble() != size.toDouble()) return null
        val contentType = opt("contentType") as? String ?: return null
        val rawWaveform = optJSONArray("waveform")
        val waveform = rawWaveform?.let { values ->
            if (values.length() !in 1..256) null
            else buildList {
                for (index in 0 until values.length()) {
                    val peak = values.opt(index) as? Number ?: return@buildList
                    if (!peak.toDouble().isFinite()) return@buildList
                    add(peak.toDouble().roundToInt().coerceIn(0, 255))
                }
            }.takeIf { it.size == values.length() }
        }
        return sanitizePointer(
            ChatGroupAttachmentPointer(
                key = key,
                digest = digest,
                sizeBytes = size,
                contentType = contentType,
                fileName = opt("fileName") as? String,
                width = (opt("width") as? Number)?.toDouble(),
                height = (opt("height") as? Number)?.toDouble(),
                durationSeconds = (opt("durationSeconds") as? Number)?.toDouble(),
                pageCount = (opt("pageCount") as? Number)?.toDouble(),
                thumbnail = opt("thumbnail") as? String,
                waveform = waveform,
            ),
        )
    }

    private fun Double?.jsonNumber(): String = this?.takeIf { it.isFinite() && it >= 0 }?.toString() ?: "null"
    private fun secureRandomBytes(size: Int): ByteArray = ByteArray(size).also(SecureRandom()::nextBytes)
}
