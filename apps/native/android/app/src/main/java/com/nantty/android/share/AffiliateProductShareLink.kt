package com.nantty.android.share

import com.nantty.android.BuildConfig
import java.net.URI
import java.text.Normalizer

internal fun affiliateProductShareUrl(
    productId: String,
    productName: String,
    affiliateLinkId: String,
    webAppBaseUrl: String = BuildConfig.NANTTY_WEBAPP_URL,
): String {
    require(productId.matches(Regex("[A-Za-z0-9_-]{1,100}")))
    require(affiliateLinkId.matches(Regex("[A-Za-z0-9_-]{1,80}")))
    val uri = URI(webAppBaseUrl.trim().trimEnd('/'))
    require(uri.scheme.equals("https", true) && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.query == null && uri.fragment == null)
    val slug = Normalizer.normalize(productName, Normalizer.Form.NFKD)
        .replace(Regex("\\p{M}+"), "")
        .lowercase()
        .replace("&", " and ")
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
        .take(80)
        .trimEnd('-')
        .ifEmpty { "item" }
    return "${uri.toString().trimEnd('/')}/p/$slug-$productId?aff=$affiliateLinkId"
}
