package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.SavedPostsHttpException
import com.nantty.android.data.SavedPostsTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class SavedPostsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun loadsAuthenticatedSavedPostAndOpensExistingPostDetail() {
        val transport = FakeTransport()
        var openedPost: String? = null
        compose.setContent {
            MaterialTheme {
                SavedPostsScreen(
                    SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() },
                    onBack = {},
                    onOpenPost = { openedPost = it },
                    onAuthenticationRequired = {},
                )
            }
        }

        compose.onNodeWithText("Saved posts").assertIsDisplayed()
        compose.onNodeWithText("A saved post").assertIsDisplayed().performClick()
        compose.runOnIdle {
            assertEquals("/api/v1/saves?type=post", transport.paths.first())
            assertEquals("saved-token", transport.tokens.first())
            assertEquals("d2222222-2222-4222-8222-222222222222", openedPost)
        }
    }

    @Test
    fun rendersExplicitEmptyState() {
        compose.setContent {
            MaterialTheme {
                SavedPostsScreen(
                    SavedPostsRepository("https://api.nantty.com", ::signedInSession, FakeTransport(empty = true)),
                    Executor { it.run() }, {}, {}, {},
                )
            }
        }

        compose.onNodeWithText("No saved posts yet").assertIsDisplayed()
        compose.onNodeWithText("Save a post from your feed and it will be easy to find here.").assertIsDisplayed()
    }

    @Test
    fun videoFilterLoadsTheSavedVideoPostThroughExistingEndpoint() {
        val transport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                SavedPostsScreen(
                    SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() }, {}, {}, {},
                )
            }
        }

        compose.onNodeWithText("Videos").performClick()
        compose.onNodeWithText("Saved videos").assertIsDisplayed()
        compose.onNodeWithText("A saved video").assertIsDisplayed()
        compose.runOnIdle { assertEquals("/api/v1/saves?type=video", transport.paths.last()) }
    }

    @Test
    fun initialFailureCanRetryWithoutLosingTheScreen() {
        val transport = FakeTransport(failFirst = true)
        compose.setContent {
            MaterialTheme {
                SavedPostsScreen(
                    SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() }, {}, {}, {},
                )
            }
        }

        compose.onNodeWithText("Saved posts are unavailable").assertIsDisplayed()
        compose.onNodeWithText("Retry").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("A saved post").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, transport.calls) }
    }

    @Test
    fun loadingStateAppearsWhileTheRequestIsPending() {
        val transport = FakeTransport()
        val queued = QueuedExecutor()
        compose.setContent {
            MaterialTheme {
                SavedPostsScreen(
                    SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport),
                    queued, {}, {}, {},
                )
            }
        }

        compose.onNodeWithText("Loading saved posts").assertIsDisplayed()
        compose.runOnIdle { queued.runAll() }
        compose.onNodeWithText("A saved post").assertIsDisplayed()
    }

    @Test
    fun expiredSessionOffersSignInRecovery() {
        var recoveryRequested = false
        val transport = FakeTransport(unauthorized = true)
        compose.setContent {
            MaterialTheme {
                SavedPostsScreen(
                    SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() }, {}, {}, { recoveryRequested = true },
                )
            }
        }

        compose.onNodeWithText("Sign in to continue").assertIsDisplayed()
        compose.onNodeWithText("Sign in again").performClick()
        compose.runOnIdle { assertEquals(true, recoveryRequested) }
    }

    @Test
    fun exposesCursorLoadMoreAndAppendsOnlyNewSavedRows() {
        val transport = FakeTransport(twoPages = true)
        compose.setContent {
            MaterialTheme {
                SavedPostsScreen(
                    SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() }, {}, {}, {},
                )
            }
        }

        compose.onNodeWithText("Load more saved posts").performScrollTo().performClick()
        compose.onNodeWithText("Second saved post").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Duplicate saved row").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals("/api/v1/saves?type=post&cursor=d3333333-3333-4333-8333-333333333333", transport.paths.last())
            assertEquals("saved-token", transport.tokens.last())
            assertEquals("/api/v1/saves?type=post", transport.paths.first())
        }
    }

    @Test
    fun cursorFailureOffersRetryAndKeepsExistingPostsVisible() {
        val transport = FakeTransport(failCursor = true)
        compose.setContent {
            MaterialTheme {
                SavedPostsScreen(
                    SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() }, {}, {}, {},
                )
            }
        }

        compose.onNodeWithText("Load more saved posts").performScrollTo().performClick()
        compose.onNodeWithText("Couldn't load the next page.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("A saved post").assertIsDisplayed()
        compose.onNodeWithText("Try again").performScrollTo().performClick()
        compose.onNodeWithText("Second saved post").performScrollTo().assertIsDisplayed()
    }

    private class FakeTransport(
        private val empty: Boolean = false,
        private val failFirst: Boolean = false,
        private val twoPages: Boolean = false,
        private val failCursor: Boolean = false,
        private val unauthorized: Boolean = false,
    ) : SavedPostsTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String>()
        var calls = 0

        override fun get(path: String, accessToken: String): JSONObject {
            calls += 1
            paths += path
            tokens += accessToken
            if (unauthorized) throw SavedPostsHttpException(401)
            if (failFirst && calls == 1) error("Offline")
            if (failCursor && path.contains("cursor=") && calls == 2) error("Offline")
            if (empty) return JSONObject("""{"data":[],"nextCursor":null}""")
            if (path.contains("cursor=")) return JSONObject("""{"data":[${savedItem("d1111111-1111-4111-8111-111111111111", "d2222222-2222-4222-8222-222222222222", "Duplicate saved row")},${savedItem("e1111111-1111-4111-8111-111111111111", "e2222222-2222-4222-8222-222222222222", "Second saved post")}],"nextCursor":null}""")
            if (path.contains("type=video")) return JSONObject("""{"data":[${savedItem("d1111111-1111-4111-8111-111111111111", "d2222222-2222-4222-8222-222222222222", "A saved video", "video")}],"nextCursor":null}""")
            val nextCursor = if (twoPages || failCursor) "d3333333-3333-4333-8333-333333333333" else null
            return JSONObject("""{"data":[${savedItem("d1111111-1111-4111-8111-111111111111", "d2222222-2222-4222-8222-222222222222", "A saved post")}],"nextCursor":${nextCursor?.let { "\"$it\"" } ?: "null"}}""")
        }

        private fun savedItem(saveId: String, postId: String, text: String, type: String = "post"): String {
            val media = if (type == "video") """[{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","type":"video","status":"ready","url":"https://cdn.nantty.com/saved.mp4","posterUrl":"https://cdn.nantty.com/saved-poster.jpg"}]""" else "[]"
            return """{"id":"$saveId","type":"$type","targetId":"$postId","savedAt":"2026-11-02T10:00:00Z","post":{"id":"$postId","kind":"post","text":"$text","createdAt":"2026-11-02T09:00:00Z","author":{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"Ari","username":"ari"},"media":$media}}"""
        }
    }

    private fun signedInSession() = AccountSession("saved-token", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))

    private class QueuedExecutor : Executor {
        private val tasks = mutableListOf<Runnable>()
        override fun execute(command: Runnable) { tasks += command }
        fun runAll() { tasks.toList().also { tasks.clear() }.forEach(Runnable::run) }
    }
}
