package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChannelInvitationsRepositoryTest {
    private val channelId = "11111111-1111-4111-8111-111111111111"
    private val invitationId = "22222222-2222-4222-8222-222222222222"
    private val linkId = "33333333-3333-4333-8333-333333333333"
    private val token = "a".repeat(43)

    @Test
    fun usesExactChannelRoutesAndAcceptanceIsSeparateFromLinkClaim() {
        val requests = mutableListOf<String>()
        val repository = repository { method, path, _, body ->
            requests += "$method $path ${body?.takeIf { it.has("expiresInHours") }?.optInt("expiresInHours") ?: ""}"
            when {
                method == "POST" && path.endsWith("/invitation-links") -> createdLink()
                method == "GET" && path.endsWith("/preview") -> preview()
                method == "POST" && path.endsWith("/claim") -> invitation("pending")
                method == "GET" && path.startsWith("/api/v1/channel-invitations") -> invitationPage()
                path.endsWith("/accept") -> invitation("accepted")
                path.endsWith("/decline") -> invitation("declined")
                method == "GET" -> linksPage()
                else -> revokedLink()
            }
        }

        val created = repository.createLink(channelId) as ChannelInvitationResult.Success
        assertEquals(token, created.value.token)
        val preview = repository.previewLink(token) as ChannelInvitationResult.Success
        assertEquals("Nantty updates", preview.value.title)
        assertEquals(8, preview.value.subscriberCount)
        assertEquals(ChannelInvitationStatus.PENDING, (repository.claimLink(token) as ChannelInvitationResult.Success).value.status)
        val pending = repository.listPending() as ChannelInvitationResult.Success
        assertEquals(1, pending.value.invitations.size)
        assertEquals(ChannelInvitationStatus.ACCEPTED, (repository.accept(invitationId) as ChannelInvitationResult.Success).value.status)
        assertEquals(ChannelInvitationStatus.DECLINED, (repository.decline(invitationId) as ChannelInvitationResult.Success).value.status)
        assertEquals(1, (repository.listLinks(channelId) as ChannelInvitationResult.Success).value.links.size)
        assertEquals(linkId, (repository.revokeLink(channelId, linkId) as ChannelInvitationResult.Success).value.id)

        assertEquals(
            listOf(
                "POST /api/v1/channels/$channelId/invitation-links 168",
                "GET /api/v1/channels/invitation-links/$token/preview ",
                "POST /api/v1/channels/invitation-links/$token/claim ",
                "GET /api/v1/channel-invitations?status=pending&limit=20 ",
                "POST /api/v1/channel-invitations/$invitationId/accept ",
                "POST /api/v1/channel-invitations/$invitationId/decline ",
                "GET /api/v1/channels/$channelId/invitation-links?limit=20 ",
                "DELETE /api/v1/channels/$channelId/invitation-links/$linkId ",
            ),
            requests,
        )
    }

    @Test
    fun retries401OnceWithRefreshedAuthenticationAndDoesNotRetryOtherFailures() {
        val tokens = mutableListOf<String>()
        var refreshes = 0
        val repository = repository(refresh = { refreshes++; session("fresh") }) { _, _, access, _ ->
            tokens += access
            if (tokens.size == 1) throw MessagesHttpException(401)
            preview()
        }
        assertTrue(repository.previewLink(token) is ChannelInvitationResult.Success)
        assertEquals(listOf("access", "fresh"), tokens)
        assertEquals(1, refreshes)

        var calls = 0
        val forbidden = repository { _, _, _, _ -> calls++; throw MessagesHttpException(403) }
            .listPending() as ChannelInvitationResult.Failure
        assertTrue(forbidden.authenticationRequired)
        assertEquals(1, calls)
    }

    @Test
    fun rejectsInvalidIdsTokensExpiryAndCursorBeforeNetworkAccess() {
        var calls = 0
        val repository = repository { _, _, _, _ -> calls++; JSONObject() }
        assertTrue(repository.createLink("invalid") is ChannelInvitationResult.Failure)
        assertTrue(repository.createLink(channelId, 48) is ChannelInvitationResult.Failure)
        assertTrue(repository.previewLink("not-a-token") is ChannelInvitationResult.Failure)
        assertTrue(repository.claimLink("not-a-token") is ChannelInvitationResult.Failure)
        assertTrue(repository.accept("invalid") is ChannelInvitationResult.Failure)
        assertTrue(repository.listPending(cursor = "invalid") is ChannelInvitationResult.Failure)
        assertTrue(repository.listLinks(channelId, cursor = "invalid") is ChannelInvitationResult.Failure)
        assertEquals(0, calls)
    }

    @Test
    fun linkListingDoesNotReadOrExposeTokensAndFiltersForeignChannelRows() {
        val foreign = "44444444-4444-4444-8444-444444444444"
        val repository = repository { _, _, _, _ ->
            JSONObject("""{"data":{"data":[{"id":"$linkId","channelId":"$channelId","createdAt":"created","expiresAt":"expiry","revokedAt":null,"token":"must-not-be-used"},{"id":"$invitationId","channelId":"$foreign","createdAt":"created","expiresAt":"expiry"}],"nextCursor":null}}""")
        }
        val page = repository.listLinks(channelId) as ChannelInvitationResult.Success
        assertEquals(listOf(linkId), page.value.links.map(ChannelInvitationLinkRecord::id))
        assertFalse(page.value.links.first().revokedAt != null)
    }

    private fun repository(
        refresh: () -> AccountSession? = { null },
        request: (String, String, String, JSONObject?) -> JSONObject,
    ) = ChannelInvitationsRepository({ session("access") }, ChatThreadTransport(request), refresh)

    private fun session(token: String) = AccountSession(
        token, "refresh", AccountUser(invitationId, "Ari", "ari", null, null, emptyList()),
    )

    private fun createdLink() = JSONObject().put("data", JSONObject()
        .put("id", linkId).put("channelId", channelId).put("token", token).put("expiresAt", "2030-01-01T00:00:00Z"))

    private fun preview() = JSONObject().put("data", JSONObject()
        .put("channel", JSONObject().put("title", "Nantty updates").put("subscriberCount", 8))
        .put("expiresAt", "2030-01-01T00:00:00Z"))

    private fun invitation(status: String) = JSONObject().put("data", JSONObject()
        .put("id", invitationId).put("channelId", channelId).put("channelTitle", "Nantty updates")
        .put("status", status).put("createdAt", "2026-11-06T12:00:00Z").put("expiresAt", "2030-01-01T00:00:00Z"))

    private fun invitationPage() = JSONObject().put("data", JSONObject()
        .put("data", org.json.JSONArray().put(JSONObject()
            .put("id", invitationId).put("channelId", channelId).put("status", "pending")
            .put("createdAt", "2026-11-06T12:00:00Z").put("expiresAt", "2030-01-01T00:00:00Z")))
        .put("nextCursor", JSONObject.NULL))

    private fun linksPage() = JSONObject().put("data", JSONObject()
        .put("data", org.json.JSONArray().put(JSONObject()
            .put("id", linkId).put("channelId", channelId).put("createdAt", "created")
            .put("expiresAt", "expiry").put("revokedAt", JSONObject.NULL)))
        .put("nextCursor", JSONObject.NULL))

    private fun revokedLink() = JSONObject().put("data", JSONObject()
        .put("id", linkId).put("channelId", channelId).put("revokedAt", "2026-11-06T12:00:00Z"))
}
