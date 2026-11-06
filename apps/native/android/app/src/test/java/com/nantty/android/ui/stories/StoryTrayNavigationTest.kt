package com.nantty.android.ui.stories

import com.nantty.android.data.StoryTrayEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StoryTrayNavigationTest {
    private val entries = listOf(
        StoryTrayEntry("u1", "A", "a", null, true),
        StoryTrayEntry("u2", "B", "b", null, true),
        StoryTrayEntry("u3", "C", "c", null, false),
    )

    @Test
    fun nextStoryAuthorMovesForwardAndStartsAtFirstStory() {
        assertEquals(StoryAuthorTarget("u2", startAtLast = false), adjacentStoryAuthor(entries, "u1", next = true))
        assertEquals(StoryAuthorTarget("u3", startAtLast = false), adjacentStoryAuthor(entries, "u2", next = true))
    }

    @Test
    fun previousStoryAuthorMovesBackwardAndStartsAtLastStory() {
        assertEquals(StoryAuthorTarget("u2", startAtLast = true), adjacentStoryAuthor(entries, "u3", next = false))
        assertEquals(StoryAuthorTarget("u1", startAtLast = true), adjacentStoryAuthor(entries, "u2", next = false))
    }

    @Test
    fun storyAuthorNavigationDoesNotWrapAtTrayEdgesAndMatchesReactNativeForUnknownAuthor() {
        assertNull(adjacentStoryAuthor(entries, "u1", next = false))
        assertNull(adjacentStoryAuthor(entries, "u3", next = true))
        assertEquals(StoryAuthorTarget("u1", startAtLast = false), adjacentStoryAuthor(entries, "missing", next = true))
        assertNull(adjacentStoryAuthor(emptyList(), "missing", next = true))
        assertNull(adjacentStoryAuthor(entries, "missing", next = false))
    }
}
