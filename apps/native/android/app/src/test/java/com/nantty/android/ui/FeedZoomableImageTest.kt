package com.nantty.android.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.IntSize
import org.junit.Assert.assertEquals
import org.junit.Test

class FeedZoomableImageTest {
    @Test
    fun zoomedImagePanIsBoundedByTheScaledViewport() {
        val size = IntSize(width = 400, height = 800)

        val bounded = clampFeedImageOffset(Offset(500f, -900f), 2.5f, size, IntSize(1200, 800))
        assertEquals(300f, bounded.x, 0.01f)
        assertEquals(0f, bounded.y, 0.01f)
    }

    @Test
    fun fitImageCannotRetainPanOffset() {
        assertEquals(Offset.Zero, clampFeedImageOffset(Offset(80f, -40f), 1f, IntSize(400, 800), IntSize(1200, 800)))
    }

    @Test
    fun unmeasuredImageCannotRetainPanOffset() {
        assertEquals(Offset.Zero, clampFeedImageOffset(Offset(80f, -40f), 2f, IntSize.Zero))
    }
}
