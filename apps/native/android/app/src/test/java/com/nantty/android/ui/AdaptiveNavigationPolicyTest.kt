package com.nantty.android.ui

import androidx.window.core.layout.WindowSizeClass
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdaptiveNavigationPolicyTest {
    @Test
    fun mediumWidthUsesRailWhenThereIsVerticalRoom() {
        assertTrue(
            shouldUseNavigationRail(
                WindowSizeClass(600, 480),
                isTabletop = false,
            ),
        )
    }

    @Test
    fun compactHeightKeepsBottomNavigationEvenAtExpandedWidth() {
        assertFalse(
            shouldUseNavigationRail(
                WindowSizeClass(840, 0),
                isTabletop = false,
            ),
        )
    }

    @Test
    fun tabletopPostureKeepsBottomNavigationAtMediumWidth() {
        assertFalse(
            shouldUseNavigationRail(
                WindowSizeClass(600, 480),
                isTabletop = true,
            ),
        )
    }

    @Test
    fun expandedNonTabletopWindowUsesRail() {
        assertTrue(
            shouldUseNavigationRail(
                WindowSizeClass(840, 900),
                isTabletop = false,
            ),
        )
    }

    @Test
    fun martUsesSupportingCategoryPaneOnlyOnExpandedNonTabletopWindows() {
        assertTrue(shouldShowMartCategoryPane(WindowSizeClass(840, 480), isTabletop = false, hasVerticalHinge = false))
        assertFalse(shouldShowMartCategoryPane(WindowSizeClass(600, 480), isTabletop = false, hasVerticalHinge = false))
        assertFalse(shouldShowMartCategoryPane(WindowSizeClass(0, 480), isTabletop = false, hasVerticalHinge = false))
        assertFalse(shouldShowMartCategoryPane(WindowSizeClass(840, 480), isTabletop = true, hasVerticalHinge = false))
        assertFalse(shouldShowMartCategoryPane(WindowSizeClass(840, 480), isTabletop = false, hasVerticalHinge = true))
    }
}
