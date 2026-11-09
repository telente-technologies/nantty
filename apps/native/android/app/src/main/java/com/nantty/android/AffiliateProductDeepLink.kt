package com.nantty.android

import java.net.URI
import java.util.UUID

data class AffiliateProductDeepLink(
    val productId: String,
    val affiliateLinkId: String?,
)

/** Accepts only a same-site HTTPS product URL with one optional, syntactically safe affiliate ID. */
internal object AffiliateProductDeepLinkParser {
    private val uuidAtEnd = Regex("([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$")
    private val affiliateIdPattern = Regex("[A-Za-z0-9_-]{1,80}")

    fun parse(rawUrl: String?, trustedWebHost: String): AffiliateProductDeepLink? {
        if (rawUrl.isNullOrBlank() || trustedWebHost.isBlank()) return null
        val uri = runCatching { URI(rawUrl) }.getOrNull() ?: return null
        if (!uri.scheme.equals("https", ignoreCase = true) || !uri.host.equals(trustedWebHost, ignoreCase = true) ||
            uri.rawUserInfo != null || uri.port != -1 || uri.rawFragment != null
        ) return null

        val path = uri.path ?: return null
        val rawPath = uri.rawPath ?: return null
        if (!path.startsWith("/p/") || path.removePrefix("/p/").isBlank() || '/' in path.removePrefix("/p/") ||
            rawPath.contains("%2f", ignoreCase = true)
        ) return null
        val productId = uuidAtEnd.find(path.removePrefix("/p/"))?.groupValues?.getOrNull(1) ?: return null
        val canonicalProductId = runCatching { UUID.fromString(productId).toString() }.getOrNull() ?: return null
        if (!canonicalProductId.equals(productId, ignoreCase = true)) return null

        val query = uri.rawQuery
        val fields = query?.split('&').orEmpty().filter(String::isNotBlank)
        val linkId = fields.singleOrNull()
            ?.takeIf { it.startsWith("aff=") }
            ?.removePrefix("aff=")
            ?.takeIf(affiliateIdPattern::matches)
        return AffiliateProductDeepLink(canonicalProductId, linkId)
    }
}
