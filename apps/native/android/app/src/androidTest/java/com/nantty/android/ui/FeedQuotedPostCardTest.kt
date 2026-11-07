package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedQuotedPost
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FeedQuotedPostCardTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun quotedPostPreviewOpensOriginalInsteadOfParentPost() {
        var openedPostId: String? = null
        compose.setContent {
            MaterialTheme {
                FeedCard(
                    post = parentPost().copy(
                        quotedPost = FeedQuotedPost(
                            id = "original-1",
                            kind = "post",
                            authorName = "Ada",
                            username = "ada",
                            avatarUrl = null,
                            verified = true,
                            verificationColor = "gold",
                            text = "Original post text",
                            thumbnailUrl = null,
                        ),
                    ),
                    onOpenPost = { openedPostId = it },
                )
            }
        }

        compose.onNodeWithTag("feed-quoted-post").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals("original-1", openedPostId) }
    }

    @Test
    fun plainRepostPreviewOpensOriginalInsteadOfRepost() {
        var openedPostId: String? = null
        compose.setContent {
            MaterialTheme {
                FeedCard(
                    post = parentPost().copy(
                        isQuote = false,
                        quotedPost = FeedQuotedPost(
                            id = "original-repost-1",
                            kind = "post",
                            authorName = "Ari",
                            username = "ari",
                            avatarUrl = null,
                            verified = false,
                            verificationColor = null,
                            text = "Original post text",
                            thumbnailUrl = null,
                        ),
                    ),
                    onOpenPost = { openedPostId = it },
                )
            }
        }

        compose.onNodeWithTag("feed-quoted-post").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals("original-repost-1", openedPostId) }
    }

    @Test
    fun unavailableQuotedPostShowsNonInteractiveFallback() {
        compose.setContent {
            MaterialTheme {
                FeedCard(post = parentPost().copy(quotedPostUnavailable = true))
            }
        }

        compose.onNodeWithContentDescription("Quoted post unavailable").assertIsDisplayed()
        compose.runOnIdle { assertTrue(compose.onAllNodesWithTag("feed-quoted-post").fetchSemanticsNodes().isEmpty()) }
    }

    @Test
    fun feedRepostChoiceSupportsRepostAndQuoteActions() {
        var repostedId: String? = null
        var quotedId: String? = null
        compose.setContent {
            MaterialTheme {
                FeedRepostActionsDialog(
                    post = parentPost(),
                    onDismiss = {},
                    onRepost = { repostedId = it.id },
                    onQuote = { quotedId = it.id },
                )
            }
        }

        compose.onNodeWithTag("feed-quote-action").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals("quote-parent", quotedId) }

        compose.setContent {
            MaterialTheme {
                FeedRepostActionsDialog(
                    post = parentPost(),
                    onDismiss = {},
                    onRepost = { repostedId = it.id },
                    onQuote = { quotedId = it.id },
                )
            }
        }
        compose.onNodeWithTag("feed-repost-confirm").performClick()
        compose.runOnIdle { assertEquals("quote-parent", repostedId) }
    }

    private fun parentPost() = FeedPost(
        id = "quote-parent",
        authorName = "Nia",
        username = "nia",
        avatarUrl = null,
        verified = false,
        verificationColor = null,
        postedAsName = null,
        postedAsHandle = null,
        postedAsAvatarUrl = null,
        kind = "post",
        text = "My thought",
        media = emptyList(),
        likes = 1,
        comments = 0,
        reposts = 1,
        shares = 0,
        createdAt = "2026-11-06T10:00:00Z",
    )
}
