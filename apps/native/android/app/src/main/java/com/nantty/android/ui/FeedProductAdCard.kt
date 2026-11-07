package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
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
            }
            .semantics { contentDescription = "Ad from ${ad.advertiserName}: ${ad.headline}" },
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(ad.advertiserName, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (ad.verifiedBusiness) {
                    Icon(Icons.Default.Verified, contentDescription = "Verified business", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                }
                Spacer(Modifier.weight(1f))
                Surface(shape = RoundedCornerShape(5.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                    Text("Ad", Modifier.padding(horizontal = 6.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Text(ad.headline, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (ad.primaryText.isNotBlank()) {
                Text(ad.primaryText, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            AsyncImage(
                model = ad.imageUrl,
                contentDescription = ad.headline,
                modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
                contentScale = ContentScale.Crop,
            )
            TextButton(onClick = onOpenProduct, modifier = Modifier.align(androidx.compose.ui.Alignment.End).testTag(ctaTestTag)) {
                Text(ad.callToAction.replace('_', ' ').replaceFirstChar(Char::uppercase))
            }
        }
    }
}

private const val FEED_AD_VISIBLE_FRACTION = 0.5f
private const val FEED_AD_IMPRESSION_VISIBLE_MILLIS = 1_000L
private const val FEED_AD_IMPRESSION_RETRY_MILLIS = 2_000L
private const val FEED_AD_IMPRESSION_MAX_ATTEMPTS = 3
