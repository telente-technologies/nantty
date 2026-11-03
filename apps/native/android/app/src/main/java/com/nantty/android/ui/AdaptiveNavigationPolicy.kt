package com.nantty.android.ui

import androidx.window.core.layout.WindowHeightSizeClass
import androidx.window.core.layout.WindowWidthSizeClass

internal fun shouldUseNavigationRail(
    widthClass: WindowWidthSizeClass,
    heightClass: WindowHeightSizeClass,
    isTabletop: Boolean,
): Boolean {
    val hasRoomForRail = widthClass == WindowWidthSizeClass.MEDIUM ||
        widthClass == WindowWidthSizeClass.EXPANDED
    val hasVerticalRoom = heightClass != WindowHeightSizeClass.COMPACT

    return hasRoomForRail && hasVerticalRoom && !isTabletop
}
