package com.nantty.android.ui.clips

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.PersonAddAlt1
import androidx.compose.material.icons.filled.PersonRemove
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.ClipFeedItem
import com.nantty.android.data.ClipWatchTrackingRepository
import java.util.concurrent.Executor

@Composable
internal fun ClipPagerPage(
    item: ClipFeedItem,
    active: Boolean,
    liked: Boolean,
    saved: Boolean,
    following: Boolean,
    muted: Boolean,
    actionPending: Boolean,
    onToggleMute: () -> Unit,
    onToggleLike: () -> Unit,
    onToggleSave: () -> Unit,
    onOpenComments: () -> Unit,
    onShare: () -> Unit,
    onOpenProfile: () -> Unit,
    onToggleFollow: () -> Unit,
    watchTrackingRepository: ClipWatchTrackingRepository,
    trackingExecutor: Executor,
    modifier: Modifier = Modifier,
) {
    val video = item.post.media.firstOrNull { it.type == "video" }
    val onPlaybackPosition = ClipWatchTrackingEffect(item, active, watchTrackingRepository, trackingExecutor)
    Box(modifier.fillMaxSize().background(Color.Black).testTag("clip-page-${item.post.id}")) {
        if (item.viewerHasAccess && active && video != null) {
            ClipVideoPlayer(video.url, muted, active, Modifier.fillMaxSize(), onPlaybackPosition = onPlaybackPosition)
        } else {
            val poster = video?.posterUrl ?: video?.url ?: item.post.media.firstOrNull()?.url
            if (item.viewerHasAccess && poster != null) {
                AsyncImage(
                    model = poster,
                    contentDescription = "Preview of ${item.post.authorName}'s clip",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            }
        }
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.18f)))

        if (!item.viewerHasAccess) {
            Column(
                Modifier.align(Alignment.Center).padding(horizontal = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Subscriber-only clip", color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("Subscribe to this creator to watch this clip.", color = Color.White.copy(alpha = 0.86f), style = MaterialTheme.typography.bodyMedium)
            }
        }

        Column(
            Modifier.align(Alignment.CenterEnd).padding(end = 10.dp, bottom = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            ClipActionButton(if (liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder, if (liked) "Unlike clip" else "Like clip", onToggleLike, actionPending, liked)
            val likeCount = (item.post.likes + when {
                liked && !item.post.liked -> 1
                !liked && item.post.liked -> -1
                else -> 0
            }).coerceAtLeast(0)
            Text(likeCount.toString(), color = Color.White, style = MaterialTheme.typography.labelSmall)
            Spacer(Modifier.size(10.dp))
            ClipActionButton(Icons.Outlined.ChatBubbleOutline, "Open ${item.post.comments} comments", onOpenComments)
            Text(item.post.comments.toString(), color = Color.White, style = MaterialTheme.typography.labelSmall)
            Spacer(Modifier.size(10.dp))
            ClipActionButton(Icons.Default.Share, "Share clip", onShare)
            Spacer(Modifier.size(10.dp))
            ClipActionButton(if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, if (saved) "Remove clip from saved" else "Save clip", onToggleSave, actionPending, saved)
            Spacer(Modifier.size(10.dp))
            ClipActionButton(if (muted) Icons.Default.VolumeOff else Icons.Default.VolumeUp, if (muted) "Unmute clips" else "Mute clips", onToggleMute)
        }

        Column(
            Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(start = 16.dp, end = 78.dp, bottom = 18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    Modifier.size(42.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.18f))
                        .clickable(onClick = onOpenProfile),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(item.post.authorName.firstOrNull()?.uppercase() ?: "N", color = Color.White, fontWeight = FontWeight.Bold)
                    item.post.avatarUrl?.let { AsyncImage(it, contentDescription = null, modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop) }
                }
                Column(Modifier.weight(1f).clickable(onClick = onOpenProfile)) {
                    Text(item.post.authorName, color = Color.White, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("@${item.post.username}", color = Color.White.copy(alpha = 0.82f), style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (!following && item.post.authorId.isNotBlank()) {
                    Surface(
                        onClick = onToggleFollow,
                        enabled = !actionPending,
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.semantics { contentDescription = "Follow ${item.post.username}" },
                    ) {
                        Icon(Icons.Default.PersonAddAlt1, contentDescription = null, modifier = Modifier.padding(9.dp).size(18.dp))
                    }
                } else if (following && item.post.authorId.isNotBlank()) {
                    IconButton(onClick = onToggleFollow, enabled = !actionPending, modifier = Modifier.semantics { contentDescription = "Unfollow ${item.post.username}" }) {
                        Icon(Icons.Default.PersonRemove, contentDescription = null, tint = Color.White)
                    }
                }
            }
            if (item.post.text.isNotBlank()) {
                Text(item.post.text, color = Color.White, style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            item.sound?.let { Text("♫  ${it.title}", color = Color.White.copy(alpha = 0.9f), style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis) }
        }
    }
}

@Composable
private fun ClipActionButton(
    image: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    selected: Boolean = false,
) {
    IconButton(onClick = onClick, enabled = enabled, modifier = Modifier.semantics { contentDescription = label }) {
        Icon(image, contentDescription = null, tint = if (selected) MaterialTheme.colorScheme.primary else Color.White)
    }
}
