package com.nantty.android.ui.stories

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoriesTransport
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.StoryItem
import com.nantty.android.data.StoryTrayEntry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class StoriesViewerTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun previouslySeenStoriesStillCountTowardTheSessionAdCadence() {
        compose.mainClock.autoAdvance = false
        val session = AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
        val repository = StoriesRepository(
            sessionProvider = { session },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject = JSONObject(
                    """{"data":[
                        {"id":"story-seen","author":{"id":"author-1","name":"Ada","username":"ada"},"media":{"id":"media-1","type":"image","url":"https://cdn.nantty.com/one.jpg","status":"ready"},"createdAt":"2026-11-06T10:00:00.000Z","seen":true},
                        {"id":"story-unseen","author":{"id":"author-1","name":"Ada","username":"ada"},"media":{"id":"media-2","type":"image","url":"https://cdn.nantty.com/two.jpg","status":"ready"},"createdAt":"2026-11-06T10:01:00.000Z","seen":false}
                    ]}""",
                )
                override fun post(path: String, accessToken: String) = JSONObject()
            },
        )
        val adSession = StoryAdSession("story_ads_test")

        compose.setContent {
            MaterialTheme {
                StoryViewerDialog(
                    repository = repository,
                    userId = "author-1",
                    executor = Executor { it.run() },
                    adSession = adSession,
                    onClose = {},
                    onReauthenticate = {},
                )
            }
        }

        compose.onNodeWithText("Ada").assertIsDisplayed()
        compose.mainClock.advanceTimeBy(1L)
        compose.waitForIdle()
        compose.runOnIdle { assertEquals(1, adSession.viewedCount) }
        compose.onNodeWithTag("story-next").performClick()
        compose.mainClock.advanceTimeBy(1L)
        compose.waitForIdle()
        compose.runOnIdle { assertEquals(2, adSession.viewedCount) }
    }

    @Test
    fun storyTrayExposesAccessibleStoryItemsAndSelection() {
        var selectedUserId: String? = null
        compose.setContent {
            MaterialTheme {
                StoriesTray(
                    entries = listOf(StoryTrayEntry("user-1", "Ada", "ada", null, true)),
                    onStorySelected = { selectedUserId = it },
                )
            }
        }

        compose.onNodeWithContentDescription("View Ada's unseen story").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals("user-1", selectedUserId) }
    }

    @Test
    fun ownerStoryAnalyticsShowsMetricsAndLoadsNextViewerPage() {
        val session = AccountSession("access", "refresh", AccountUser("author-1", "Ada", "ada", null, null, emptyList()))
        val requestedPaths = mutableListOf<String>()
        val repository = StoriesRepository(
            sessionProvider = { session },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject {
                    requestedPaths += path
                    return when {
                        path == "/api/v1/posts/story-1/analytics" -> JSONObject("""{"data":{"impressions":20,"uniqueViewers":12,"likes":3,"comments":2,"shares":3,"profileVisits":1,"newFollows":1,"postedAt":"2026-11-06T10:00:00.000Z"}}""")
                        path == "/api/v1/stories/story-1/viewers" -> JSONObject("""{"data":{"viewers":[{"id":"viewer-1","name":"Sam","username":"sam"}],"total":22,"nextCursor":"next"}}""")
                        path == "/api/v1/stories/story-1/viewers?cursor=next" -> JSONObject("""{"data":{"viewers":[{"id":"viewer-2","name":"Lee","username":"lee"}],"total":22,"nextCursor":null}}""")
                        else -> JSONObject()
                    }
                }
                override fun post(path: String, accessToken: String) = JSONObject()
            },
        )
        val story = StoryItem("story-1", "author-1", "Ada", "ada", null, FeedMedia("media", "image", "https://cdn.nantty.com/story.jpg", null, null, null), "", true, null, null)

        compose.setContent {
            MaterialTheme {
                StoryAnalyticsDialog(repository, story, Executor { it.run() }, onDismiss = {}, onReauthenticate = {})
            }
        }

        compose.onNodeWithTag("story-analytics-metrics").assertIsDisplayed()
        compose.onNodeWithText("Likes").assertIsDisplayed()
        compose.onNodeWithText("Comments").assertIsDisplayed()
        compose.onAllNodesWithText("Impressions").assertCountEquals(0)
        compose.onNodeWithText("Unique viewers").assertIsDisplayed()
        compose.onNodeWithText("3").assertIsDisplayed()
        compose.onNodeWithText("22").assertIsDisplayed()
        compose.onNodeWithText("Sam").assertIsDisplayed()
        compose.onNodeWithTag("story-viewers-load-more").performClick()
        compose.onNodeWithText("Lee").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(listOf("/api/v1/posts/story-1/analytics", "/api/v1/stories/story-1/viewers", "/api/v1/stories/story-1/viewers?cursor=next"), requestedPaths)
        }
    }

    @Test
    fun storyAnalyticsEntryIsHiddenFromNonOwners() {
        val session = AccountSession("access", "refresh", AccountUser("viewer-1", "Viewer", "viewer", null, null, emptyList()))
        val repository = StoriesRepository(
            sessionProvider = { session },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject = JSONObject(
                    """{"data":[{"id":"story-1","author":{"id":"author-1","name":"Ada","username":"ada"},"media":{"id":"media-1","type":"image","url":"https://cdn.nantty.com/story.jpg","status":"ready"},"createdAt":"2026-11-06T10:00:00.000Z","seen":true}]}""",
                )
                override fun post(path: String, accessToken: String) = JSONObject()
            },
        )

        compose.setContent {
            MaterialTheme {
                StoryViewerDialog(
                    repository = repository,
                    userId = "author-1",
                    executor = Executor { it.run() },
                    onClose = {},
                    onReauthenticate = {},
                )
            }
        }

        compose.onNodeWithTag("story-options").performClick()
        compose.onNodeWithTag("story-options-analytics").assertDoesNotExist()
        compose.onNodeWithTag("story-options-report").assertIsDisplayed()
    }

    @Test
    fun storyViewerShowsStoriesAndAdvancesToTheNextItem() {
        val session = AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
        var seenStoryIds = emptyList<String>()
        var requestedNextAuthor = false
        val repository = StoriesRepository(
            sessionProvider = { session },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject = JSONObject(
                    """{"data":[
                        {"id":"story-1","author":{"id":"author-1","name":"Ada","username":"ada"},"media":{"id":"media-1","type":"image","url":"https://cdn.nantty.com/one.jpg","status":"ready"},"createdAt":"2026-11-06T10:00:00.000Z","seen":true},
                        {"id":"story-2","author":{"id":"author-1","name":"Ada","username":"ada"},"media":{"id":"media-2","type":"image","url":"https://cdn.nantty.com/two.jpg","status":"ready"},"createdAt":"2026-11-06T10:01:00.000Z","seen":true}
                    ]}""",
                )
                override fun post(path: String, accessToken: String): JSONObject {
                    seenStoryIds = seenStoryIds + path.substringAfterLast('/').removeSuffix("/seen")
                    return JSONObject()
                }
            },
        )

        compose.setContent {
            MaterialTheme {
                StoryViewerDialog(
                    repository,
                    "author-1",
                    Executor { it.run() },
                    onClose = {},
                    onNextUser = { requestedNextAuthor = true },
                    onReauthenticate = {},
                )
            }
        }

        compose.onNodeWithText("Ada").assertIsDisplayed()
        compose.onNodeWithTag("story-report-author").assertIsDisplayed().performClick()
        compose.onNodeWithText("Report account").assertIsDisplayed()
        compose.onNodeWithTag("story-report-dismiss").performClick()
        compose.onNodeWithTag("story-next").performClick()
        compose.onNodeWithTag("story-viewer").assertIsDisplayed()
        compose.onNodeWithContentDescription("Close stories").assertIsDisplayed()
        compose.onNodeWithTag("story-next").performClick()
        compose.runOnIdle {
            assertEquals(emptyList<String>(), seenStoryIds)
            assertEquals(true, requestedNextAuthor)
        }
    }

    @Test
    fun imageStoryProgressPausesWithOptionsAndResumesAfterOptionsClose() {
        compose.mainClock.autoAdvance = false
        val session = AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
        var advancedToNextUser = false
        val repository = StoriesRepository(
            sessionProvider = { session },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject = JSONObject(
                    """{"data":[{"id":"story-1","author":{"id":"author-1","name":"Ada","username":"ada"},"media":{"id":"media-1","type":"image","url":"https://cdn.nantty.com/one.jpg","status":"ready"},"createdAt":"2026-11-06T10:00:00.000Z","seen":true}]}""",
                )
                override fun post(path: String, accessToken: String) = JSONObject()
            },
        )

        compose.setContent {
            MaterialTheme {
                StoryViewerDialog(
                    repository,
                    "author-1",
                    Executor { it.run() },
                    onClose = {},
                    onNextUser = { advancedToNextUser = true },
                    onReauthenticate = {},
                )
            }
        }

        compose.waitForIdle()
        compose.mainClock.advanceTimeBy(1_000L)
        compose.waitForIdle()
        val beforeOptions = compose.onNodeWithTag("story-progress").fetchSemanticsNode()
            .config[SemanticsProperties.ProgressBarRangeInfo].current
        assertTrue(beforeOptions > 0f)

        compose.onNodeWithTag("story-options").performClick()
        compose.mainClock.advanceTimeBy(6_000L)
        compose.waitForIdle()
        val whileOptionsOpen = compose.onNodeWithTag("story-progress").fetchSemanticsNode()
            .config[SemanticsProperties.ProgressBarRangeInfo].current
        assertEquals(beforeOptions, whileOptionsOpen, 0.001f)
        assertEquals(false, advancedToNextUser)

        compose.onNodeWithTag("story-options-report").performClick()
        compose.mainClock.advanceTimeBy(STORY_IMAGE_DURATION_MS)
        compose.waitForIdle()
        assertTrue(advancedToNextUser)
    }

    @Test
    fun ownerCanConfirmDeletionFromStoryOptionsAndViewerReloads() {
        val session = AccountSession("access", "refresh", AccountUser("author-1", "Ada", "ada", null, null, emptyList()))
        val deletedPaths = mutableListOf<String>()
        var storyLoads = 0
        val repository = StoriesRepository(
            sessionProvider = { session },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject {
                    if (path == "/api/v1/users/author-1/stories") {
                        storyLoads++
                        return if (storyLoads == 1) JSONObject(
                            """{"data":[{"id":"story-1","author":{"id":"author-1","name":"Ada","username":"ada"},"media":{"id":"media-1","type":"image","url":"https://cdn.nantty.com/one.jpg","status":"ready"},"createdAt":"2026-11-06T10:00:00.000Z","seen":true}]}""",
                        ) else JSONObject("""{"data":[]}""")
                    }
                    return JSONObject()
                }
                override fun post(path: String, accessToken: String) = JSONObject()
                override fun delete(path: String, accessToken: String, idempotencyKey: String) = JSONObject().also {
                    deletedPaths += "$path|$accessToken|$idempotencyKey"
                }
            },
        )

        compose.setContent {
            MaterialTheme {
                StoryViewerDialog(repository, "author-1", Executor { it.run() }, onClose = {}, onReauthenticate = {})
            }
        }

        compose.onNodeWithTag("story-options").performClick()
        compose.onNodeWithTag("story-options-delete").assertIsDisplayed().performClick()
        compose.onNodeWithText("Delete story?").assertIsDisplayed()
        compose.onNodeWithText("Delete", useUnmergedTree = true).performClick()
        compose.onNodeWithText("No stories right now").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(1, deletedPaths.size)
            assertEquals(true, deletedPaths.single().startsWith("/api/v1/posts/story-1|access|"))
            assertEquals(2, storyLoads)
        }
    }
}
