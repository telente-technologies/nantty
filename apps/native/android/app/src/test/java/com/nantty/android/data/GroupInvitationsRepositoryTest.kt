package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GroupInvitationsRepositoryTest {
    private val conversationId = "11111111-1111-4111-8111-111111111111"
    private val invitationId = "22222222-2222-4222-8222-222222222222"
    private val memberId = "33333333-3333-4333-8333-333333333333"

    @Test
    fun listsReceivedAndSentCursorPagesAndSafelyParsesCounterpart() {
        val requests = mutableListOf<String>()
        val repository = repository { method, path, token, _ ->
            assertEquals("GET", method)
            assertEquals("session-access", token)
            requests += path
            JSONObject(
                """{"data":{"data":[{"id":"$invitationId","conversationId":"$conversationId","status":"pending","createdAt":"2026-11-05T12:00:00.000Z","expiresAt":"2026-11-12T12:00:00.000Z","counterpart":{"id":"$memberId","name":"Ari","username":"@ari","avatarUrl":"http://unsafe.test/avatar.png","verified":true}}],"nextCursor":"$invitationId"}}""",
            )
        }

        val received = repository.list(GroupInvitationDirection.RECEIVED) as GroupInvitationResult.Success
        val sent = repository.list(GroupInvitationDirection.SENT, received.value.nextCursor) as GroupInvitationResult.Success
        val counterpart = received.value.invitations.single().counterpart!!

        assertEquals(
            listOf(
                "/api/v1/group-invitations?direction=received&limit=20",
                "/api/v1/group-invitations?direction=sent&limit=20&cursor=$invitationId",
            ),
            requests,
        )
        assertEquals(memberId, counterpart.id)
        assertEquals("ari", counterpart.username)
        assertEquals(null, counterpart.avatarUrl)
        assertTrue(counterpart.verified)
        assertEquals(invitationId, sent.value.nextCursor)
    }

    @Test
    fun createsInvitationForValidatedConversationAndRecipientUsingExactContract() {
        var request: String? = null
        val repository = repository { method, path, token, body ->
            request = "$method $path $token ${body?.optString("inviteeId")}"
            invitationPayload(status = "pending")
        }

        val result = repository.create(conversationId, memberId) as GroupInvitationResult.Success

        assertEquals("POST /api/v1/conversations/$conversationId/invitations session-access $memberId", request)
        assertEquals(GroupInvitationMembershipStatus.NOT_JOINED, result.value.membershipStatus)
    }

    @Test
    fun acceptDeclineAndRevokeUseTheirRoutesAndAcceptanceNeverMeansJoined() {
        val requests = mutableListOf<String>()
        val repository = repository { method, path, _, _ ->
            requests += "$method $path"
            when {
                path.endsWith("/accept") -> invitationPayload(status = "accepted", membership = "awaiting_secure_key_handoff")
                path.endsWith("/decline") -> invitationPayload(status = "declined")
                else -> invitationPayload(status = "revoked")
            }
        }

        val accepted = repository.accept(invitationId) as GroupInvitationResult.Success
        val declined = repository.decline(invitationId) as GroupInvitationResult.Success
        val revoked = repository.revoke(conversationId, invitationId) as GroupInvitationResult.Success

        assertEquals(GroupInvitationMembershipStatus.AWAITING_SECURE_KEY_HANDOFF, accepted.value.membershipStatus)
        assertFalse("Consent must not be represented as membership", accepted.value.membershipStatus == GroupInvitationMembershipStatus.NOT_JOINED && accepted.value.status == GroupInvitationStatus.ACCEPTED)
        assertEquals(GroupInvitationStatus.DECLINED, declined.value.status)
        assertEquals(GroupInvitationStatus.REVOKED, revoked.value.status)
        assertEquals(
            listOf(
                "POST /api/v1/group-invitations/$invitationId/accept",
                "POST /api/v1/group-invitations/$invitationId/decline",
                "DELETE /api/v1/conversations/$conversationId/invitations/$invitationId",
            ),
            requests,
        )
    }

    @Test
    fun rejectsInvalidIdsAndMalformedPageCursorWithoutRequestingNetwork() {
        var requests = 0
        val repository = repository { _, _, _, _ -> requests += 1; JSONObject() }

        assertTrue(repository.create("bad", memberId) is GroupInvitationResult.Failure)
        assertTrue(repository.accept("bad") is GroupInvitationResult.Failure)
        assertTrue(repository.list(GroupInvitationDirection.RECEIVED, cursor = "bad") is GroupInvitationResult.Failure)
        assertEquals(0, requests)
    }

    @Test
    fun retriesExpiredSessionOnceAndMarksMissingRefreshAsAuthenticationRequired() {
        val tokens = mutableListOf<String>()
        var refreshes = 0
        val refreshed = repository(
            refresh = { refreshes += 1; session("fresh-access") },
        ) { _, _, token, _ ->
            tokens += token
            if (tokens.size == 1) throw MessagesHttpException(401)
            invitationPayload(status = "accepted", membership = "awaiting_secure_key_handoff")
        }
        assertTrue(refreshed.accept(invitationId) is GroupInvitationResult.Success)
        assertEquals(listOf("session-access", "fresh-access"), tokens)
        assertEquals(1, refreshes)

        val expired = repository(refresh = { null }) { _, _, _, _ -> throw MessagesHttpException(401) }
        val failure = expired.list(GroupInvitationDirection.RECEIVED) as GroupInvitationResult.Failure
        assertTrue(failure.authenticationRequired)
    }

    @Test
    fun createsPreviewsClaimsAndRevokesLinksUsingTheServerContract() {
        val linkId = "44444444-4444-4444-8444-444444444444"
        val token = "a".repeat(43)
        val requests = mutableListOf<String>()
        val repository = repository { method, path, _, body ->
            requests += "$method $path ${body?.takeIf { it.has("expiresInHours") }?.optInt("expiresInHours") ?: ""}"
            when {
                method == "POST" && path.endsWith("/invitation-links") -> JSONObject().put("data", JSONObject()
                    .put("id", linkId).put("conversationId", conversationId).put("token", token).put("expiresAt", "2026-11-13T12:00:00.000Z"))
                method == "GET" -> JSONObject().put("data", JSONObject()
                    .put("group", JSONObject().put("title", "Book club").put("memberCount", 3)).put("expiresAt", "2026-11-13T12:00:00.000Z"))
                method == "POST" && path.endsWith("/claim") -> invitationPayload(status = "pending")
                else -> JSONObject().put("data", JSONObject()
                    .put("id", linkId).put("conversationId", conversationId).put("revokedAt", "2026-11-06T12:00:00.000Z"))
            }
        }

        val created = repository.createLink(conversationId, 24) as GroupInvitationResult.Success
        val preview = repository.previewLink(created.value.token) as GroupInvitationResult.Success
        val claimed = repository.claimLink(created.value.token) as GroupInvitationResult.Success
        val revoked = repository.revokeLink(conversationId, created.value.id) as GroupInvitationResult.Success

        assertEquals(linkId, created.value.id)
        assertEquals("Book club", preview.value.title)
        assertEquals(3, preview.value.memberCount)
        assertEquals(GroupInvitationStatus.PENDING, claimed.value.status)
        assertEquals(GroupInvitationMembershipStatus.NOT_JOINED, claimed.value.membershipStatus)
        assertEquals(linkId, revoked.value.id)
        assertEquals(
            listOf(
                "POST /api/v1/conversations/$conversationId/invitation-links 24",
                "GET /api/v1/conversations/invitation-links/$token/preview ",
                "POST /api/v1/conversations/invitation-links/$token/claim ",
                "DELETE /api/v1/conversations/$conversationId/invitation-links/$linkId ",
            ),
            requests,
        )
    }

    @Test
    fun listsOnlySafeLinkMetadataWithCursorAndRejectsAnotherConversationsRows() {
        val otherConversationId = "55555555-5555-4555-8555-555555555555"
        val linkId = "44444444-4444-4444-8444-444444444444"
        var requestPath: String? = null
        val repository = repository { method, path, _, _ ->
            assertEquals("GET", method)
            requestPath = path
            JSONObject().put("data", JSONObject()
                .put("data", org.json.JSONArray()
                    .put(JSONObject().put("id", linkId).put("conversationId", conversationId).put("createdAt", "2026-11-06T12:00:00Z").put("expiresAt", "2026-11-13T12:00:00Z").put("revokedAt", JSONObject.NULL).put("token", "must-not-be-present"))
                    .put(JSONObject().put("id", "66666666-6666-4666-8666-666666666666").put("conversationId", otherConversationId).put("createdAt", "2026-11-06T12:00:00Z").put("expiresAt", "2026-11-13T12:00:00Z")))
                .put("nextCursor", linkId))
        }

        val page = repository.listLinks(conversationId, linkId) as GroupInvitationResult.Success

        assertEquals("/api/v1/conversations/$conversationId/invitation-links?limit=20&cursor=$linkId", requestPath)
        assertEquals(listOf(linkId), page.value.links.map(GroupInvitationLinkRecord::id))
        assertEquals(null, page.value.links.single().revokedAt)
        assertEquals(linkId, page.value.nextCursor)
    }

    @Test
    fun rejectsMalformedLinkTokensAndUnsupportedExpiryWithoutNetworkCalls() {
        var requests = 0
        val repository = repository { _, _, _, _ -> requests += 1; JSONObject() }

        assertTrue(repository.createLink(conversationId, 48) is GroupInvitationResult.Failure)
        assertTrue(repository.previewLink("short") is GroupInvitationResult.Failure)
        assertTrue(repository.claimLink("short") is GroupInvitationResult.Failure)
        assertEquals(0, requests)
    }

    private fun repository(
        refresh: () -> AccountSession? = { null },
        request: (String, String, String, JSONObject?) -> JSONObject,
    ) = GroupInvitationsRepository(
        sessionProvider = { session("session-access") },
        transport = ChatThreadTransport(request),
        refreshSessionProvider = refresh,
    )

    private fun invitationPayload(status: String, membership: String? = null): JSONObject {
        val value = JSONObject()
            .put("id", invitationId)
            .put("conversationId", conversationId)
            .put("status", status)
            .put("createdAt", "2026-11-05T12:00:00.000Z")
            .put("expiresAt", "2026-11-12T12:00:00.000Z")
            .put("counterpart", JSONObject().put("id", memberId).put("name", "Ari").put("username", "ari"))
        membership?.let { value.put("membershipStatus", it) }
        return JSONObject().put("data", value)
    }

    private fun session(token: String) = AccountSession(
        token,
        "session-refresh",
        AccountUser(memberId, "Ari", "ari", null, null, emptyList()),
    )
}
