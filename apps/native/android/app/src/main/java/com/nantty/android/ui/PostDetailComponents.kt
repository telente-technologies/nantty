package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.PostDetail
import com.nantty.android.data.ThreadComment
import com.nantty.android.data.extractSafePostLinks
import java.net.URI

@Composable
internal fun PostDetailCard(
    post: PostDetail,
    canInteract: Boolean,
    interactionBusy: Boolean,
    interactionError: String?,
    onOpenLink: (String) -> Unit,
    onShare: (PostDetail) -> Unit,
    onLike: () -> Unit,
    onRepost: () -> Unit,
    onSave: () -> Unit,
) {
    val images = remember(post.media) { post.media.filter { it.type == "image" } }
    var previewImageIndex by remember(post.id) { mutableIntStateOf(-1) }
    Surface(Modifier.fillMaxWidth().padding(12.dp), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp) {
        Column(Modifier.padding(18.dp)) {
            Text(post.authorName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            if (post.username.isNotBlank()) Text("@${post.username}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (post.text.isNotBlank()) Text(post.text, Modifier.padding(top = 14.dp), style = MaterialTheme.typography.bodyLarge)
            PostExternalLinkActions(post.text, onOpenLink)
            var imageIndex = 0
            post.media.forEach { media ->
                if (media.type == "image") {
                    val selectedImageIndex = imageIndex++
                    PostDetailImage(media, selectedImageIndex, images.size) { previewImageIndex = selectedImageIndex }
                } else {
                    ThreadMedia(media)
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (canInteract) {
                    IconButton(onClick = onLike, enabled = !interactionBusy, modifier = Modifier.semantics {
                        contentDescription = "${if (post.liked) "Unlike post" else "Like post"}, ${post.likes}"
                        selected = post.liked
                    }) {
                        Icon(if (post.liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder, contentDescription = null, tint = if (post.liked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary)
                    }
                    Text("${post.likes}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                    Spacer(Modifier.width(12.dp))
                    IconButton(onClick = onRepost, enabled = !interactionBusy, modifier = Modifier.semantics {
                        contentDescription = "${if (post.reposted) "Undo repost" else "Repost"}, ${post.reposts}"
                        selected = post.reposted
                    }) {
                        Icon(Icons.Default.Repeat, contentDescription = null, tint = if (post.reposted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary)
                    }
                    Text("${post.reposts}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                    IconButton(onClick = onSave, enabled = !interactionBusy, modifier = Modifier.semantics {
                        contentDescription = if (post.bookmarked) "Remove post from saved" else "Save post"
                        selected = post.bookmarked
                    }) {
                        Icon(if (post.bookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = null, tint = if (post.bookmarked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary)
                    }
                } else {
                    Text("${post.likes} likes · ${post.reposts} reposts", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                }
                Spacer(Modifier.width(12.dp))
                Text("${post.comments} replies", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                Spacer(Modifier.width(8.dp))
                IconButton(onClick = { onShare(post) }, modifier = Modifier.semantics { contentDescription = "Share post" }) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                }
            }
            interactionError?.let { Text(it, Modifier.padding(top = 4.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        }
    }
    if (previewImageIndex in images.indices) {
        PostDetailImageViewer(images, previewImageIndex) { previewImageIndex = -1 }
    }
}

@Composable
internal fun ThreadCommentRow(
    comment: ThreadComment,
    depth: Int = 0,
    canReply: Boolean = false,
    canLike: Boolean = false,
    likeBusyIds: Set<String> = emptySet(),
    likeErrors: Map<String, String> = emptyMap(),
    onReply: (ThreadComment) -> Unit = {},
    onToggleLike: (ThreadComment) -> Unit = {},
    onOpenLink: (String) -> Unit = {},
    highlightCommentId: String? = null,
) {
    Column(Modifier.fillMaxWidth().padding(start = (depth.coerceAtMost(4) * 16).dp, end = 12.dp, top = 4.dp, bottom = 4.dp)) {
        Surface(
            Modifier.fillMaxWidth().testTag("comment-${comment.id}").semantics {
                contentDescription = "Reply by ${comment.authorName}${if (comment.username.isNotBlank()) ", @${comment.username}" else ""}, depth ${comment.depth}"
            },
            shape = RoundedCornerShape(14.dp),
            color = if (comment.id == highlightCommentId) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        ) {
            Column(Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    comment.avatarUrl?.let { url ->
                        AsyncImage(url, "${comment.authorName} profile photo", Modifier.width(34.dp).height(34.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                        Spacer(Modifier.width(10.dp))
                    }
                    Column {
                        Text(comment.authorName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (comment.username.isNotBlank()) Text("@${comment.username}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Text(comment.text, Modifier.fillMaxWidth().padding(top = 9.dp), style = MaterialTheme.typography.bodyMedium)
                PostExternalLinkActions(comment.text, onOpenLink)
                comment.media.forEach { ThreadMedia(it) }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (canLike) {
                        IconButton(
                            onClick = { onToggleLike(comment) },
                            enabled = comment.id !in likeBusyIds,
                            modifier = Modifier
                                .testTag("like-comment-${comment.id}")
                                .semantics {
                                    contentDescription = "${if (comment.liked) "Unlike" else "Like"} comment, ${comment.likes}"
                                    selected = comment.liked
                                },
                        ) {
                            Icon(
                                if (comment.liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                contentDescription = null,
                                tint = if (comment.liked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary,
                            )
                        }
                        Text("${comment.likes}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        Text("${comment.likes} likes", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(" · ${comment.replyCount} replies", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                likeErrors[comment.id]?.let { error ->
                    Text(error, Modifier.testTag("like-error-${comment.id}"), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                if (canReply) TextButton(onClick = { onReply(comment) }, modifier = Modifier.testTag("reply-${comment.id}")) { Text("Reply") }
            }
        }
        comment.replies.forEach { reply ->
            ThreadCommentRow(
                comment = reply,
                depth = depth + 1,
                canReply = canReply,
                canLike = canLike,
                likeBusyIds = likeBusyIds,
                likeErrors = likeErrors,
                onReply = onReply,
                onToggleLike = onToggleLike,
                onOpenLink = onOpenLink,
                highlightCommentId = highlightCommentId,
            )
        }
    }
}

@Composable
internal fun PostExternalLinkActions(text: String, onOpenLink: (String) -> Unit) {
    val links = remember(text) { com.nantty.android.data.extractSafePostLinks(text) }
    links.forEach { url ->
        val host = runCatching { URI(url).host }.getOrNull() ?: return@forEach
        TextButton(
            onClick = { onOpenLink(url) },
            modifier = Modifier.semantics { contentDescription = "Open link to $host" },
        ) {
            Text(host, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
internal fun ThreadMedia(media: FeedMedia) {
    val imageUrl = if (media.type == "video") media.posterUrl ?: media.url else media.url
    AsyncImage(
        model = imageUrl,
        contentDescription = if (media.type == "video") "Video reply preview" else "Attached image",
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp).aspectRatio(
            media.width?.toFloat()?.div(media.height?.toFloat() ?: 0f)?.takeIf { it.isFinite() && it in 0.5f..2.2f } ?: 1.5f,
        ).clip(RoundedCornerShape(12.dp)),
        contentScale = ContentScale.Crop,
    )
}

