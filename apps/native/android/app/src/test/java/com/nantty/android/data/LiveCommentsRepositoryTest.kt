package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveCommentsRepositoryTest {
    @Test fun listsPageAndForwardsOpaqueCursor() {
        val transport = RecordingLiveCommentsTransport(JSONObject("""{"data":{"data":[${commentJson()}],"nextCursor":"next-token"}}"""))
        val result = repository(transport).list("live-123", "cursor/opaque") as LiveCommentsResult.Success
        assertEquals("GET", transport.calls.single().method)
        assertEquals("/api/v1/lives/live-123/comments?order=newest&cursor=cursor%2Fopaque", transport.calls.single().path)
        assertEquals("comment-1", result.value.comments.single().id)
        assertEquals("next-token", result.value.nextCursor)
    }

    @Test fun displaysNewestPageInChronologicalOrder() {
        val transport = RecordingLiveCommentsTransport(JSONObject("""{"data":[${commentJson("comment-3")},${commentJson("comment-2")},${commentJson("comment-1")}],"nextCursor":"older"}"""))
        val result = repository(transport).list("live-123") as LiveCommentsResult.Success
        assertEquals("/api/v1/lives/live-123/comments?order=newest", transport.calls.single().path)
        assertEquals(listOf("comment-1", "comment-2", "comment-3"), result.value.comments.map(LiveComment::id))
        assertEquals("older", result.value.nextCursor)
    }

    @Test fun createsWithTextOnlyPayloadAndParsesComment() {
        val transport = RecordingLiveCommentsTransport(JSONObject(commentJson()))
        val result = repository(transport).create("live-123", "  hello   live ") as LiveCommentsResult.Success
        assertEquals("POST", transport.calls.single().method)
        assertEquals("/api/v1/lives/live-123/comments", transport.calls.single().path)
        assertEquals(setOf("text"), transport.calls.single().body!!.keys().asSequence().toSet())
        assertEquals("hello   live", transport.calls.single().body!!.getString("text"))
        assertEquals("comment-1", result.value.id)
    }

    @Test fun refreshesUnauthorizedRequestOnceAndReportsAuthenticationAndBackendErrors() {
        val transport = RecordingLiveCommentsTransport(JSONObject("""{"data":{"data":[],"nextCursor":null}}""")).apply { unauthorizedFirst = true }
        val result = LiveCommentsRepository({ commentSession("expired") }, { commentSession("fresh") }, transport).list("live-123")
        assertTrue(result is LiveCommentsResult.Success)
        assertEquals(listOf("expired", "fresh"), transport.calls.map { it.token })

        val noSession = LiveCommentsRepository({ null }, transport = transport).list("live-123") as LiveCommentsResult.Failure
        assertTrue(noSession.authenticationRequired)
        val denied = RecordingLiveCommentsTransport(JSONObject()).apply { errorStatus = 403 }
        val failure = repository(denied).list("live-123") as LiveCommentsResult.Failure
        assertEquals(403, failure.statusCode)
        assertFalse(failure.retryable)
    }

    @Test fun rejectsInvalidIdsCursorsAndCommentTextWithoutRequests() {
        val transport = RecordingLiveCommentsTransport(JSONObject(commentJson()))
        val repo = repository(transport)
        assertTrue(repo.list("../live") is LiveCommentsResult.Failure)
        assertTrue(repo.list("live-123", "bad\ncursor") is LiveCommentsResult.Failure)
        assertTrue(repo.create("live-123", " \n ") is LiveCommentsResult.Failure)
        assertTrue(repo.create("live-123", "😀".repeat(201)) is LiveCommentsResult.Failure)
        assertTrue(transport.calls.isEmpty())
    }
}

private data class LiveCommentsCall(val method: String, val path: String, val token: String, val body: JSONObject?)
private class RecordingLiveCommentsTransport(private val response: JSONObject) : LiveCommentsTransport {
    val calls = mutableListOf<LiveCommentsCall>()
    var unauthorizedFirst = false
    var errorStatus: Int? = null
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        calls += LiveCommentsCall(method, path, accessToken, body?.let { JSONObject(it.toString()) })
        if (unauthorizedFirst && calls.size == 1) throw LiveCommentsHttpException(401)
        errorStatus?.let { throw LiveCommentsHttpException(it) }
        return JSONObject(response.toString())
    }
}
private fun repository(transport: LiveCommentsTransport) = LiveCommentsRepository({ commentSession("access") }, transport = transport)
private fun commentSession(token: String) = AccountSession(token, "refresh", AccountUser("user-123", "Test User", "test-user", null, null, emptyList()))
private fun commentJson(id: String = "comment-1") = """{"id":"$id","liveId":"live-123","author":{"id":"user-1","name":"Viewer","username":"viewer","avatarUrl":null},"text":"Hello","kind":"comment","createdAt":"2026-11-06T09:30:00Z","mentions":[],"replyToId":null,"pinned":false}"""
