package com.nantty.android.data

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SupportTicketRepositoryTest {
    @Test
    fun listsRequesterTicketsAndLoadsUnreadCountFromTheirCanonicalRoutes() {
        val listTransport = RecordingSupportTransport(JSONObject().put("data", JSONArray().put(summary())))
        val repository = SupportTicketRepository("https://api.nantty.com", ::signedInSession, transport = listTransport)

        val listed = repository.listMyTickets() as SupportTicketResult.Success

        assertEquals("GET", listTransport.method)
        assertEquals(TICKETS_PATH, listTransport.path)
        assertEquals(TICKET_ID, listed.value.single().id)
        assertEquals(2, listed.value.single().unreadCount)

        val unreadTransport = RecordingSupportTransport(JSONObject().put("count", 2))
        val unread = SupportTicketRepository("https://api.nantty.com", ::signedInSession, transport = unreadTransport)
            .unreadCount() as SupportTicketResult.Success
        assertEquals("/api/v1/support/tickets/unread-count", unreadTransport.path)
        assertEquals(2, unread.value)
    }

    @Test
    fun ratesTicketOnTheRequesterRatingRoute() {
        val transport = RecordingSupportTransport(JSONObject())
        val result = SupportTicketRepository("https://api.nantty.com", ::signedInSession, transport = transport)
            .rateTicket(TICKET_ID, 5)

        assertTrue(result is SupportTicketResult.Success)
        assertEquals("POST", transport.method)
        assertEquals("$TICKETS_PATH/$TICKET_ID/rating", transport.path)
        assertEquals(5, transport.body?.optInt("score"))
        assertTrue(transport.body?.isNull("comment") == true)
    }

    @Test
    fun createsOrderLinkedTicketWithAuthenticatedRequestAndParsesThread() {
        val transport = RecordingSupportTransport(ticket())
        val repository = SupportTicketRepository("https://api.nantty.com", ::signedInSession, transport = transport)

        val result = repository.createTicket(
            category = "order",
            subject = "Order hasn't arrived",
            message = "The tracking page has not changed for several days.",
            linkedReference = SupportLinkedReference("order", ORDER_ID, "Order NT-1042"),
            idempotencyKey = "support-key-1",
        ) as SupportTicketResult.Success

        assertEquals("POST", transport.method)
        assertEquals(SupportTicketRepository.TICKETS_PATH, transport.path)
        assertEquals("buyer-token", transport.token)
        assertEquals("support-key-1", transport.idempotencyKey)
        assertEquals("order", transport.body?.optString("category"))
        assertEquals("Order NT-1042", transport.body?.optJSONObject("linkedReference")?.optString("label"))
        assertEquals(TICKET_ID, result.value.id)
        assertEquals("open", result.value.status)
        assertEquals("We're looking into this", result.value.messages.single().text)
    }

    @Test
    fun requiresAuthenticationBeforeAnySupportRequest() {
        val transport = RecordingSupportTransport(ticket())
        val result = SupportTicketRepository("https://api.nantty.com", { null }, transport = transport)
            .loadTicket(TICKET_ID) as SupportTicketResult.Failure

        assertTrue(result.authenticationRequired)
        assertTrue(transport.path == null)
    }

    @Test
    fun rejectsInvalidCreationValuesWithoutCallingTheTransport() {
        val transport = RecordingSupportTransport(ticket())
        val repository = SupportTicketRepository("https://api.nantty.com", ::signedInSession, transport = transport)

        val result = repository.createTicket(
            category = "unsupported",
            subject = "abc",
            message = "too short",
            linkedReference = SupportLinkedReference("order", "", "Order NT-1042"),
            idempotencyKey = "bad",
        )

        assertTrue(result is SupportTicketResult.Failure)
        assertTrue(transport.path == null)
    }

    @Test
    fun refreshesAnExpiredSessionOnceForTheSameWrite() {
        val tokens = mutableListOf<String>()
        val transport = object : SupportTicketTransport {
            override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject {
                tokens += accessToken
                if (tokens.size == 1) throw SupportTicketHttpException(401)
                return ticket()
            }
        }
        val repository = SupportTicketRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            refreshSessionProvider = { signedInSession().copy(accessToken = "refreshed-token") },
            transport = transport,
        )

        val result = repository.createTicket("order", "Order issue", "The parcel has not arrived yet.", idempotencyKey = "support-key-2")

        assertTrue(result is SupportTicketResult.Success)
        assertEquals(listOf("buyer-token", "refreshed-token"), tokens)
    }

    @Test
    fun returnsAuthenticationRecoveryForUnauthorizedAndForbiddenResponses() {
        listOf(401, 403).forEach { status ->
            val transport = object : SupportTicketTransport {
                override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject {
                    throw SupportTicketHttpException(status)
                }
            }
            val result = SupportTicketRepository("https://api.nantty.com", ::signedInSession, transport = transport)
                .loadTicket(TICKET_ID) as SupportTicketResult.Failure
            assertTrue(result.authenticationRequired)
        }
    }

    @Test
    fun repliesWithIdempotencyAndMarksReadUsingTicketRoutes() {
        val transport = RecordingSupportTransport(JSONObject())
        val repository = SupportTicketRepository("https://api.nantty.com", ::signedInSession, transport = transport)

        assertTrue(repository.reply(TICKET_ID, "I have another update.", "reply-key-1") is SupportTicketResult.Success)
        assertEquals("POST", transport.method)
        assertEquals("$TICKETS_PATH/$TICKET_ID/messages", transport.path)
        assertEquals("I have another update.", transport.body?.optString("text"))
        assertEquals("reply-key-1", transport.idempotencyKey)

        assertTrue(repository.markRead(TICKET_ID) is SupportTicketResult.Success)
        assertEquals("$TICKETS_PATH/$TICKET_ID/read", transport.path)
        assertFalse(transport.body == null)
    }

    @Test
    fun rejectsMalformedTicketIdentityAndUnsafeLinkedReference() {
        val repository = SupportTicketRepository("https://api.nantty.com", ::signedInSession, transport = RecordingSupportTransport(ticket()))

        assertTrue(repository.loadTicket("not-a-uuid") is SupportTicketResult.Failure)
        assertTrue(
            repository.createTicket(
                "order", "Order issue", "The parcel did not arrive.",
                SupportLinkedReference("order", "order/one", "Order NT-1042"), emptyList(), "support-key-3",
            ) is SupportTicketResult.Failure,
        )
    }

    @Test
    fun rejectsUnexpectedTicketResponseInsteadOfShowingInventedState() {
        val repository = SupportTicketRepository(
            "https://api.nantty.com",
            ::signedInSession,
            transport = RecordingSupportTransport(JSONObject("""{"id":"not-a-uuid","subject":"No"}""")),
        )

        assertTrue(repository.loadTicket(TICKET_ID) is SupportTicketResult.Failure)
    }

    private class RecordingSupportTransport(private val response: JSONObject) : SupportTicketTransport {
        var method: String? = null
        var path: String? = null
        var token: String? = null
        var body: JSONObject? = null
        var idempotencyKey: String? = null

        override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject {
            this.method = method
            this.path = path
            token = accessToken
            this.body = body
            this.idempotencyKey = idempotencyKey
            return response
        }
    }

    private fun signedInSession() = AccountSession("buyer-token", "refresh", AccountUser("buyer-1", "Ari", "ari", null, null, emptyList()))

    private fun ticket() = JSONObject(
        """{"id":"$TICKET_ID","reference":"SUP-1042","subject":"Order hasn't arrived","category":"order","status":"open","channel":"form","linkedReference":{"kind":"order","id":"$ORDER_ID","label":"Order NT-1042"},"lastMessagePreview":"We're looking into this","unreadCount":0,"canRate":false,"canReply":true,"satisfactionScore":null,"messages":[{"id":"message-1","fromSupport":true,"authorName":"Nantty Support","text":"We're looking into this","attachmentUrls":[],"createdAt":"2026-11-05T10:00:00Z"}],"agentTyping":false,"isRecorded":true,"isEndToEndEncrypted":false}""",
    )

    private fun summary() = JSONObject(
        """{"id":"$TICKET_ID","reference":"SUP-1042","subject":"Order hasn't arrived","category":"order","status":"open","channel":"form","linkedReference":{"kind":"order","id":"$ORDER_ID","label":"Order NT-1042"},"lastMessagePreview":"We're looking into this","unreadCount":2,"satisfactionScore":null,"canRate":false,"canReply":true,"createdAt":"2026-11-05T10:00:00Z","updatedAt":"2026-11-05T10:00:00Z"}""",
    )

    companion object {
        private const val TICKET_ID = "0192a4f0-0000-7000-8000-000000000123"
        private const val ORDER_ID = "0192a4f0-0000-7000-8000-000000000000"
        private const val TICKETS_PATH = "/api/v1/support/tickets"
    }
}
