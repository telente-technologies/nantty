package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.FeedTopic
import org.junit.Rule
import org.junit.Test

class FeedTopicSelectorTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun selectingTopicAndForYouChipReportsFilterAndResetsToAll() {
        composeRule.setContent {
            MaterialTheme {
                var selectedTopic by remember { mutableStateOf<String?>(null) }
                FeedTopicSelector(
                    topics = listOf(FeedTopic("fashion", "Fashion"), FeedTopic("music", "Music")),
                    selectedTopicId = selectedTopic,
                    loading = false,
                    error = null,
                    onSelectTopic = { selectedTopic = it },
                    onRetry = {},
                )
            }
        }

        composeRule.onNodeWithText("For You").assertIsSelected()
        composeRule.onNodeWithText("Fashion").assertIsNotSelected().performClick()
        composeRule.onNodeWithText("Fashion").assertIsSelected()
        composeRule.onNodeWithContentDescription("Show all For You posts").performClick()
        composeRule.onNodeWithText("For You").assertIsSelected()
        composeRule.onNodeWithText("Fashion").assertIsNotSelected()
    }
}
