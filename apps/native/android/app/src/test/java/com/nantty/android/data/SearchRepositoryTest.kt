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

    private fun page() = JSONObject("""{"data":[{"type":"post","id":"post-123","authorId":"user-9","caption":"First post","thumbnailUrl":"https://cdn.nantty.com/post.jpg","likes":3,"views":8}],"nextCursor":"next cursor","scope":"global"}""")
    private fun signedInSession() = AccountSession("search-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))

    private class RecordingTransport(private val response: JSONObject) : SearchTransport {
        var path: String? = null
        var token: String? = null
        var requested = false
        override fun request(path: String, accessToken: String?): JSONObject {
            requested = true
            this.path = path
            token = accessToken
            return response
        }
    }
}
