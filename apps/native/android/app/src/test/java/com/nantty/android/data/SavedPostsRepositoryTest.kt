package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SavedPostsRepositoryTest {
    private val saveId = "d1111111-1111-4111-8111-111111111111"
    private val postId = "d2222222-2222-4222-8222-222222222222"
    private val cursorId = "d3333333-3333-4333-8333-333333333333"

    @Test
    fun requestsOnlyCurrentUsersSavedPostsWithExistingSessionBearer() {
        val transport = RecordingTransport(page())
        val repository = SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport)

        val result = repository.load() as SavedPostsResult.Success

        assertEquals("/api/v1/saves?type=post", transport.path)
        assertEquals("saved-access", transport.token)
        assertEquals(saveId, result.page.posts.single().saveId)
        assertEquals(postId, result.page.posts.single().post.id)
        assertEquals("A saved post", result.page.posts.single().post.text)
        assertEquals("https://cdn.nantty.com/saved.jpg", result.page.posts.single().post.media.single().url)
        assertEquals(cursorId, result.page.nextCursor)
    }

    @Test
    fun usesBackendUuidCursorAndRejectsInvalidCursorBeforeRequest() {
        val transport = RecordingTransport(JSONObject("""{"data":[],"nextCursor":null}"""))
        val repository = SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport)

        repository.load(cursorId)
        assertEquals("/api/v1/saves?type=post&cursor=$cursorId", transport.path)

        val bad = repository.load("not-a-uuid")
        assertTrue(bad is SavedPostsResult.Failure)
        assertEquals(1, transport.calls)
    }

    @Test
    fun refusesUnauthenticatedOrBlankSessionWithoutCallingTransport() {
        val transport = RecordingTransport(page())

        assertTrue((SavedPostsRepository("https://api.nantty.com", { null }, transport).load() as SavedPostsResult.Failure).message.contains("Sign in"))
        val blank = signedInSession().copy(accessToken = " ")
        assertTrue((SavedPostsRepository("https://api.nantty.com", { blank }, transport).load() as SavedPostsResult.Failure).message.contains("Sign in"))
        assertEquals(0, transport.calls)
    }

    @Test
    fun filtersNonPostSavedKindsAndUnsafePostTargets() {
        val payload = JSONObject("""{"data":[
            {"id":"$saveId","type":"post","targetId":"$postId","savedAt":"2026-11-02T10:00:00Z","post":${postJson()}},
            {"id":"d4444444-4444-4444-8444-444444444444","type":"video","targetId":"$postId","post":${postJson()}},
            {"id":"d5555555-5555-4555-8555-555555555555","type":"product","targetId":"d6666666-6666-4666-8666-666666666666"},
            {"id":"d7777777-7777-4777-8777-777777777777","type":"post","targetId":"../post","post":${postJson()}},
            {"id":"d8888888-8888-4888-8888-888888888888","type":"post","targetId":"d9999999-9999-4999-8999-999999999999"}
        ],"nextCursor":null}""")
        val parsed = SavedPostsRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(payload)).parsePage(payload)

        assertEquals(listOf(saveId), parsed.posts.map(SavedPost::saveId))
        assertTrue(parsed.posts.single().post.bookmarked)
    }

    @Test
    fun rejectsNonUuidCursorReturnedByBackend() {
        val payload = JSONObject("""{"data":[],"nextCursor":"next-page"}""")
        val result = SavedPostsRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(payload)).load()

        assertTrue(result is SavedPostsResult.Failure)
        assertTrue((result as SavedPostsResult.Failure).message.contains("invalid saved-posts page cursor"))
    }

    @Test
    fun classifiesExpiredAuthenticationForSignInRecovery() {
        val transport = SavedPostsTransport { _, _ -> throw SavedPostsHttpException(401) }
        val result = SavedPostsRepository("https://api.nantty.com", ::signedInSession, transport).load()

        assertTrue(result is SavedPostsResult.Failure)
        assertTrue((result as SavedPostsResult.Failure).authenticationRequired)
    }

    @Test
    fun rejectsPostPayloadWhoseIdentityDoesNotMatchSavedTarget() {
        val mismatchedPost = postJson().replace(postId, "d0000000-0000-4000-8000-000000000000")
        val payload = JSONObject("""{"data":[{"id":"$saveId","type":"post","targetId":"$postId","post":$mismatchedPost}],"nextCursor":null}""")

        assertTrue(SavedPostsRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(payload)).parsePage(payload).posts.isEmpty())
    }

    @Test
    fun returnsEmptyPageWithoutInventingItems() {
        val result = SavedPostsRepository(
            "https://api.nantty.com",
            ::signedInSession,
            RecordingTransport(JSONObject("""{"data":[],"nextCursor":null}""")),
        ).load() as SavedPostsResult.Success

        assertTrue(result.page.posts.isEmpty())
        assertEquals(null, result.page.nextCursor)
    }

    @Test
    fun deduplicatesRowsAcrossCursorPagesBySaveIdentity() {
        val post = feedPost()
        val first = SavedPost("same-save", post, "first")
        val duplicate = SavedPost("same-save", post.copy(text = "duplicate"), "later")
        val next = SavedPost("next-save", post.copy(id = "post-2"), "next")

        assertEquals(listOf("same-save", "next-save"), appendUniqueSavedPosts(listOf(first), listOf(duplicate, next)).map(SavedPost::saveId))
        assertFalse(appendUniqueSavedPosts(emptyList(), listOf(first)).isEmpty())
    }

    @Test
    fun requiresSecureApiOrigin() {
        val result = SavedPostsRepository("http://api.nantty.com", ::signedInSession).load()

        assertTrue(result is SavedPostsResult.Failure)
        assertTrue((result as SavedPostsResult.Failure).message.contains("HTTPS"))
    }

    private fun page() = JSONObject("""{"data":[{"id":"$saveId","type":"post","targetId":"$postId","savedAt":"2026-11-02T10:00:00Z","post":${postJson()}}],"nextCursor":"$cursorId"}""")

    private fun postJson() = """{"id":"$postId","kind":"post","text":"A saved post","createdAt":"2026-11-02T09:00:00Z","likes":3,"comments":2,"reposts":1,"shares":0,"author":{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"Ari","username":"ari","avatarUrl":"https://cdn.nantty.com/ari.png","verification":{"badgeVisible":true,"status":"active","color":"blue"}},"media":[{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","type":"image","status":"ready","url":"https://cdn.nantty.com/saved.jpg","width":600,"height":400},{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","type":"image","status":"pending","url":"https://cdn.nantty.com/pending.jpg"}]}"""

    private fun feedPost() = FeedPost("post-1", "Ari", "ari", null, true, "blue", null, null, null, "post", "A saved post", emptyList(), 3, 2, 1, 0, "2026-11-02T09:00:00Z", authorId = "author-1", bookmarked = true)
    private fun signedInSession() = AccountSession("saved-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))

    private class RecordingTransport(private val response: JSONObject) : SavedPostsTransport {
        var calls = 0
        var path: String? = null
        var token: String? = null

        override fun get(path: String, accessToken: String): JSONObject {
            calls += 1
            this.path = path
            token = accessToken
            return response
        }
    }
}
