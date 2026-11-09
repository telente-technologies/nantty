package com.nantty.android.data

import org.json.JSONObject
import java.util.UUID

internal enum class SaleAttributionSource(val apiValue: String) {
    POST("post"), CLIP("clip"), LIVE("live"), LINK("link"),
}

/** Short-lived, privacy-safe attribution from a trusted in-app product entry point. */
internal data class SaleAttribution(
    val source: SaleAttributionSource,
    val id: String,
    val expiresAtMillis: Long,
) {
    fun toCartPayload(nowMillis: Long = System.currentTimeMillis()): JSONObject? {
        if (expiresAtMillis <= nowMillis || !isCanonicalUuid(id)) return null
        return JSONObject().put("source", source.apiValue).put("id", id)
    }
}

internal fun saleAttributionForFeedPost(post: FeedPost, nowMillis: Long = System.currentTimeMillis()): SaleAttribution? {
    if (post.isSponsored || !isCanonicalUuid(post.id)) return null
    val source = if (post.kind == "clip") SaleAttributionSource.CLIP else SaleAttributionSource.POST
    return SaleAttribution(source, post.id, nowMillis + SALE_ATTRIBUTION_WINDOW_MILLIS)
}

internal fun restoreSaleAttribution(sourceValue: String?, id: String?, expiresAtMillis: Long?, nowMillis: Long = System.currentTimeMillis()): SaleAttribution? {
    val source = SaleAttributionSource.entries.firstOrNull { it.apiValue == sourceValue } ?: return null
    val attributionId = id?.takeIf(::isCanonicalUuid) ?: return null
    val expiresAt = expiresAtMillis?.takeIf { it > nowMillis } ?: return null
    return SaleAttribution(source, attributionId, expiresAt)
}

private fun isCanonicalUuid(value: String): Boolean = runCatching {
    UUID.fromString(value).toString().equals(value, ignoreCase = true)
}.getOrDefault(false)

private const val SALE_ATTRIBUTION_WINDOW_MILLIS = 30L * 24 * 60 * 60 * 1000
