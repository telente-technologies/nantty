package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.ui.AspectRatioFrameLayout
import coil.compose.AsyncImage
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.FeedPost
import com.nantty.android.ui.clips.ClipVideoPlayer
import com.nantty.android.share.copyPostLinkFromAndroid
import kotlinx.coroutines.launch

@Composable
internal fun FeedImagePreviewDialog(
    images: List<FeedMedia>,
    initialIndex: Int,
    post: FeedPost,
    onLike: (() -> Unit)?,
    onOpenComments: () -> Unit,
    onRepost: (() -> Unit)?,
    onSave: (() -> Unit)?,
    saveBusy: Boolean,
    onShare: (() -> Unit)?,
    onDismiss: () -> Unit,
) {
    val pagerState = rememberPagerState(initialPage = initialIndex, pageCount = { images.size })
    val scope = rememberCoroutineScope()
    val zoomedPages = remember { mutableStateMapOf<Int, Boolean>() }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            Modifier.fillMaxSize(),
            shape = RoundedCornerShape(0.dp),
            color = Color.Black,
        ) {
            Column(Modifier.fillMaxSize().padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Photo", Modifier.weight(1f), color = Color.White, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "${pagerState.currentPage + 1} of ${images.size}",
                        Modifier.semantics { contentDescription = "Photo ${pagerState.currentPage + 1} of ${images.size}" },
                        color = Color.White,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Spacer(Modifier.width(8.dp))
                    IconButton(onClick = onDismiss, modifier = Modifier.semantics { contentDescription = "Close image preview" }) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
                    }
                }
                Box(Modifier.fillMaxWidth().weight(1f)) {
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxSize(),
                        userScrollEnabled = zoomedPages[pagerState.currentPage] != true,
                    ) { page ->
                        FeedZoomableImage(
                            imageUrl = images[page].url,
                            sourceSize = images[page].width?.let { width ->
                                images[page].height?.let { height -> IntSize(width, height) }
                            },
                            isActive = pagerState.currentPage == page,
                            onZoomChanged = { zoomed -> zoomedPages[page] = zoomed },
                            onDismiss = onDismiss,
                        )
                    }
                    if (images.size > 1) {
                        IconButton(
                            onClick = { scope.launch { pagerState.scrollToPage(pagerState.currentPage - 1) } },
                            enabled = pagerState.currentPage > 0,
                            modifier = Modifier.align(Alignment.CenterStart).background(Color.Black.copy(alpha = 0.66f), CircleShape)
                                .semantics { contentDescription = "Show previous photo" },
                        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Color.White) }
                        IconButton(
                            onClick = { scope.launch { pagerState.scrollToPage(pagerState.currentPage + 1) } },
                            enabled = pagerState.currentPage < images.lastIndex,
                            modifier = Modifier.align(Alignment.CenterEnd).background(Color.Black.copy(alpha = 0.66f), CircleShape)
                                .semantics { contentDescription = "Show next photo" },
                        ) { Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Color.White) }
                    }
                }
                FeedMediaActionBar(post, onLike, onOpenComments, onRepost, onSave, saveBusy, onShare)
            }
        }
    }
}

@Composable
@androidx.media3.common.util.UnstableApi
internal fun FeedVideoPreviewDialog(
    media: FeedMedia,
    post: FeedPost,
    onLike: (() -> Unit)?,
    onOpenComments: () -> Unit,
    onRepost: (() -> Unit)?,
    onSave: (() -> Unit)?,
    saveBusy: Boolean,
    onShare: (() -> Unit)?,
    onDismiss: () -> Unit,
) {
    var isMuted by remember(media.url) { mutableStateOf(true) }
    var isPaused by remember(media.url) { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            Modifier.fillMaxSize(),
            shape = RoundedCornerShape(0.dp),
            color = Color.Black,
        ) {
            Column(Modifier.fillMaxSize().padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Video", Modifier.weight(1f), color = Color.White, style = MaterialTheme.typography.titleMedium)
                    IconButton(
                        onClick = { isMuted = !isMuted },
                        modifier = Modifier.semantics { contentDescription = if (isMuted) "Unmute video" else "Mute video" },
                    ) {
                        Icon(if (isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp, contentDescription = null, tint = Color.White)
                    }
                    IconButton(
                        onClick = { isPaused = !isPaused },
                        modifier = Modifier.semantics { contentDescription = if (isPaused) "Play video" else "Pause video" },
                    ) {
                        Icon(if (isPaused) Icons.Default.PlayArrow else Icons.Default.Pause, contentDescription = null, tint = Color.White)
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.semantics { contentDescription = "Close video preview" }) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
                    }
                }
                Box(
                    Modifier.fillMaxWidth().weight(1f)
                        .clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center,
                ) {
                    if (media.url.isNotBlank()) {
                        ClipVideoPlayer(
                            videoUrl = media.url,
                            muted = isMuted,
                            isActive = !isPaused,
                            modifier = Modifier.fillMaxSize(),
                            loop = true,
                            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT,
                        )
                    } else if (!media.posterUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = media.posterUrl,
                            contentDescription = "Video thumbnail",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit,
                        )
                    }
                    if (media.url.isBlank()) {
                        Text(
                            "Video playback is unavailable",
                            Modifier.align(Alignment.BottomCenter).padding(12.dp)
                                .background(Color.Black.copy(alpha = 0.72f), RoundedCornerShape(6.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                                .semantics { contentDescription = "Video playback unavailable" },
                            color = Color.White,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
                FeedMediaActionBar(post, onLike, onOpenComments, onRepost, onSave, saveBusy, onShare)
            }
        }
    }
}

@Composable
private fun FeedMediaActionBar(
    post: FeedPost,
    onLike: (() -> Unit)?,
    onOpenComments: () -> Unit,
    onRepost: (() -> Unit)?,
    onSave: (() -> Unit)?,
    saveBusy: Boolean,
    onShare: (() -> Unit)?,
) {
    var shareMenuExpanded by remember(post.id) { mutableStateOf(false) }
    val context = LocalContext.current
    Row(
        Modifier.fillMaxWidth().padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onLike != null) Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            IconButton(
                onClick = onLike,
                modifier = Modifier.testTag("feed-media-like").semantics {
                    contentDescription = if (post.liked) "Unlike post" else "Like post"
                },
            ) {
                Icon(
                    if (post.liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = null,
                    tint = if (post.liked) MaterialTheme.colorScheme.error else Color.White,
                )
            }
            Text(post.likes.toString(), color = Color.White, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            IconButton(
                onClick = onOpenComments,
                modifier = Modifier.testTag("feed-media-comments").semantics {
                    contentDescription = "Open ${post.comments} comments"
                },
            ) {
                Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = null, tint = Color.White)
            }
            Text(post.comments.toString(), color = Color.White, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
        if (onRepost != null) Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            IconButton(
                onClick = onRepost,
                modifier = Modifier.testTag("feed-media-repost").semantics {
                    contentDescription = if (post.reposted) "Undo repost" else "Repost"
                },
            ) {
                Icon(
                    Icons.Default.Repeat,
                    contentDescription = null,
                    tint = if (post.reposted) MaterialTheme.colorScheme.primary else Color.White,
                )
            }
            Text(post.reposts.toString(), color = Color.White, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
        if (onSave != null) Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            IconButton(
                onClick = onSave,
                enabled = !saveBusy,
                modifier = Modifier.testTag("feed-media-save").semantics {
                    contentDescription = if (saveBusy) "Saving post" else if (post.bookmarked) "Remove post from saved" else "Save post"
                    selected = post.bookmarked
                },
            ) {
                Icon(
                    if (post.bookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                    contentDescription = null,
                    tint = if (post.bookmarked) MaterialTheme.colorScheme.primary else Color.White,
                )
            }
            Text(
                if (post.bookmarked) "Saved" else "Save",
                color = Color.White,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
            )
        }
        if (onShare != null) Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            Box {
                IconButton(
                    onClick = { shareMenuExpanded = true },
                    modifier = Modifier.testTag("feed-media-share").semantics { contentDescription = "Share post" },
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = Color.White)
                }
                DropdownMenu(expanded = shareMenuExpanded, onDismissRequest = { shareMenuExpanded = false }) {
                    DropdownMenuItem(
                        text = { Text(androidx.compose.ui.res.stringResource(com.nantty.android.R.string.feed_copy_link)) },
                        modifier = Modifier.testTag("feed-media-copy-link"),
                        onClick = {
                            shareMenuExpanded = false
                            copyPostLinkFromAndroid(context, post.id)
                        },
                    )
                    DropdownMenuItem(
                        text = { Text(androidx.compose.ui.res.stringResource(com.nantty.android.R.string.feed_share_link)) },
                        modifier = Modifier.testTag("feed-media-share-link"),
                        onClick = {
                            shareMenuExpanded = false
                            onShare()
                        },
                    )
                }
            }
            Text(
                post.shares.toString(),
                color = Color.White,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
                modifier = Modifier.semantics { contentDescription = "${post.shares} shares" },
            )
        }
    }
}
