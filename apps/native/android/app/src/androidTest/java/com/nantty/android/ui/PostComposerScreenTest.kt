package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.PostComposerRepository
import com.nantty.android.data.PostComposerAudience
import com.nantty.android.data.PostPublishTransport
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.SoundsRepository
import com.nantty.android.data.SoundsTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class PostComposerScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun signedInUserPublishesTextAndReceivesCreatedPostId() {
        val session = AccountSession("current-access", "current-refresh", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingPublishTransport()
        val repository = PostComposerRepository("https://api.nantty.com", { session }, transport)
        var publishedId: String? = null
        compose.setContent {
            MaterialTheme {
                PostComposerScreen(
                    sessionProvider = { session },
                    executor = Executor { it.run() },
                    repository = repository,
                    onCancel = {},
                    onPublished = { publishedId = it },
                )
            }
        }

        compose.onNodeWithContentDescription("Post text").performTextInput("My first native Nantty post")
        compose.onNodeWithContentDescription("Publish post").performClick()

        compose.runOnIdle {
            assertEquals("post-1", publishedId)
            assertEquals("/api/v1/posts", transport.path)
            assertEquals("current-access", transport.accessToken)
            org.junit.Assert.assertTrue(transport.idempotencyKey.matches(Regex("^[A-Za-z0-9_-]{8,128}$")))
            assertEquals("My first native Nantty post", transport.body?.getString("text"))
            assertEquals(0, transport.body?.getJSONArray("mediaIds")?.length())
        }
    }

    @Test
    fun blankTextCannotBePublished() {
        val session = AccountSession("current-access", "current-refresh", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingPublishTransport()
        compose.setContent {
            MaterialTheme {
                PostComposerScreen(
                    sessionProvider = { session },
                    executor = Executor { it.run() },
                    repository = PostComposerRepository("https://api.nantty.com", { session }, transport),
                    onCancel = {},
                    onPublished = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Publish post").assertIsDisplayed().assertIsNotEnabled()
        assertEquals(null, transport.path)
    }

    @Test
    fun selectedFollowersAudienceIsSentWhenPublishing() {
        val session = AccountSession("current-access", "current-refresh", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingPublishTransport()
        val repository = PostComposerRepository("https://api.nantty.com", { session }, transport)
        compose.setContent {
            MaterialTheme {
                PostComposerScreen(
                    sessionProvider = { session },
                    executor = Executor { it.run() },
                    repository = repository,
                    onCancel = {},
                    onPublished = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Post text").performTextInput("Only for followers")
        compose.onNodeWithContentDescription("Post audience: Followers").performClick()
        compose.onNodeWithContentDescription("Publish post").performClick()

        compose.runOnIdle {
            assertEquals(PostComposerAudience.FOLLOWERS.wireValue, transport.body?.getString("audience"))
        }
    }

    @Test
    fun postComposerExposesPhotoStoryFlowWhenItsRepositoriesAreConfigured() {
        val session = AccountSession("current-access", "current-refresh", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        compose.setContent {
            MaterialTheme {
                PostComposerScreen(
                    sessionProvider = { session },
                    executor = Executor { it.run() },
                    storiesRepository = StoriesRepository(sessionProvider = { session }),
                    soundsRepository = SoundsRepository(sessionProvider = { session }),
                    storyMediaRepository = CreatorSampleMediaRepository(sessionProvider = { session }),
                    onCancel = {},
                    onPublished = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Create story").performClick()
        compose.onNodeWithTag("story-create-title").assertIsDisplayed()
        compose.onNodeWithTag("story-photo-choose").assertIsDisplayed()
        compose.onNodeWithTag("story-camera-capture").assertIsDisplayed()
        compose.onNodeWithTag("story-camera-record-video").assertIsDisplayed()
        compose.onNodeWithTag("story-camera-capture").assertIsDisplayed()
        compose.onNodeWithTag("story-photo-publish").assertIsNotEnabled()
        compose.onNodeWithTag("story-sound-picker").assertIsDisplayed()
        compose.onNodeWithText("Warm").assertIsDisplayed()
    }

    @Test
    fun storySoundPickerListsReusableSoundsAndReturnsTheSelection() {
        val session = AccountSession("current-access", "current-refresh", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val soundId = "00000000-0000-0000-0000-000000000001"
        val sounds = SoundsRepository(
            sessionProvider = { session },
            transport = SoundsTransport { path, _ ->
                assertEquals("/api/v1/sounds/trending?limit=20", path)
                JSONObject("""{"data":{"data":[{"id":"$soundId","title":"Warm track","owner":{"name":"Ari","username":"ari"},"isOriginal":false,"allowReuse":true,"status":"available","usageCount":4}]}}""")
            },
        )
        compose.setContent {
            MaterialTheme {
                PostComposerScreen(
                    sessionProvider = { session },
                    executor = Executor { it.run() },
                    storiesRepository = StoriesRepository(sessionProvider = { session }),
                    soundsRepository = sounds,
                    storyMediaRepository = CreatorSampleMediaRepository(sessionProvider = { session }),
                    onCancel = {},
                    onPublished = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Create story").performClick()
        compose.onNodeWithTag("story-sound-picker").performClick()
        compose.waitUntil(3_000) {
            runCatching { compose.onNodeWithText("Warm track").assertIsDisplayed() }.isSuccess
        }
        compose.onNodeWithTag("story-sound-none").assertIsSelected()
        compose.onNodeWithText("Warm track").performClick()
        compose.onNodeWithTag("story-sound-picker").assertIsDisplayed()
        compose.onNodeWithText("Warm track").assertIsDisplayed()
        compose.onNodeWithTag("story-sound-$soundId").assertIsSelected()
    }

    private class RecordingPublishTransport : PostPublishTransport {
        var path: String? = null
        var accessToken: String? = null
        var idempotencyKey = ""
        var body: JSONObject? = null
        override fun publish(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
            this.path = path
            this.accessToken = accessToken
            this.idempotencyKey = idempotencyKey
            this.body = body
            return JSONObject("""{"data":{"id":"post-1"}}""")
        }
    }
}
