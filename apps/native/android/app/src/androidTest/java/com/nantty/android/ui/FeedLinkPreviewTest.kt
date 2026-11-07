package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import com.nantty.android.data.FeedLinkPreview
import com.nantty.android.data.FeedPost
import com.nantty.android.data.SharedContentCard
import com.nantty.android.data.SharedContentReference
import com.nantty.android.data.SharedContentResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

class FeedLinkPreviewTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun attachedPreviewConfirmsRiskyLinkAndRecordsOnlyAfterOpenIsConfirmed() {
        val preview = FeedLinkPreview("https://bit.ly/nantty", "bit.ly", "A story worth reading", "A short summary", null, "Example")
        var openedUrl: String? = null
        var recordedClicks = 0
        composeRule.setContent {
            MaterialTheme {
                LazyColumn(Modifier.fillMaxSize().testTag("feed-link-test-list")) {
                    item {
                        FeedCard(
                            post = postWithPreview(preview),
                            currentAccountId = "viewer-1",
                            onRecordFeedLinkClick = { recordedClicks++ },
                            onOpenExternalFeedLink = { openedUrl = it; true },
                        )
                    }
                }
            }
        }

        composeRule.onNodeWithTag("feed-link-test-list").performScrollToNode(hasContentDescription("A story worth reading, opens bit.ly"))
        composeRule.onNodeWithTag("feed-link-preview", useUnmergedTree = true).assertIsDisplayed()
        composeRule.onNodeWithText("A story worth reading").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("A story worth reading, opens bit.ly").performClick()
        composeRule.onNodeWithText("Check this link").assertIsDisplayed()
        composeRule.onNodeWithTag("feed-link-cancel-open").performClick()
        composeRule.runOnIdle {
            assertNull(openedUrl)
            assertEquals(0, recordedClicks)
        }

        composeRule.onNodeWithContentDescription("A story worth reading, opens bit.ly").performClick()
        composeRule.onNodeWithTag("feed-link-confirm-open").performClick()
        composeRule.runOnIdle {
            assertEquals("https://bit.ly/nantty", openedUrl)
            assertEquals(1, recordedClicks)
        }
    }

    @Test
    fun missingPreviewResolvesOnlyForSignedInFeedViewer() {
        val preview = FeedLinkPreview("https://example.com/article", "example.com", "An article", null, null, null)
        var requestedUrl: String? = null
        var requestedAccountId: String? = null
        composeRule.setContent {
            MaterialTheme {
                LazyColumn(Modifier.fillMaxSize().testTag("feed-link-test-list")) {
                    item {
                        FeedCard(
                            post = postWithPreview(null).copy(text = "Read https://example.com/article"),
                            currentAccountId = "viewer-7",
                            onResolveFeedLinkPreview = { url, accountId, complete ->
                                requestedUrl = url
                                requestedAccountId = accountId
                                complete(preview)
                            },
                        )
                    }
                }
            }
        }

        composeRule.waitUntil(5_000) { requestedUrl != null }
        composeRule.onNodeWithTag("feed-link-test-list").performScrollToNode(hasContentDescription("An article, opens example.com"))
        composeRule.onNodeWithTag("feed-link-preview", useUnmergedTree = true).assertIsDisplayed()
        composeRule.runOnIdle {
            assertEquals("https://example.com/article", requestedUrl)
            assertEquals("viewer-7", requestedAccountId)
        }
    }

    @Test
    fun internalNanttyPostLinkResolvesAndOpensTheResolvedContent() {
        var requested: SharedContentReference? = null
        var opened: SharedContentCard? = null
        val reference = SharedContentReference("post", "post-42")
        val card = SharedContentCard(reference, "available", "A shared post", "@ari", null, null, null, false, null, true, "user-42")
        composeRule.setContent {
            MaterialTheme {
                LazyColumn(Modifier.fillMaxSize().testTag("feed-link-test-list")) {
                    item {
                        FeedCard(
                            post = postWithPreview(null).copy(text = "Read more at https://www.nantty.com/posts/post-42"),
                            onResolveSharedContent = { target, complete -> requested = target; complete(SharedContentResult.Success(card)) },
                            onOpenSharedContent = { opened = it },
                        )
                    }
                }
            }
        }

        composeRule.waitUntil(5_000) { requested != null }
        composeRule.onNodeWithTag("feed-link-test-list").performScrollToNode(hasContentDescription("A shared post, @ari"))
        composeRule.onNodeWithText("A shared post").assertIsDisplayed()
        composeRule.onNodeWithTag("feed-shared-content-card", useUnmergedTree = true).performClick()
        composeRule.runOnIdle {
            assertEquals(reference, requested)
            assertEquals(card, opened)
        }
    }

    @Test
    fun internalLinkPreviewContinuesAfterGuestSignIn() {
        val reference = SharedContentReference("profile", "ari")
        val card = SharedContentCard(reference, "available", "Ari", "@ari", null, null, null, false, null, false, "user-ari")
        var promptedForSignIn = false
        var resolvedAfterSignIn = false
        composeRule.setContent {
            MaterialTheme {
                LazyColumn(Modifier.fillMaxSize()) {
                    item {
                        FeedSharedContentCard(
                            reference = reference,
                            resolve = { _, complete ->
                                if (resolvedAfterSignIn) complete(SharedContentResult.Success(card))
                                else complete(SharedContentResult.AuthenticationRequired)
                            },
                            onOpen = {},
                            onRequireSignInWithAction = { resume ->
                                promptedForSignIn = true
                                resolvedAfterSignIn = true
                                resume()
                            },
                        )
                    }
                }
            }
        }
        composeRule.onNodeWithText("Sign in to preview this Nantty link").performClick()
        composeRule.waitUntil(5_000) { resolvedAfterSignIn }
        composeRule.onNodeWithText("Ari").assertIsDisplayed()
        composeRule.runOnIdle { assertEquals(true, promptedForSignIn) }
    }

    private fun postWithPreview(preview: FeedLinkPreview?) = FeedPost(
        id = "post-link",
        authorName = "Ari",
        username = "ari",
        avatarUrl = null,
        verified = false,
        verificationColor = null,
        postedAsName = null,
        postedAsHandle = null,
        postedAsAvatarUrl = null,
        kind = "post",
        text = "A feed post",
        media = emptyList(),
        likes = 0,
        comments = 0,
        reposts = 0,
        shares = 0,
        createdAt = "2026-11-07T10:00:00Z",
        linkPreview = preview,
    )
}
