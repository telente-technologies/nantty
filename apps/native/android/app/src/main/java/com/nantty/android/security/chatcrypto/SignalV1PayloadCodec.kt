package com.nantty.android.security.chatcrypto

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import kotlin.math.roundToInt

internal data class SignalV1LinkPreview(
    val url: String,
    val domain: String,
    val title: String,
    val description: String? = null,
    val imageUrl: String? = null,
    val siteName: String? = null,
    val imageMediaId: String? = null,
)

internal data class SignalV1SharedContent(val kind: String, val id: String)

internal data class SignalV1Attachment(
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

internal data class SignalV1Location(val latitude: Double, val longitude: Double, val label: String?, val liveUntil: String? = null)
internal data class SignalV1PollOption(val id: String, val text: String)
internal data class SignalV1Poll(val question: String, val allowMultipleAnswers: Boolean, val options: List<SignalV1PollOption>)

internal sealed interface SignalV1Control {
    data class Reaction(val targetMessageId: String, val emoji: String, val remove: Boolean) : SignalV1Control
    data class PollVote(val targetMessageId: String, val optionIds: List<String>) : SignalV1Control
    data class LocationUpdate(val targetMessageId: String, val latitude: Double, val longitude: Double, val label: String?) : SignalV1Control
    data class LocationStop(val targetMessageId: String) : SignalV1Control
    data object GroupUpdate : SignalV1Control
}

internal data class SignalV1Payload(
    val text: String,
    val sentAt: String,
    val conversationId: String? = null,
    val storyId: String? = null,
    val linkPreviewKey: String? = null,
    val linkPreview: SignalV1LinkPreview? = null,
    val sharedContent: SignalV1SharedContent? = null,
    val attachment: SignalV1Attachment? = null,
    val location: SignalV1Location? = null,
    val poll: SignalV1Poll? = null,
    val control: SignalV1Control? = null,
    val groupKey: String? = null,
)

/** Inner JSON payload wire codec only; no message encryption/decryption is performed here. */
internal object SignalV1PayloadCodec {
    const val MAXIMUM_TEXT_LENGTH = 4_000
    private const val MAXIMUM_LINK_PREVIEW_URL_LENGTH = 2_048
    private const val MAXIMUM_THUMBNAIL_LENGTH = 6_000
    private const val MAXIMUM_WAVEFORM_VALUES = 256
    private const val MAXIMUM_POLL_OPTIONS = 6

    fun encode(payload: SignalV1Payload): ByteArray {
        val json = JSONObject()
            .put("v", 1)
            .put("text", payload.text.take(MAXIMUM_TEXT_LENGTH))
            .put("sentAt", payload.sentAt)
        payload.conversationId?.let { json.put("conversationId", it) }
        payload.storyId?.let { json.put("storyId", it) }
        payload.linkPreviewKey?.let { json.put("linkPreviewKey", it) }
        json.put("linkPreview", payload.linkPreview?.toJson() ?: JSONObject.NULL)
        payload.sharedContent?.let { json.put("sharedContent", JSONObject().put("kind", it.kind).put("id", it.id)) }
        payload.attachment?.let { json.put("attachment", it.toJson()) }
        payload.location?.let { json.put("location", it.toJson()) }
        payload.poll?.let { json.put("poll", it.toJson()) }
        payload.control?.let { json.put("control", it.toJson()) }
        payload.groupKey?.let { json.put("groupKey", it) }
        return json.toString().toByteArray(Charsets.UTF_8)
    }

    fun decode(bytes: ByteArray): SignalV1Payload {
        try {
            val root = JSONObject(bytes.toString(Charsets.UTF_8))
            require(root.strictInteger("v") == 1) { "Malformed signal-v1 payload" }
            val text = root.strictString("text")
            val sentAt = root.strictString("sentAt")
            val shared = root.objectOrNull("sharedContent")?.let { value ->
                val kind = value.opt("kind") as? String
                val id = value.opt("id") as? String
                if (kind != null && id != null) SignalV1SharedContent(kind, id) else null
            }
            return SignalV1Payload(
                text = text.take(MAXIMUM_TEXT_LENGTH),
                sentAt = sentAt,
                conversationId = root.opt("conversationId") as? String,
                storyId = root.opt("storyId") as? String,
                linkPreviewKey = (root.opt("linkPreviewKey") as? String)?.takeIf { it.length == 44 },
                linkPreview = sanitizeLinkPreview(root.opt("linkPreview")),
                sharedContent = shared,
                attachment = sanitizeAttachment(root.opt("attachment")),
                location = sanitizeLocation(root.opt("location")),
                poll = sanitizePoll(root.opt("poll")),
                control = sanitizeControl(root.opt("control")),
                groupKey = (root.opt("groupKey") as? String)?.takeIf { it.length == 44 },
            )
        } catch (error: Exception) {
            if (error is IllegalArgumentException) throw error
            throw IllegalArgumentException("Malformed signal-v1 payload", error)
        }
    }

    private fun sanitizeLinkPreview(value: Any?): SignalV1LinkPreview? {
        val candidate = value.asObject() ?: return null
        val url = candidate.opt("url") as? String ?: return null
        val title = candidate.opt("title") as? String ?: return null
        val domain = candidate.opt("domain") as? String ?: return null
        if (!url.startsWithHttp() || !candidate.optionalString("description") || !candidate.optionalString("imageUrl") ||
            !candidate.optionalString("siteName") || !candidate.optionalString("imageMediaId")
        ) return null
        return SignalV1LinkPreview(
            url = url.take(MAXIMUM_LINK_PREVIEW_URL_LENGTH),
            domain = domain.take(255),
            title = title.take(300),
            description = (candidate.opt("description") as? String)?.take(500),
            imageUrl = (candidate.opt("imageUrl") as? String)?.takeIf { it.startsHttps() },
            siteName = (candidate.opt("siteName") as? String)?.take(120),
            imageMediaId = (candidate.opt("imageMediaId") as? String)?.take(64),
        )
    }

    private fun sanitizeAttachment(value: Any?): SignalV1Attachment? {
        val candidate = value.asObject() ?: return null
        val key = candidate.opt("key") as? String ?: return null
        val digest = candidate.opt("digest") as? String ?: return null
        val size = candidate.opt("sizeBytes").finiteLongOrNull() ?: return null
        val contentType = candidate.opt("contentType") as? String ?: return null
        if (key.length != 44 || digest.length != 44 || size < 0) return null
        val thumbnail = (candidate.opt("thumbnail") as? String)?.takeIf {
            it.length <= MAXIMUM_THUMBNAIL_LENGTH && it.matches(Regex("[A-Za-z0-9+/=]*"))
        }
        val waveform = sanitizeWaveform(candidate.opt("waveform").asArray())
        return SignalV1Attachment(
            key, digest, size, contentType.take(120),
            fileName = (candidate.opt("fileName") as? String)?.take(300),
            width = candidate.opt("width").nonNegativeFinite(),
            height = candidate.opt("height").nonNegativeFinite(),
            durationSeconds = candidate.opt("durationSeconds").nonNegativeFinite(),
            pageCount = candidate.opt("pageCount").nonNegativeFinite(),
            thumbnail = thumbnail,
            waveform = waveform,
        )
    }

    private fun sanitizeLocation(value: Any?): SignalV1Location? {
        val candidate = value.asObject() ?: return null
        val latitude = candidate.opt("latitude").finiteDouble()?.takeIf { it in -90.0..90.0 } ?: return null
        val longitude = candidate.opt("longitude").finiteDouble()?.takeIf { it in -180.0..180.0 } ?: return null
        val label = (candidate.opt("label") as? String)?.trim()?.takeIf(String::isNotEmpty)?.take(200)
        val liveUntil = (candidate.opt("liveUntil") as? String)?.takeIf { it.isValidTimestamp() }
        return SignalV1Location(latitude, longitude, label, liveUntil)
    }

    private fun sanitizePoll(value: Any?): SignalV1Poll? {
        val candidate = value.asObject() ?: return null
        val question = (candidate.opt("question") as? String)?.trim()?.takeIf(String::isNotEmpty) ?: return null
        val rawOptions = candidate.opt("options").asArray() ?: return null
        if (rawOptions.length() !in 2..MAXIMUM_POLL_OPTIONS) return null
        val ids = mutableSetOf<String>()
        val texts = mutableSetOf<String>()
        val options = mutableListOf<SignalV1PollOption>()
        for (index in 0 until rawOptions.length()) {
            val option = rawOptions.opt(index).asObject() ?: return null
            val id = option.opt("id") as? String ?: return null
            val text = (option.opt("text") as? String)?.trim()?.takeIf(String::isNotEmpty) ?: return null
            val normalized = text.take(100)
            if (id.isEmpty() || id.length > 100 || !ids.add(id) || !texts.add(normalized.lowercase())) return null
            options.add(SignalV1PollOption(id, normalized))
        }
        return SignalV1Poll(question.take(300), candidate.opt("allowMultipleAnswers") == true, options)
    }

    private fun sanitizeControl(value: Any?): SignalV1Control? {
        val candidate = value.asObject() ?: return null
        if (candidate.opt("type") == "groupUpdate") return SignalV1Control.GroupUpdate
        val target = candidate.opt("targetMessageId") as? String ?: return null
        if (target.isEmpty() || target.length > 100) return null
        return when (candidate.opt("type")) {
            "reaction" -> (candidate.opt("emoji") as? String)?.takeIf { it.isNotEmpty() && it.length <= 32 }
                ?.let { SignalV1Control.Reaction(target, it, candidate.opt("remove") == true) }
            "pollVote" -> {
                val ids = candidate.opt("optionIds").asArray() ?: return null
                if (ids.length() > MAXIMUM_POLL_OPTIONS) return null
                val values = mutableListOf<String>()
                for (index in 0 until ids.length()) {
                    val id = ids.opt(index) as? String ?: return null
                    if (id.isEmpty() || id.length > 100) return null
                    if (id !in values) values.add(id)
                }
                SignalV1Control.PollVote(target, values)
            }
            "locationUpdate" -> {
                val lat = candidate.opt("latitude").finiteDouble()?.takeIf { it in -90.0..90.0 } ?: return null
                val lon = candidate.opt("longitude").finiteDouble()?.takeIf { it in -180.0..180.0 } ?: return null
                val label = (candidate.opt("label") as? String)?.trim()?.takeIf(String::isNotEmpty)?.take(200)
                SignalV1Control.LocationUpdate(target, lat, lon, label)
            }
            "locationStop" -> SignalV1Control.LocationStop(target)
            else -> null
        }
    }

    private fun sanitizeWaveform(array: JSONArray?): List<Int>? {
        if (array == null || array.length() !in 1..MAXIMUM_WAVEFORM_VALUES) return null
        val values = mutableListOf<Int>()
        for (index in 0 until array.length()) {
            val peak = array.opt(index).finiteDouble() ?: return null
            values.add(peak.roundToInt().coerceIn(0, 255))
        }
        return values
    }

    private fun SignalV1LinkPreview.toJson() = JSONObject()
        .put("url", url).put("domain", domain).put("title", title)
        .put("description", description.jsonValue()).put("imageUrl", imageUrl.jsonValue())
        .put("siteName", siteName.jsonValue()).put("imageMediaId", imageMediaId.jsonValue())

    private fun SignalV1Attachment.toJson(): JSONObject {
        val result = JSONObject().put("key", key).put("digest", digest).put("sizeBytes", sizeBytes).put("contentType", contentType)
        result.put("fileName", fileName.jsonValue()).put("width", width.jsonValue()).put("height", height.jsonValue())
            .put("durationSeconds", durationSeconds.jsonValue()).put("pageCount", pageCount.jsonValue())
            .put("thumbnail", thumbnail.jsonValue())
        waveform?.let { result.put("waveform", JSONArray(it)) }
        return result
    }

    private fun SignalV1Location.toJson() = JSONObject()
        .put("latitude", latitude).put("longitude", longitude).put("label", label.jsonValue())
        .also { if (liveUntil != null) it.put("liveUntil", liveUntil) }

    private fun SignalV1Poll.toJson() = JSONObject()
        .put("question", question).put("allowMultipleAnswers", allowMultipleAnswers)
        .put("options", JSONArray(options.map { JSONObject().put("id", it.id).put("text", it.text) }))

    private fun SignalV1Control.toJson(): JSONObject = when (this) {
        is SignalV1Control.Reaction -> JSONObject().put("type", "reaction").put("targetMessageId", targetMessageId).put("emoji", emoji).put("remove", remove)
        is SignalV1Control.PollVote -> JSONObject().put("type", "pollVote").put("targetMessageId", targetMessageId).put("optionIds", JSONArray(optionIds))
        is SignalV1Control.LocationUpdate -> JSONObject().put("type", "locationUpdate").put("targetMessageId", targetMessageId).put("latitude", latitude).put("longitude", longitude).put("label", label.jsonValue())
        is SignalV1Control.LocationStop -> JSONObject().put("type", "locationStop").put("targetMessageId", targetMessageId)
        SignalV1Control.GroupUpdate -> JSONObject().put("type", "groupUpdate")
    }

    private fun Any?.asObject(): JSONObject? = this as? JSONObject
    private fun Any?.asArray(): JSONArray? = this as? JSONArray
    private fun Any?.finiteDouble(): Double? = (this as? Number)?.toDouble()?.takeIf(Double::isFinite)
    private fun Any?.nonNegativeFinite(): Double? = finiteDouble()?.takeIf { it >= 0 }
    private fun JSONObject.optionalString(key: String): Boolean = opt(key) == null || opt(key) === JSONObject.NULL || opt(key) is String
    private fun JSONObject.strictString(key: String): String = opt(key) as? String ?: error("Malformed signal-v1 payload")
    private fun JSONObject.strictInteger(key: String): Int? = (opt(key) as? Number)?.toDouble()
        ?.takeIf { it.isFinite() && it % 1.0 == 0.0 && it <= Int.MAX_VALUE && it >= Int.MIN_VALUE }
        ?.toInt()
    private fun JSONObject.objectOrNull(key: String): JSONObject? = opt(key).asObject()
    private fun String.startsWithHttp(): Boolean = startsWith("http://", ignoreCase = true) || startsWith("https://", ignoreCase = true)
    private fun String.startsHttps(): Boolean = startsWith("https://", ignoreCase = true)
    private fun String.isValidTimestamp(): Boolean = try {
        Instant.parse(this)
        true
    } catch (_: DateTimeParseException) {
        try {
            OffsetDateTime.parse(this)
            true
        } catch (_: DateTimeParseException) {
            try {
                LocalDateTime.parse(this)
                true
            } catch (_: DateTimeParseException) {
                try { LocalDate.parse(this); true } catch (_: DateTimeParseException) { false }
            }
        }
    }
    private fun Any?.jsonValue(): Any = this ?: JSONObject.NULL
    private fun Any?.finiteLongOrNull(): Long? = finiteDouble()?.takeIf { it % 1.0 == 0.0 && it <= Long.MAX_VALUE.toDouble() }?.toLong()
}
