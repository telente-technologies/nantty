package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.ClipFeedItem
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.FeedPost
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SuggestedClipsFeedModuleTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun rendersClipPosterAuthorTitleAndAccessibleActions() {
        compose.setContent {
            MaterialTheme {
                SuggestedClipsFeedModule(
                    clips = listOf(clip("clip-1", "A short behind-the-scenes clip")),
                    onOpenClip = {},
                    onMore = {},
                )
            }
        }

        compose.onNodeWithTag("feed-suggested-clips").assertIsDisplayed()
        compose.onNodeWithTag("suggested-clips-row").assertIsDisplayed()
        compose.onNodeWithTag("suggested-clip-clip-1").assertIsDisplayed()
        compose.onNodeWithTag("suggested-clip-poster-clip-1").assertIsDisplayed()
        compose.onNodeWithContentDescription("Play suggested clip by Ada Okafor").assertIsDisplayed()
        compose.onNodeWithTag("suggested-clips-more").assertIsDisplayed().assertHasClickAction()
    }

    @Test
    fun opensSelectedClipAndPassesItsIdToMoreCallback() {
        var openedId: String? = null
        var moreIds: List<String>? = null
        compose.setContent {
            MaterialTheme {
                SuggestedClipsFeedModule(
                    clips = listOf(clip("clip-42", "Studio update"), clip("clip-43", "Second clip")),
                    onOpenClip = { openedId = it },
                    onMore = { moreIds = it },
                )
            }
        }

        compose.onNodeWithTag("suggested-clip-clip-42").performClick()
        compose.onNodeWithTag("suggested-clips-more").performClick()
        compose.runOnIdle {
            assertEquals("clip-42", openedId)
            assertEquals(listOf("clip-42", "clip-43"), moreIds)
        }
    }

    @Test
    fun rendersNothingForEmptyClipList() {
        compose.setContent {
            MaterialTheme {
                SuggestedClipsFeedModule(clips = emptyList(), onOpenClip = {}, onMore = {})
            }
        }

        compose.onNodeWithTag("feed-suggested-clips").assertDoesNotExist()
    }

    private fun clip(id: String, title: String) = ClipFeedItem(
        post = FeedPost(
            id = id,
            authorName = "Ada Okafor",
            username = "ada",
            avatarUrl = null,
            verified = false,
            verificationColor = null,
            postedAsName = null,
            postedAsHandle = null,
            postedAsAvatarUrl = null,
            kind = "clip",
            text = title,
            media = listOf(FeedMedia("media-$id", "video", "https://cdn.nantty.test/$id.mp4", "https://cdn.nantty.test/$id.jpg", 720, 1280)),
            likes = 0,
            comments = 0,
            reposts = 0,
            shares = 0,
            createdAt = "2026-11-07T10:00:00Z",
        ),
        durationSeconds = 12,
        viewerHasAccess = true,
        isFollowingAuthor = false,
        sound = null,
    )
}
