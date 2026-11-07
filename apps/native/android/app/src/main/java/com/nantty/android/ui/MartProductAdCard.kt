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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.MartProductAd
import kotlinx.coroutines.delay

@Composable
internal fun MartProductAdCard(
    ad: MartProductAd,
    onOpenProduct: (String) -> Unit,
    onViewed: (MartProductAd) -> Unit,
    modifier: Modifier = Modifier,
) {
    val view = LocalView.current
    var sufficientlyVisible by remember(ad.adId) { mutableStateOf(false) }
    var impressionSent by remember(ad.adId) { mutableStateOf(false) }

    LaunchedEffect(sufficientlyVisible, ad.adId) {
        if (!sufficientlyVisible || impressionSent) return@LaunchedEffect
        delay(MART_AD_IMPRESSION_VISIBLE_MILLIS)
        impressionSent = true
        onViewed(ad)
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .testTag("mart-product-ad")
            .onGloballyPositioned { coordinates ->
                val bounds = coordinates.boundsInWindow(clipBounds = true)
                val viewportHeight = view.height.toFloat()
                val visibleHeight = (minOf(bounds.bottom, viewportHeight) - maxOf(bounds.top, 0f)).coerceAtLeast(0f)
                sufficientlyVisible = coordinates.size.height > 0 &&
                    visibleHeight / coordinates.size.height >= MART_AD_VISIBLE_FRACTION
            },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(ad.advertiserName, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (ad.verifiedBusiness) Text("Verified business", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.weight(1f))
                Text(ad.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row {
                AsyncImage(
                    model = ad.imageUrl,
                    contentDescription = null,
                    modifier = Modifier.size(84.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceContainerHighest),
                    contentScale = ContentScale.Crop,
                )
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(ad.headline, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    if (ad.primaryText.isNotBlank()) Text(ad.primaryText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            Button(onClick = { onOpenProduct(ad.productId) }, modifier = Modifier.fillMaxWidth().height(40.dp)) {
                Text(ad.callToAction.replace('_', ' ').replaceFirstChar(Char::uppercase))
            }
        }
    }
}

private const val MART_AD_VISIBLE_FRACTION = 0.5f
private const val MART_AD_IMPRESSION_VISIBLE_MILLIS = 1_000L
