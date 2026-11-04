package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FollowRequestsRepositoryTest {
    @Test
    fun loadUsesAuthenticatedPagedEndpointAndMapsOnlyPublicRequesterFields() {
        val transport = RecordingFollowRequestsTransport(pagePayload())
        val repository = FollowRequestsRepository(
            baseUrl = "https://api.nantty.com",
            transport = transport,
            sessionProvider = { testSession() },
        )

        val result = repository.load("cursor value") as FollowRequestsResult.Success

        assertEquals("GET", transport.method)
        assertEquals("/api/v1/users/me/follow-requests?limit=20&cursor=cursor%20value", transport.path)
        assertEquals("session-token", transport.accessToken)
        assertEquals("request-1", result.page.requests.single().id)
        assertEquals("requester-1", result.page.requests.single().requester.id)
        assertEquals("Ari", result.page.requests.single().requester.name)
        assertEquals("ari", result.page.requests.single().requester.username)
        assertEquals("next-page", result.page.nextCursor)
    }

    @Test
    fun settleUsesAuthenticatedAcceptOrRejectEndpoint() {
        val transport = RecordingFollowRequestsTransport(JSONObject())
        val repository = FollowRequestsRepository("https://api.nantty.com", transport) { testSession() }

        assertTrue(repository.settle("request-1", accept = true).isSuccess)
        assertEquals("POST", transport.method)
        assertEquals("/api/v1/follow-requests/request-1/accept", transport.path)
        assertEquals("session-token", transport.accessToken)

        assertTrue(repository.settle("request-2", accept = false).isSuccess)
        assertEquals("/api/v1/follow-requests/request-2/reject", transport.path)
    }

    @Test
    fun missingSessionAndUnsafeIdsNeverCallTransport() {
        val transport = RecordingFollowRequestsTransport(pagePayload())
        val repository = FollowRequestsRepository("https://api.nantty.com", transport)

        assertTrue(repository.load() is FollowRequestsResult.Failure)
        assertTrue(repository.settle("../request", accept = true).isFailure)
        assertEquals(0, transport.calls)
    }

    @Test
    fun malformedRowsAreSkippedAndPrivateRequesterDataIsNotMapped() {
        val repository = FollowRequestsRepository(
            baseUrl = "https://api.nantty.com",
            transport = RecordingFollowRequestsTransport(JSONObject()),
        )

        val page = repository.parsePage(JSONObject().put("data", JSONArray()
            .put(JSONObject().put("id", "bad/id"))
            .put(JSONObject().put("id", "request-1").put("requester", JSONObject()
                .put("id", "requester-1").put("username", "ari").put("name", "Ari")
                .put("email", "private@example.test").put("phone", "+234000000000")))))

        assertEquals(1, page.requests.size)
        assertNull(page.requests.single().requester.avatarUrl)
        assertFalse(page.requests.single().requester.name.contains("private"))
        assertNull(page.nextCursor)
    }
}

private class RecordingFollowRequestsTransport(private val response: JSONObject) : FollowRequestsTransport {
    var calls = 0
    var method: String? = null
    var path: String? = null
    var accessToken: String? = null

    override fun request(method: String, path: String, accessToken: String): JSONObject {
        calls += 1
        this.method = method
        this.path = path
        this.accessToken = accessToken
        return response
    }
}

private fun pagePayload() = JSONObject()
    .put("data", JSONArray().put(JSONObject()
        .put("id", "request-1")
        .put("createdAt", "2026-11-04T10:00:00Z")
        .put("requester", JSONObject()
            .put("id", "requester-1")
            .put("name", "Ari")
            .put("username", "ari")
            .put("avatarUrl", JSONObject.NULL)
            .put("email", "private@example.test"))))
    .put("nextCursor", "next-page")

private fun testSession() = AccountSession(
    accessToken = "session-token",
    refreshToken = "refresh-token",
    user = AccountUser("account-1", "Sam", "sam", "private@example.test", null, listOf("user")),
)
