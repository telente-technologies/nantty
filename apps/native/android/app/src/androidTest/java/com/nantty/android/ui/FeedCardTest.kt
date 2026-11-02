package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import com.nantty.android.data.FeedPost
import org.junit.Rule
import org.junit.Test

class FeedCardTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun rendersPostIdentityContentAndReadOnlyEngagementCounts() {
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-1", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = true, verificationColor = "gold", postedAsName = null, postedAsHandle = null, kind = "post",
                        postedAsAvatarUrl = null,
                        text = "A real post from the API", media = emptyList(), likes = 4,
                        comments = 2, reposts = 1, shares = 3, createdAt = "2026-11-02T10:00:00.000Z",
                    ),
                )
            }
        }

        composeRule.onNodeWithText("Ari").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Verified business", useUnmergedTree = true).assertIsDisplayed()
        composeRule.onNodeWithText("A real post from the API").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("4 likes").assertIsDisplayed()
    }
}
