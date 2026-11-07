package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.onNodeWithTag
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedFeedbackKind
import org.junit.Rule
import org.junit.Test

class FeedCardTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun feedMenuOffersHideAndNotInterestedFeedbackActions() {
        var feedback: Pair<String, FeedFeedbackKind>? = null
        val post = FeedPost(
            id = "post-feedback", authorId = "author-2", authorName = "Ari", username = "ari", avatarUrl = null,
            verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null, postedAsAvatarUrl = null,
            kind = "post", text = "Tune this feed", media = emptyList(), likes = 0, comments = 0,
            reposts = 0, shares = 0, createdAt = "2026-11-07T10:00:00Z",
        )
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    post = post,
                    currentAccountId = "viewer-1",
                    onReportPost = {},
                    onFeedFeedback = { target, kind -> feedback = target.id to kind },
                )
            }
        }

        composeRule.onNodeWithContentDescription("More post options").performClick()
        composeRule.onNodeWithText("Not interested").assertIsDisplayed().performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-feedback" to FeedFeedbackKind.NOT_INTERESTED, feedback) }
        composeRule.onNodeWithContentDescription("More post options").performClick()
        composeRule.onNodeWithText("Hide this post").assertIsDisplayed().performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-feedback" to FeedFeedbackKind.HIDE, feedback) }
    }

    @Test
    fun feedMenuTogglesNotificationsForThisPost() {
        var toggledPostId: String? = null
        val post = FeedPost(
            id = "post-notifications", authorId = "author-2", authorName = "Ari", username = "ari", avatarUrl = null,
            verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null, postedAsAvatarUrl = null,
            kind = "post", text = "Follow this post", media = emptyList(), likes = 0, comments = 0,
            reposts = 0, shares = 0, createdAt = "2026-11-07T10:00:00Z",
        )
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    post = post,
                    currentAccountId = "viewer-1",
                    onReportPost = {},
                    onTogglePostNotifications = { toggledPostId = it.id },
                )
            }
        }

        composeRule.onNodeWithContentDescription("More post options").performClick()
        composeRule.onNodeWithText("Turn off notifications for this post").assertIsDisplayed().performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-notifications", toggledPostId) }
    }

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
    fun feedAuthorCanBeFollowedFromThePostHeader() {
        var followedAuthorId: String? = null
        var openedPostId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-follow", authorId = "author-7", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Follow from the feed", media = emptyList(),
                        likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-06T10:00:00Z",
                    ),
                    onOpenPost = { openedPostId = it },
                    currentAccountId = "viewer-1",
                    onFollowAuthor = { followedAuthorId = it.authorId },
                )
            }
        }

        composeRule.onNodeWithContentDescription("Follow @ari").assertIsDisplayed().performClick()
        composeRule.runOnIdle {
            org.junit.Assert.assertEquals("author-7", followedAuthorId)
            org.junit.Assert.assertNull(openedPostId)
        }
    }

    @Test
    fun followedAuthorsDoNotShowTheFollowAction() {
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-already-followed", authorId = "author-7", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Already followed", media = emptyList(),
                        likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-06T10:00:00Z", isFollowingAuthor = true,
                    ),
                    onFollowAuthor = {},
                )
            }
        }

        composeRule.onNodeWithContentDescription("Follow @ari").assertDoesNotExist()
    }

    @Test
    fun authorViewsActionOpensAnalyticsOnlyForTheOwningAccount() {
        var analyticsPostId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-analytics", authorId = "owner-1", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Analytics owner", media = emptyList(),
                        likes = 3, comments = 2, reposts = 1, shares = 0, createdAt = "2026-11-07T10:00:00Z", views = 42,
                    ),
                    currentAccountId = "owner-1",
                    onOpenAnalytics = { analyticsPostId = it },
                )
            }
        }

        composeRule.onNodeWithContentDescription("Views, 42").assertIsDisplayed().performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-analytics", analyticsPostId) }
    }

    @Test
    fun postedAsOwnerCanOpenAnalyticsAndOtherViewersSeeTheViewsExplanation() {
        var analyticsPostId: String? = null
        val currentAccountId = mutableStateOf("brand-owner")
        val post = FeedPost(
            id = "post-as-brand", authorId = "brand-owner", authorName = "Ari Studio", username = "aristudio", avatarUrl = null,
            verified = false, verificationColor = null, postedAsName = "Ari Studio", postedAsHandle = "aristudio",
            postedAsAvatarUrl = null, postedAsId = "brand-1", kind = "post", text = "Posted as a brand", media = emptyList(),
            likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-07T10:00:00Z", views = 19,
        )
        composeRule.setContent {
            MaterialTheme {
                FeedCard(post, currentAccountId = currentAccountId.value, activeProfileId = if (currentAccountId.value == "brand-owner") "brand-1" else "other-brand", onOpenAnalytics = { analyticsPostId = it })
            }
        }
        composeRule.onNodeWithContentDescription("Views, 19").performClick()
        composeRule.runOnIdle { org.junit.Assert.assertEquals("post-as-brand", analyticsPostId) }

        analyticsPostId = null
        composeRule.runOnIdle { currentAccountId.value = "viewer-2" }
        composeRule.waitForIdle()
        composeRule.onNodeWithContentDescription("Views, 19").performClick()
        composeRule.onNodeWithText("Times this post was seen. A view counts each time it appears on someone else’s screen, including repeat views. The author’s own views don’t count.").assertIsDisplayed()
        composeRule.runOnIdle { org.junit.Assert.assertNull(analyticsPostId) }
    }

    @Test
    fun currentAccountDoesNotShowAFollowActionOnItsOwnPost() {
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "own-post", authorId = "viewer-1", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "My post", media = emptyList(),
                        likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-06T10:00:00Z",
                    ),
                    currentAccountId = "viewer-1",
                    onFollowAuthor = {},
                )
            }
        }

        composeRule.onNodeWithContentDescription("Follow @ari").assertDoesNotExist()
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
    fun feedMediaViewerRunsTheSamePostActionsAsTheFeedCard() {
        val events = mutableListOf<String>()
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-media-actions", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Open media actions",
                        media = listOf(FeedMedia("image-1", "image", "https://cdn.nantty.com/image-1.jpg", null, 1200, 800)),
                        likes = 4, comments = 5, reposts = 2, shares = 1, createdAt = "2026-11-06T10:00:00Z",
                    ),
                    onLike = { events += "like:${it.id}" },
                    onOpenComments = { events += "comments:$it" },
                    onRepost = { events += "repost:${it.id}" },
                    onSave = { events += "save:${it.id}" },
                    onShare = { events += "share:${it.id}" },
                    canInteract = true,
                )
            }
        }

        composeRule.onNodeWithContentDescription("Open image 1 of 1 full screen").performClick()
        composeRule.onNodeWithTag("feed-media-like").performClick()
        composeRule.onNodeWithTag("feed-media-save").performClick()
        composeRule.onNodeWithTag("feed-media-share").performClick()
        composeRule.onNodeWithTag("feed-media-share-link").performClick()
        composeRule.onNodeWithTag("feed-media-comments").performClick()
        composeRule.waitForIdle()
        org.junit.Assert.assertTrue(
            composeRule.onAllNodesWithContentDescription("Close image preview").fetchSemanticsNodes().isEmpty(),
        )

        composeRule.onNodeWithContentDescription("Open image 1 of 1 full screen").performClick()
        composeRule.onNodeWithTag("feed-media-repost").performClick()
        composeRule.waitForIdle()

        composeRule.runOnIdle {
            org.junit.Assert.assertEquals(
                listOf(
                    "like:post-media-actions",
                    "save:post-media-actions",
                    "share:post-media-actions",
                    "comments:post-media-actions",
                    "repost:post-media-actions",
                ),
                events,
            )
        }
        composeRule.onNodeWithContentDescription("Close image preview").assertDoesNotExist()
    }

    @Test
    fun repostFromImageViewerOpensTheFeedRepostChoicesAndSubmitsTheSelectedAction() {
        var repostedPostId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    FeedPost(
                        id = "post-image-repost", authorName = "Ari", username = "ari", avatarUrl = null,
                        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
                        postedAsAvatarUrl = null, kind = "post", text = "Reshare this image",
                        media = listOf(FeedMedia("image-repost", "image", "https://cdn.nantty.com/repost.jpg", null, 1200, 800)),
                        likes = 1, comments = 2, reposts = 3, shares = 0, createdAt = "2026-11-06T10:00:00Z",
                    ),
                    onRepost = { repostedPostId = it.id },
                    onQuotePost = {},
                    canInteract = true,
                )
            }
        }

        composeRule.onNodeWithContentDescription("Open image 1 of 1 full screen").performClick()
        composeRule.onNodeWithTag("feed-media-repost").performClick()
        composeRule.onNodeWithText("Share this post").assertIsDisplayed()
        composeRule.onNodeWithTag("feed-repost-confirm").performClick()

        composeRule.runOnIdle {
            org.junit.Assert.assertEquals("post-image-repost", repostedPostId)
        }
        composeRule.onNodeWithContentDescription("Close image preview").assertDoesNotExist()
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
