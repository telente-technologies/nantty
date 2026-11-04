package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.separatingHorizontalHingeBounds
import androidx.compose.material3.adaptive.separatingVerticalHingeBounds

internal data class SafePaneBounds(val leftPx: Float, val rightPx: Float) {
    val widthPx: Float get() = rightPx - leftPx
}

internal data class SafeContentBounds(
    val leftPx: Float,
    val topPx: Float,
    val rightPx: Float,
    val bottomPx: Float,
) {
    val widthPx: Float get() = rightPx - leftPx
    val heightPx: Float get() = bottomPx - topPx
}

/** Finds the largest contiguous window region that does not overlap a separating hinge. */
internal fun largestSafeContentBounds(
    windowWidthPx: Float,
    windowHeightPx: Float,
    hinges: List<Rect>,
): SafeContentBounds? {
    if (!windowWidthPx.isFinite() || windowWidthPx <= 0f || !windowHeightPx.isFinite() || windowHeightPx <= 0f) {
        return null
    }

    val clipped = hinges.mapNotNull { hinge ->
        val left = hinge.left.coerceIn(0f, windowWidthPx)
        val top = hinge.top.coerceIn(0f, windowHeightPx)
        val right = hinge.right.coerceIn(0f, windowWidthPx)
        val bottom = hinge.bottom.coerceIn(0f, windowHeightPx)
        SafeContentBounds(left, top, right, bottom).takeIf { it.widthPx > 0f && it.heightPx > 0f }
    }
    if (clipped.isEmpty()) return null

    val xEdges = (listOf(0f, windowWidthPx) + clipped.flatMap { listOf(it.leftPx, it.rightPx) }).distinct().sorted()
    val yEdges = (listOf(0f, windowHeightPx) + clipped.flatMap { listOf(it.topPx, it.bottomPx) }).distinct().sorted()
    val candidates = buildList {
        for (leftIndex in 0 until xEdges.lastIndex) {
            for (rightIndex in leftIndex + 1 until xEdges.size) {
                for (topIndex in 0 until yEdges.lastIndex) {
                    for (bottomIndex in topIndex + 1 until yEdges.size) {
                        add(SafeContentBounds(xEdges[leftIndex], yEdges[topIndex], xEdges[rightIndex], yEdges[bottomIndex]))
                    }
                }
            }
        }
    }
    return candidates
        .sortedByDescending { it.widthPx * it.heightPx }
        .firstOrNull { candidate ->
            clipped.none { hinge ->
                candidate.leftPx < hinge.rightPx && candidate.rightPx > hinge.leftPx &&
                    candidate.topPx < hinge.bottomPx && candidate.bottomPx > hinge.topPx
            }
        }
}

internal fun largestSafePaneBounds(windowWidthPx: Float, hinges: List<Rect>): SafePaneBounds? {
    if (!windowWidthPx.isFinite() || windowWidthPx <= 0f) return null

    val separators = hinges.mapNotNull { hinge ->
        val left = hinge.left.coerceIn(0f, windowWidthPx)
        val right = hinge.right.coerceIn(0f, windowWidthPx)
        if (right > left) SafePaneBounds(left, right) else null
    }.sortedBy(SafePaneBounds::leftPx)

    if (separators.isEmpty()) return null

    var paneStart = 0f
    var widest: SafePaneBounds? = null
    separators.forEach { hinge ->
        val gap = SafePaneBounds(paneStart, hinge.leftPx)
        if (gap.widthPx > (widest?.widthPx ?: 0f)) widest = gap
        paneStart = maxOf(paneStart, hinge.rightPx)
    }

    val trailingPane = SafePaneBounds(paneStart, windowWidthPx)
    if (trailingPane.widthPx > (widest?.widthPx ?: 0f)) widest = trailingPane
    return widest?.takeIf { it.widthPx > 0f }
}

/**
 * Hosts one app surface wholly inside the largest usable region when a
 * separating hinge splits the window. The unused region is intentional for current
 * callers: this API accepts one destination and invoking that destination in
 * both panes could duplicate remembered state, effects, and authenticated
 * requests. A future list/detail destination should provide two explicit pane
 * slots and divide them around the hinge instead of reusing this wrapper.
 */
@Composable
internal fun HingeSafeContent(content: @Composable () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val density = LocalDensity.current
        val safePane = largestSafeContentBounds(
            windowWidthPx = with(density) { maxWidth.toPx() },
            windowHeightPx = with(density) { maxHeight.toPx() },
            hinges = currentWindowAdaptiveInfoV2().windowPosture.let { posture ->
                posture.separatingVerticalHingeBounds + posture.separatingHorizontalHingeBounds
            },
        )

        if (safePane == null) {
            Box(Modifier.fillMaxSize()) { content() }
        } else {
            val left = with(density) { safePane.leftPx.toDp() }
            val top = with(density) { safePane.topPx.toDp() }
            val width = with(density) { safePane.widthPx.toDp() }
            val height = with(density) { safePane.heightPx.toDp() }
            Box(Modifier.absoluteOffset(x = left, y = top).width(width).height(height)) { content() }
        }
    }
}
