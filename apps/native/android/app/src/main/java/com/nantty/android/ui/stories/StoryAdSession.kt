package com.nantty.android.ui.stories

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateSetOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import com.nantty.android.data.StoryDecidedAd
import java.util.UUID

/** Keeps the same per-viewer-session slot state used by React Native's Story viewer. */
internal class StoryAdSession(
    initialSessionId: String = "story_ads_${UUID.randomUUID()}"
) {
    var sessionId by mutableStateOf(initialSessionId)
        private set
    var viewedCount by mutableIntStateOf(0)
        private set
    var lastAdViewedAt by mutableIntStateOf(0)
        private set
    val adsBySlot = mutableStateMapOf<Int, StoryDecidedAd>()
    private val requestedSlots = mutableStateSetOf<Int>()
    private val viewedAdSlots = mutableStateSetOf<Int>()

    fun recordStoryViewed() {
        viewedCount += 1
    }

    fun requestSlotOnce(slot: Int): Boolean = isStoryAdCandidateSlot(slot) && requestedSlots.add(slot)

    fun cacheAd(slot: Int, ad: StoryDecidedAd, expectedSessionId: String = sessionId) {
        if (expectedSessionId == sessionId) adsBySlot[slot] = ad
    }

    fun markAdViewed(slot: Int): Boolean {
        if (!viewedAdSlots.add(slot)) return false
        lastAdViewedAt = slot
        return true
    }

    fun hasViewedAd(slot: Int): Boolean = slot in viewedAdSlots

    fun reset() {
        sessionId = "story_ads_${UUID.randomUUID()}"
        viewedCount = 0
        lastAdViewedAt = 0
        adsBySlot.clear()
        requestedSlots.clear()
        viewedAdSlots.clear()
    }
}

/** Candidate slots mirror apps/mobile/src/store/storyAdSession.store.ts. */
internal fun isStoryAdCandidateSlot(viewedCount: Int): Boolean =
    viewedCount >= FIRST_AD_AFTER_VIEWED && (viewedCount - FIRST_AD_AFTER_VIEWED) % VIEWS_BETWEEN_ADS == 0

internal fun storyAdSlotsForStories(sessionOffset: Int, storyCount: Int): List<Int> =
    (1..storyCount.coerceAtLeast(0)).map { sessionOffset + it }.filter(::isStoryAdCandidateSlot)

internal fun storySlotsSinceLastAd(slot: Int, lastAdViewedAt: Int): Int =
    (slot - lastAdViewedAt - 1).coerceAtLeast(0)

private const val FIRST_AD_AFTER_VIEWED = 3
private const val VIEWS_BETWEEN_ADS = 5
