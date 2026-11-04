package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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
                        comments = 2, reposts = 1, shares = 3, createdAt = "2026-11-02T10:00:00.000Z", liked = true,
                    ),
                    canInteract = true,
                )
            }
        }

        composeRule.onNodeWithText("Ari").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Verified business", useUnmergedTree = true).assertIsDisplayed()
        composeRule.onNodeWithText("A real post from the API").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Unlike post").assertIsDisplayed()
    }

    @Test
    fun tappingFeedCardOpensItsPostDetail() {
        var openedPostId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-42", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Open this post", media = emptyList(),
                        likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-02T10:00:00Z",
                    ),
                    onOpenPost = { openedPostId = it },
                )
            }
        }

        composeRule.onNodeWithText("Open this post").performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-42", openedPostId) }
    }

    @Test
    fun commentsActionHasAccessibleLabelAndOpensTheMatchingPostThread() {
        var openedPostId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-comments", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Read the replies", media = emptyList(),
                        likes = 3, comments = 12, reposts = 1, shares = 0, createdAt = "2026-11-04T10:00:00Z",
                    ),
                    onOpenComments = { openedPostId = it },
                )
            }
        }

        composeRule.onNodeWithContentDescription("Open 12 comments").assertIsDisplayed().performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-comments", openedPostId) }
    }

    @Test
    fun feedAuthorIdentityOpensTheirPublicProfileWithoutOpeningThePost() {
        var openedPostId: String? = null
        var openedProfileId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-9", authorId = "user-9", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Visit my profile", media = emptyList(),
                        likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-02T10:00:00Z",
                    ),
                    onOpenPost = { openedPostId = it },
                    onOpenProfile = { openedProfileId = it },
                )
            }
        }

        composeRule.onNodeWithContentDescription("Open Ari's profile").performClick()
        composeRule.runOnIdle {
            org.junit.Assert.assertEquals("user-9", openedProfileId)
            org.junit.Assert.assertNull(openedPostId)
        }
    }

    @Test
    fun authenticatedFeedActionsInvokeLikeAndRepostCallbacksWithoutOpeningPost() {
        var likedPostId: String? = null
        var repostedPostId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-7", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "React here", media = emptyList(),
                        likes = 2, comments = 0, reposts = 1, shares = 0, createdAt = "2026-11-02T10:00:00Z",
                    ),
                    onLike = { likedPostId = it.id },
                    onRepost = { repostedPostId = it.id },
                    canInteract = true,
                )
            }
        }

        composeRule.onNodeWithContentDescription("Like post").performClick()
        composeRule.onNodeWithContentDescription("Repost").performClick()
        composeRule.runOnIdle {
            org.junit.Assert.assertEquals("post-7", likedPostId)
            org.junit.Assert.assertEquals("post-7", repostedPostId)
        }
    }

    @Test
    fun feedShareActionHasAccessibleLabelAndReturnsThePostToTheShareHandler() {
        var sharedPostId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-share", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Share this post", media = emptyList(),
                        likes = 0, comments = 0, reposts = 0, shares = 4, createdAt = "2026-11-02T10:00:00Z",
                    ),
                    onShare = { sharedPostId = it.id },
                )
            }
        }

        composeRule.onNodeWithContentDescription("Share post").assertIsDisplayed().performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-share", sharedPostId) }
    }

    @Test
    fun authenticatedSaveActionHasAccessibleStateAndCallsCallback() {
        var savedId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-save", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Save this", media = emptyList(),
                        likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-02T10:00:00Z",
                    ),
                    onSave = { savedId = it.id },
                    canInteract = true,
                )
            }
        }

        composeRule.onNodeWithContentDescription("Save post").assertIsNotSelected().performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-save", savedId) }
    }

    @Test
    fun saveActionIsNotExposedToGuestFeedCard() {
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-guest", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Guest view", media = emptyList(),
                        likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-02T10:00:00Z",
                    ),
                    canInteract = false,
                )
            }
        }

        composeRule.onNodeWithContentDescription("Save post").assertDoesNotExist()
    }
}
