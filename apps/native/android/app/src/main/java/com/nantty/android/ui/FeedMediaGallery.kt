package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.FeedPost
import kotlinx.coroutines.launch

@Composable
@androidx.annotation.OptIn(markerClass = [androidx.media3.common.util.UnstableApi::class])
internal fun FeedMediaGallery(
    media: List<FeedMedia>,
    post: FeedPost,
    onLike: (() -> Unit)?,
    onOpenComments: () -> Unit,
    onRepost: (() -> Unit)?,
    onSave: (() -> Unit)?,
    saveBusy: Boolean,
    onShare: (() -> Unit)?,
) {
    if (media.isEmpty()) return

    val pagerState = rememberPagerState(pageCount = { media.size })
    val scope = rememberCoroutineScope()
    val images = remember(media) { media.filter { it.type == "image" } }
    var previewImageIndex by remember(media) { mutableIntStateOf(-1) }
    var previewVideo by remember(media) { mutableStateOf<FeedMedia?>(null) }

    BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 14.dp)) {
        val ratio = media.firstNotNullOfOrNull(::mediaAspectRatio) ?: DEFAULT_MEDIA_RATIO
        val mediaHeight = (maxWidth / ratio).coerceIn(MIN_MEDIA_HEIGHT, MAX_MEDIA_HEIGHT)

        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().height(mediaHeight),
            userScrollEnabled = media.size > 1,
        ) { page ->
            val item = media[page]
            if (item.type == "image") {
                val imageIndex = imageIndexForMediaPage(media, page) ?: 0
                Box(
                    Modifier.fillMaxSize().clip(RoundedCornerShape(14.dp))
                        .clickable(role = Role.Button) { previewImageIndex = imageIndex }
                        .semantics { contentDescription = "Open image ${imageIndex + 1} of ${images.size} full screen" },
                ) {
                    AsyncImage(
                        model = item.url,
                        contentDescription = "Image ${imageIndex + 1} of ${images.size}",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                    Box(Modifier.align(Alignment.BottomEnd).padding(10.dp).background(Color.Black.copy(alpha = 0.72f), CircleShape).padding(12.dp)) {
                        Icon(Icons.Default.OpenInFull, contentDescription = null, tint = Color.White)
                    }
                }
            } else {
                VideoPreview(item, Modifier.fillMaxSize()) { previewVideo = item }
            }
        }
    }

    if (media.size > 1) {
        Row(
            Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = { scope.launch { pagerState.scrollToPage(pagerState.currentPage - 1) } },
                enabled = pagerState.currentPage > 0,
                modifier = Modifier.semantics { contentDescription = "Show previous media" },
            ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null) }
            Text(
                "${pagerState.currentPage + 1} of ${media.size}",
                Modifier.semantics {
                    contentDescription = "Media ${pagerState.currentPage + 1} of ${media.size}"
                    liveRegion = LiveRegionMode.Polite
                },
                style = MaterialTheme.typography.labelMedium,
            )
            IconButton(
                onClick = { scope.launch { pagerState.scrollToPage(pagerState.currentPage + 1) } },
                enabled = pagerState.currentPage < media.lastIndex,
                modifier = Modifier.semantics { contentDescription = "Show next media" },
            ) { Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null) }
        }
    }

    if (previewImageIndex in images.indices) {
        FeedImagePreviewDialog(
            images = images,
            initialIndex = previewImageIndex,
            post = post,
            onLike = onLike,
            onOpenComments = {
                previewImageIndex = -1
                onOpenComments()
            },
            onRepost = {
                previewImageIndex = -1
                onRepost?.invoke()
            },
            onSave = onSave,
            saveBusy = saveBusy,
            onShare = onShare,
            onDismiss = { previewImageIndex = -1 },
        )
    }

    previewVideo?.let { video ->
        FeedVideoPreviewDialog(
            media = video,
            post = post,
            onLike = onLike,
            onOpenComments = {
                previewVideo = null
                onOpenComments()
            },
            onRepost = {
                previewVideo = null
                onRepost?.invoke()
            },
            onSave = onSave,
            saveBusy = saveBusy,
            onShare = onShare,
            onDismiss = { previewVideo = null },
        )
    }
}

@Composable
private fun VideoPreview(media: FeedMedia, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics {
                contentDescription = if (media.posterUrl.isNullOrBlank()) "Open video; no thumbnail is available" else "Open video"
            },
        contentAlignment = Alignment.Center,
    ) {
        if (!media.posterUrl.isNullOrBlank()) {
            AsyncImage(
                model = media.posterUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Default.PlayArrow,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.background(Color.Black.copy(alpha = 0.72f), CircleShape).padding(12.dp),
            )
            Text(
                "Play video",
                Modifier.padding(top = 8.dp).background(Color.Black.copy(alpha = 0.72f), RoundedCornerShape(6.dp)).padding(horizontal = 10.dp, vertical = 6.dp),
                color = Color.White,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

internal fun imageIndexForMediaPage(media: List<FeedMedia>, mediaIndex: Int): Int? {
    if (media.getOrNull(mediaIndex)?.type != "image") return null
    return media.take(mediaIndex + 1).count { it.type == "image" } - 1
}

private fun mediaAspectRatio(media: FeedMedia): Float? {
    val width = media.width?.toFloat() ?: return null
    val height = media.height?.toFloat() ?: return null
    return (width / height).takeIf { it.isFinite() && it in MIN_MEDIA_RATIO..MAX_MEDIA_RATIO }
}

private val DEFAULT_MEDIA_RATIO = 1.6f
private val MIN_MEDIA_RATIO = 0.55f
private val MAX_MEDIA_RATIO = 2.1f
private val MIN_MEDIA_HEIGHT = 200.dp
private val MAX_MEDIA_HEIGHT = 420.dp
