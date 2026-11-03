package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.nantty.android.data.FeedMedia
import kotlinx.coroutines.launch

@Composable
internal fun PostDetailImage(media: FeedMedia, imageIndex: Int, imageCount: Int, onOpen: () -> Unit) {
    val ratio = media.width?.toFloat()?.div(media.height?.toFloat() ?: 0f)
        ?.takeIf { it.isFinite() && it in 0.5f..2.2f } ?: 1.5f
    Box(
        Modifier.fillMaxWidth().padding(top = 10.dp).aspectRatio(ratio)
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(role = Role.Button, onClick = onOpen)
            .semantics { contentDescription = "Open image ${imageIndex + 1} of $imageCount full screen" },
    ) {
        AsyncImage(
            model = media.url,
            contentDescription = "Image ${imageIndex + 1} of $imageCount",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
        )
    }
}

@Composable
internal fun PostDetailImageViewer(images: List<FeedMedia>, initialIndex: Int, onDismiss: () -> Unit) {
    if (images.isEmpty()) return
    val pagerState = rememberPagerState(initialPage = initialIndex.coerceIn(images.indices), pageCount = { images.size })
    val scope = rememberCoroutineScope()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        BoxWithConstraints(Modifier.fillMaxSize().background(Color.Black)) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize(),
            ) { page ->
                AsyncImage(
                    model = images[page].url,
                    contentDescription = "Full-screen image ${page + 1} of ${images.size}",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit,
                )
            }

            Surface(
                modifier = Modifier.align(Alignment.TopCenter).padding(16.dp),
                shape = CircleShape,
                color = Color.Black.copy(alpha = 0.72f),
            ) {
                Text(
                    "${pagerState.currentPage + 1} of ${images.size}",
                    Modifier.padding(horizontal = 16.dp, vertical = 10.dp).semantics {
                        contentDescription = "Image ${pagerState.currentPage + 1} of ${images.size}"
                        liveRegion = LiveRegionMode.Polite
                    },
                    color = Color.White,
                    style = MaterialTheme.typography.labelLarge,
                )
            }

            IconButton(
                onClick = onDismiss,
                modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)
                    .background(Color.Black.copy(alpha = 0.72f), CircleShape)
                    .semantics { contentDescription = "Close image viewer" },
            ) { Icon(Icons.Default.Close, contentDescription = null, tint = Color.White) }

            if (images.size > 1) {
                IconButton(
                    onClick = { scope.launch { pagerState.animateScrollToPage(pagerState.currentPage - 1) } },
                    enabled = pagerState.currentPage > 0,
                    modifier = Modifier.align(Alignment.CenterStart).padding(8.dp)
                        .background(Color.Black.copy(alpha = 0.72f), CircleShape)
                        .semantics { contentDescription = "Show previous image" },
                ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Color.White) }
                IconButton(
                    onClick = { scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) } },
                    enabled = pagerState.currentPage < images.lastIndex,
                    modifier = Modifier.align(Alignment.CenterEnd).padding(8.dp)
                        .background(Color.Black.copy(alpha = 0.72f), CircleShape)
                        .semantics { contentDescription = "Show next image" },
                ) { Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Color.White) }
            }
        }
    }
}
