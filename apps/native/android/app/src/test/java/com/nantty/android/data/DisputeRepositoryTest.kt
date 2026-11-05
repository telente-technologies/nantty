package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DisputeRepositoryTest {
    @Test
    fun buyerDisputeEligibilityMatchesEscrowAndOrderStateRules() {
        val activeEscrow = repository(RecordingDisputeTransport(escrowPayload()))
            .loadEscrowForOrder("order_123").success<OrderEscrowDetail>()
            .copy(disputeId = null, stage = "paid_into_escrow")

        assertTrue(buyerCanOpenDispute("paid", false, activeEscrow))
        assertTrue(buyerCanOpenDispute("shipped", false, activeEscrow.copy(stage = "shipped")))
        assertTrue(buyerCanOpenDispute("delivered", false, activeEscrow.copy(stage = "delivered")))
        assertFalse(buyerCanOpenDispute("paid", true, activeEscrow))
        assertFalse(buyerCanOpenDispute("pending", false, activeEscrow))
        assertFalse(buyerCanOpenDispute("completed", false, activeEscrow.copy(stage = "released_to_seller")))
        assertFalse(buyerCanOpenDispute("paid", false, activeEscrow.copy(disputeId = DISPUTE_ID, stage = "disputed")))
        assertFalse(buyerCanOpenDispute("paid", false, null))
    }

    @Test
    fun loadsAuthenticatedEscrowWithBuyerPaymentAndDisputeFields() {
        val transport = RecordingDisputeTransport(escrowPayload())
        val result = repository(transport).loadEscrowForOrder("order_123").success<OrderEscrowDetail>()

        assertEquals("/api/v1/orders/order_123/escrow", transport.getPath)
        assertEquals("GET", transport.method)
        assertEquals("buyer-access", transport.getToken)
        assertEquals("escrow-123", result.escrowId)
        assertEquals("disputed", result.stage)
        assertEquals("disputed", result.status)
        assertEquals(245_000L, result.heldAmount.amountMinor)
        assertEquals("NGN", result.heldAmount.currency)
        assertEquals(5_000L, result.platformFee.amountMinor)
        assertEquals(240_000L, result.sellerPayoutAmount.amountMinor)
        assertEquals(0L, result.refundedAmount.amountMinor)
        assertEquals(DISPUTE_ID, result.disputeId)
        assertEquals("TRACK-123", result.shipment?.trackingNumber)
    }

    @Test
    fun fetchesDisputeByCanonicalIdAndParsesCaseHistoryAndMessages() {
        val transport = RecordingDisputeTransport(disputePayload())
        val result = repository(transport).loadDispute(DISPUTE_ID).success<BuyerDispute>()

        assertEquals("/api/v1/disputes/$DISPUTE_ID", transport.getPath)
        assertEquals("GET", transport.method)
        assertEquals("buyer-access", transport.getToken)
        assertEquals(DISPUTE_ID, result.id)
        assertEquals("not_received", result.reason)
        assertEquals("open", result.status)
        assertEquals(1, result.statusHistory.size)
        assertEquals("buyer", result.messages.single().authorRole)
        assertEquals("https://cdn.nantty.com/evidence.jpg", result.evidenceUrls.single())
    }

    @Test
    fun opensDisputeUsingAuthenticatedPostBodyAndCallerIdempotencyKey() {
        val transport = RecordingDisputeTransport(disputePayload())
        val result = repository(transport).openDispute(
            orderId = "order_123",
            reason = "damaged",
            description = "The item arrived damaged.",
            evidenceUrls = listOf("https://cdn.nantty.com/photo.jpg"),
            idempotencyKey = "open-dispute-001",
        ).success<BuyerDispute>()

        assertEquals(DISPUTE_ID, result.id)
        assertEquals("POST", transport.method)
        assertEquals("/api/v1/orders/order_123/disputes", transport.postPath)
        assertEquals("buyer-access", transport.postToken)
        assertEquals("open-dispute-001", transport.idempotencyKey)
        assertEquals(setOf("reason", "description", "evidenceUrls"), transport.body?.names()?.let { names ->
            (0 until names.length()).map(names::getString).toSet()
        })
        assertEquals("damaged", transport.body?.getString("reason"))
        assertEquals("The item arrived damaged.", transport.body?.getString("description"))
        assertEquals("https://cdn.nantty.com/photo.jpg", transport.body?.getJSONArray("evidenceUrls")?.getString(0))
    }

    @Test
    fun postsMessageWithAttachmentsAndStableIdempotencyKey() {
        val transport = RecordingDisputeTransport(messagePayload())
        val result = repository(transport).sendDisputeMessage(
            DISPUTE_ID,
            "Here is another photo.",
            listOf("https://cdn.nantty.com/photo-2.jpg"),
            "message-retry-001",
        ).success<DisputeMessage>()

        assertEquals("223e4567-e89b-42d3-a456-426614174001", result.id)
        assertEquals("POST", transport.method)
        assertEquals("/api/v1/disputes/$DISPUTE_ID/messages", transport.postPath)
        assertEquals("buyer-access", transport.postToken)
        assertEquals("message-retry-001", transport.idempotencyKey)
        assertEquals(setOf("text", "attachmentUrls"), transport.body?.names()?.let { names ->
            (0 until names.length()).map(names::getString).toSet()
        })
        assertEquals("Here is another photo.", transport.body?.getString("text"))
        assertEquals("https://cdn.nantty.com/photo-2.jpg", transport.body?.getJSONArray("attachmentUrls")?.getString(0))
    }

    @Test
    fun signedOutAndMissingAccessTokenReturnAuthenticationRequiredWithoutTransport() {
        val transport = RecordingDisputeTransport(escrowPayload())
        val noSession = DisputeRepository("https://api.nantty.com", { null }, transport)
            .loadEscrowForOrder("order_123").failure()
        val emptyToken = DisputeRepository(
            "https://api.nantty.com",
            { AccountSession("", "refresh", AccountUser("buyer-1", "Ari", "ari", null, null, emptyList())) },
            transport,
        ).loadDispute(DISPUTE_ID).failure()

        assertTrue(noSession.authenticationRequired)
        assertTrue(emptyToken.authenticationRequired)
        assertFalse(transport.called)
    }

    @Test
    fun rejectsUnsafeIdsKeysReasonsAndUrlsBeforeTransport() {
        val transport = RecordingDisputeTransport(disputePayload())
        val repo = repository(transport)

        assertTrue(repo.loadEscrowForOrder("../other").failure().message.isNotBlank())
        assertTrue(repo.loadDispute("not-a-uuid").failure().message.isNotBlank())
        assertTrue(repo.openDispute("order_123", "unsupported", "description", emptyList(), "open-dispute-001") is DisputeRepositoryResult.Failure)
        assertTrue(repo.openDispute("order_123", "other", "x".repeat(2_001), emptyList(), "open-dispute-001") is DisputeRepositoryResult.Failure)
        assertTrue(repo.openDispute("order_123", "other", "description", listOf("http://cdn.nantty.com/file"), "open-dispute-001") is DisputeRepositoryResult.Failure)
        assertTrue(repo.openDispute("order_123", "other", "description", List(11) { "https://cdn.nantty.com/$it" }, "open-dispute-001") is DisputeRepositoryResult.Failure)
        assertTrue(repo.openDispute("order_123", "other", "description", emptyList(), "bad key") is DisputeRepositoryResult.Failure)
        assertTrue(repo.sendDisputeMessage(DISPUTE_ID, "  ", emptyList(), "message-key-001") is DisputeRepositoryResult.Failure)
        assertTrue(repo.sendDisputeMessage(DISPUTE_ID, "message", listOf("https://user@cdn.nantty.com/a"), "message-key-001") is DisputeRepositoryResult.Failure)
        assertFalse(transport.called)
    }

    @Test
    fun acceptsServerDefinedMaximumsForTextAttachmentCountUrlBytesAndIdempotencyKey() {
        val transport = RecordingDisputeTransport(disputePayload())
        val repo = repository(transport)
        val longestUrl = "https://cdn.nantty.com/" + "x".repeat(500 - "https://cdn.nantty.com/".length)
        val maximumKey = "k".repeat(128)
        val messageTransport = RecordingDisputeTransport(messagePayload())
        val messageRepository = repository(messageTransport)

        assertTrue(repo.openDispute("order_123", "other", "d".repeat(2_000), List(10) { longestUrl }, maximumKey) is DisputeRepositoryResult.Success)
        assertTrue(messageRepository.sendDisputeMessage(DISPUTE_ID, "m".repeat(2_000), emptyList(), maximumKey) is DisputeRepositoryResult.Success)
        assertEquals(maximumKey, transport.idempotencyKey)
        assertEquals(maximumKey, messageTransport.idempotencyKey)
    }

    @Test
    fun missingFinancialFieldsAndMalformedPayloadsFailInsteadOfInventingValues() {
        val repo = repository(RecordingDisputeTransport(JSONObject()))
        val missingMoney = JSONObject(escrowPayload().toString()).apply { remove("platformFee") }
        val missingId = JSONObject(disputePayload().toString()).apply { remove("id") }
        val malformedEnvelope = JSONObject("""{"data":[]}""")

        assertTrue(runCatching { repo.parseEscrow(missingMoney, "order_123") }.isFailure)
        assertTrue(runCatching { repo.parseDispute(missingId) }.isFailure)
        assertTrue(runCatching { repo.parseDispute(malformedEnvelope) }.isFailure)
        assertTrue(runCatching { repo.parseEscrow(escrowPayload().put("heldAmount", JSONObject().put("amountMinor", "245000").put("currency", "NGN")), "order_123") }.isFailure)
    }

    @Test
    fun rejectsEscrowForDifferentOrderAndUnsafeServerAttachmentUrls() {
        val repo = repository(RecordingDisputeTransport(JSONObject()))
        val badEvidence = JSONObject(disputePayload().toString()).put("evidenceUrls", org.json.JSONArray().put("javascript:alert(1)"))

        assertTrue(runCatching { repo.parseEscrow(escrowPayload(), "another_order") }.isFailure)
        assertTrue(runCatching { repo.parseDispute(badEvidence) }.isFailure)
    }

    @Test
    fun mapsExpiredAndForbiddenSessionsToAuthenticationRequired() {
        for (status in listOf(401, 403)) {
            val failedTransport = RecordingDisputeTransport(disputePayload(), status)
            val result = repository(failedTransport).loadDispute(DISPUTE_ID).failure()
            assertTrue(result.authenticationRequired)
            assertFalse(result.message.contains("private response"))
        }
    }

    private fun repository(transport: DisputeTransport) = DisputeRepository(
        "https://api.nantty.com",
        { AccountSession("buyer-access", "refresh", AccountUser("buyer-1", "Ari", "ari", null, null, emptyList())) },
        transport,
    )

    private class RecordingDisputeTransport(
        private val response: JSONObject,
        private val statusCode: Int = 200,
    ) : DisputeTransport {
        var called = false
        var method: String? = null
        var getPath: String? = null
        var postPath: String? = null
        var getToken: String? = null
        var postToken: String? = null
        var idempotencyKey: String? = null
        var body: JSONObject? = null

        override fun get(path: String, accessToken: String): JSONObject {
            called = true
            method = "GET"
            getPath = path
            getToken = accessToken
            checkStatus()
            return response
        }

        override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
            called = true
            method = "POST"
            postPath = path
            postToken = accessToken
            this.idempotencyKey = idempotencyKey
            this.body = JSONObject(body.toString())
            checkStatus()
            return response
        }

        private fun checkStatus() {
            if (statusCode !in 200..299) throw DisputeHttpException(statusCode)
        }
    }

    private fun <T> DisputeRepositoryResult<T>.success(): T = (this as DisputeRepositoryResult.Success<T>).value
    private fun DisputeRepositoryResult<*>.failure(): DisputeRepositoryResult.Failure = this as DisputeRepositoryResult.Failure

    private fun escrowPayload() = JSONObject(
        """{"escrowId":"escrow-123","orderId":"order_123","orderReference":"NT-1001","stage":"disputed","status":"disputed","heldAmount":{"amountMinor":245000,"currency":"NGN"},"platformFee":{"amountMinor":5000,"currency":"NGN"},"sellerPayoutAmount":{"amountMinor":240000,"currency":"NGN"},"refundedAmount":{"amountMinor":0,"currency":"NGN"},"buyer":{"id":"buyer-1"},"store":{"id":"store-1"},"sellerUserId":"seller-1","paidAt":"2026-11-01T10:00:00Z","preparingSince":"2026-11-01T10:00:00Z","shipment":{"courierName":"Swift","trackingNumber":"TRACK-123","trackingUrl":"https://tracking.nantty.com/t/123","shippedAt":"2026-11-02T10:00:00Z","estimatedDeliveryAt":null},"deliveredAt":null,"buyerConfirmedAt":null,"autoReleaseAt":null,"expectedReleaseAt":null,"releasedAt":null,"refundedAt":null,"disputeId":"$DISPUTE_ID","undeliveredReviewAt":null,"feesKeptOnRefund":{"amountMinor":0,"currency":"NGN"}}""",
    )

    private fun disputePayload() = JSONObject(
        """{"id":"$DISPUTE_ID","orderId":"order_123","orderReference":"NT-1001","productName":"Headphones","amount":{"amountMinor":245000,"currency":"NGN"},"refundAmount":{"amountMinor":0,"currency":"NGN"},"reason":"not_received","description":"Package has not arrived.","evidenceUrls":["https://cdn.nantty.com/evidence.jpg"],"status":"open","viewerRole":"buyer","counterpartyName":"Seller","openedAt":"2026-11-03T10:00:00Z","respondByAt":null,"resolutionNote":null,"statusHistory":[{"status":"open","label":"Dispute opened","occurredAt":"2026-11-03T10:00:00Z"}],"messages":[{"id":"223e4567-e89b-42d3-a456-426614174001","authorRole":"buyer","authorName":"Ari","authorAvatarUrl":null,"text":"Please help.","attachmentUrls":[],"createdAt":"2026-11-03T10:00:00Z"}]}""",
    )

    private fun messagePayload() = JSONObject(
        """{"id":"223e4567-e89b-42d3-a456-426614174001","authorRole":"buyer","authorName":"Ari","authorAvatarUrl":null,"text":"Here is another photo.","attachmentUrls":["https://cdn.nantty.com/photo-2.jpg"],"createdAt":"2026-11-03T11:00:00Z"}""",
    )

    private companion object {
        const val DISPUTE_ID = "123e4567-e89b-42d3-a456-426614174000"
    }
}
