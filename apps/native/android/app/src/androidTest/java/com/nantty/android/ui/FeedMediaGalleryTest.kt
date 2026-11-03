package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.FeedMedia
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FeedMediaGalleryTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun imageOpensGalleryAtItsOwnIndexAndSupportsAccessibleNextPreviousAndClose() {
        compose.setContent {
            MaterialTheme {
                FeedMediaGallery(listOf(image("image-1"), video("video-1"), image("image-2")))
            }
        }

        compose.onNodeWithContentDescription("Open image 1 of 2 full screen").performClick()
        compose.onNodeWithContentDescription("Photo 1 of 2").assertIsDisplayed()
        compose.onNodeWithContentDescription("Show next photo").performClick()
        compose.onNodeWithContentDescription("Photo 2 of 2").assertIsDisplayed()
        compose.onNodeWithContentDescription("Show previous photo").performClick()
        compose.onNodeWithContentDescription("Photo 1 of 2").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close image preview").performClick()
        compose.onNodeWithContentDescription("Photo 1 of 2").assertDoesNotExist()
    }

    @Test
    fun videoPosterIsExplicitlyUnavailableAndHasNoPlayAction() {
        compose.setContent {
            MaterialTheme {
                FeedMediaGallery(listOf(image("image-1"), video("video-1")))
            }
        }

        compose.onNodeWithContentDescription("Show next media").performClick()
        compose.onNodeWithContentDescription("Video thumbnail. Playback is not available in this app yet.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Play video").assertDoesNotExist()
    }

    private fun image(id: String) = FeedMedia(id, "image", "https://cdn.nantty.com/$id.jpg", null, 1200, 800)

    private fun video(id: String) = FeedMedia(id, "video", "https://cdn.nantty.com/$id.mp4", "https://cdn.nantty.com/$id-poster.jpg", 1920, 1080)
}
