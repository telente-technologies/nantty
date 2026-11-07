package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveStageRepositoryTest {
    @Test
    fun loadsStageAndRequestsToJoinThroughTheAuthenticatedStageRoutes() {
        val transport = RecordingStageTransport(stageJson())
        val repository = stageRepository(transport)

        val initial = repository.load("live-123") as LiveSessionsResult.Success
        assertEquals("viewer", initial.value.myRole)
        assertNull(initial.value.invitationId)
        assertEquals("GET" to "/api/v1/lives/live-123/stage", transport.calls[0].method to transport.calls[0].path)

        val pending = repository.requestToJoin("live-123") as LiveSessionsResult.Success
        assertEquals("pending", pending.value.joinRequestState)
        assertEquals("POST" to "/api/v1/lives/live-123/guests/requests", transport.calls[1].method to transport.calls[1].path)

        val invite = JSONObject(stageJson().toString()).put("invitationForMe", JSONObject("""{"id":"slot-456"}"""))
        assertEquals("slot-456", (stageRepository(RecordingStageTransport(invite)).load("live-123") as LiveSessionsResult.Success).value.invitationId)
    }

    @Test
    fun acceptsInvitationAndParsesServerIssuedPublishGrant() {
        val response = JSONObject(stageJson().toString())
            .put("myRole", "guest")
            .put("invitationForMe", JSONObject.NULL)
            .put("livekit", JSONObject("""{"url":"wss://media.nantty.test","token":"publish-token","canPublish":true,"role":"guest"}"""))
        val transport = RecordingStageTransport(response)
        val result = stageRepository(transport).respondToInvitation("live-123", "slot-456", accept = true) as LiveSessionsResult.Success

        assertEquals("POST", transport.calls.single().method)
        assertEquals("/api/v1/lives/live-123/guests/invitations/slot-456/accept", transport.calls.single().path)
        assertEquals("guest", result.value.stage.myRole)
        assertEquals("publish-token", result.value.mediaGrant?.token)
        assertTrue(result.value.mediaGrant?.canPublish == true)
    }

    @Test
    fun declineNeverReturnsOrUsesAStageMediaGrant() {
        val response = JSONObject(stageJson().toString()).put("livekit", JSONObject("""{"url":"wss://media.nantty.test","token":"token","canPublish":true,"role":"guest"}"""))
        val transport = RecordingStageTransport(response)
        val result = stageRepository(transport).respondToInvitation("live-123", "slot-456", accept = false) as LiveSessionsResult.Success
        assertEquals("/api/v1/lives/live-123/guests/invitations/slot-456/decline", transport.calls.single().path)
        assertNull(result.value.mediaGrant)
    }

    @Test
    fun rejectsMismatchedIdsAndUnsafeMediaGrants() {
        val transport = RecordingStageTransport(stageJson())
        val repository = stageRepository(transport)
        assertTrue(repository.load("../live") is LiveSessionsResult.Failure)
        assertTrue(repository.respondToInvitation("live-123", "bad/slot", true) is LiveSessionsResult.Failure)
        assertTrue(transport.calls.isEmpty())

        val invalid = JSONObject(stageJson().toString())
            .put("myRole", "admin")
            .put("livekit", JSONObject("""{"url":"http://media.test","token":"token","canPublish":true,"role":"guest"}"""))
        assertTrue(stageRepository(RecordingStageTransport(invalid)).load("live-123") is LiveSessionsResult.Failure)

        val response = JSONObject(stageJson().toString()).put("myRole", "guest").put("livekit", invalid.optJSONObject("livekit"))
        assertTrue(stageRepository(RecordingStageTransport(response)).respondToInvitation("live-123", "slot-456", true) is LiveSessionsResult.Failure)
    }

    @Test
    fun refreshesExpiredAuthenticationOnceAndRequiresSignInForWrites() {
        val transport = RecordingStageTransport(stageJson()).apply { unauthorizedFirst = true }
        val refreshed = LiveStageRepository(
            sessionProvider = { stageSession("expired") },
            refreshSessionProvider = { stageSession("fresh") },
            transport = transport,
        ).requestToJoin("live-123")

        assertTrue(refreshed is LiveSessionsResult.Success)
        assertEquals(listOf("expired", "fresh"), transport.calls.map { it.token })
        val callsBeforeSignedOutWrite = transport.calls.size
        val signedOut = LiveStageRepository(sessionProvider = { null }, transport = transport).requestToJoin("live-123")
        assertTrue(signedOut is LiveSessionsResult.Failure)
        assertTrue((signedOut as LiveSessionsResult.Failure).authenticationRequired)
        assertEquals(callsBeforeSignedOutWrite, transport.calls.size)
    }

    @Test
    fun hostCanSearchViewersInviteDecideRequestsAndModerateStageGuests() {
        val search = JSONObject("""{"data":[{"id":"viewer-123","name":"Ada Viewer","username":"ada","avatarUrl":null,"verified":true}],"nextCursor":""}""")
        val transport = RecordingStageTransport(search)
        val repository = stageRepository(transport)

        val viewers = repository.searchViewers("live-123", "ada") as LiveSessionsResult.Success
        assertEquals("Ada Viewer", viewers.value.single().name)
        assertEquals("GET" to "/api/v1/lives/live-123/viewers?q=ada", transport.calls.single().method to transport.calls.single().path)

        transport.response = JSONObject(stageJson().toString())
        assertTrue(repository.inviteViewer("live-123", "viewer-123") is LiveSessionsResult.Success)
        assertEquals("viewer-123", JSONObject(transport.calls.last().body).optString("userId"))
        assertEquals("speaker", JSONObject(transport.calls.last().body).optString("role"))
        assertTrue(repository.decideJoinRequest("live-123", "request-123", true) is LiveSessionsResult.Success)
        assertTrue(transport.calls.last().path.endsWith("/guests/requests/request-123/approve"))
        assertTrue(repository.removeGuest("live-123", "viewer-123") is LiveSessionsResult.Success)
        assertTrue(transport.calls.last().path.endsWith("/guests/viewer-123/remove"))
        assertTrue(repository.muteStreamer("live-123", "viewer-123", audio = true) is LiveSessionsResult.Success)
        assertEquals(true, JSONObject(transport.calls.last().body).optBoolean("audio"))
    }

    @Test
    fun hostInvitationSendsRoleAndOptionalTitleAndParsesInviteDesignation() {
        val transport = RecordingStageTransport(stageJson())
        val repository = stageRepository(transport)

        assertTrue(repository.inviteViewer("live-123", "viewer-123", "cohost", "Guest expert") is LiveSessionsResult.Success)
        val request = JSONObject(transport.calls.single().body)
        assertEquals("cohost", request.optString("role"))
        assertEquals("Guest expert", request.optString("title"))

        val response = JSONObject(stageJson().toString()).put(
            "invitationForMe",
            JSONObject("""{"id":"slot-456","stageRole":"cohost","title":"Guest expert"}"""),
        )
        val invite = stageRepository(RecordingStageTransport(response)).load("live-123") as LiveSessionsResult.Success
        assertEquals("cohost", invite.value.invitationRole)
        assertEquals("Guest expert", invite.value.invitationTitle)
    }

    @Test
    fun rejectsInvalidLiveInvitationRoleAndOverlongTitleBeforeTransport() {
        val transport = RecordingStageTransport(stageJson())
        val repository = stageRepository(transport)
        assertTrue(repository.inviteViewer("live-123", "viewer-123", "admin", "Title") is LiveSessionsResult.Failure)
        assertTrue(repository.inviteViewer("live-123", "viewer-123", "speaker", "x".repeat(33)) is LiveSessionsResult.Failure)
        assertTrue(transport.calls.isEmpty())
    }
}

private data class StageCall(val method: String, val path: String, val token: String, val body: String)
private class RecordingStageTransport(var response: JSONObject) : LiveSessionsTransport {
    val calls = mutableListOf<StageCall>()
    var unauthorizedFirst = false
    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, idempotencyKey: String?): JSONObject {
        calls += StageCall(method, path, accessToken.orEmpty(), body?.toString().orEmpty())
        if (unauthorizedFirst && calls.size == 1) throw LiveSessionsHttpException(401)
        return JSONObject(response.toString())
    }
}

private fun stageRepository(transport: LiveSessionsTransport) = LiveStageRepository({ stageSession("access") }, transport = transport)
private fun stageSession(token: String) = AccountSession(token, "refresh", AccountUser("user-123", "Test User", "test-user", null, null, emptyList()))
private fun stageJson() = JSONObject("""{"liveId":"live-123","myRole":"viewer","invitationForMe":null,"myJoinRequest":{"state":"pending"}}""")
