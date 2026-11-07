package com.nantty.android.data

import com.nantty.android.BuildConfig
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.time.Instant
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

data class MartProductAd(
    val adId: String,
    val impressionToken: String,
    val expiresAt: String,
    val label: String,
    val headline: String,
    val primaryText: String,
    val callToAction: String,
    val imageUrl: String,
    val advertiserName: String,
    val verifiedBusiness: Boolean,
    val productId: String,
    val placement: String = ProductAdsRepository.MART_PLACEMENT,
    val slotKind: String = ProductAdsRepository.MART_SLOT_KIND,
    val advertiserHandle: String = "",
    val advertiserAvatarUrl: String? = null,
)

sealed interface ProductAdResult {
    data class Success(val ad: MartProductAd?, val declinedReason: String?) : ProductAdResult
    data class Failure(val message: String) : ProductAdResult
}

fun interface ProductAdsTransport {
    fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject
}

/** Client for the existing Go product-ad slot and signed ad-event endpoints. */
class ProductAdsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String? = { null },
    private val accountIdProvider: () -> String? = accessTokenProvider,
    private val transport: ProductAdsTransport = JdkProductAdsTransport(baseUrl),
    private val pendingEventStore: ProductAdEventStore = InMemoryProductAdEventStore(),
    private val now: () -> Instant = Instant::now,
) {
    fun decideMartProductAd(sessionId: String): ProductAdResult {
        return decideProductAd(sessionId, MART_SLOT_KIND, MART_PLACEMENT)
    }

    fun decideSearchProductAd(sessionId: String): ProductAdResult {
        return decideProductAd(sessionId, SEARCH_SLOT_KIND, SEARCH_PLACEMENT)
    }

    fun decideFeedProductAd(sessionId: String, slotIndex: Int, neighbourContentIds: List<String>): ProductAdResult {
        if (slotIndex !in 0..10_000 || neighbourContentIds.size > 10 || neighbourContentIds.any { !SAFE_ID.matches(it) }) {
            return ProductAdResult.Failure("This feed ad request is invalid.")
        }
        return decideProductAd(sessionId, FEED_PRODUCT_SLOT_KIND, FEED_PLACEMENT, slotIndex, neighbourContentIds)
    }

    private fun decideProductAd(
        sessionId: String,
        slotKind: String,
        placement: String,
        slotIndex: Int? = null,
        neighbourContentIds: List<String> = emptyList(),
    ): ProductAdResult {
        if (!SAFE_SESSION_ID.matches(sessionId)) return ProductAdResult.Failure("This product ad request is invalid.")
        val slot = JSONObject().put("kind", slotKind)
        slotIndex?.let { slot.put("slotIndex", it).put("slotsSinceLastAd", it) }
        if (neighbourContentIds.isNotEmpty()) slot.put("neighbourContentIds", JSONArray(neighbourContentIds))
        val body = JSONObject().put("slot", slot).put("sessionId", sessionId)
        return try {
            val token = accessTokenProvider()?.takeIf(String::isNotBlank)
                ?: return ProductAdResult.Failure("Sign in to view sponsored products.")
            val row = transport.post(DECIDE_PATH, token, body, null).let { it.optJSONObject("data") ?: it }
            val ad = row.optJSONObject("ad")?.let { parseProductAd(it, slotKind, placement) }
            ProductAdResult.Success(ad, row.optNullableString("declinedReason"))
        } catch (error: Exception) {
            ProductAdResult.Failure(error.message ?: "Could not load a sponsored product.")
        }
    }

    fun recordImpression(ad: MartProductAd): Boolean = recordEvent(ad, "impression")
    fun recordClick(ad: MartProductAd): Boolean = recordEvent(ad, "click")

    @Synchronized
    fun flushPendingEvents(): Boolean {
        val accountId = accountIdProvider()?.takeIf(String::isNotBlank) ?: return false
        return flushPendingEvents(accountId)
    }

    @Synchronized
    private fun recordEvent(ad: MartProductAd, type: String): Boolean = runCatching {
        require(SAFE_ID.matches(ad.adId) && SAFE_TOKEN.matches(ad.impressionToken))
        require(type == "impression" || type == "click")
        require(
            (ad.placement == MART_PLACEMENT && ad.slotKind == MART_SLOT_KIND) ||
                (ad.placement == SEARCH_PLACEMENT && ad.slotKind == SEARCH_SLOT_KIND) ||
                (ad.placement == FEED_PLACEMENT && ad.slotKind == FEED_PRODUCT_SLOT_KIND),
        )
        val expiresAt = Instant.parse(ad.expiresAt)
        require(expiresAt.isAfter(now())) { "This product ad has expired." }
        val accountId = accountIdProvider()?.takeIf(String::isNotBlank) ?: return false
        val event = PendingProductAdEvent(
            eventId = UUID.randomUUID().toString().replace("-", ""),
            campaignId = ad.adId,
            placement = ad.placement,
            type = type,
            itemId = ad.adId,
            token = ad.impressionToken,
            expiresAt = ad.expiresAt,
            occurredAt = now().toString(),
        )
        val pending = pendingEventStore.read(accountId)
            .filter { runCatching { Instant.parse(it.expiresAt).isAfter(now()) }.getOrDefault(false) }
            .plus(event)
            .takeLast(MAXIMUM_PENDING_EVENTS)
        pendingEventStore.write(accountId, pending)
        // True means the event is durably accepted by the local queue; a transient network error
        // leaves it available for the next foreground or tracking event.
        flushPendingEvents(accountId)
        true
    }.getOrDefault(false)

    private fun flushPendingEvents(accountId: String): Boolean {
        var pending = pendingEventStore.read(accountId)
            .filter { runCatching { Instant.parse(it.expiresAt).isAfter(now()) }.getOrDefault(false) }
        pendingEventStore.write(accountId, pending)
        while (pending.isNotEmpty()) {
            val accessToken = accessTokenProvider()?.takeIf(String::isNotBlank) ?: return false
            val event = pending.first()
            try {
                transport.post(EVENTS_PATH, accessToken, JSONObject().put("events", JSONArray().put(event.requestJson())), event.eventId)
            } catch (_: Exception) {
                return false
            }
            pending = pending.drop(1)
            pendingEventStore.write(accountId, pending)
        }
        return true
    }

    private fun parseProductAd(row: JSONObject, expectedSlotKind: String, expectedPlacement: String): MartProductAd {
        val creative = row.optJSONObject("creative") ?: error("Nantty returned an incomplete product ad.")
        require(row.optString("placement") == expectedPlacement && row.optString("slotKind") == expectedSlotKind)
        require(row.optString("format") == "product" && creative.optString("format") == "product")
        val label = row.optString("label").takeIf { it == "Ad" || it == "Sponsored" }
            ?: error("Nantty returned an unsupported ad label.")
        val adId = row.optString("adId").takeIf(SAFE_ID::matches) ?: error("Nantty returned an invalid ad ID.")
        val impressionToken = row.optString("impressionToken").takeIf(SAFE_TOKEN::matches) ?: error("Nantty returned an invalid impression token.")
        val expiresAt = row.optString("expiresAt").takeIf(String::isNotBlank) ?: error("Nantty returned no ad expiry.")
        require(runCatching { java.time.Instant.parse(expiresAt).isAfter(java.time.Instant.now()) }.getOrDefault(false)) {
            "Nantty returned an expired product ad."
        }
        val destination = creative.optJSONObject("destination") ?: error("Nantty returned no product destination.")
        require(destination.optString("type") == "product")
        val productId = destination.optString("targetId").takeIf(SAFE_ID::matches) ?: error("Nantty returned an invalid product destination.")
        val image = creative.optJSONArray("media")?.let(::firstTrustedImage) ?: error("Nantty returned no product image.")
        val identity = creative.optJSONObject("identity") ?: error("Nantty returned no advertiser identity.")
        val headline = creative.optString("headline").trim().takeIf(String::isNotEmpty) ?: error("Nantty returned no product headline.")
        val advertiserName = identity.optString("name").trim().takeIf(String::isNotEmpty) ?: error("Nantty returned no advertiser name.")
        val advertiserHandle = identity.optString("handle").trim().removePrefix("@").trim()
        val advertiserAvatarUrl = identity.optNullableString("avatarUrl")?.takeIf(::isTrustedHttps)
        return MartProductAd(
            adId = adId,
            impressionToken = impressionToken,
            expiresAt = expiresAt,
            label = label,
            headline = headline,
            primaryText = creative.optString("primaryText").trim(),
            callToAction = creative.optString("callToAction").trim().ifEmpty { "shop_now" },
            imageUrl = image,
            advertiserName = advertiserName,
            verifiedBusiness = identity.optBoolean("verifiedBusiness"),
            productId = productId,
            placement = expectedPlacement,
            slotKind = expectedSlotKind,
            advertiserHandle = advertiserHandle,
            advertiserAvatarUrl = advertiserAvatarUrl,
        )
    }

    private fun firstTrustedImage(rows: JSONArray): String? = (0 until rows.length()).asSequence()
        .mapNotNull { rows.optJSONObject(it) }
        .firstOrNull { it.optString("kind") == "image" && isTrustedHttps(it.optString("url")) }
        ?.optString("url")

    companion object {
        const val MAXIMUM_PENDING_EVENTS = 500
        const val DECIDE_PATH = "/api/v1/ads/decide"
        const val EVENTS_PATH = "/api/v1/ads/events"
        const val MART_SLOT_KIND = "martTile"
        const val MART_PLACEMENT = "mart"
        const val SEARCH_SLOT_KIND = "searchTile"
        const val SEARCH_PLACEMENT = "search"
        const val FEED_PRODUCT_SLOT_KIND = "feedProduct"
        const val FEED_PLACEMENT = "feed"
        private val SAFE_ID = Regex("^[A-Za-z0-9_:-]{1,128}$")
        private val SAFE_SESSION_ID = Regex("^[A-Za-z0-9_-]{1,128}$")
        private val SAFE_TOKEN = Regex("^[A-Za-z0-9_.~-]{8,4096}$")
    }
}

private class JdkProductAdsTransport(private val baseUrl: String) : ProductAdsTransport {
    override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
        require(path == ProductAdsRepository.DECIDE_PATH || path == ProductAdsRepository.EVENTS_PATH)
        require(accessToken.isNotBlank())
        val origin = trustedProductAdsOrigin(baseUrl) ?: error("Configure a trusted Nantty API URL for ads.")
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
            idempotencyKey?.takeIf(String::isNotBlank)?.let { setRequestProperty("Idempotency-Key", it) }
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val source = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = source?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= 256 * 1024) { "Nantty returned an oversized ads response." }
                    output.write(buffer, 0, count)
                }
                output.toString(Charsets.UTF_8.name())
            }.orEmpty()
            if (status !in 200..299) error("The product ads request failed ($status).")
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }
}

private fun isTrustedHttps(raw: String): Boolean = runCatching {
    val uri = URI(raw.trim())
    uri.isAbsolute && uri.scheme.equals("https", true) && !uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.fragment == null
}.getOrDefault(false)

private fun trustedProductAdsOrigin(raw: String): String? = runCatching {
    val uri = URI(raw.trim())
    require(uri.isAbsolute && (uri.scheme.equals("https", true) || uri.scheme.equals("http", true)))
    require(!uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null)
    require(uri.scheme.equals("https", true) || uri.host in setOf("10.0.2.2", "127.0.0.1", "localhost"))
    "${uri.scheme}://${uri.rawAuthority}"
}.getOrNull()

private fun JSONObject.optNullableString(key: String): String? = opt(key)
    ?.takeUnless { it == JSONObject.NULL }
    ?.toString()
    ?.takeIf(String::isNotBlank)
