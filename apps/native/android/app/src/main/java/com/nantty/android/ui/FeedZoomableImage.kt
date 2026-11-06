package com.nantty.android.ui

import androidx.compose.foundation.gestures.TransformableState
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntSize
import coil.compose.AsyncImage
import kotlin.math.max
import kotlin.math.min

private const val FEED_IMAGE_ZOOM_SCALE = 2.5f
private const val FEED_IMAGE_MAX_SCALE = 4f

/** Full-size feed image with the same double-tap zoom, drag-to-pan and fit/close behavior as RN. */
@Composable
internal fun FeedZoomableImage(
    imageUrl: String?,
    sourceSize: IntSize?,
    isActive: Boolean,
    onZoomChanged: (Boolean) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var scale by remember(imageUrl) { mutableFloatStateOf(1f) }
    var offset by remember(imageUrl) { mutableStateOf(Offset.Zero) }
    var containerSize by remember(imageUrl) { mutableStateOf(IntSize.Zero) }

    fun resetZoom() {
        scale = 1f
        offset = Offset.Zero
        onZoomChanged(false)
    }

    fun zoomAt(position: Offset) {
        val nextScale = if (scale > 1f) 1f else FEED_IMAGE_ZOOM_SCALE
        if (nextScale == 1f) {
            resetZoom()
        } else {
            val center = Offset(containerSize.width / 2f, containerSize.height / 2f)
            scale = nextScale
            offset = clampFeedImageOffset((center - position) * (nextScale - 1f), nextScale, containerSize, sourceSize)
            onZoomChanged(true)
        }
    }

    val transformState: TransformableState = rememberTransformableState { centroid, zoomChange, panChange, _ ->
        val nextScale = (scale * zoomChange).coerceIn(1f, FEED_IMAGE_MAX_SCALE)
        val scaleRatio = nextScale / scale
        val wasZoomed = scale > 1f
        scale = nextScale
        offset = if (nextScale <= 1f) {
            Offset.Zero
        } else {
            clampFeedImageOffset(
                (offset + centroid) * scaleRatio - centroid + panChange,
                nextScale,
                containerSize,
                sourceSize,
            )
        }
        if (wasZoomed != (nextScale > 1f)) onZoomChanged(nextScale > 1f)
    }

    LaunchedEffect(isActive, imageUrl) {
        if (!isActive) resetZoom()
    }

    Box(
        modifier
            .fillMaxSize()
            .onSizeChanged { containerSize = it }
            .transformable(state = transformState)
            .pointerInput(imageUrl, isActive) {
                detectTapGestures(
                    onDoubleTap = ::zoomAt,
                    onTap = { if (scale > 1f) resetZoom() else onDismiss() },
                )
            }
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                translationX = offset.x
                translationY = offset.y
            }
            .semantics {
                contentDescription = if (scale > 1f) "Zoomed photo; tap to fit" else "Photo; double tap to zoom, tap to close"
                onClick(label = if (scale > 1f) "Fit photo" else "Close photo") {
                    if (scale > 1f) resetZoom() else onDismiss()
                    true
                }
            }
            .testTag("feed-image-zoomable"),
    ) {
        if (!imageUrl.isNullOrBlank()) {
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        }
    }
}

internal fun clampFeedImageOffset(offset: Offset, scale: Float, viewportSize: IntSize, sourceSize: IntSize? = null): Offset {
    if (scale <= 1f || viewportSize == IntSize.Zero) return Offset.Zero
    val validSourceSize = sourceSize?.takeIf { it.width > 0 && it.height > 0 } ?: viewportSize
    val fitScale = min(
        viewportSize.width.toFloat() / validSourceSize.width,
        viewportSize.height.toFloat() / validSourceSize.height,
    )
    val fittedWidth = validSourceSize.width * fitScale
    val fittedHeight = validSourceSize.height * fitScale
    val maxX = max(0f, (fittedWidth * scale - viewportSize.width) / 2f)
    val maxY = max(0f, (fittedHeight * scale - viewportSize.height) / 2f)
    return Offset(offset.x.coerceIn(-maxX, maxX), offset.y.coerceIn(-maxY, maxY))
}
