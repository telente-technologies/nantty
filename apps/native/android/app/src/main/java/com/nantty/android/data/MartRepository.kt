package com.nantty.android.data

import com.nantty.android.BuildConfig
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

class MartRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String? = { null },
    private val accountIdProvider: () -> String? = { null },
    private val affiliateVisitorIdProvider: () -> String? = { null },
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) {
    private val interactionRepository by lazy { ProductInteractionRepository(baseUrl, accessTokenProvider, openConnection) }

    internal fun currentAccessToken(): String? = accessTokenProvider()

    internal fun apiBaseUrl(): String = baseUrl

    internal fun currentAccountId(): String? = accountIdProvider()?.takeIf(String::isNotBlank)

    internal fun productInteractions(): ProductInteractionRepository = interactionRepository

    fun recordCategoryViewed(categoryId: String): Boolean = interactionRepository.recordCategoryViewed(categoryId)

    fun recordProductClicked(productId: String, surface: String? = null): Boolean = interactionRepository.recordProductClicked(productId, surface)

    fun recordProductViewed(productId: String): Boolean = interactionRepository.recordProductViewed(productId)

    fun recordProductPurchased(productId: String, quantity: Int): Boolean =
        interactionRepository.recordProductPurchased(productId, quantity)

    /** Records an affiliate landing with the canonical backend contract and returns only matching attribution. */
    internal fun recordAffiliateLinkClick(linkId: String, expectedProductId: String): SaleAttribution? {
        if (!linkId.matches(AFFILIATE_LINK_ID_PATTERN) || !isSafeMartIdentifier(expectedProductId)) return null
        val visitorId = affiliateVisitorIdProvider()?.takeIf(::isSafeAffiliateVisitorId) ?: return null
        return runCatching {
            val response = MartHttpTransport.postJsonResponse(
                buildAffiliateLinkClickUrl(baseUrl, linkId),
                accessTokenProvider(),
                JSONObject().put("visitorId", visitorId),
                openConnection,
            )
            if (response.status !in 200..299 || response.body.isBlank()) return null
            val root = JSONObject(response.body)
            val payload = root.optJSONObject("data") ?: root
            val attribution = payload.optJSONObject("attribution") ?: return null
            val productId = payload.optString("productId")
            val source = attribution.optString("source")
            val returnedLinkId = attribution.optString("id")
            val expiresAt = Instant.parse(payload.optString("expiresAt")).toEpochMilli()
            if (productId != expectedProductId || source != SaleAttributionSource.LINK.apiValue ||
                returnedLinkId != linkId || expiresAt <= System.currentTimeMillis()
            ) return null
            SaleAttribution(SaleAttributionSource.LINK, linkId, expiresAt)
        }.getOrNull()
    }

    fun loadHome(): MartResult = get(buildMartHomeUrl(baseUrl), MartResponseParser::parseHome)

    fun loadHighlights(limit: Int = MART_HIGHLIGHTS_PAGE_SIZE): MartResult {
        if (limit !in 1..MART_HIGHLIGHTS_PAGE_SIZE) return MartResult.Failure("The Mart highlights request is invalid.")
        return get(buildMartHighlightsUrl(baseUrl, limit), MartResponseParser::parseHighlights)
    }

    fun recordSponsoredEvent(placement: MartSponsoredPlacement, itemId: String, type: String): Boolean {
        val token = accessTokenProvider()?.takeIf(String::isNotBlank) ?: return false
        if (type !in setOf("impression", "click") || !isSafeMartIdentifier(itemId)) return false
        return try {
            val payload = JSONObject().put(
                "events",
                JSONArray().put(
                    JSONObject()
                        .put("campaignId", placement.campaignId)
                        .put("placement", "mart")
                        .put("type", type)
                        .put("itemId", itemId)
                        .put("token", placement.impressionToken)
                        .put("occurredAt", java.time.Instant.now().toString()),
                ),
            )
            MartHttpTransport.postJson(buildMartAdsEventsUrl(baseUrl), token, payload, openConnection) in 200..299
        } catch (_: Exception) {
            false
        }
    }

    fun loadProducts(categoryId: String? = null, cursor: String? = null, collection: String? = null): MartResult {
        if (categoryId != null && !isSafeMartIdentifier(categoryId)) return MartResult.Failure("Nantty returned an invalid category. Refresh the Mart and try again.")
        if (cursor != null && cursor.length > 300) return MartResult.Failure("The product page cursor is invalid. Refresh the Mart and try again.")
        if (collection != null && collection !in MART_PRODUCT_COLLECTIONS) return MartResult.Failure("This Mart collection is not available.")
        if (collection != null && categoryId != null) return MartResult.Failure("Choose a category or a collection, not both.")
        return get(buildMartProductsUrl(baseUrl, categoryId, cursor, collection), MartResponseParser::parseProducts)
    }

    fun loadProductRecommendations(): MartRecommendationsResult {
        return try {
            val response = MartHttpTransport.get(buildMartRecommendationsUrl(baseUrl), accessTokenProvider(), openConnection)
            if (response.status !in 200..299) {
                MartRecommendationsResult.Failure("Recommendations request failed (HTTP ${response.status}). Please try again later.")
            } else {
                val parsed = runCatching { parseRecommendations(response.body) }.getOrNull()
                if (parsed == null) MartRecommendationsResult.Failure("Nantty returned recommendations that could not be read.")
                else MartRecommendationsResult.Success(parsed)
            }
        } catch (_: Exception) {
            MartRecommendationsResult.Failure("Could not load product recommendations. Check your connection and try again.")
        }
    }

    internal fun parseRecommendations(body: String): MartRecommendations = MartResponseParser.parseRecommendations(body)

    fun loadProductDetail(productId: String): MartProductDetailResult {
        if (!isSafeMartIdentifier(productId)) return MartProductDetailResult.Failure("This product link is invalid.")
        return try {
            val response = MartHttpTransport.get(buildMartProductDetailUrl(baseUrl, productId), accessTokenProvider(), openConnection)
            if (response.status !in 200..299) {
                MartProductDetailResult.Failure("Product request failed (HTTP ${response.status}). Please try again later.")
            } else {
                runCatching { MartProductDetailResult.Success(parseProductDetail(response.body, productId)) }
                    .getOrElse { MartProductDetailResult.Failure("Nantty returned product details that could not be read.") }
            }
        } catch (_: Exception) {
            MartProductDetailResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    internal fun parseProductDetail(body: String, expectedId: String): MartProductDetail =
        MartResponseParser.parseProductDetail(body, expectedId)

    private fun get(url: URL, parse: (String) -> MartResult): MartResult {
        return try {
            val response = MartHttpTransport.get(url, accessTokenProvider(), openConnection)
            if (response.status !in 200..299) MartResult.Failure("Mart request failed (HTTP ${response.status}). Please try again later.")
            else runCatching { parse(response.body) }.getOrElse { MartResult.Failure("Nantty returned catalogue data that could not be read.") }
        } catch (_: Exception) {
            MartResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }
}

private val AFFILIATE_LINK_ID_PATTERN = Regex("[A-Za-z0-9_-]{1,80}")

private fun isSafeAffiliateVisitorId(value: String): Boolean =
    value.length in 8..80 && value.all { it.isLetterOrDigit() || it == '-' || it == '_' }
