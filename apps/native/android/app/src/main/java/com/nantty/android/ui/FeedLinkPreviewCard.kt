package com.nantty.android.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.R
import com.nantty.android.data.FeedLinkPreview
import com.nantty.android.data.FeedPost
import com.nantty.android.data.SharedContentCard
import com.nantty.android.data.SharedContentReference
import com.nantty.android.data.SharedContentResult
import com.nantty.android.data.extractSafePostLinks
import java.net.URI

@Composable
internal fun FeedPostLinkPreview(
    post: FeedPost,
    currentAccountId: String?,
    onResolve: ((String, String, (FeedLinkPreview?) -> Unit) -> Unit)?,
    onRecordClick: ((FeedPost) -> Unit)?,
    onOpen: ((String) -> Boolean)?,
    onResolveSharedContent: ((SharedContentReference, (SharedContentResult) -> Unit) -> Unit)?,
    onOpenSharedContent: ((SharedContentCard) -> Unit)?,
    onRequireSignInWithAction: ((() -> Unit) -> Unit),
) {
    if (post.media.isNotEmpty() || post.products.isNotEmpty() || post.quotedPost != null || post.kind == "sponsored") return
    val internalReference = remember(post.text) { firstInternalFeedReference(post.text) }
    if (internalReference != null) {
        FeedSharedContentCard(
            reference = internalReference,
            resolve = onResolveSharedContent,
            onOpen = onOpenSharedContent,
            onRequireSignInWithAction = onRequireSignInWithAction,
        )
        return
    }
    val externalUrl = remember(post.text) { firstExternalFeedUrl(post.text) }
    var preview by remember(post.id) { mutableStateOf(post.linkPreview) }
    LaunchedEffect(post.id, post.linkPreview, externalUrl, onResolve != null) {
        if (post.linkPreview != null) preview = post.linkPreview
        else if (externalUrl != null && !currentAccountId.isNullOrBlank() && onResolve != null) {
            onResolve(externalUrl, currentAccountId) { resolved -> preview = resolved }
        }
    }
    preview?.let { value -> FeedLinkPreviewCard(value, onRecordClick = { onRecordClick?.invoke(post) }, onOpen = onOpen) }
}

private fun firstInternalFeedReference(text: String): SharedContentReference? {
    val internalHosts = setOf("nantty.app", "www.nantty.app", "nantty.com", "www.nantty.com", "web.nantty.com")
    val kinds = mapOf("product" to "product", "products" to "product", "p" to "product", "post" to "post", "posts" to "post", "clip" to "clip", "clips" to "clip", "u" to "profile", "live" to "live", "lives" to "live", "space" to "space", "spaces" to "space", "store" to "store", "stores" to "store", "order" to "order", "orders" to "order")
    return extractSafePostLinks(text).firstNotNullOfOrNull { raw ->
        val uri = runCatching { URI(raw) }.getOrNull() ?: return@firstNotNullOfOrNull null
        if (uri.host?.lowercase() !in internalHosts || uri.rawUserInfo != null) return@firstNotNullOfOrNull null
        val parts = uri.path.split('/').filter(String::isNotBlank).mapNotNull { segment ->
            runCatching { java.net.URLDecoder.decode(segment, Charsets.UTF_8.name()) }.getOrNull()
        }
        val kind = parts.firstOrNull()?.let(kinds::get)
        val id = parts.getOrNull(1)
        when {
            kind != null && !id.isNullOrBlank() -> SharedContentReference(kind, id)
            parts.size == 1 && parts[0].matches(Regex("@?[A-Za-z0-9._]{3,30}")) -> SharedContentReference("profile", parts[0].removePrefix("@"))
            else -> null
        }
    }
}

private fun firstExternalFeedUrl(text: String): String? {
    val internalHosts = setOf("nantty.app", "www.nantty.app", "nantty.com", "www.nantty.com", "web.nantty.com")
    return extractSafePostLinks(text).firstOrNull { url ->
        val host = runCatching { URI(url).host?.lowercase() }.getOrNull()
        host != null && host !in internalHosts
    }
}

@Composable
internal fun FeedLinkPreviewCard(
    preview: FeedLinkPreview,
    onRecordClick: () -> Unit,
    onOpen: ((String) -> Boolean)? = null,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var confirmRiskyLink by remember(preview.url) { mutableStateOf(false) }
    val host = remember(preview.url) { runCatching { URI(preview.url).host.orEmpty() }.getOrDefault("") }
    val risky = remember(preview.url) { isRiskyFeedLink(preview.url) }

    Card(
        modifier = modifier.fillMaxWidth().padding(top = 8.dp).testTag("feed-link-preview"),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clickable {
                    if (risky) confirmRiskyLink = true
                    else openFeedLink(context, preview.url, onOpen, onRecordClick)
                }
                .semantics { contentDescription = context.getString(R.string.feed_link_open_description, preview.title, host) },
        ) {
            preview.imageUrl?.let { imageUrl ->
                AsyncImage(
                    model = imageUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxWidth().aspectRatio(1.91f).clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp)).testTag("feed-link-preview-image"),
                    contentScale = ContentScale.Crop,
                )
            }
            Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                Text(preview.siteName ?: preview.domain, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(preview.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                preview.description?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }

    if (confirmRiskyLink) {
        AlertDialog(
            onDismissRequest = { confirmRiskyLink = false },
            title = { Text(stringResource(R.string.feed_link_safety_title)) },
            text = { Text(stringResource(R.string.feed_link_safety_message, host)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmRiskyLink = false
                    openFeedLink(context, preview.url, onOpen, onRecordClick)
                }, modifier = Modifier.testTag("feed-link-confirm-open")) {
                    Text(stringResource(R.string.feed_link_open_anyway))
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmRiskyLink = false }, modifier = Modifier.testTag("feed-link-cancel-open")) {
                    Text(stringResource(R.string.feed_link_cancel))
                }
            },
        )
    }
}

private fun openFeedLink(context: android.content.Context, rawUrl: String, onOpen: ((String) -> Boolean)?, onRecordClick: () -> Unit) {
    val uri = runCatching { URI(rawUrl) }.getOrNull() ?: return
    if (uri.scheme != "https" || uri.host.isNullOrBlank() || uri.rawUserInfo != null || rawUrl.length > 2_048) return
    if (onOpen != null) {
        if (runCatching { onOpen(uri.toASCIIString()) }.getOrDefault(false)) onRecordClick()
        return
    }
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri.toASCIIString()))
    if (intent.resolveActivity(context.packageManager) == null) return
    if (runCatching { context.startActivity(intent); true }.getOrDefault(false)) onRecordClick()
}

private fun isRiskyFeedLink(rawUrl: String): Boolean {
    val host = runCatching { URI(rawUrl).host?.lowercase() }.getOrNull() ?: return true
    val shortenedHosts = setOf("bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "shorturl.at")
    val suspiciousSuffixes = setOf(".zip", ".mov", ".top", ".click", ".xyz", ".gq", ".tk")
    val ipv4 = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$").matches(host)
    return host in shortenedHosts || ipv4 || host.contains("xn--") || host.split('.').size > 4 || suspiciousSuffixes.any(host::endsWith)
}
