package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveSessionsRepositoryTest {
    @Test
    fun suggestedLivesUsesCurrentAuthenticatedContractAndParsesHostPreview() {
        val transport = RecordingLiveSessionsTransport(JSONObject("""{"data":[${suggestedLive()}],"nextCursor":null}"""))
        val result = repository(transport).suggested() as LiveSessionsResult.Success

        assertEquals("GET", transport.calls.single().method)
        assertEquals("/api/v1/lives/suggested", transport.calls.single().path)
        assertEquals("access", transport.calls.single().accessToken)
        assertEquals("live-123", result.value.items.single().id)
        assertEquals("creator", result.value.items.single().host.username)
        assertEquals("Live preview", result.value.items.single().title)
        assertNull(result.value.nextCursor)
    }

    @Test
    fun loadsSessionAndKeepsServerAccessAndCoinSupportState() {
        val transport = RecordingLiveSessionsTransport(liveSession())
        val result = repository(transport).load("live-123") as LiveSessionsResult.Success

        assertEquals("/api/v1/lives/live-123", transport.calls.single().path)
        assertEquals("live", result.value.status)
        assertEquals(42, result.value.viewers)
        assertEquals("wss://live.nantty.test", result.value.liveKitUrl)
        assertTrue(result.value.coinSupportEnabled)
        assertTrue(result.value.accessAllowed)
        assertEquals("creator", result.value.host.username)
    }

    @Test
    fun joinsAndLeavesUsingOrdinaryLiveContractsWithoutSpacesRoutes() {
        val transport = RecordingLiveSessionsTransport(JSONObject())
        val repository = repository(transport)

        assertTrue(repository.join("live-123") is LiveSessionsResult.Success)
        assertTrue(repository.leave("live-123") is LiveSessionsResult.Success)

        assertEquals(listOf("POST" to "/api/v1/lives/live-123/join", "POST" to "/api/v1/lives/live-123/leave"),
            transport.calls.map { it.method to it.path })
        assertTrue(transport.calls.all { it.path.startsWith("/api/v1/lives/") })
    }

    @Test
    fun mediaGrantRequiresSecureUrlNonemptyTokenAndKnownRole() {
        val transport = RecordingLiveSessionsTransport(JSONObject("""{"url":"wss://live.nantty.test","token":"media-token","canPublish":false,"role":"viewer"}"""))
        val result = repository(transport).issueMediaToken("live-123") as LiveSessionsResult.Success

        assertEquals("POST", transport.calls.single().method)
        assertEquals("/api/v1/lives/live-123/media-token", transport.calls.single().path)
        assertEquals("media-token", result.value.token)
        assertFalse(result.value.canPublish)
        assertEquals("viewer", result.value.role)

        val malformed = RecordingLiveSessionsTransport(JSONObject("""{"url":"http://insecure.test","token":"media-token","role":"viewer"}"""))
        assertTrue(repository(malformed).issueMediaToken("live-123") is LiveSessionsResult.Failure)
    }

    @Test
    fun hostCoinSupportTogglePostsOnlyEnabledAndPreservesIdempotencyKey() {
        val transport = RecordingLiveSessionsTransport(JSONObject("""{"liveId":"live-123","giftsEnabled":false}"""))
        val result = repository(transport).setCoinSupport("live-123", false, "stable-toggle-key")

        val request = transport.calls.single()
        assertEquals("PATCH", request.method)
        assertEquals("/api/v1/lives/live-123/coin-support", request.path)
        assertEquals("stable-toggle-key", request.idempotencyKey)
        assertEquals(setOf("enabled"), request.body?.keys()?.asSequence()?.toSet())
        assertFalse(request.body?.getBoolean("enabled") ?: true)
        assertFalse((result as LiveSessionsResult.Success).value)
    }

    @Test
    fun unauthorizedMutationRefreshesOnceAndReusesSameIdempotencyKey() {
        val transport = RecordingLiveSessionsTransport(JSONObject("""{"liveId":"live-123","giftsEnabled":true}""")).apply { unauthorizedFirst = true }
        val result = LiveSessionsRepository(
            sessionProvider = { liveTestSession("expired") },
            refreshSessionProvider = { liveTestSession("fresh") },
            transport = transport,
        ).setCoinSupport("live-123", true, "stable-toggle-key")

        assertTrue(result is LiveSessionsResult.Success)
        assertEquals(listOf("expired", "fresh"), transport.calls.map { it.accessToken })
        assertEquals(listOf("stable-toggle-key", "stable-toggle-key"), transport.calls.map { it.idempotencyKey })
    }

    @Test
    fun rejectsUnsafeIdsKeysAndMalformedSessionWithoutSendingUnsafeRequests() {
        val transport = RecordingLiveSessionsTransport(liveSession())
        val repository = repository(transport)

        assertTrue(repository.load("../live") is LiveSessionsResult.Failure)
        assertTrue(repository.issueMediaToken("bad/live") is LiveSessionsResult.Failure)
        assertTrue(repository.setCoinSupport("live-123", true, "bad key") is LiveSessionsResult.Failure)
        assertTrue(transport.calls.isEmpty())

        val malformed = JSONObject(liveSession().toString()).put("status", "unknown")
        assertTrue(repository(RecordingLiveSessionsTransport(malformed)).load("live-123") is LiveSessionsResult.Failure)
    }

    @Test
    fun requiresAuthenticationForSuggestedAndMediaButAllowsOptionalSessionRead() {
        val transport = RecordingLiveSessionsTransport(liveSession())
        val repository = LiveSessionsRepository(sessionProvider = { null }, transport = transport)

        val suggested = repository.suggested() as LiveSessionsResult.Failure
        assertTrue(suggested.authenticationRequired)
        assertTrue(repository.issueMediaToken("live-123") is LiveSessionsResult.Failure)
        assertTrue(repository.load("live-123") is LiveSessionsResult.Success)
        assertNull(transport.calls.last().accessToken)
    }
}

private data class LiveSessionsCall(
    val method: String,
    val path: String,
    val accessToken: String?,
    val body: JSONObject?,
    val idempotencyKey: String?,
)

private class RecordingLiveSessionsTransport(private val response: JSONObject) : LiveSessionsTransport {
    val calls = mutableListOf<LiveSessionsCall>()
    var unauthorizedFirst = false

    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, idempotencyKey: String?): JSONObject {
        calls += LiveSessionsCall(method, path, accessToken, body?.let { JSONObject(it.toString()) }, idempotencyKey)
        if (unauthorizedFirst && calls.size == 1) throw LiveSessionsHttpException(401)
        return JSONObject(response.toString())
    }
}

private fun repository(transport: LiveSessionsTransport) = LiveSessionsRepository(
    sessionProvider = { liveTestSession("access") },
    transport = transport,
)

private fun liveTestSession(accessToken: String) = AccountSession(
    accessToken = accessToken,
    refreshToken = "refresh",
    user = AccountUser("user-123", "Test User", "test-user", null, null, emptyList()),
)

private fun suggestedLive() = """{"id":"live-123","title":"Live preview","coverUrl":null,"host":{"id":"creator-1","name":"Creator","username":"creator","avatarUrl":null,"verified":true,"followers":12,"following":8}}"""

private fun liveSession() = JSONObject(
    """{"id":"live-123","host":{"id":"creator-1","name":"Creator","username":"creator","avatarUrl":null,"verified":true,"followers":12,"following":8},"title":"Live room","category":"music","state":"live","status":"live","visibility":"everyone","viewers":42,"startedAt":"2026-11-06T09:30:00Z","coverUrl":null,"media":{"livekitUrl":"wss://live.nantty.test"},"giftsEnabled":true,"hostIsCreator":true,"isFollowingHost":true,"products":[],"access":{"allowed":true,"reason":""}}""",
)
