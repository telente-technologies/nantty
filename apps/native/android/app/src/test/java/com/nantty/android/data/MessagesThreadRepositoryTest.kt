package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MessagesThreadRepositoryTest {
    private val conversationId = "11111111-1111-4111-8111-111111111111"
    private val senderId = "22222222-2222-4222-8222-222222222222"
    private val messageId = "33333333-3333-4333-8333-333333333333"

    @Test
    fun historyKeepsCiphertextOpaqueAndNeverReadsPlaintext() {
        var requestedPath: String? = null
        val repository = repository { method, path, token, body ->
            assertEquals("GET", method)
            assertEquals("session-access", token)
            assertNull(body)
            requestedPath = path
            JSONObject("""{"data":[{"id":"$messageId","conversationId":"$conversationId","senderId":"$senderId","createdAt":"2026-10-01T12:00:00.000Z","kind":"text","text":"must never display","encryption":{"deviceId":"device-a","ciphertext":"opaque-envelope","protocol":"signal-v1"}}],"nextCursor":null}""")
        }

        val page = (repository.loadMessages(conversationId) as ChatHistoryResult.Success).page
        assertEquals("/api/v1/conversations/$conversationId/messages?limit=30", requestedPath)
        assertEquals("opaque-envelope", page.messages.single().ciphertext)
        assertEquals("signal-v1", page.messages.single().protocol)
        assertFalse(page.messages.toString().contains("must never display"))
    }

    @Test
    fun malformedOrCrossConversationRowsAreDroppedAndMissingEnvelopeIsUnavailable() {
        val otherConversationId = "44444444-4444-4444-8444-444444444444"
        val repository = repository { _, _, _, _ ->
            JSONObject("""{"data":[{"id":"$messageId","conversationId":"$otherConversationId","senderId":"$senderId","createdAt":"now","text":"plaintext"},{"id":"$messageId","conversationId":"$conversationId","senderId":"$senderId","createdAt":"now","text":"plaintext"}],"nextCursor":null}""")
        }

        val message = (repository.loadMessages(conversationId) as ChatHistoryResult.Success).page.messages.single()
        assertNull(message.ciphertext)
    }

    @Test
    fun invalidConversationAndCursorAreRejectedBeforeNetwork() {
        var requests = 0
        val repository = repository { _, _, _, _ -> requests++; JSONObject("{\"data\":[]}") }

        assertTrue((repository.loadMessages("not-a-uuid") as ChatHistoryResult.Failure).message.contains("invalid"))
        assertTrue((repository.loadMessages(conversationId, "bad-cursor") as ChatHistoryResult.Failure).message.contains("cursor"))
        assertEquals(0, requests)
    }

    @Test
    fun marksReadWithAuthenticatedPostAndEmptyBody() {
        var method: String? = null
        var path: String? = null
        var token: String? = null
        var body: JSONObject? = null
        val repository = repository { requestMethod, requestPath, accessToken, requestBody ->
            method = requestMethod; path = requestPath; token = accessToken; body = requestBody
            JSONObject()
        }

        assertTrue(repository.markConversationRead(conversationId).isSuccess)
        assertEquals("POST", method)
        assertEquals("/api/v1/conversations/$conversationId/read", path)
        assertEquals("session-access", token)
        assertEquals("{}", body.toString())
    }

    private fun repository(transport: ChatThreadTransport) = MessagesRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = { AccountSession("session-access", "refresh", AccountUser(senderId, "Ari", "ari", null, null, emptyList())) },
        threadTransport = transport,
    )
}
