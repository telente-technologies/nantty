package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.separatingVerticalHingeBounds

internal data class SafePaneBounds(val leftPx: Float, val rightPx: Float) {
    val widthPx: Float get() = rightPx - leftPx
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

@Composable
internal fun HingeSafeContent(content: @Composable () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val density = LocalDensity.current
        val safePane = largestSafePaneBounds(
            windowWidthPx = with(density) { maxWidth.toPx() },
            hinges = currentWindowAdaptiveInfoV2().windowPosture.separatingVerticalHingeBounds,
        )

        if (safePane == null) {
            Box(Modifier.fillMaxSize()) { content() }
        } else {
            val left = with(density) { safePane.leftPx.toDp() }
            val width = with(density) { safePane.widthPx.toDp() }
            Box(Modifier.absoluteOffset(x = left).width(width).fillMaxHeight()) { content() }
        }
    }
}
