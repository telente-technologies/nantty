package com.nantty.android.ui

import androidx.window.core.layout.WindowHeightSizeClass
import androidx.window.core.layout.WindowWidthSizeClass
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdaptiveNavigationPolicyTest {
    @Test
    fun mediumWidthUsesRailWhenThereIsVerticalRoom() {
        assertTrue(
            shouldUseNavigationRail(
                WindowWidthSizeClass.MEDIUM,
                WindowHeightSizeClass.MEDIUM,
                isTabletop = false,
            ),
        )
    }

    @Test
    fun compactHeightKeepsBottomNavigationEvenAtExpandedWidth() {
        assertFalse(
            shouldUseNavigationRail(
                WindowWidthSizeClass.EXPANDED,
                WindowHeightSizeClass.COMPACT,
                isTabletop = false,
            ),
        )
    }

    @Test
    fun tabletopPostureKeepsBottomNavigationAtMediumWidth() {
        assertFalse(
            shouldUseNavigationRail(
                WindowWidthSizeClass.MEDIUM,
                WindowHeightSizeClass.MEDIUM,
                isTabletop = true,
            ),
        )
    }

    @Test
    fun expandedNonTabletopWindowUsesRail() {
        assertTrue(
            shouldUseNavigationRail(
                WindowWidthSizeClass.EXPANDED,
                WindowHeightSizeClass.EXPANDED,
                isTabletop = false,
            ),
        )
    }
}
