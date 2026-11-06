package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.ClipboardManager
import android.content.Context
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.FeedPost
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FeedMediaGalleryTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun imagePreviewKeepsPagerAndRunsFeedActionsForItsPost() {
        var liked = false
        var reposted = false
        var saved = false
        var shared = false
        compose.setContent {
            MaterialTheme {
                FeedMediaGallery(
                    media = listOf(image("image-1"), video("video-1"), image("image-2")),
                    post = post(),
                    onLike = { liked = true },
                    onOpenComments = {},
                    onRepost = { reposted = true },
                    onSave = { saved = true },
                    saveBusy = false,
                    onShare = { shared = true },
                )
            }
        }

        compose.onNodeWithContentDescription("Open image 1 of 2 full screen").performClick()
        compose.onNodeWithContentDescription("Photo 1 of 2").assertIsDisplayed()
        compose.onNodeWithContentDescription("Show next photo").performClick()
        compose.onNodeWithContentDescription("Photo 2 of 2").assertIsDisplayed()
        compose.onNodeWithTag("feed-media-like").performClick()
        compose.onNodeWithTag("feed-media-repost").performClick()
        compose.onNodeWithTag("feed-media-save").performClick()
        compose.onNodeWithTag("feed-media-share").performClick()
        compose.onNodeWithTag("feed-media-share-link").performClick()
        compose.runOnIdle {
            assertEquals(true, liked)
            assertEquals(true, reposted)
            assertEquals(true, saved)
            assertEquals(true, shared)
        }
        compose.onNodeWithContentDescription("Show previous photo").performClick()
        compose.onNodeWithContentDescription("Photo 1 of 2").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close image preview").performClick()
        compose.runOnIdle {
            assertTrue(compose.onAllNodesWithContentDescription("Photo 1 of 2").fetchSemanticsNodes().isEmpty())
        }
    }

    @Test
    fun videoPosterOpensPreviewWithFeedActionsAndClose() {
        var liked = false
        var reposted = false
        var saved = false
        var shared = false
        compose.setContent {
            MaterialTheme {
                FeedMediaGallery(
                    media = listOf(image("image-1"), video("video-1")),
                    post = post(),
                    onLike = { liked = true },
                    onOpenComments = {},
                    onRepost = { reposted = true },
                    onSave = { saved = true },
                    saveBusy = false,
                    onShare = { shared = true },
                )
            }
        }

        compose.onNodeWithContentDescription("Show next media").performClick()
        compose.onNodeWithText("Play video").assertIsDisplayed()
        compose.onNodeWithContentDescription("Open video").performClick()
        compose.onNodeWithTag("clip-video-player").assertIsDisplayed()
        compose.onNodeWithContentDescription("Pause video").assertIsDisplayed()
        compose.onNodeWithContentDescription("Unmute video").performClick()
        compose.onNodeWithContentDescription("Mute video").assertIsDisplayed()
        compose.onNodeWithContentDescription("Pause video").performClick()
        compose.onNodeWithContentDescription("Play video").assertIsDisplayed()
        compose.onNodeWithTag("feed-media-like").performClick()
        compose.onNodeWithTag("feed-media-repost").performClick()
        compose.onNodeWithTag("feed-media-save").performClick()
        compose.onNodeWithTag("feed-media-share").performClick()
        compose.onNodeWithTag("feed-media-share-link").performClick()
        compose.runOnIdle {
            assertEquals(true, liked)
            assertEquals(true, reposted)
            assertEquals(true, saved)
            assertEquals(true, shared)
        }
        compose.onNodeWithContentDescription("Close video preview").performClick()
        compose.runOnIdle { assertTrue(compose.onAllNodesWithTag("clip-video-player").fetchSemanticsNodes().isEmpty()) }
    }

    @Test
    fun commentsActionClosesPhotoAndVideoPreviewBeforeOpeningConversation() {
        var commentsOpened = 0
        compose.setContent {
            MaterialTheme {
                FeedMediaGallery(
                    media = listOf(image("image-1"), video("video-1")),
                    post = post(),
                    onLike = {},
                    onOpenComments = { commentsOpened += 1 },
                    onRepost = {},
                    onSave = {},
                    saveBusy = false,
                    onShare = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Open image 1 of 1 full screen").performClick()
        compose.onNodeWithTag("feed-media-comments").performClick()
        compose.runOnIdle {
            assertTrue(compose.onAllNodesWithContentDescription("Close image preview").fetchSemanticsNodes().isEmpty())
        }

        compose.onNodeWithContentDescription("Show next media").performClick()
        compose.onNodeWithContentDescription("Open video").performClick()
        compose.onNodeWithTag("feed-media-comments").performClick()
        compose.runOnIdle {
            assertTrue(compose.onAllNodesWithContentDescription("Close video preview").fetchSemanticsNodes().isEmpty())
        }
        compose.runOnIdle { assertEquals(2, commentsOpened) }
    }

    @Test
    fun previewDoesNotExposeMutationActionsWithoutHandlersButKeepsCommentsAvailable() {
        compose.setContent {
            MaterialTheme {
                FeedMediaGallery(
                    media = listOf(image("image-1")),
                    post = post(),
                    onLike = null,
                    onOpenComments = {},
                    onRepost = null,
                    onSave = null,
                    saveBusy = false,
                    onShare = null,
                )
            }
        }

        compose.onNodeWithContentDescription("Open image 1 of 1 full screen").performClick()
        compose.onNodeWithTag("feed-media-like").assertDoesNotExist()
        compose.onNodeWithTag("feed-media-repost").assertDoesNotExist()
        compose.onNodeWithTag("feed-media-share").assertDoesNotExist()
        compose.onNodeWithTag("feed-media-save").assertDoesNotExist()
        compose.onNodeWithTag("feed-media-comments").assertIsDisplayed()
    }

    @Test
    fun imageViewerCopiesPostLinkFromShareMenu() {
        compose.setContent {
            MaterialTheme {
                FeedMediaGallery(
                    media = listOf(image("image-copy")),
                    post = post(),
                    onLike = {},
                    onOpenComments = {},
                    onRepost = {},
                    onSave = {},
                    saveBusy = false,
                    onShare = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Open image 1 of 1 full screen").performClick()
        compose.onNodeWithTag("feed-media-share").performClick()
        compose.onNodeWithTag("feed-media-copy-link").performClick()

        val clipboard = ApplicationProvider.getApplicationContext<Context>()
            .getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        assertEquals("https://web.nantty.com/post/post-media-actions", clipboard.primaryClip?.getItemAt(0)?.text?.toString())
    }

    private fun post() = FeedPost(
        id = "post-media-actions", authorName = "Ari", username = "ari", avatarUrl = null,
        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
        postedAsAvatarUrl = null, kind = "post", text = "Media actions", media = emptyList(),
        likes = 2, comments = 3, reposts = 4, shares = 5, createdAt = "2026-11-06T10:00:00Z",
    )

    private fun image(id: String) = FeedMedia(id, "image", "https://cdn.nantty.com/$id.jpg", null, 1200, 800)

    private fun video(id: String) = FeedMedia(id, "video", "https://cdn.nantty.com/$id.mp4", "https://cdn.nantty.com/$id-poster.jpg", 1920, 1080)
}
