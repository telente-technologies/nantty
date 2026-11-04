package com.nantty.android.ui

import androidx.compose.ui.geometry.Rect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HingeSafeContentTest {
    @Test
    fun usesWiderPaneWhenVerticalHingeSeparatesWindow() {
        val pane = largestSafePaneBounds(1200f, listOf(Rect(620f, 0f, 650f, 800f)))

        assertEquals(SafePaneBounds(0f, 620f), pane)
    }

    @Test
    fun usesRightPaneWhenItHasMoreUsableWidth() {
        val pane = largestSafePaneBounds(1200f, listOf(Rect(500f, 0f, 540f, 800f)))

        assertEquals(SafePaneBounds(540f, 1200f), pane)
    }

    @Test
    fun choosesWidestSegmentAcrossMultipleHinges() {
        val pane = largestSafePaneBounds(
            1200f,
            listOf(Rect(300f, 0f, 320f, 800f), Rect(800f, 0f, 840f, 800f)),
        )

        assertEquals(SafePaneBounds(320f, 800f), pane)
    }

    @Test
    fun ignoresEmptyOrOutOfWindowHingeBounds() {
        val pane = largestSafePaneBounds(
            1200f,
            listOf(Rect(400f, 0f, 400f, 800f), Rect(1300f, 0f, 1400f, 800f)),
        )

        assertNull(pane)
    }

    @Test
    fun ignoresInvalidWindowWidth() {
        assertNull(largestSafePaneBounds(Float.NaN, listOf(Rect(400f, 0f, 420f, 800f))))
        assertNull(largestSafePaneBounds(0f, listOf(Rect(400f, 0f, 420f, 800f))))
    }

    @Test
    fun keepsContentAboveHorizontalTabletopHinge() {
        val safe = largestSafeContentBounds(800f, 1200f, listOf(Rect(0f, 580f, 800f, 620f)))

        assertEquals(SafeContentBounds(0f, 0f, 800f, 580f), safe)
    }

    @Test
    fun keepsContentInsideLargestRegionWhenBothHingeOrientationsSeparateWindow() {
        val safe = largestSafeContentBounds(
            1200f,
            800f,
            listOf(Rect(590f, 0f, 610f, 800f), Rect(0f, 390f, 590f, 410f)),
        )
        assertEquals(SafeContentBounds(610f, 0f, 1200f, 800f), safe)
    }

    @Test
    fun ignoresInvalidWindowBoundsAndNonSeparatingHingeGeometry() {
        assertNull(largestSafeContentBounds(800f, Float.POSITIVE_INFINITY, emptyList()))
        assertNull(largestSafeContentBounds(800f, 1200f, listOf(Rect(900f, 300f, 950f, 350f))))
        assertNull(largestSafeContentBounds(800f, 1200f, emptyList()))
    }
}
