package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.FeedQuotedPost

@Composable
internal fun FeedQuotedPostCard(
    quotedPost: FeedQuotedPost?,
    unavailable: Boolean,
    onOpen: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    if (quotedPost == null) {
        if (unavailable) {
            Text(
                "This post is unavailable.",
                modifier.fillMaxWidth().padding(top = 10.dp).clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant).padding(12.dp)
                    .semantics { contentDescription = "Quoted post unavailable" },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        return
    }

    Column(
        modifier
            .fillMaxWidth()
            .padding(top = 10.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .then(onOpen?.let { open -> Modifier.clickable(role = Role.Button) { open(quotedPost.id) } } ?: Modifier)
            .testTag("feed-quoted-post")
            .semantics { contentDescription = "Quoted post by ${quotedPost.authorName}: ${quotedPost.text}" }
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                Modifier.size(22.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(quotedPost.authorName.firstOrNull()?.uppercase() ?: "N", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                quotedPost.avatarUrl?.let { avatar ->
                    AsyncImage(avatar, contentDescription = null, modifier = Modifier.size(22.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                }
            }
            Text(quotedPost.authorName, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            if (quotedPost.verified) {
                val badgeColor = quotedPost.verificationColor ?: "blue"
                Icon(
                    Icons.Default.Verified,
                    contentDescription = when (badgeColor) {
                        "gold" -> "Verified business"
                        "black" -> "Official government account"
                        else -> "Verified account"
                    },
                    tint = when (badgeColor) {
                        "gold" -> androidx.compose.ui.graphics.Color(0xFFB7791F)
                        "black" -> MaterialTheme.colorScheme.onSurface
                        else -> MaterialTheme.colorScheme.primary
                    },
                    modifier = Modifier.size(14.dp),
                )
            }
            if (quotedPost.username.isNotBlank()) {
                Text("@${quotedPost.username}", color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (!quotedPost.text.isBlank()) {
                Text(
                    quotedPost.text,
                    Modifier.weight(1f),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            quotedPost.thumbnailUrl?.let { imageUrl ->
                AsyncImage(
                    model = imageUrl,
                    contentDescription = "Quoted post media",
                    modifier = Modifier.size(72.dp).clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop,
                )
            }
        }
    }
}
