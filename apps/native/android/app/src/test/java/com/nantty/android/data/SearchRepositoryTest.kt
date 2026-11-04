package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchRepositoryTest {
    @Test
    fun encodesQueryAndCursorAndUsesGlobalSearchContract() {
        val transport = RecordingTransport(page())
        val repository = SearchRepository("https://api.nantty.com", ::signedInSession, transport)

        val result = repository.search("  rain & sun  ", SearchType.POSTS, "after/+ cursor") as SearchResult.Success

        assertEquals("/api/v1/search?q=rain%20%26%20sun&scope=global&type=posts&limit=10&cursor=after%2F%2B%20cursor", transport.path)
        assertEquals("search-access", transport.token)
        assertEquals("post-123", result.page.posts.single().id)
        assertEquals("user-9", result.page.posts.single().authorId)
        assertEquals("next cursor", result.page.nextCursor)
    }

    @Test
    fun topSearchMapsOnlyOpenablePostRecordsAndSanitizesMediaAndCounts() {
        val payload = JSONObject("""{"data":[
            {"type":"post","id":"post_1-abc","caption":"Real result","thumbnailUrl":"https://cdn.nantty.com/post.jpg","likes":7,"views":11},
            {"type":"user","id":"user-1","name":"Unsupported destination"},
            {"type":"clip","id":"clip-1","caption":"Native app has no clip destination"},
            {"type":"post","id":"../unsafe","caption":"Unsafe id"},
            {"type":"post","id":"post-2","caption":"Unsafe image","thumbnailUrl":"javascript:alert(1)","likes":-4,"views":-2}
        ],"nextCursor":null}""")

        val page = SearchRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(payload)).parsePage(payload, SearchType.TOP)

        assertEquals(listOf("post_1-abc", "post-2"), page.posts.map(SearchPost::id))
        assertEquals("https://cdn.nantty.com/post.jpg", page.posts.first().thumbnailUrl)
        assertEquals(null, page.posts.last().thumbnailUrl)
        assertEquals(0, page.posts.last().likes)
        assertEquals(0, page.posts.last().views)
        assertEquals(null, page.nextCursor)
    }

    @Test
    fun peopleSearchMapsOnlyPublicUserSummaryAndValidatesIdentity() {
        val payload = JSONObject("""{"data":[
            {"type":"user","id":"user-1","name":"Ari","username":"ari","avatarUrl":"https://cdn.nantty.com/ari.png","verified":true,"email":"private@example.test","phone":"+10000000000"},
            {"type":"user","id":"../bad","name":"Unsafe","username":"unsafe"},
            {"type":"post","id":"post-1","caption":"Not a person"}
        ],"nextCursor":null}""")
        val transport = RecordingTransport(payload)
        val repository = SearchRepository("https://api.nantty.com", { null }, transport)

        val result = repository.search("ari", SearchType.PEOPLE) as SearchResult.Success

        assertEquals("/api/v1/search?q=ari&scope=global&type=people&limit=10", transport.path)
        assertEquals(listOf("user-1"), result.page.users.map(SearchUser::id))
        assertEquals("https://cdn.nantty.com/ari.png", result.page.users.single().avatarUrl)
        assertTrue(result.page.users.single().verified)
        assertTrue(result.page.posts.isEmpty())
    }

    @Test
    fun productSearchUsesTheSharedSearchContractAndMapsOnlySafeProductSummaries() {
        val payload = JSONObject("""{"data":[
            {"type":"product","id":"prod_1","name":"Adire jacket","price":{"amountMinor":1250000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.com/jacket.jpg","stock":3,"storeId":"store_1"},
            {"type":"product","id":"../private","name":"Unsafe id","price":{"amountMinor":1,"currency":"NGN"}},
            {"type":"product","id":"prod_2","name":"Bad price","price":{"amountMinor":-1,"currency":"NGN"}},
            {"type":"user","id":"user_1","username":"not a product"}
        ],"nextCursor":null,"scope":"global"}""")
        val transport = RecordingTransport(payload)
        val repository = SearchRepository("https://api.nantty.com", ::signedInSession, transport)

        val result = repository.search("adire", SearchType.PRODUCTS) as SearchResult.Success

        assertEquals("/api/v1/search?q=adire&scope=global&type=products&limit=10", transport.path)
        assertEquals(listOf("prod_1"), result.page.products.map(SearchProduct::id))
        assertEquals("https://cdn.nantty.com/jacket.jpg", result.page.products.single().imageUrl)
        assertEquals(1_250_000L, result.page.products.single().amountMinor)
        assertTrue(result.page.posts.isEmpty())
        assertTrue(result.page.users.isEmpty())
    }

    @Test
    fun invalidQueriesDoNotCallNetwork() {
        val transport = RecordingTransport(page())
        val repository = SearchRepository("https://api.nantty.com", { null }, transport)

        assertTrue(repository.search("  ", SearchType.TOP) is SearchResult.Failure)
        assertTrue(repository.search("x".repeat(SearchRepository.MAX_QUERY_LENGTH + 1), SearchType.TOP) is SearchResult.Failure)
        assertEquals(null, transport.path)
    }

    @Test
    fun guestSearchSucceedsWithoutAuthorizationHeader() {
        val transport = RecordingTransport(page())
        val repository = SearchRepository("https://api.nantty.com", { null }, transport)

        val result = repository.search("public posts", SearchType.TOP)

        assertTrue(result is SearchResult.Success)
        assertTrue(transport.requested)
        assertEquals("/api/v1/search?q=public%20posts&scope=global&type=top&limit=10", transport.path)
        assertEquals(null, transport.token)
    }

    @Test
    fun signedInSearchSendsOptionalBearerToken() {
        val transport = RecordingTransport(page())
        val repository = SearchRepository("https://api.nantty.com", ::signedInSession, transport)

        assertTrue(repository.search("private context", SearchType.TOP) is SearchResult.Success)
        assertEquals("search-access", transport.token)
    }

    @Test
    fun rejectsOversizedCursorAndInsecureApiOriginWithoutRequest() {
        val transport = RecordingTransport(page())
        val session = signedInSession()

        assertTrue(SearchRepository("https://api.nantty.com", { session }, transport).search("term", SearchType.TOP, "x".repeat(301)) is SearchResult.Failure)
        assertTrue(SearchRepository("http://api.nantty.com", { session }).search("term", SearchType.TOP) is SearchResult.Failure)
        assertFalse(transport.requested)
    }

    @Test
    fun recentHistoryRequiresAuthenticationAndGuestOperationsNeverCallTransport() {
        val transport = RecordingTransport(page())
        val repository = SearchRepository("https://api.nantty.com", { null }, transport)

        assertEquals(RecentSearchResult.Success(emptyList()), repository.listRecentSearches())
        assertTrue(repository.recordRecentSearch("hello") is RecentSearchResult.Failure)
        assertTrue(repository.removeRecentSearch("7b7d83c7-d9a8-49e8-9e98-c52aab1ba444") is RecentSearchResult.Failure)
        assertTrue(repository.clearRecentSearches() is RecentSearchResult.Failure)
        assertFalse(transport.requested)
    }

    @Test
    fun recentHistoryUsesAuthenticatedGlobalContractsAndEncodesSubmittedQuery() {
        val transport = RecordingTransport(JSONObject("""{"data":[{"id":"7b7d83c7-d9a8-49e8-9e98-c52aab1ba444","query":"rain & sun","scope":"global","searchedAt":"2026-11-04T12:00:00Z"}],"nextCursor":null}"""))
        val repository = SearchRepository("https://api.nantty.com", ::signedInSession, transport)

        val listed = repository.listRecentSearches() as RecentSearchResult.Success
        assertEquals("/api/v1/search/recent?scope=global", transport.path)
        assertEquals("GET", transport.method)
        assertEquals("search-access", transport.token)
        assertEquals("rain & sun", listed.entries.single().query)

        assertTrue(repository.recordRecentSearch("  rain & sun  ") is RecentSearchResult.Success)
        assertEquals("POST", transport.method)
        assertEquals("/api/v1/search/recent", transport.path)
        assertEquals("rain & sun", transport.body?.optString("q"))
        assertEquals("global", transport.body?.optString("scope"))
        assertEquals("search-access", transport.token)

        assertTrue(repository.removeRecentSearch("7b7d83c7-d9a8-49e8-9e98-c52aab1ba444") is RecentSearchResult.Success)
        assertEquals("DELETE", transport.method)
        assertEquals("/api/v1/search/recent/7b7d83c7-d9a8-49e8-9e98-c52aab1ba444", transport.path)

        assertTrue(repository.clearRecentSearches() is RecentSearchResult.Success)
        assertEquals("DELETE", transport.method)
        assertEquals("/api/v1/search/recent?scope=global", transport.path)
    }

    @Test
    fun recentHistorySkipsMalformedIdsAndRejectsUnsafeDeleteIds() {
        val payload = JSONObject("""{"data":[
            {"id":"7b7d83c7-d9a8-49e8-9e98-c52aab1ba444","query":"safe","scope":"global","searchedAt":"now"},
            {"id":"../../users","query":"unsafe","scope":"global","searchedAt":"now"},
            {"id":"7b7d83c7-d9a8-49e8-9e98-c52aab1ba444","query":"wrong scope","scope":"mart","searchedAt":"now"}
        ],"nextCursor":null}""")
        val transport = RecordingTransport(payload)
        val repository = SearchRepository("https://api.nantty.com", ::signedInSession, transport)

        val listed = repository.listRecentSearches() as RecentSearchResult.Success
        assertEquals(listOf("safe"), listed.entries.map(SearchRecent::query))
        val requestCount = transport.requests.size
        assertTrue(repository.removeRecentSearch("../../users") is RecentSearchResult.Failure)
        assertEquals(requestCount, transport.requests.size)
    }

    @Test
    fun recentHistoryFailuresAreReturnedWithoutThrowing() {
        val transport = RecordingTransport(page(), fail = true)
        val repository = SearchRepository("https://api.nantty.com", ::signedInSession, transport)

        assertTrue(repository.listRecentSearches() is RecentSearchResult.Failure)
        assertTrue(repository.recordRecentSearch("query") is RecentSearchResult.Failure)
        assertTrue(repository.removeRecentSearch("7b7d83c7-d9a8-49e8-9e98-c52aab1ba444") is RecentSearchResult.Failure)
        assertTrue(repository.clearRecentSearches() is RecentSearchResult.Failure)
        assertTrue(repository.search("query", SearchType.TOP) is SearchResult.Failure)
    }

    private fun page() = JSONObject("""{"data":[{"type":"post","id":"post-123","authorId":"user-9","caption":"First post","thumbnailUrl":"https://cdn.nantty.com/post.jpg","likes":3,"views":8}],"nextCursor":"next cursor","scope":"global"}""")
    private fun signedInSession() = AccountSession("search-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))

    private class RecordingTransport(private val response: JSONObject, private val fail: Boolean = false) : SearchTransport {
        var path: String? = null
        var token: String? = null
        var requested = false
        var method: String? = null
        var body: JSONObject? = null
        val requests = mutableListOf<String>()
        override fun request(path: String, accessToken: String?): JSONObject {
            return request(path, accessToken, "GET", null)
        }
        override fun request(path: String, accessToken: String?, method: String, body: JSONObject?): JSONObject {
            requested = true
            requests += "$method $path"
            this.path = path
            token = accessToken
            this.method = method
            this.body = body
            if (fail) error("History unavailable")
            return response
        }
    }
}
