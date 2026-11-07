package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.MartProductAd
import kotlinx.coroutines.delay

/** Product creative rendered in the organic feed's existing card rhythm and theme. */
@Composable
internal fun FeedProductAdCard(
    ad: MartProductAd,
    onOpenProduct: () -> Unit,
    onViewed: suspend (MartProductAd) -> Boolean,
    testTag: String = "feed-product-ad",
    ctaTestTag: String = "feed-product-ad-cta",
) {
    val view = LocalView.current
    var sufficientlyVisible by remember(ad.adId) { mutableStateOf(false) }
    var impressionSent by remember(ad.adId) { mutableStateOf(false) }

    LaunchedEffect(sufficientlyVisible, ad.adId) {
        if (!sufficientlyVisible || impressionSent) return@LaunchedEffect
        repeat(FEED_AD_IMPRESSION_MAX_ATTEMPTS) { attempt ->
            if (!sufficientlyVisible) return@LaunchedEffect
            delay(if (attempt == 0) FEED_AD_IMPRESSION_VISIBLE_MILLIS else FEED_AD_IMPRESSION_RETRY_MILLIS)
            if (!sufficientlyVisible) return@LaunchedEffect
            if (onViewed(ad)) {
                impressionSent = true
                return@LaunchedEffect
            }
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .testTag(testTag)
            .onGloballyPositioned { coordinates ->
                val bounds = coordinates.boundsInWindow()
                val viewportHeight = view.height.toFloat()
                val visibleHeight = (minOf(bounds.bottom, viewportHeight) - maxOf(bounds.top, 0f)).coerceAtLeast(0f)
                sufficientlyVisible = coordinates.size.height > 0 && visibleHeight / coordinates.size.height >= FEED_AD_VISIBLE_FRACTION
            },
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(32.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = androidx.compose.ui.Alignment.Center,
                ) {
                    Text(ad.advertiserName.firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                    ad.advertiserAvatarUrl?.let { avatarUrl ->
                        AsyncImage(
                            model = avatarUrl,
                            contentDescription = null,
                            modifier = Modifier.size(32.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop,
                        )
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(ad.advertiserName, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (ad.verifiedBusiness) {
                            Icon(Icons.Default.Verified, contentDescription = "Verified business", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                        }
                        Surface(shape = RoundedCornerShape(5.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                            Text(
                                ad.label.asSponsoredLabel(),
                                Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    if (ad.advertiserHandle.isNotBlank()) {
                        Text("@${ad.advertiserHandle}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            if (ad.primaryText.isNotBlank()) {
                Text(ad.primaryText, Modifier.padding(horizontal = 16.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(onClick = onOpenProduct, role = Role.Button)
                    .semantics { contentDescription = "${ad.headline}, sponsored product"; role = Role.Button }
                    .testTag("$testTag-product"),
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column {
                    AsyncImage(
                        model = ad.imageUrl,
                        contentDescription = null,
                        modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(MaterialTheme.colorScheme.surfaceVariant),
                        contentScale = ContentScale.Crop,
                    )
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(ad.headline, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text("Sponsored product", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            val ctaLabel = ad.callToAction.productAdCtaLabel()
            Button(
                onClick = onOpenProduct,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).heightIn(min = 48.dp).testTag(ctaTestTag)
                    .semantics { contentDescription = "$ctaLabel, ${ad.headline}" },
            ) {
                Text(ctaLabel)
            }
        }
    }
}

private fun String.asSponsoredLabel(): String = if (this == "Ad") "Sponsored" else this

private fun String.productAdCtaLabel(): String = when (this) {
    "shop_now" -> "Shop now"
    "learn_more" -> "Learn more"
    "visit_store" -> "Visit store"
    "send_message" -> "Send message"
    "follow" -> "Follow"
    "watch_more" -> "Watch more"
    "order_now" -> "Order now"
    "sign_up" -> "Sign up"
    "install" -> "Install"
    "download" -> "Download"
    "book_now" -> "Book now"
    "contact_us" -> "Contact us"
    else -> this
}

private const val FEED_AD_VISIBLE_FRACTION = 0.5f
private const val FEED_AD_IMPRESSION_VISIBLE_MILLIS = 1_000L
private const val FEED_AD_IMPRESSION_RETRY_MILLIS = 2_000L
private const val FEED_AD_IMPRESSION_MAX_ATTEMPTS = 3
