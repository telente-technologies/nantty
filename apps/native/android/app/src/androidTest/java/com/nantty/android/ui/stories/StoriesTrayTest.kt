package com.nantty.android.ui.stories

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.LiveHostSummary
import com.nantty.android.data.SuggestedLiveCard
import com.nantty.android.data.StoryTrayEntry
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StoriesTrayTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun addStoryIsAvailableWhenTheTrayIsEmptyAndOpensTheStoryComposer() {
        var addStoryRequests = 0
        compose.setContent {
            MaterialTheme {
                StoriesTray(entries = emptyList(), onStorySelected = {}, onAddStory = { addStoryRequests++ })
            }
        }

        compose.onNodeWithContentDescription("Add Story").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(1, addStoryRequests) }
    }

    @Test
    fun suggestedLiveOpensItsLiveAndDoesNotDuplicateStoryAuthor() {
        var openedLiveId: String? = null
        val live = SuggestedLiveCard(
            id = "live-1",
            host = LiveHostSummary("host-1", "Ari", "ari", null, verified = false, followers = 0, following = 0),
            title = "A live title",
            coverUrl = null,
        )
        compose.setContent {
            MaterialTheme {
                StoriesTray(
                    entries = listOf(StoryTrayEntry("host-1", "Ari", "ari", null, hasUnseen = true)),
                    liveEntries = listOf(live),
                    onStorySelected = {},
                    onLiveSelected = { openedLiveId = it },
                )
            }
        }

        compose.onNodeWithContentDescription("Ari is live, open livestream").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals("live-1", openedLiveId) }
        compose.onAllNodesWithContentDescription("View Ari's unseen story").assertCountEquals(0)
    }
}
