package com.nantty.android.data

import java.net.URL
import java.net.URLEncoder

internal fun buildMartHomeUrl(origin: String): URL = URL("${validatedMartOrigin(origin)}/api/v1/mart/home")

internal fun buildMartHighlightsUrl(origin: String, limit: Int = MART_HIGHLIGHTS_PAGE_SIZE): URL {
    require(limit in 1..MART_HIGHLIGHTS_PAGE_SIZE)
    return URL("${validatedMartOrigin(origin)}/api/v1/mart/highlights?limit=$limit")
}

internal fun buildMartRecommendationsUrl(origin: String): URL =
    URL("${validatedMartOrigin(origin)}/api/v1/mart/recommendations/for-you")

internal fun buildMartAdsEventsUrl(origin: String): URL = URL("${validatedMartOrigin(origin)}/api/v1/ads/events")

internal fun buildMartProductsUrl(origin: String, categoryId: String?, cursor: String?, collection: String? = null): URL {
    val parsed = URL(validatedMartOrigin(origin))
    val query = buildList {
        add("limit=20")
        categoryId?.let { add("categoryId=${URLEncoder.encode(it, "UTF-8")}") }
        collection?.let {
            require(it in MART_PRODUCT_COLLECTIONS)
            add("collection=${URLEncoder.encode(it, "UTF-8")}")
        }
        cursor?.let { add("cursor=${URLEncoder.encode(it, "UTF-8")}") }
    }.joinToString("&")
    return URL("${parsed.toString().trimEnd('/')}/api/v1/products?$query")
}

internal fun buildMartProductDetailUrl(origin: String, productId: String): URL {
    require(isSafeMartIdentifier(productId)) { "Invalid product identifier." }
    return URL("${validatedMartOrigin(origin)}/api/v1/products/$productId")
}

internal fun buildAffiliateLinkClickUrl(origin: String, linkId: String): URL {
    require(linkId.matches(Regex("[A-Za-z0-9_-]{1,80}"))) { "Invalid affiliate link identifier." }
    return URL("${validatedMartOrigin(origin)}/api/v1/affiliate-links/$linkId/clicks")
}

private fun validatedMartOrigin(origin: String): String {
    val parsed = runCatching { URL(origin.trim().trimEnd('/')) }.getOrElse { throw IllegalArgumentException("Invalid API URL", it) }
    val allowed = parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2")
    require(allowed && parsed.host.isNotBlank() && parsed.userInfo == null && parsed.query == null && parsed.ref == null) {
        "API URL must use HTTPS (emulator development may use 10.0.2.2) and must not contain credentials or query data."
    }
    return parsed.toString().trimEnd('/')
}

internal fun isSafeMartIdentifier(value: String): Boolean = value.isNotBlank() && value.length <= 100 && value.matches(Regex("[A-Za-z0-9_-]+"))

internal const val MART_HIGHLIGHTS_PAGE_SIZE = 6
internal const val MART_RECOMMENDATIONS_LIMIT = 20
internal val MART_PRODUCT_COLLECTIONS = setOf("sales_of_the_day", "featured_brands", "new_arrivals")
