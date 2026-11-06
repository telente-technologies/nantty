package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SearchTransport
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class SearchRecentHistoryScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun signedInUserLoadsRecentSearchesAndSelectingOneRunsSearch() {
        val transport = RecentSearchTransport(recentEntries = listOf(recent("rain & sun")))
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithContentDescription("Search rain & sun").assertIsDisplayed().performClick()
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
        compose.onNodeWithText("A real post result").assertIsDisplayed()
        compose.runOnIdle {
            assertTrue(transport.historyRequests.any { it.method == "GET" && it.path == "/api/v1/search/recent?scope=global" })
            assertTrue(transport.searchPaths.contains("/api/v1/search?q=rain%20%26%20sun&scope=global&type=top&limit=10"))
        }
    }

    @Test
    fun signedInUserRecordsOnlyOnExplicitSubmitAndHistoryErrorsDoNotBlockSearchOrOpening() {
        val transport = RecentSearchTransport(failHistory = true)
        var opened: String? = null
        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    SearchRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() },
                    onOpenPost = { opened = it },
                )
            }
        }

        compose.onNode(hasSetTextAction()).performTextInput("explicit term")
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
        compose.runOnIdle { assertEquals(0, transport.historyRequests.count { it.method == "POST" }) }

        compose.onNode(hasSetTextAction()).performImeAction()
        compose.waitForIdle()
        compose.onNodeWithContentDescription("Open post: A real post result").performClick()
        compose.runOnIdle {
            assertEquals("post-1", opened)
            assertTrue(transport.historyRequests.count { it.method == "POST" } >= 2)
            assertTrue(transport.searchPaths.isNotEmpty())
            assertTrue(transport.historyRequests.all { it.token == "search-token" })
        }
        compose.onNodeWithText("Recent searches couldn’t be updated.").assertIsDisplayed()
    }

    @Test
    fun historyFailureIsShownAsNonBlockingNoticeAndDoesNotBlockSearch() {
        val transport = RecentSearchTransport(failHistory = true)
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }
        compose.onNodeWithText("Recent searches couldn’t be updated.").assertIsDisplayed()
        searchFor("still searchable")
        compose.onNodeWithText("A real post result").assertIsDisplayed()
        compose.onNodeWithText("Recent searches couldn’t be updated.").assertIsDisplayed()
    }

    @Test
    fun whitespaceOnlyEditsDoNotRepeatTheNormalizedSearchRequest() {
        val transport = RecentSearchTransport()
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        val field = compose.onNode(hasSetTextAction())
        field.performTextInput("shoes")
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
        assertEquals(1, transport.searchPaths.size)

        field.performTextInput(" ")
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
        assertEquals("Whitespace is trimmed before the debounce key, matching React Native.", 1, transport.searchPaths.size)
    }

    @Test
    fun guestNeverRequestsRecentHistory() {
        val transport = RecentSearchTransport()
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", { null }, transport), Executor { it.run() })
            }
        }
        searchFor("guest search")
        compose.onNodeWithText("A real post result").assertIsDisplayed()
        compose.runOnIdle {
            assertTrue(transport.searchPaths.isNotEmpty())
            assertTrue(transport.historyRequests.isEmpty())
        }
    }

    @Test
    fun loggingOutClearsInMemoryRecentHistoryWithoutAnotherHistoryRequest() {
        var session by mutableStateOf<AccountSession?>(signedInSession())
        val transport = RecentSearchTransport(recentEntries = listOf(recent("private account query")))
        val repository = SearchRepository("https://api.nantty.com", { session }, transport)
        compose.setContent { MaterialTheme { SearchScreen(repository, Executor { it.run() }) } }

        compose.onNodeWithContentDescription("Search private account query").assertIsDisplayed()
        val callsBeforeLogout = transport.historyRequests.size
        compose.runOnIdle { session = null }
        compose.waitForIdle()

        compose.onNodeWithContentDescription("Search private account query").assertDoesNotExist()
        compose.onNodeWithText("Clear all").assertDoesNotExist()
        compose.runOnIdle { assertEquals(callsBeforeLogout, transport.historyRequests.size) }
    }

    @Test
    fun recentSearchCanBeRemovedOrCleared() {
        val transport = RecentSearchTransport(recentEntries = listOf(recent("old query"), recent("second query", SECOND_UUID)))
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithContentDescription("Remove old query from recent searches").performClick()
        compose.waitForIdle()
        compose.runOnIdle {
            assertTrue(transport.historyRequests.any { it.method == "DELETE" && it.path.endsWith(FIRST_UUID) })
        }
        compose.onNodeWithText("Clear all").performClick()
        compose.waitForIdle()
        compose.runOnIdle {
            assertTrue(transport.historyRequests.any { it.method == "DELETE" && it.path == "/api/v1/search/recent?scope=global" })
        }
    }

    private fun searchFor(query: String) {
        compose.onNode(hasSetTextAction()).performTextInput(query)
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
    }

    private fun signedInSession() = AccountSession("search-token", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))

    private fun recent(query: String, id: String = FIRST_UUID) = JSONObject()
        .put("id", id).put("query", query).put("scope", "global").put("searchedAt", "2026-11-04T12:00:00Z")

    private class RecentSearchTransport(
        recentEntries: List<JSONObject> = emptyList(),
        private val failHistory: Boolean = false,
    ) : SearchTransport {
        data class Request(val path: String, val token: String?, val method: String)

        val historyRequests = mutableListOf<Request>()
        val searchPaths = mutableListOf<String>()
        private val recentEntries = recentEntries.toMutableList()

        override fun request(path: String, accessToken: String?): JSONObject = request(path, accessToken, "GET", null)

        override fun request(path: String, accessToken: String?, method: String, body: JSONObject?): JSONObject {
            if (path.startsWith("/api/v1/search/recent")) {
                historyRequests += Request(path, accessToken, method)
                if (failHistory) error("History offline")
                when {
                    method == "GET" -> return JSONObject().put("data", JSONArray(recentEntries)).put("nextCursor", JSONObject.NULL)
                    method == "POST" -> return JSONObject()
                    method == "DELETE" && path == "/api/v1/search/recent?scope=global" -> {
                        recentEntries.clear()
                        return JSONObject()
                    }
                    method == "DELETE" -> {
                        recentEntries.removeAll { it.optString("id") == path.substringAfterLast('/') }
                        return JSONObject()
                    }
                }
            }
            searchPaths += path
            return JSONObject("""{"data":[{"type":"post","id":"post-1","caption":"A real post result","thumbnailUrl":"https://cdn.nantty.com/post.jpg","likes":4,"views":12}],"nextCursor":null,"scope":"global"}""")
        }
    }

    companion object {
        private const val FIRST_UUID = "7b7d83c7-d9a8-49e8-9e98-c52aab1ba444"
        private const val SECOND_UUID = "e48546e1-c4e7-4cc1-bdaa-f11a9061bd7d"
    }
}
