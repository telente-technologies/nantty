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
}
