package com.nantty.android.ui

import androidx.window.core.layout.WindowSizeClass

internal fun shouldUseNavigationRail(
    windowSizeClass: WindowSizeClass,
    isTabletop: Boolean,
): Boolean {
    val hasRoomForRail = windowSizeClass.isWidthAtLeastBreakpoint(
        WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND,
    )
    val hasVerticalRoom = windowSizeClass.isHeightAtLeastBreakpoint(
        WindowSizeClass.HEIGHT_DP_MEDIUM_LOWER_BOUND,
    )

    return hasRoomForRail && hasVerticalRoom && !isTabletop
}

internal fun shouldShowMartCategoryPane(
    windowSizeClass: WindowSizeClass,
    isTabletop: Boolean,
    hasVerticalHinge: Boolean,
): Boolean = windowSizeClass.isWidthAtLeastBreakpoint(
    WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND,
) && !isTabletop && !hasVerticalHinge
