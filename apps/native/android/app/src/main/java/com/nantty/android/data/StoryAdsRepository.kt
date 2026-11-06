package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

data class StoryAdMedia(
    val kind: String,
    val url: String,
    val posterUrl: String?,
    val width: Int?,
    val height: Int?,
    val durationSeconds: Int?,
)

data class StoryAdDestination(val type: String, val targetId: String?, val url: String?)

data class StoryAdIdentity(val name: String, val handle: String, val avatarUrl: String?)

data class StoryDecidedAd(
    val adId: String,
    val impressionToken: String,
    val expiresAt: String,
    val placement: String,
    val slotKind: String,
    val format: String,
    val label: String,
    val skipAfterSeconds: Int?,
    val media: List<StoryAdMedia>,
    val headline: String,
    val primaryText: String,
    val callToAction: String,
    val destination: StoryAdDestination,
    val identity: StoryAdIdentity,
)

sealed interface StoryAdDecisionResult {
    data class Success(val ad: StoryDecidedAd?, val declinedReason: String?) : StoryAdDecisionResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StoryAdDecisionResult
}

fun interface StoryAdsTransport {
    fun post(path: String, accessToken: String, body: JSONObject): JSONObject
}

/** Story placement contract shared with the React Native ad decision and event services. */
class StoryAdsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: StoryAdsTransport = JdkStoryAdsTransport(baseUrl),
) {
    fun decideStoryAd(
        contentId: String,
        sessionId: String,
        slotsSinceLastAd: Int,
        neighbourContentIds: List<String>,
        slotIndex: Int,
    ): StoryAdDecisionResult {
        if (!SAFE_ID.matches(contentId) || !SAFE_SESSION_ID.matches(sessionId) ||
            slotsSinceLastAd < 0 || slotIndex < 0 || neighbourContentIds.size > MAX_NEIGHBOURS ||
            neighbourContentIds.any { !SAFE_ID.matches(it) }
        ) return StoryAdDecisionResult.Failure("This story ad request is invalid.")

        val body = JSONObject()
            .put("slot", JSONObject()
                .put("kind", STORY_SLOT_KIND)
                .put("contentId", contentId)
                .put("neighbourContentIds", JSONArray(neighbourContentIds))
                .put("slotsSinceLastAd", slotsSinceLastAd)
                .put("slotIndex", slotIndex))
            .put("sessionId", sessionId)

        return try {
            authenticatedRequest(DECIDE_PATH, body, ::parseDecision)
        } catch (error: StoryAdsHttpException) {
            StoryAdDecisionResult.Failure(
                message = storyAdsErrorMessage(error.statusCode),
                authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN,
            )
        } catch (error: Exception) {
            StoryAdDecisionResult.Failure(error.message ?: "Could not load a story ad. Try again.")
        }
    }

    fun recordImpression(ad: StoryDecidedAd): Result<Unit> = recordEvent(ad, EVENT_IMPRESSION)

    fun recordClick(ad: StoryDecidedAd): Result<Unit> = recordEvent(ad, EVENT_CLICK)

    private fun recordEvent(ad: StoryDecidedAd, type: String): Result<Unit> = runCatching {
        require(SAFE_ID.matches(ad.adId) && SAFE_TOKEN.matches(ad.impressionToken)) {
            "This story ad event is invalid."
        }
        val body = JSONObject().put("events", JSONArray().put(
            JSONObject()
                .put("campaignId", ad.adId)
                .put("placement", STORIES_PLACEMENT)
                .put("type", type)
                .put("itemId", ad.adId)
                .put("token", ad.impressionToken),
        ))
        authenticatedRequest(EVENTS_PATH, body) { Unit }
    }

    private fun <T> authenticatedRequest(path: String, body: JSONObject, parse: (JSONObject) -> T): T {
        val initial = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw StoryAdsHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
        return try {
            parse(transport.post(path, initial, body))
        } catch (error: StoryAdsHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw StoryAdsHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
            parse(transport.post(path, refreshed, body))
        }
    }

    private fun parseDecision(payload: JSONObject): StoryAdDecisionResult.Success {
        val row = payload.optJSONObject("data") ?: payload
        val ad = row.optJSONObject("ad")?.let(::parseAd)
        return StoryAdDecisionResult.Success(ad, row.optNullableStoryString("declinedReason"))
    }

    private fun parseAd(row: JSONObject): StoryDecidedAd {
        val creative = row.optJSONObject("creative") ?: error("Nantty returned an incomplete story ad.")
        val rawMedia = creative.optJSONArray("media") ?: error("Nantty returned no story ad media.")
        require(rawMedia.length() in 1..MAX_MEDIA_ITEMS) { "Nantty returned invalid story ad media." }
        val media = buildList {
            for (index in 0 until rawMedia.length()) {
                val item = rawMedia.optJSONObject(index) ?: error("Nantty returned invalid story ad media.")
                val kind = item.optString("kind").takeIf { it in MEDIA_KINDS }
                    ?: error("Nantty returned an unsupported story ad media type.")
                val url = item.optString("url").takeIf(::isTrustedHttpsUrl)
                    ?: error("Nantty returned an untrusted story ad media URL.")
                val posterUrl = item.optNullableStoryString("posterUrl")?.also {
                    require(isTrustedHttpsUrl(it)) { "Nantty returned an untrusted story ad poster URL." }
                }
                add(StoryAdMedia(kind, url, posterUrl, item.optNullablePositiveInt("width"),
                    item.optNullablePositiveInt("height"), item.optNullableNonNegativeInt("durationSeconds")))
            }
        }
        val destinationRow = creative.optJSONObject("destination") ?: error("Nantty returned no story ad destination.")
        val destinationType = destinationRow.optString("type").takeIf { it in DESTINATION_TYPES }
            ?: error("Nantty returned an unsupported story ad destination.")
        val targetId = destinationRow.optNullableStoryString("targetId")?.also {
            require(SAFE_ID.matches(it)) { "Nantty returned an invalid story ad destination ID." }
        }
        val destinationUrl = destinationRow.optNullableStoryString("url")?.also {
            require(isTrustedHttpsUrl(it)) { "Nantty returned an untrusted story ad destination URL." }
        }
        if (destinationType == "url") require(destinationUrl != null) { "Nantty returned no story ad destination URL." }
        val identityRow = creative.optJSONObject("identity") ?: error("Nantty returned no story ad identity.")
        val avatarUrl = identityRow.optNullableStoryString("avatarUrl")?.also {
            require(isTrustedHttpsUrl(it)) { "Nantty returned an untrusted story ad identity URL." }
        }
        val label = row.optString("label").takeIf { it in AD_LABELS }
            ?: error("Nantty returned an invalid story ad label.")
        val adId = row.optString("adId").takeIf { SAFE_ID.matches(it) }
            ?: error("Nantty returned an invalid story ad ID.")
        val token = row.optString("impressionToken").takeIf { SAFE_TOKEN.matches(it) }
            ?: error("Nantty returned an invalid story ad impression token.")
        val expiresAt = row.optString("expiresAt").takeIf(String::isNotBlank)
            ?: error("Nantty returned no story ad expiry.")
        require(row.optString("placement") == STORIES_PLACEMENT && row.optString("slotKind") == STORY_SLOT_KIND) {
            "Nantty returned a story ad for a different placement."
        }
        val format = row.optString("format").takeIf(String::isNotBlank)
            ?: error("Nantty returned no story ad format.")
        val skipAfter = row.optNullableNonNegativeInt("skipAfterSeconds")
        val identity = StoryAdIdentity(
            name = identityRow.optString("name").ifBlank { "Nantty advertiser" },
            handle = identityRow.optString("handle").trim().removePrefix("@").takeIf(String::isNotBlank)
                ?: error("Nantty returned an invalid story ad identity."),
            avatarUrl = avatarUrl,
        )
        return StoryDecidedAd(
            adId, token, expiresAt, STORIES_PLACEMENT, STORY_SLOT_KIND, format, label, skipAfter,
            media, creative.optString("headline"), creative.optString("primaryText"),
            creative.optString("callToAction"), StoryAdDestination(destinationType, targetId, destinationUrl), identity,
        )
    }

    companion object {
        const val DECIDE_PATH = "/api/v1/ads/decide"
        const val EVENTS_PATH = "/api/v1/ads/events"
        const val STORY_SLOT_KIND = "story"
        const val STORIES_PLACEMENT = "stories"
        private const val EVENT_IMPRESSION = "impression"
        private const val EVENT_CLICK = "click"
        private const val MAX_NEIGHBOURS = 10
        private const val MAX_MEDIA_ITEMS = 10
        private val SAFE_ID = Regex("^[A-Za-z0-9_-]{1,128}$")
        private val SAFE_SESSION_ID = Regex("^[A-Za-z0-9_-]{1,128}$")
        private val SAFE_TOKEN = Regex("^[A-Za-z0-9_.~-]{8,4096}$")
        private val MEDIA_KINDS = setOf("image", "video")
        private val AD_LABELS = setOf("Sponsored", "Ad")
        private val DESTINATION_TYPES = setOf("url", "post", "product", "store", "profile", "messages", "app_store")
    }
}

private class JdkStoryAdsTransport(private val baseUrl: String) : StoryAdsTransport {
    override fun post(path: String, accessToken: String, body: JSONObject): JSONObject {
        require(path == StoryAdsRepository.DECIDE_PATH || path == StoryAdsRepository.EVENTS_PATH) {
            "Unsupported story ads endpoint."
        }
        require(accessToken.isNotBlank()) { "Sign in to use story ads." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use story ads.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readStoryAdsResponse).orEmpty()
            if (status !in 200..299) throw StoryAdsHttpException(status)
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readStoryAdsResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large story ads response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object { const val MAX_RESPONSE_BYTES = 512 * 1024 }
}

private fun isTrustedHttpsUrl(raw: String): Boolean = runCatching {
    val uri = URI(raw.trim())
    uri.isAbsolute && uri.scheme.equals("https", ignoreCase = true) &&
        !uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.fragment == null &&
        uri.toASCIIString().length <= MAX_URL_LENGTH
}.getOrDefault(false)

private fun JSONObject.optNullableStoryString(key: String): String? = opt(key)
    ?.takeUnless { it == JSONObject.NULL }
    ?.toString()
    ?.takeIf(String::isNotBlank)

private fun JSONObject.optNullablePositiveInt(key: String): Int? = opt(key)
    ?.takeUnless { it == JSONObject.NULL }
    ?.let { value -> value.toString().toIntOrNull()?.takeIf { it in 1..MAX_DIMENSION } }

private fun JSONObject.optNullableNonNegativeInt(key: String): Int? = opt(key)
    ?.takeUnless { it == JSONObject.NULL }
    ?.let { value -> value.toString().toIntOrNull()?.takeIf { it >= 0 } }

internal class StoryAdsHttpException(val statusCode: Int) : Exception()

private fun storyAdsErrorMessage(statusCode: Int): String = when (statusCode) {
    HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN -> "Your session has expired. Sign in again."
    429 -> "Too many ad requests. Wait a moment and try again."
    else -> "Could not load a story ad. Try again."
}

private const val MAX_URL_LENGTH = 4_096
private const val MAX_DIMENSION = 16_384
