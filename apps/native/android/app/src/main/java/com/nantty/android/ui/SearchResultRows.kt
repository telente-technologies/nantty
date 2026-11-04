package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.SearchOther
import com.nantty.android.data.SearchPost
import com.nantty.android.data.SearchProduct
import com.nantty.android.data.SearchRecent
import com.nantty.android.data.SearchUser

@Composable
internal fun RecentHistoryNotice(onRetry: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = SearchDimensions.noticeHorizontal, vertical = SearchDimensions.noticeVertical),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Recent searches couldn’t be updated.",
            Modifier.weight(1f).semantics { contentDescription = "Recent searches couldn’t be updated" },
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodySmall,
        )
        TextButton(onClick = onRetry) { Text("Try again") }
    }
}

@Composable
internal fun RecentSearchRow(recent: SearchRecent, onSelect: () -> Unit, onRemove: () -> Unit) {
    Surface(
        onClick = onSelect,
        modifier = Modifier.fillMaxWidth().padding(horizontal = SearchDimensions.rowHorizontal).sizeIn(minHeight = SearchDimensions.minimumRowHeight)
            .semantics(mergeDescendants = true) { contentDescription = "Search ${recent.query}" },
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(Modifier.padding(start = SearchDimensions.rowContentStart, end = SearchDimensions.rowContentEnd), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(recent.query, Modifier.weight(1f).padding(horizontal = SearchDimensions.rowTextHorizontal), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge)
            androidx.compose.material3.IconButton(onClick = onRemove, modifier = Modifier.sizeIn(minWidth = SearchDimensions.minimumTouchTarget, minHeight = SearchDimensions.minimumTouchTarget)) {
                Icon(Icons.Default.Close, contentDescription = "Remove ${recent.query} from recent searches")
            }
        }
    }
}

@Composable
internal fun SearchOtherRow(item: com.nantty.android.data.SearchOther, onClick: (() -> Unit)?) {
    val rowModifier = Modifier.fillMaxWidth().padding(horizontal = SearchDimensions.rowHorizontal)
        .sizeIn(minHeight = SearchDimensions.minimumRowHeight)
        .semantics(mergeDescendants = true) {
            contentDescription = when (item.kind) {
                "hashtag" -> "Search posts with ${item.title}"
                "store" -> "Search within store ${item.title}"
                "category" -> "Search Mart category ${item.title}"
                "brand" -> if (item.associatedStoreId == null) "${item.title} brand; official store not available" else "Search the official store for ${item.title}"
                else -> "${item.title}, ${item.kind}"
            }
        }
    val content: @Composable () -> Unit = {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                Surface(color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.fillMaxSize()) {}
                item.imageUrl?.let { image ->
                    AsyncImage(image, contentDescription = null, modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                } ?: Text(if (item.kind == "hashtag") "#" else item.title.take(1).uppercase(), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(item.title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (item.subtitle.isNotBlank()) Text(item.subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
    if (onClick == null) Surface(modifier = rowModifier, color = MaterialTheme.colorScheme.surface) { content() }
    else Surface(onClick = onClick, modifier = rowModifier, color = MaterialTheme.colorScheme.surface) { content() }
}

internal object SearchDimensions {
    val headerHorizontal = 20.dp
    val headerVertical = 8.dp
    val listSpacing = 4.dp
    val loadingInset = 20.dp
    val noticeHorizontal = 20.dp
    val noticeVertical = 4.dp
    val rowHorizontal = 12.dp
    val minimumRowHeight = 56.dp
    val rowContentStart = 16.dp
    val rowContentEnd = 8.dp
    val rowTextHorizontal = 12.dp
    val minimumTouchTarget = 48.dp
}

@Composable
internal fun SearchProductRow(product: SearchProduct, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = SearchDimensions.rowHorizontal)
            .sizeIn(minHeight = 88.dp).testTag("product-search-result-${product.id}").semantics(mergeDescendants = true) {
                contentDescription = "Product ${product.name}, ${formatSearchProductPrice(product.amountMinor, product.currency)}"
            },
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (product.imageUrl != null) {
                AsyncImage(
                    model = product.imageUrl,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)),
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                )
            }
            Column(Modifier.weight(1f)) {
                Text(product.name, style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(formatSearchProductPrice(product.amountMinor, product.currency), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (product.stock == 0) Text("Out of stock", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

internal fun formatSearchProductPrice(amountMinor: Long, currencyCode: String): String = runCatching {
    val currency = java.util.Currency.getInstance(currencyCode)
    java.text.NumberFormat.getCurrencyInstance(java.util.Locale.getDefault()).apply { this.currency = currency }
        .format(java.math.BigDecimal.valueOf(amountMinor, currency.defaultFractionDigits.coerceAtLeast(0)))
}.getOrElse { "$currencyCode ${amountMinor}" }

@Composable
internal fun SearchPostRow(post: SearchPost, onClick: () -> Unit, onOpenProfile: (String) -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp).semantics(mergeDescendants = true) {
            contentDescription = "Open post: ${post.caption.ifBlank { "Post" }}"
        },
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            if (post.thumbnailUrl != null) {
                AsyncImage(post.thumbnailUrl, contentDescription = "Post image", modifier = Modifier.size(64.dp, 72.dp))
            } else {
                Surface(Modifier.size(64.dp, 72.dp), shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                    Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Search, contentDescription = null) }
                }
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text(post.caption.ifBlank { "Post" }, maxLines = 3, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(6.dp))
                Text("${post.likes} likes · ${post.views} views", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                post.authorId?.let { authorId ->
                    TextButton(onClick = { onOpenProfile(authorId) }, modifier = Modifier.sizeIn(minHeight = 48.dp)) { Text("View author profile") }
                }
            }
        }
    }
}

@Composable
internal fun SearchUserRow(user: SearchUser, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp).sizeIn(minHeight = 56.dp).semantics(mergeDescendants = true) {
            contentDescription = "Open ${user.name}, @${user.username}'s profile"
        },
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                Surface(Modifier.fillMaxSize(), shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer) {
                    Text(user.name.firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.onPrimaryContainer, fontWeight = FontWeight.Bold)
                }
                user.avatarUrl?.let { AsyncImage(it, contentDescription = null, modifier = Modifier.fillMaxSize().clip(CircleShape)) }
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(user.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                    if (user.verified) Icon(Icons.Default.Verified, contentDescription = "Verified account", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp).size(16.dp))
                }
                Text("@${user.username}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
internal fun SearchCenterMessage(message: String, detail: String? = null, progress: Boolean = false, action: (() -> Unit)? = null, actionLabel: String = "Try again") {
    Column(Modifier.fillMaxSize().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        if (progress) CircularProgressIndicator()
        Text(message, Modifier.padding(top = if (progress) 16.dp else 0.dp), style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
        detail?.let { Text(it, Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        action?.let { TextButton(onClick = it) { Text(actionLabel) } }
    }
}

