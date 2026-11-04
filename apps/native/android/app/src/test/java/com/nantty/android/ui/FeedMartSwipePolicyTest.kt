package com.nantty.android.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FeedMartSwipePolicyTest {
    @Test
    fun horizontalSwipesSelectTheAdjacentSectionOnlyAfterThreshold() {
        assertEquals(true, resolveFeedMartSwipeTarget(false, -100f, 64f))
        assertEquals(false, resolveFeedMartSwipeTarget(true, 100f, 64f))
        assertNull(resolveFeedMartSwipeTarget(false, -63f, 64f))
        assertNull(resolveFeedMartSwipeTarget(true, 63f, 64f))
    }

    @Test
    fun swipeTowardCurrentSectionDoesNotTriggerAnotherSelection() {
        assertNull(resolveFeedMartSwipeTarget(false, 100f, 64f))
        assertNull(resolveFeedMartSwipeTarget(true, -100f, 64f))
    }

    @Test
    fun invalidThresholdNeverSwitchesSections() {
        assertNull(resolveFeedMartSwipeTarget(false, -100f, 0f))
        assertNull(resolveFeedMartSwipeTarget(true, 100f, -1f))
    }
}
