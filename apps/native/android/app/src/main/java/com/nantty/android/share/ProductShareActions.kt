package com.nantty.android.share

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import com.nantty.android.BuildConfig
import com.nantty.android.R
import java.text.Normalizer
import java.net.URI

internal fun productShareUrl(
    productId: String,
    productName: String,
    webAppBaseUrl: String = BuildConfig.NANTTY_WEBAPP_URL,
): String {
    require(productId.isNotBlank() && productId.length <= 100 && productId.matches(Regex("[A-Za-z0-9_-]+")))
    val configured = runCatching { URI(webAppBaseUrl.trim().trimEnd('/')) }.getOrNull()
    val trustedHost = configured?.host?.let { it.equals("nantty.com", true) || it.endsWith(".nantty.com", true) } == true
    val trustedHttps = configured?.scheme.equals("https", true) && trustedHost && configured?.rawUserInfo == null && configured?.rawQuery == null && configured?.rawFragment == null
    val emulatorHost = configured?.scheme.equals("http", true) && configured?.host == "10.0.2.2" && configured.rawUserInfo == null
    val baseUrl = if (trustedHttps || emulatorHost) configured.toString() else "https://web.nantty.com"
    val slug = slugifyProductName(productName)
    return "$baseUrl/p/$slug-$productId"
}

internal fun productShareText(productId: String, productName: String, webAppBaseUrl: String = BuildConfig.NANTTY_WEBAPP_URL): String =
    "$productName on Nantty: ${productShareUrl(productId, productName, webAppBaseUrl)}"

internal fun copyProductLinkFromAndroid(context: Context, productId: String, productName: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
    clipboard.setPrimaryClip(ClipData.newPlainText(context.getString(R.string.product_link_label), productShareUrl(productId, productName)))
    Toast.makeText(context, R.string.product_link_copied, Toast.LENGTH_SHORT).show()
}

internal fun shareProductFromAndroid(context: Context, productId: String, productName: String) {
    if (productId.isBlank() || productName.isBlank()) return
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, productShareText(productId, productName))
    }
    context.startActivity(Intent.createChooser(intent, context.getString(R.string.share_product_title)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

private fun slugifyProductName(value: String): String {
    val normalized = Normalizer.normalize(value, Normalizer.Form.NFKD)
    val slug = normalized
        .replace(Regex("\\p{M}+"), "")
        .lowercase()
        .replace("&", " and ")
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
        .take(80)
        .trimEnd('-')
    return slug.ifEmpty { "product" }
}
