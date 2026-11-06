package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.FeedPost
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FeedPostReportMenuTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun reportMenuCallsBackWithThePostAndDoesNotOfferSelfReport() {
        var reportedId: String? = null
        compose.setContent {
            MaterialTheme {
                FeedCard(
                    post = post(),
                    canReportPost = true,
                    onReportPost = { reportedId = it.id },
                )
            }
        }

        compose.onNodeWithContentDescription("More post options").performClick()
        compose.onNodeWithText("Report post").performClick()
        compose.runOnIdle { assertEquals("feed-post-1", reportedId) }
    }

    @Test
    fun ownPostDoesNotExposeReportMenu() {
        compose.setContent {
            MaterialTheme {
                FeedCard(
                    post = post(),
                    canReportPost = false,
                    onReportPost = {},
                )
            }
        }

        compose.runOnIdle {
            assertTrue(compose.onAllNodesWithContentDescription("More post options").fetchSemanticsNodes().isEmpty())
        }
    }

    private fun post() = FeedPost(
        id = "feed-post-1",
        authorId = "author-1",
        authorName = "Ari",
        username = "ari",
        avatarUrl = null,
        verified = false,
        verificationColor = null,
        postedAsName = null,
        postedAsHandle = null,
        postedAsAvatarUrl = null,
        kind = "post",
        text = "Post to report",
        media = emptyList(),
        likes = 0,
        comments = 0,
        reposts = 0,
        shares = 0,
        createdAt = "2026-11-06T10:00:00Z",
    )
}
