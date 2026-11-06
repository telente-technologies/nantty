package com.nantty.android.ui.stories

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StoryAdSessionTest {
    @Test
    fun storyAdCandidateSlotsMirrorTheReactNativeSessionSchedule() {
        assertEquals(listOf(3, 8, 13), storyAdSlotsForStories(sessionOffset = 0, storyCount = 14))
        assertEquals(listOf(8, 13), storyAdSlotsForStories(sessionOffset = 4, storyCount = 10))
        assertEquals(emptyList<Int>(), storyAdSlotsForStories(sessionOffset = 0, storyCount = 2))
    }

    @Test
    fun candidateRequestIsOnlyIssuedOncePerSessionSlot() {
        val session = StoryAdSession()
        assertTrue(session.requestSlotOnce(3))
        assertFalse(session.requestSlotOnce(3))
        assertFalse(session.requestSlotOnce(4))
    }

    @Test
    fun requestGapUsesTheSameSlotArithmeticAsReactNative() {
        assertEquals(2, storySlotsSinceLastAd(slot = 3, lastAdViewedAt = 0))
        assertEquals(4, storySlotsSinceLastAd(slot = 13, lastAdViewedAt = 8))
        assertEquals(0, storySlotsSinceLastAd(slot = 2, lastAdViewedAt = 8))
    }

    @Test
    fun closingAndRestartingViewerCreatesANewAdSession() {
        val session = StoryAdSession()
        val firstId = session.sessionId
        session.recordStoryViewed()
        session.requestSlotOnce(3)

        session.reset()

        assertNotEquals(firstId, session.sessionId)
        assertEquals(0, session.viewedCount)
        assertTrue(session.requestSlotOnce(3))
    }
}
