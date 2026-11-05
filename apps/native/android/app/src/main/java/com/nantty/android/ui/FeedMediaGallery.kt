package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.nantty.android.data.FeedMedia
import kotlinx.coroutines.launch

@Composable
internal fun FeedMediaGallery(media: List<FeedMedia>) {
    if (media.isEmpty()) return

    val pagerState = rememberPagerState(pageCount = { media.size })
    val scope = rememberCoroutineScope()
    val images = remember(media) { media.filter { it.type == "image" } }
    var previewImageIndex by remember(media) { mutableIntStateOf(-1) }

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
                VideoPreview(item, Modifier.fillMaxSize())
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
            onDismiss = { previewImageIndex = -1 },
        )
    }
}

@Composable
private fun VideoPreview(media: FeedMedia, modifier: Modifier = Modifier) {
    Box(
        modifier.clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
            .clearAndSetSemantics {
                contentDescription = if (media.posterUrl.isNullOrBlank()) {
                    "Video preview. No thumbnail is available, and playback is not available in this app yet."
                } else {
                    "Video thumbnail. Playback is not available in this app yet."
                }
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
            Text(
                "Video · playback unavailable",
                Modifier.padding(top = 4.dp).background(Color.Black.copy(alpha = 0.72f), RoundedCornerShape(6.dp)).padding(horizontal = 10.dp, vertical = 6.dp),
                color = Color.White,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun FeedImagePreviewDialog(images: List<FeedMedia>, initialIndex: Int, onDismiss: () -> Unit) {
    val pagerState = rememberPagerState(initialPage = initialIndex, pageCount = { images.size })
    val scope = rememberCoroutineScope()

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = true)) {
        Surface(
            Modifier.fillMaxWidth().widthIn(max = 720.dp),
            shape = MaterialTheme.shapes.extraLarge,
            color = Color.Black,
        ) {
            Column(Modifier.padding(12.dp)) {
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
                Box(Modifier.fillMaxWidth().heightIn(min = 240.dp, max = 560.dp)) {
                    HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                        AsyncImage(
                            model = images[page].url,
                            contentDescription = "Photo ${page + 1} of ${images.size}",
                            modifier = Modifier.fillMaxSize().semantics { contentDescription = "Full-size photo ${page + 1} of ${images.size}" },
                            contentScale = ContentScale.Fit,
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
            }
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
