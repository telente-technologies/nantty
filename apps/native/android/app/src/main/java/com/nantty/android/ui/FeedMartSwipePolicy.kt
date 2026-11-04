package com.nantty.android.ui

import kotlin.math.abs

internal fun resolveFeedMartSwipeTarget(
    currentIsMart: Boolean,
    horizontalDragPx: Float,
    thresholdPx: Float,
): Boolean? {
    if (thresholdPx <= 0f || abs(horizontalDragPx) < thresholdPx) return null
    val targetIsMart = horizontalDragPx < 0f
    return targetIsMart.takeUnless { it == currentIsMart }
}
