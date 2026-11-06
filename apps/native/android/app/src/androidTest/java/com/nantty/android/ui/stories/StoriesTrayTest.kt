package com.nantty.android.ui.stories

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
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
}
