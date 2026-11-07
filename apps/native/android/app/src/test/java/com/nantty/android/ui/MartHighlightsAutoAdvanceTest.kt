package com.nantty.android.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MartHighlightsAutoAdvanceTest {
    @Test
    fun autoAdvanceRequiresMultipleVisibleHighlightsAndForegroundLifecycle() {
        assertTrue(eligible())
        assertFalse(eligible(highlightCount = 1))
        assertFalse(eligible(isVisible = false))
        assertFalse(eligible(isResumed = false))
    }

    @Test
    fun autoAdvancePausesForInteractionReducedMotionAndTouchExploration() {
        assertFalse(eligible(isScrolling = true))
        assertFalse(eligible(animationsEnabled = false))
        assertFalse(eligible(touchExplorationEnabled = true))
    }

    private fun eligible(
        highlightCount: Int = 2,
        isVisible: Boolean = true,
        isResumed: Boolean = true,
        isScrolling: Boolean = false,
        animationsEnabled: Boolean = true,
        touchExplorationEnabled: Boolean = false,
    ) = canAutoAdvanceMartHighlights(
        highlightCount = highlightCount,
        isVisible = isVisible,
        isResumed = isResumed,
        isScrolling = isScrolling,
        animationsEnabled = animationsEnabled,
        touchExplorationEnabled = touchExplorationEnabled,
    )
}
