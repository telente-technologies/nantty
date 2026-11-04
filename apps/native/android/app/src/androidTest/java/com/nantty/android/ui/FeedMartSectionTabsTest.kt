package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.swipeRight
import org.junit.Rule
import org.junit.Test

class FeedMartSectionTabsTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun keepsFeedAndMartDirectlySelectableAndReflectsCurrentSection() {
        composeRule.setContent {
            MaterialTheme {
                var selectedMart by remember { mutableStateOf(false) }
                FeedMartSectionTabs(
                    selectedMart = selectedMart,
                    onSelectMart = { selectedMart = it },
                )
            }
        }

        composeRule.onNodeWithText("Feed").assertIsSelected()
        composeRule.onNodeWithText("Mart").assertIsNotSelected().performClick()
        composeRule.onNodeWithText("Mart").assertIsSelected()
        composeRule.onNodeWithText("Feed").assertIsNotSelected().performClick()
        composeRule.onNodeWithText("Feed").assertIsSelected()
    }

    @Test
    fun horizontalSwipesOnSectionTabsSwitchBetweenFeedAndMart() {
        composeRule.setContent {
            MaterialTheme {
                var selectedMart by remember { mutableStateOf(false) }
                FeedMartSectionTabs(
                    selectedMart = selectedMart,
                    onSelectMart = { selectedMart = it },
                )
            }
        }

        composeRule.onNodeWithTag("feed-mart-tabs").performTouchInput { swipeLeft() }
        composeRule.onNodeWithText("Mart").assertIsSelected()

        composeRule.onNodeWithTag("feed-mart-tabs").performTouchInput { swipeRight() }
        composeRule.onNodeWithText("Feed").assertIsSelected()
    }
}
