package com.nantty.android.ui.stories

import org.junit.Assert.assertEquals
import org.junit.Test

class StoryPlaybackProgressTest {
    @Test
    fun imageProgressUsesReactNativeDurationAndTick() {
        assertEquals(0.01f, advanceStoryPlaybackProgress(0f, STORY_PROGRESS_TICK_MS), 0.0001f)
        assertEquals(0.5f, advanceStoryPlaybackProgress(0.4f, 500L), 0.0001f)
        assertEquals(1f, advanceStoryPlaybackProgress(0.99f, STORY_PROGRESS_TICK_MS), 0f)
    }

    @Test
    fun imageProgressClampsInvalidAndOutOfRangeInputs() {
        assertEquals(0f, advanceStoryPlaybackProgress(Float.NaN, 50L), 0f)
        assertEquals(0f, advanceStoryPlaybackProgress(-1f, 0L), 0f)
        assertEquals(1f, advanceStoryPlaybackProgress(2f, 0L), 0f)
        assertEquals(0.25f, advanceStoryPlaybackProgress(0.25f, -1L), 0f)
    }

    @Test
    fun videoProgressTracksPlaybackFractionAndHandlesUnknownDuration() {
        assertEquals(0.25f, storyVideoPlaybackProgress(2.0, 8.0), 0.0001f)
        assertEquals(1f, storyVideoPlaybackProgress(12.0, 8.0), 0f)
        assertEquals(0f, storyVideoPlaybackProgress(2.0, 0.0), 0f)
        assertEquals(0f, storyVideoPlaybackProgress(Double.NaN, 8.0), 0f)
    }
}
