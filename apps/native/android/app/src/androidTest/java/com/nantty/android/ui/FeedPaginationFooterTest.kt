package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class FeedPaginationFooterTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun offersLoadMoreWhenAnotherCursorExists() {
        var calls = 0
        composeRule.setContent {
            MaterialTheme {
                FeedPaginationFooter(hasMore = true, loading = false, error = null) { calls++ }
            }
        }

        composeRule.onNodeWithText("Load more posts").assertIsDisplayed().performClick()
        composeRule.runOnIdle { assertEquals(1, calls) }
    }

    @Test
    fun exposesRetryForPageFailure() {
        composeRule.setContent {
            MaterialTheme {
                FeedPaginationFooter(hasMore = true, loading = false, error = "Page failed") {}
            }
        }
        composeRule.onNodeWithText("Page failed").assertIsDisplayed()
        composeRule.onNodeWithText("Try loading more").assertIsDisplayed()
    }

    @Test
    fun announcesEndOfFeedWhenCursorIsAbsent() {
        composeRule.setContent {
            MaterialTheme {
                FeedPaginationFooter(hasMore = false, loading = false, error = null) {}
            }
        }
        composeRule.onNodeWithText("You’re all caught up").assertIsDisplayed()
    }

    @Test
    fun announcesPageLoadingAccessibly() {
        composeRule.setContent {
            MaterialTheme {
                FeedPaginationFooter(hasMore = true, loading = true, error = null) {}
            }
        }
        composeRule.onNodeWithContentDescription("Loading more posts").assertIsDisplayed()
    }
}
