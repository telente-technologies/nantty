package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import com.nantty.android.data.SharedContentCard
import com.nantty.android.data.SharedContentReference
import com.nantty.android.data.SharedContentResult

@Composable
internal fun FeedSharedContentCard(
    reference: SharedContentReference,
    resolve: ((SharedContentReference, (SharedContentResult) -> Unit) -> Unit)?,
    onOpen: ((SharedContentCard) -> Unit)?,
    onRequireSignInWithAction: ((() -> Unit) -> Unit),
) {
    var result by remember(reference) {
        mutableStateOf<SharedContentResult?>(null)
    }
    LaunchedEffect(reference, resolve != null) {
        if (resolve != null) resolve(reference) { result = it }
        else result = SharedContentResult.AuthenticationRequired
    }
    val card = (result as? SharedContentResult.Success)?.card
    if (card == null) {
        val loading = result == null
        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp).testTag("feed-shared-content-card"),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        ) {
            Text(
                when {
                    loading -> "Loading Nantty link…"
                    result == SharedContentResult.AuthenticationRequired -> "Sign in to preview this Nantty link"
                    else -> "This Nantty link is unavailable"
                },
                Modifier
                    .fillMaxWidth()
                    .then(
                        if (result == SharedContentResult.AuthenticationRequired) {
                            Modifier.clickable {
                                onRequireSignInWithAction {
                                    resolve?.invoke(reference) { next -> result = next }
                                }
                            }
                        } else Modifier
                    )
                    .padding(14.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        return
    }
    val available = card.availability == "available"
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .testTag("feed-shared-content-card")
            .clickable(enabled = available && onOpen != null) { onOpen?.invoke(card) }
            .semantics { contentDescription = "${card.title ?: "Nantty content"}${card.subtitle?.let { ", $it" }.orEmpty()}" },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth()) {
            card.imageUrl?.let { image ->
                AsyncImage(
                    model = image,
                    contentDescription = null,
                    modifier = if (reference.kind == "profile") Modifier.padding(12.dp).clip(CircleShape).fillMaxWidth(0.22f).aspectRatio(1f)
                    else Modifier.fillMaxWidth().aspectRatio(1.91f),
                    contentScale = ContentScale.Crop,
                )
            }
            Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                if (card.isLive) {
                    Row {
                        Text("LIVE", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                        card.viewerCount?.let { Text("  ·  $it watching", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary) }
                    }
                }
                Text(
                    when {
                        card.availability == "private" && reference.kind == "space" -> "Private Space"
                        !available -> "This content is unavailable"
                        else -> card.title ?: reference.kind.replaceFirstChar(Char::uppercase)
                    },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                card.subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                card.priceLabel?.let { price ->
                    Text(
                        price + (card.stock?.let { if (it > 0) " · $it in stock" else " · Out of stock" }.orEmpty()),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
    }
}
