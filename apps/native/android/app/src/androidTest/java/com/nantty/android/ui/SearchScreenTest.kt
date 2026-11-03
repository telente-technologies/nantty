package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SearchTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class SearchScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun signedOutGuestCanSearchAndRequestHasNoBearerToken() {
        val transport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", { null }, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Search posts on Nantty").assertIsDisplayed()
        searchFor("open posts")

        compose.onNodeWithText("A real post result").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals("/api/v1/search?q=open%20posts&scope=global&type=top&limit=10", transport.paths.first())
            assertNull(transport.tokens.first())
        }
    }

    @Test
    fun failedSearchCanBeRetried() {
        val transport = FakeTransport(failFirst = true)
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        searchFor("retry me")
        compose.onNodeWithText("Search is unavailable").assertIsDisplayed()
        compose.onNodeWithText("Try again").performClick()
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()

        compose.onNodeWithText("A real post result").assertIsDisplayed()
    }

    @Test
    fun showsLoadingStateUntilTheSearchRequestCompletes() {
        val transport = FakeTransport()
        val executor = QueuedExecutor()
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), executor)
            }
        }

        compose.onNode(hasSetTextAction()).performTextInput("wait for it")
        compose.mainClock.advanceTimeBy(400)
        compose.onNodeWithText("Searching Nantty…").assertIsDisplayed()
        executor.runNext()
        compose.waitForIdle()
        compose.onNodeWithText("A real post result").assertIsDisplayed()
    }

    @Test
    fun unsupportedTopResultTypesProduceHonestEmptyState() {
        val transport = FakeTransport(usersOnly = true)
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Posts").performClick()
        searchFor("a person")

        compose.onNodeWithText("No posts found").assertIsDisplayed()
        compose.onNodeWithText("Unsupported user result").assertDoesNotExist()
    }

    @Test
    fun opensReactNativePeopleSearchResultAsPublicProfile() {
        val transport = FakeTransport(usersOnly = true)
        var openedProfile: String? = null
        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    SearchRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() },
                    onOpenProfile = { openedProfile = it },
                )
            }
        }

        compose.onNodeWithText("People").performClick()
        searchFor("ari")
        compose.onNodeWithContentDescription("Open Ari, @ari's profile").performClick()
        compose.runOnIdle {
            assertEquals("user-1", openedProfile)
            assertEquals("/api/v1/search?q=ari&scope=global&type=people&limit=10", transport.paths.first())
        }
    }

    @Test
    fun opensSupportedPostResultInExistingPostDestination() {
        val transport = FakeTransport()
        var openedPost: String? = null
        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    SearchRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() },
                    onOpenPost = { openedPost = it },
                )
            }
        }

        searchFor("first")
        compose.onNodeWithContentDescription("Open post: A real post result").performClick()
        compose.runOnIdle { assertEquals("post-1", openedPost) }
    }

    @Test
    fun loadsNextCursorPageAndAppendsDistinctPosts() {
        val transport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        searchFor("paginate")
        compose.onNodeWithText("Load more posts").assertIsDisplayed().performClick()
        compose.onNodeWithText("Another API post").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals("/api/v1/search?q=paginate&scope=global&type=top&limit=10&cursor=next-page", transport.paths.last())
            assertEquals("search-token", transport.tokens.last())
        }
    }

    private fun searchFor(query: String) {
        compose.onNode(hasSetTextAction()).performTextInput(query)
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
    }

    private class FakeTransport(
        private val failFirst: Boolean = false,
        private val usersOnly: Boolean = false,
    ) : SearchTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()

        override fun request(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            if (failFirst && paths.size == 1) error("Offline")
            if (path.contains("cursor=")) return JSONObject("""{"data":[{"type":"post","id":"post-2","caption":"Another API post","likes":2,"views":5}],"nextCursor":null,"scope":"global"}""")
            if (usersOnly) return JSONObject("""{"data":[{"type":"user","id":"user-1","name":"Ari","username":"ari","verified":true}],"nextCursor":null,"scope":"global"}""")
            return JSONObject("""{"data":[{"type":"post","id":"post-1","caption":"A real post result","thumbnailUrl":"https://cdn.nantty.com/post.jpg","likes":4,"views":12}],"nextCursor":"next-page","scope":"global"}""")
        }
    }

    private class QueuedExecutor : Executor {
        private val tasks = ArrayDeque<Runnable>()
        override fun execute(command: Runnable) { tasks.addLast(command) }
        fun runNext() { tasks.removeFirst().run() }
    }

    companion object {
        private fun signedInSession() = AccountSession("search-token", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
    }
}
