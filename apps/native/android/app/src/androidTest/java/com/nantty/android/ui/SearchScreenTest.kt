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
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SearchTransport
import com.nantty.android.data.ExploreRepository
import com.nantty.android.data.ExploreTransport
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfileTransport
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class SearchScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun discoverLoadsExploreSectionsAndCategorySelectionRefreshesServerData() {
        val searchTransport = FakeTransport()
        val exploreRequests = mutableListOf<String>()
        val exploreRepository = ExploreRepository(transport = ExploreTransport { path, _ ->
            exploreRequests += path
            when {
                path == "/api/v1/explore/categories" -> JSONObject("""{"data":[{"id":"for_you","label":"For you"},{"id":"sports","label":"Sports"}]}""")
                path.startsWith("/api/v1/explore/trends") -> {
                    val tag = if (path.contains("category=sports")) "sports-tag" else "music-tag"
                    val items = JSONArray()
                    val count = if (tag == "music-tag") 6 else 1
                    repeat(count) { index ->
                        val suffix = if (index == 0) "" else "-${index + 1}"
                        items.put(JSONObject().put("hashtag", "$tag$suffix").put("label", "#$tag$suffix")
                            .put("category", "sports").put("categoryLabel", "Sports").put("postCount", 8)
                            .put("authorCount", 4).put("rank", index + 1).put("context", "Sports · Trending"))
                    }
                    JSONObject().put("scope", "in Nigeria").put("items", items)
                }
                path.startsWith("/api/v1/explore/headlines") -> JSONObject("""{"scope":"in Nigeria","items":[{"id":"headline-1","title":"Explore headline","summary":"A short summary","category":"sports","categoryLabel":"Sports","postIds":["post-explore"],"postCount":12,"authorCount":6,"hashtags":["sports-tag"],"sourceLabel":"Summarised from posts"}]}""")
                path.startsWith("/api/v1/explore/who-to-follow") -> JSONObject("""{"data":[{"user":{"id":"user-follow","name":"Ada","username":"ada"},"reason":{"code":"popular","label":"Popular in your region"},"isOfficial":false,"checkmarkTier":"none","isPrivate":false}]}""")
                path.startsWith("/api/v1/explore/posts-for-you") -> JSONObject("""{"data":[{"id":"post-explore","kind":"post","author":{"id":"user-follow","name":"Ada","username":"ada"},"text":"Explore post","media":[],"likes":2,"comments":1,"reposts":0,"shares":0,"createdAt":"2026-11-04T10:00:00Z","ranking":{"explanations":[{"code":"trending_topic","label":"Trending in Sports"}]}}],"nextCursor":null}""")
                else -> error("Unexpected Explore path: $path")
            }
        })
        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    SearchRepository("https://api.nantty.com", { null }, searchTransport),
                    Executor { it.run() },
                    exploreRepository = exploreRepository,
                )
            }
        }

        compose.waitForIdle()
        compose.onNodeWithText("Explore headline").assertIsDisplayed()
        compose.onNodeWithText("#music-tag").assertIsDisplayed()
        compose.onNodeWithText("#music-tag-6").assertDoesNotExist()
        compose.onNodeWithText("Show more").performClick()
        compose.onNodeWithText("#music-tag-6").assertIsDisplayed()
        compose.onNodeWithText("Show less").performClick()
        compose.onNodeWithText("#music-tag-6").assertDoesNotExist()
        compose.onNodeWithText("Who to follow").assertIsDisplayed()
        compose.onNodeWithText("Explore post").assertIsDisplayed()
        compose.onNodeWithText("Sports").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("#sports-tag").assertIsDisplayed()
        compose.runOnIdle { assertTrue(exploreRequests.any { it == "/api/v1/explore/posts-for-you?category=sports" }) }
    }

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
            assertEquals("/api/v1/search?q=open%20posts&scope=global&type=top&limit=10", transport.searchPaths().first())
            assertNull(transport.searchTokens().first())
            assertEquals(0, transport.historyPaths().size)
        }
    }

    @Test
    fun guestExploreFollowIsDeferredUntilSignInThenReplayedOnTheSameScreen() {
        var viewer: AccountSession? = null
        var pendingAction: (() -> Unit)? = null
        var followPath: String? = null
        var followToken: String? = null
        val targetId = "00000000-0000-4000-8000-000000000021"
        val searchRepository = SearchRepository("https://api.nantty.com", { viewer }, FakeTransport())
        val exploreRepository = ExploreRepository(
            sessionProvider = { viewer },
            transport = ExploreTransport { path, _ ->
                when {
                    path == "/api/v1/explore/categories" -> JSONObject("""{"data":[]}""")
                    path.startsWith("/api/v1/explore/trends") -> JSONObject("""{"scope":"Nigeria","items":[]}""")
                    path.startsWith("/api/v1/explore/headlines") -> JSONObject("""{"scope":"Nigeria","items":[]}""")
                    path.startsWith("/api/v1/explore/who-to-follow") -> JSONObject("""{"data":[{"user":{"id":"$targetId","name":"Ada","username":"ada"},"reason":{"code":"popular","label":"Popular"},"isPrivate":false}]}""")
                    path.startsWith("/api/v1/explore/posts-for-you") -> JSONObject("""{"data":[],"nextCursor":null}""")
                    else -> error("Unexpected Explore path: $path")
                }
            },
        )
        val profileRepository = PublicProfileRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { viewer },
            transport = object : PublicProfileTransport {
                override fun get(path: String, accessToken: String?) = error("Unexpected profile read: $path")
                override fun post(path: String, accessToken: String): JSONObject {
                    followPath = path
                    followToken = accessToken
                    return JSONObject("""{"data":{"state":"accepted"}}""")
                }
                override fun delete(path: String, accessToken: String) = error("Unexpected profile delete: $path")
            },
        )

        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    repository = searchRepository,
                    executor = Executor { it.run() },
                    exploreRepository = exploreRepository,
                    profileRepository = profileRepository,
                    onRequireSignInWithAction = { pendingAction = it },
                )
            }
        }

        compose.onNodeWithText("Who to follow").assertIsDisplayed()
        compose.onNodeWithText("Sign in").performClick()
        compose.runOnIdle {
            assertNull(followPath)
            assertTrue(pendingAction != null)
            viewer = signedInSession()
        }
        compose.waitForIdle()
        compose.runOnIdle { pendingAction?.invoke() }
        compose.waitForIdle()

        compose.runOnIdle {
            assertEquals("/api/v1/users/$targetId/follow", followPath)
            assertEquals("search-token", followToken)
        }
        compose.onNodeWithText("Following").assertIsDisplayed()
    }

    @Test
    fun productSearchResultOpensTheExistingMartProductDetailRoute() {
        val transport = FakeTransport()
        var openedProductId: String? = null
        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    SearchRepository("https://api.nantty.com", { null }, transport),
                    Executor { it.run() },
                    onOpenProduct = { openedProductId = it },
                )
            }
        }

        compose.onNodeWithText("Products").performClick()
        searchFor("adire")
        compose.onNodeWithTag("product-search-result-prod_1").assertIsDisplayed()
        compose.onNodeWithTag("product-search-result-prod_1").performClick()

        compose.runOnIdle {
            assertEquals("prod_1", openedProductId)
            assertTrue(transport.searchPaths().contains("/api/v1/search?q=adire&scope=global&type=products&limit=10"))
        }
    }

    @Test
    fun categorySearchResultPassesItsIdToMartNavigationInsteadOfSearchingItsLabel() {
        val transport = FakeTransport(categoriesOnly = true)
        var openedCategory: Pair<String, String>? = null
        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    SearchRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() },
                    onOpenCategory = { id, name -> openedCategory = id to name },
                )
            }
        }

        searchFor("clothing")
        compose.onNodeWithContentDescription("Search Mart category Clothing").performClick()

        compose.runOnIdle {
            assertEquals("0192a4f0-0000-7000-8000-000000000001" to "Clothing", openedCategory)
            assertEquals(listOf("/api/v1/search?q=clothing&scope=global&type=top&limit=10"), transport.searchPaths())
        }
    }

    @Test
    fun officialStoreBrandSearchExposesRnStoreFiltersAndSendsSelectedScopeAndType() {
        val transport = FakeTransport(officialStoreBrand = true)
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", { null }, transport), Executor { it.run() })
            }
        }

        searchFor("loom")
        compose.onNodeWithContentDescription("Search the official store for Nigerian Loom").performClick()
        compose.onNodeWithText("In: Nigerian Loom").assertIsDisplayed()
        compose.onNodeWithText("All").assertIsDisplayed()
        compose.onNodeWithText("Products").performClick()
        searchFor("adire")

        compose.onNodeWithTag("product-search-result-prod_1").assertIsDisplayed()
        compose.runOnIdle {
            assertTrue(
                transport.searchPaths().contains(
                    "/api/v1/search?q=adire&scope=store:$OFFICIAL_STORE_ID&type=products&limit=10",
                ),
            )
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
            assertEquals("/api/v1/search?q=ari&scope=global&type=people&limit=10", transport.searchPaths().first())
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
        compose.runOnIdle {
            assertEquals("post-1", openedPost)
            assertTrue(transport.historyRequests().any { it.method == "POST" })
        }
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
        compose.onNodeWithText("Show more").assertIsDisplayed().performClick()
        compose.onNodeWithText("Load more posts").assertDoesNotExist()
        compose.onNodeWithText("Another API post").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals("/api/v1/search?q=paginate&scope=global&type=top&limit=10&cursor=next-page", transport.searchPaths().last())
            assertEquals("search-token", transport.searchTokens().last())
        }
    }

    @Test
    fun signedInUserLoadsRecentSearchesAndSelectingOneRunsSearch() {
        val transport = FakeTransport(recentEntries = listOf(recent("rain & sun")))
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
            assertTrue(transport.historyRequests().any { it.method == "GET" && it.path == "/api/v1/search/recent?scope=global" })
            assertTrue(transport.searchPaths().contains("/api/v1/search?q=rain%20%26%20sun&scope=global&type=top&limit=10"))
        }
    }

    @Test
    fun signedInUserRecordsOnlyOnExplicitSubmitAndHistoryErrorsDoNotBlockSearchOrOpening() {
        val transport = FakeTransport(failHistory = true)
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
        compose.runOnIdle { assertEquals(0, transport.historyRequests().count { it.method == "POST" }) }

        compose.onNode(hasSetTextAction()).performImeAction()
        compose.waitForIdle()
        compose.onNodeWithContentDescription("Open post: A real post result").performClick()
        compose.runOnIdle {
            assertEquals("post-1", opened)
            assertTrue(transport.historyRequests().count { it.method == "POST" } >= 2)
            assertTrue(transport.searchPaths().isNotEmpty())
            assertTrue(transport.historyRequests().all { it.token == "search-token" })
        }
        compose.onNodeWithText("Recent searches couldn’t be updated.").assertIsDisplayed()
    }

    @Test
    fun historyFailureIsShownAsNonBlockingNoticeAndDoesNotBlockSearch() {
        val signedInTransport = FakeTransport(failHistory = true)
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, signedInTransport), Executor { it.run() })
            }
        }
        compose.onNodeWithText("Recent searches couldn’t be updated.").assertIsDisplayed()
        searchFor("still searchable")
        compose.onNodeWithText("A real post result").assertIsDisplayed()
        compose.onNodeWithText("Recent searches couldn’t be updated.").assertIsDisplayed()
    }

    @Test
    fun guestNeverRequestsRecentHistory() {
        val guestTransport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", { null }, guestTransport), Executor { it.run() })
            }
        }
        searchFor("guest search")
        compose.onNodeWithText("A real post result").assertIsDisplayed()
        compose.runOnIdle {
            assertTrue(guestTransport.searchPaths().isNotEmpty())
            assertTrue(guestTransport.historyPaths().isEmpty())
        }
    }

    @Test
    fun loggingOutClearsInMemoryRecentHistoryWithoutAnotherHistoryRequest() {
        var session by mutableStateOf<AccountSession?>(signedInSession())
        val transport = FakeTransport(recentEntries = listOf(recent("private account query")))
        val repository = SearchRepository("https://api.nantty.com", { session }, transport)
        compose.setContent {
            MaterialTheme {
                SearchScreen(repository, Executor { it.run() })
            }
        }

        compose.onNodeWithContentDescription("Search private account query").assertIsDisplayed()
        val callsBeforeLogout = transport.historyPaths().size
        compose.runOnIdle { session = null }
        compose.waitForIdle()

        compose.onNodeWithContentDescription("Search private account query").assertDoesNotExist()
        compose.onNodeWithText("Clear all").assertDoesNotExist()
        compose.runOnIdle { assertEquals(callsBeforeLogout, transport.historyPaths().size) }
    }

    @Test
    fun recentSearchCanBeRemovedOrCleared() {
        val transport = FakeTransport(recentEntries = listOf(recent("old query"), recent("second query", SECOND_UUID)))
        compose.setContent {
            MaterialTheme {
                SearchScreen(SearchRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithContentDescription("Remove old query from recent searches").performClick()
        compose.waitForIdle()
        compose.runOnIdle {
            assertTrue(transport.historyRequests().any { it.method == "DELETE" && it.path.endsWith(FIRST_UUID) })
        }
        compose.onNodeWithText("Clear all").performClick()
        compose.waitForIdle()
        compose.runOnIdle {
            assertTrue(transport.historyRequests().any { it.method == "DELETE" && it.path == "/api/v1/search/recent?scope=global" })
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
        private val categoriesOnly: Boolean = false,
        private val officialStoreBrand: Boolean = false,
        private val recentEntries: List<JSONObject> = emptyList(),
        private val failHistory: Boolean = false,
    ) : SearchTransport {
        data class Request(val path: String, val token: String?, val method: String, val body: JSONObject?)
        private val requests = mutableListOf<Request>()
        private val storedRecentEntries = recentEntries.toMutableList()

        override fun request(path: String, accessToken: String?): JSONObject {
            return request(path, accessToken, "GET", null)
        }

        override fun request(path: String, accessToken: String?, method: String, body: JSONObject?): JSONObject {
            requests += Request(path, accessToken, method, body)
            if (path.startsWith("/api/v1/search/recent")) {
                if (failHistory) error("History offline")
                when {
                    method == "GET" && path.contains("scope=global") -> return JSONObject().put("data", JSONArray(storedRecentEntries)).put("nextCursor", JSONObject.NULL)
                    method == "POST" -> return JSONObject()
                    method == "DELETE" && path == "/api/v1/search/recent?scope=global" -> { storedRecentEntries.clear(); return JSONObject() }
                    method == "DELETE" -> { storedRecentEntries.removeAll { it.optString("id") == path.substringAfterLast('/') }; return JSONObject() }
                }
            }
            val searchRequests = requests.filter { it.path.startsWith("/api/v1/search?") }
            if (failFirst && searchRequests.size == 1) error("Offline")
            if (path.contains("cursor=")) return JSONObject("""{"data":[{"type":"post","id":"post-2","caption":"Another API post","likes":2,"views":5}],"nextCursor":null,"scope":"global"}""")
            if (path.contains("type=products")) return JSONObject("""{"data":[{"type":"product","id":"prod_1","name":"Adire jacket","price":{"amountMinor":1250000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.com/jacket.jpg","stock":3}],"nextCursor":null,"scope":"global"}""")
            if (categoriesOnly) return JSONObject("""{"data":[{"type":"category","id":"0192a4f0-0000-7000-8000-000000000001","name":"Clothing"}],"nextCursor":null,"scope":"global"}""")
            if (officialStoreBrand) return JSONObject("""{"data":[{"type":"brand","id":"brand_1","name":"Nigerian Loom","officialStoreId":"$OFFICIAL_STORE_ID"}],"nextCursor":null,"scope":"global"}""")
            if (usersOnly) return JSONObject("""{"data":[{"type":"user","id":"user-1","name":"Ari","username":"ari","verified":true}],"nextCursor":null,"scope":"global"}""")
            return JSONObject("""{"data":[{"type":"post","id":"post-1","caption":"A real post result","thumbnailUrl":"https://cdn.nantty.com/post.jpg","likes":4,"views":12}],"nextCursor":"next-page","scope":"global"}""")
        }

        fun historyPaths() = requests.filter { it.path.startsWith("/api/v1/search/recent") }.map(Request::path)
        fun searchPaths() = requests.filter { it.path.startsWith("/api/v1/search?") }.map(Request::path)
        fun searchTokens() = requests.filter { it.path.startsWith("/api/v1/search?") }.map(Request::token)
        fun historyRequests() = requests.filter { it.path.startsWith("/api/v1/search/recent") }
    }

    private class QueuedExecutor : Executor {
        private val tasks = ArrayDeque<Runnable>()
        override fun execute(command: Runnable) { tasks.addLast(command) }
        fun runNext() { tasks.removeFirst().run() }
    }

    companion object {
        private const val FIRST_UUID = "7b7d83c7-d9a8-49e8-9e98-c52aab1ba444"
        private const val SECOND_UUID = "e48546e1-c4e7-4cc1-bdaa-f11a9061bd7d"
        private const val OFFICIAL_STORE_ID = "1d4b7a63-a205-4418-93be-58ae7ac624a4"
        private fun signedInSession() = AccountSession("search-token", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
        private fun recent(query: String, id: String = FIRST_UUID) = JSONObject().put("id", id).put("query", query).put("scope", "global").put("searchedAt", "2026-11-04T12:00:00Z")
    }
}
