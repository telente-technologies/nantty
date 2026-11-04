package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.FeedType
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class FeedTabSelectorTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun switchesBetweenForYouAndFollowing() {
        composeRule.setContent {
            MaterialTheme {
                var selected by remember { mutableStateOf(FeedType.FOR_YOU) }
                FeedTabSelector(
                    selectedFeed = selected,
                    canViewFollowing = true,
                    onSelectFeed = { selected = it },
                    onSignInRequired = {},
                )
            }
        }

        composeRule.onNodeWithText("For You").assertIsSelected()
        composeRule.onNodeWithText("Following").assertIsNotSelected().performClick()
        composeRule.onNodeWithText("Following").assertIsSelected()
        composeRule.onNodeWithText("For You").assertIsNotSelected()
    }

    @Test
    fun signedOutFollowingSelectionShowsGateWithoutChangingTab() {
        var gateCount = 0
        composeRule.setContent {
            MaterialTheme {
                var selected by remember { mutableStateOf(FeedType.FOR_YOU) }
                FeedTabSelector(
                    selectedFeed = selected,
                    canViewFollowing = false,
                    onSelectFeed = { selected = it },
                    onSignInRequired = { gateCount++ },
                )
            }
        }

        composeRule.onNodeWithText("Following").performClick()
        composeRule.runOnIdle { assertEquals(1, gateCount) }
        composeRule.onNodeWithText("For You").assertIsSelected()
        composeRule.onNodeWithText("Following").assertIsNotSelected()
    }

    @Test
    fun signedOutFollowingSelectionUsesIntentPreservingAuthCallback() {
        var preservedIntentCount = 0
        var genericGateCount = 0
        composeRule.setContent {
            MaterialTheme {
                var selected by remember { mutableStateOf(FeedType.FOR_YOU) }
                FeedTabSelector(
                    selectedFeed = selected,
                    canViewFollowing = false,
                    onSelectFeed = { selected = it },
                    onSignInRequired = { genericGateCount++ },
                    onFollowingSignInRequired = { preservedIntentCount++ },
                )
            }
        }

        composeRule.onNodeWithText("Following").performClick()
        composeRule.runOnIdle {
            assertEquals(1, preservedIntentCount)
            assertEquals(0, genericGateCount)
        }
        composeRule.onNodeWithText("For You").assertIsSelected()
    }
}
