package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private const val TEST_SPACE_JSON = """{"id":"space-1","title":"Nigeria creators","state":"live","visibility":"followers","listenerCount":-4,"host":{"id":"host-1","role":"host"}}"""

class SpacesRepositoryTest {
    @Test
    fun parsesSummaryDetailsAndUnknownValuesSafely() {
        val summary = parseSpaceSummary(JSONObject(TEST_SPACE_JSON))
        assertEquals("space-1", summary.id)
        assertEquals("Nigeria creators", summary.title)
        assertEquals(SpaceVisibility.FOLLOWERS, summary.visibility)
        assertEquals(0, summary.listenerCount)

        val detail = parseSpaceDetails(JSONObject(TEST_SPACE_JSON).put("giftsEnabled", true)
            .put("speakers", JSONArray().put(JSONObject("""{"id":"speaker-1","role":"speaker","muted":true}""")))
            .put("pendingSpeakerRequests", JSONArray().put(JSONObject("""{"id":"request-1","user":{"id":"user-1","role":"listener"}}""")))
            .put("viewerRole", "listener").put("viewerJoined", false))
        assertTrue(detail.giftsEnabled)
        assertTrue(detail.speakers.single().muted)
        assertEquals("request-1", detail.pendingSpeakerRequests.single().id)
        assertFalse(detail.viewerJoined == true)

        val unknown = parseSpaceSummary(JSONObject(TEST_SPACE_JSON).put("state", "future").put("visibility", "future"))
        assertEquals(SpaceState.UNKNOWN, unknown.state)
        assertEquals(SpaceVisibility.UNKNOWN, unknown.visibility)
    }

    @Test
    fun listDetailAndCreateUseExpectedContractsAndBearerToken() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        val list = repository.list("access-token") as SpacesResult.Success
        assertEquals("space-1", list.value.items.single().id)
        assertEquals("GET", transport.calls.last().method)
        assertTrue(transport.calls.last().path.startsWith("/api/v1/spaces?state=live%2Cupcoming&limit=30"))
        assertEquals("access-token", transport.calls.last().token)

        repository.detail("space-1", "access-token")
        assertEquals("/api/v1/spaces/space-1", transport.calls.last().path)

        repository.create(
            CreateSpaceRequest("  Title  ", " desc ", SpaceVisibility.INVITE_ONLY, "2030-01-01T10:00:00Z", true),
            "access-token", "create-key-123",
        )
        val call = transport.calls.last()
        assertEquals("POST", call.method)
        assertEquals("create-key-123", call.idempotencyKey)
        assertEquals("Title", call.body?.getString("title"))
        assertEquals("invite_only", call.body?.getString("visibility"))
        assertEquals("2030-01-01T10:00:00Z", call.body?.getString("scheduledAt"))
        assertTrue(call.body?.getBoolean("giftsEnabled") == true)
    }

    @Test
    fun publicListAndDetailCanBeLoadedWithoutBearerToken() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        assertTrue(repository.list() is SpacesResult.Success)
        assertNull(transport.calls.last().token)
        assertTrue(repository.detail("space-1") is SpacesResult.Success)
        assertNull(transport.calls.last().token)
    }

    @Test
    fun pendingInvitationsAreRecipientScopedByAuthenticatedContractAndPreserveModeratorRole() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        val page = repository.listInvitations("invitee-token", "next-cursor") as SpacesResult.Success
        val invitation = page.value.items.single()
        assertEquals("space-1", invitation.spaceId)
        assertEquals("invitation-1", invitation.invitationId)
        assertEquals("moderator", invitation.role)
        assertEquals("Guest host", invitation.title)
        assertEquals("host-1", invitation.inviterId)
        assertEquals("space-1", invitation.space.id)
        assertEquals("GET", transport.calls.single().method)
        assertEquals("/api/v1/spaces/invitations?limit=30&cursor=next-cursor", transport.calls.single().path)
        assertEquals("invitee-token", transport.calls.single().token)
    }

    @Test
    fun invitePeopleSearchUsesAuthenticatedSocialContractAndEncodesQuery() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        val result = repository.searchInvitePeople("  Kai & co  ", "member-token") as SpacesResult.Success
        assertEquals("candidate-1", result.value.single().id)
        assertEquals("Kai O'Neil", result.value.single().name)
        assertEquals("kai", result.value.single().username)
        assertEquals(true, result.value.single().verified)
        assertEquals("GET", transport.calls.single().method)
        assertEquals("/api/v1/search/people?q=Kai%20%26%20co&limit=20", transport.calls.single().path)
        assertEquals("member-token", transport.calls.single().token)
    }

    @Test
    fun invitePeopleSearchRequiresAuthAndRejectsInvalidQueryBeforeRequest() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        assertTrue(repository.searchInvitePeople("kai", " ") is SpacesResult.Failure)
        assertTrue(repository.searchInvitePeople("k", "member-token") is SpacesResult.Failure)
        assertTrue(repository.searchInvitePeople("x".repeat(101), "member-token") is SpacesResult.Failure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun invitePeopleParserCapsResultsAndDropsMalformedAndDuplicateRows() {
        val rows = JSONArray()
        repeat(SPACE_INVITE_PEOPLE_LIMIT + 5) { index ->
            rows.put(JSONObject().put("id", "account-$index").put("name", "Person $index").put("username", "user$index"))
        }
        rows.put(JSONObject().put("id", "account-0").put("name", "Duplicate").put("username", "duplicate"))
        rows.put(JSONObject().put("id", "bad").put("name", "No username"))
        val result = parseSpaceInvitePeople(JSONObject().put("data", rows), SPACE_INVITE_PEOPLE_LIMIT)
        assertEquals(SPACE_INVITE_PEOPLE_LIMIT, result.size)
        assertEquals(SPACE_INVITE_PEOPLE_LIMIT, result.map(SpaceInvitePerson::id).distinct().size)
        assertEquals("Person 0", result.first().name)
    }

    @Test
    fun acceptAndDeclineUseServerInvitationIdentifiersAndAuthenticatedIdempotentActions() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        assertTrue(repository.acceptInvitation("space-1", "invitation-1", "token", "accept-key-123") is SpacesResult.Success)
        assertTrue(repository.declineInvitation("space-2", "invitation-2", "token", "decline-key-123") is SpacesResult.Success)
        assertEquals("/api/v1/spaces/space-1/invites/invitation-1/accept", transport.calls[0].path)
        assertEquals("/api/v1/spaces/space-2/invites/invitation-2/decline", transport.calls[1].path)
        assertEquals("token", transport.calls[0].token)
        assertEquals("accept-key-123", transport.calls[0].idempotencyKey)
        assertEquals("decline-key-123", transport.calls[1].idempotencyKey)
        assertTrue(transport.calls.all { it.body == null })
    }

    @Test
    fun joinLeaveAndSpeakerActionsUseExpectedMethodsPathsBodiesAndKeys() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        val grant = repository.join("space-1", "token", "join-key-123") as SpacesResult.Success
        assertEquals("media-token", grant.value.token)
        assertEquals("POST", transport.calls.last().method)
        assertEquals("/api/v1/spaces/space-1/join", transport.calls.last().path)
        assertEquals("join-key-123", transport.calls.last().idempotencyKey)

        repository.leave("space-1", "token", "leave-key-123")
        assertEquals("/api/v1/spaces/space-1/leave", transport.calls.last().path)
        val speakerRequest = repository.requestSpeaker("space-1", "token", "request-key-123") as SpacesResult.Success<SpaceSpeakerRequest>
        assertEquals("request-1", speakerRequest.value.id)
        assertEquals("pending", speakerRequest.value.state)
        assertEquals("/api/v1/spaces/space-1/speaker-requests", transport.calls.last().path)
        repository.approveSpeakerRequest("space-1", "request-1", "token", "approve-key-123")
        assertEquals("/api/v1/spaces/space-1/speaker-requests/request-1/approve", transport.calls.last().path)
        repository.declineSpeakerRequest("space-1", "request-1", "token", "decline-key-123")
        assertEquals("/api/v1/spaces/space-1/speaker-requests/request-1/decline", transport.calls.last().path)
        repository.muteSpeaker("space-1", "user-1", true, "token", "mute-key-123")
        assertEquals(true, transport.calls.last().body?.getBoolean("muted"))
        repository.removeSpeaker("space-1", "user-1", "token", "remove-key-123")
        assertTrue(transport.calls.last().path.endsWith("/speakers/user-1/remove"))
        repository.demoteSpeaker("space-1", "user-1", "token", "demote-key-123")
        assertTrue(transport.calls.last().path.endsWith("/speakers/user-1/demote"))
        repository.start("space-1", "token", "start-key-123")
        assertEquals("/api/v1/spaces/space-1/start", transport.calls.last().path)
        repository.end("space-1", "token", "end-key-123")
        assertEquals("/api/v1/spaces/space-1/end", transport.calls.last().path)
        repository.cancel("space-1", "token", "cancel-key-123")
        assertEquals("/api/v1/spaces/space-1/cancel", transport.calls.last().path)
    }

    @Test
    fun inviteCoinSupportAndCoinDonationSendExactRequestShapes() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        repository.invite("space-1", "account-1", "token", "invite-key-123", SpaceInviteRole.COHOST, "Guest host")
        assertEquals("account-1", transport.calls.last().body?.getString("accountId"))
        assertEquals("cohost", transport.calls.last().body?.getString("role"))
        assertEquals("Guest host", transport.calls.last().body?.getString("title"))
        assertEquals("invite-key-123", transport.calls.last().idempotencyKey)

        repository.invite("space-1", "account-2", "token", "invite-key-456")
        assertEquals("listener", transport.calls.last().body?.getString("role"))
        assertFalse(transport.calls.last().body?.has("title") == true)

        repository.setCoinDonations("space-1", false, "token", "toggle-key-123")
        val toggle = transport.calls.last()
        assertEquals("PATCH", toggle.method)
        assertEquals(false, toggle.body?.getBoolean("enabled"))
        assertEquals("toggle-key-123", toggle.idempotencyKey)

        val donation = repository.sendCoinDonation("space-1", 275, "token", "donate-key-123") as SpacesResult.Success
        val call = transport.calls.last()
        assertEquals(275L, call.body?.getLong("coins"))
        assertNull(call.body?.opt("giftId"))
        assertEquals("donate-key-123", call.idempotencyKey)
        assertEquals(275L, donation.value.totalCoins)
    }

    @Test
    fun rejectsMissingAuthInvalidIdsAndDonationAmountsWithoutRequests() {
        val transport = RecordingSpacesTransport()
        val repository = SpacesRepository("https://api.nantty.test", transport)
        assertTrue(repository.create(CreateSpaceRequest("Title", visibility = SpaceVisibility.PUBLIC, giftsEnabled = false), " ") is SpacesResult.Failure)
        assertTrue(repository.join("space-1", "token", "bad key") is SpacesResult.Failure)
        assertTrue(repository.sendCoinDonation("space-1", 0, "token", "donate-key-123") is SpacesResult.Failure)
        assertTrue(repository.sendCoinDonation("space-1", -2, "token", "donate-key-123") is SpacesResult.Failure)
        assertTrue(repository.invite("space-1", "account-1", "token", "invite-key-123", title = "x".repeat(61)) is SpacesResult.Failure)
        assertTrue(repository.listInvitations(" ") is SpacesResult.Failure)
        assertTrue(repository.acceptInvitation("space-1", "invite-1", " ") is SpacesResult.Failure)
        assertTrue(repository.declineInvitation("space-1", "bad/invite", "token") is SpacesResult.Failure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun propagatesHttpErrorsWithStatusAndDoesNotDropRequestToken() {
        val transport = RecordingSpacesTransport().apply { error = SpacesHttpException(403, "not allowed") }
        val result = SpacesRepository("https://api.nantty.test", transport).detail("space-1", "caller-token")
        assertEquals(403, (result as SpacesResult.Failure).statusCode)
        assertEquals("caller-token", transport.calls.single().token)
        assertEquals("not allowed", result.message)
    }

}

private class RecordingSpacesTransport : SpacesTransport {
    data class Call(val method: String, val path: String, val token: String?, val body: JSONObject?, val idempotencyKey: String?)
    val calls = mutableListOf<Call>()
    var error: Exception? = null

    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, idempotencyKey: String?): JSONObject {
        calls += Call(method, path, accessToken, body, idempotencyKey)
        error?.let { throw it }
        return when {
            method == "GET" && path.startsWith("/api/v1/search/people?") -> JSONObject()
                .put("data", JSONArray().put(JSONObject()
                    .put("id", "candidate-1")
                    .put("name", "Kai O'Neil")
                    .put("username", "kai")
                    .put("avatarUrl", JSONObject.NULL)
                    .put("verified", true)
                    .put("isCreator", false)
                    .put("isFollowing", false)
                    .put("followState", "none")
                    .put("followsYou", false)
                    .put("mutualConnections", 0)))
                .put("nextCursor", null)
            method == "GET" && path.startsWith("/api/v1/spaces/invitations?") -> JSONObject()
                .put("data", JSONArray().put(JSONObject()
                    .put("spaceId", "space-1")
                    .put("invitationId", "invitation-1")
                    .put("role", "moderator")
                    .put("title", "Guest host")
                    .put("invitedAt", "2026-11-05T10:00:00Z")
                    .put("inviterId", "host-1")
                    .put("space", JSONObject(TEST_SPACE_JSON))))
                .put("nextCursor", "cursor-2")
            method == "GET" && path.startsWith("/api/v1/spaces?") -> JSONObject().put("data", JSONArray().put(JSONObject(TEST_SPACE_JSON)))
            method == "GET" -> JSONObject(TEST_SPACE_JSON)
            path.endsWith("/join") -> JSONObject("""{"spaceId":"space-1","role":"listener","token":"media-token","url":"https://media.test","canPublish":false,"listeners":2}""")
            path.endsWith("/coin-donations") && method == "POST" -> JSONObject("""{"id":"donation-1","hostUserId":"host-1","totalCoins":275,"senderCoinBalance":725}""")
            path.endsWith("/coin-donations") -> JSONObject("""{"spaceId":"space-1","giftsEnabled":false}""")
            path.endsWith("/speaker-requests") -> JSONObject("""{"id":"request-1","state":"pending"}""")
            else -> JSONObject()
        }
    }
}
