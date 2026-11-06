package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveCoinTipRepositoryTest {
    @Test
    fun donationUsesSharedTipsContractAndParsesLedgerReceipt() {
        val transport = RecordingLiveCoinTipTransport(JSONObject("""{"tipId":"tip-123","targetType":"live","targetId":"live-456","coins":75,"balance":425,"coinBalance":425}"""))
        val repository = LiveCoinTipRepository(
            sessionProvider = { testSession("access-token", "refresh-token") },
            transport = transport,
        )

        val result = repository.donate("live-456", 75, "donation-key-1")

        val request = transport.calls.single()
        assertEquals("/api/v1/tips", request.path)
        assertEquals("access-token", request.accessToken)
        assertEquals("donation-key-1", request.idempotencyKey)
        assertEquals(setOf("targetType", "targetId", "coins"), request.body.keys().asSequence().toSet())
        assertEquals("live", request.body.getString("targetType"))
        assertEquals("live-456", request.body.getString("targetId"))
        assertEquals(75L, request.body.getLong("coins"))
        val receipt = (result as LiveCoinTipResult.Success).receipt
        assertEquals("tip-123", receipt.tipId)
        assertEquals("live-456", receipt.liveId)
        assertEquals(425L, receipt.coinBalance)
    }

    @Test
    fun trimsAndSendsOptionalNoteOnExistingTipsRequest() {
        val transport = RecordingLiveCoinTipTransport(tipReceipt())
        val result = LiveCoinTipRepository(
            sessionProvider = { testSession("access-token", "refresh-token") },
            transport = transport,
        ).donate("live-456", 25, "donation-key-1", "  Keep it up 🎤  ")

        assertTrue(result is LiveCoinTipResult.Success)
        val request = transport.calls.single()
        assertEquals("/api/v1/tips", request.path)
        assertEquals("Keep it up 🎤", request.body.getString("note"))
        assertEquals(setOf("targetType", "targetId", "coins", "note"), request.body.keys().asSequence().toSet())
    }

    @Test
    fun accepts280UnicodeCodePointsAndRejects281WithoutCallingTransport() {
        val acceptedTransport = RecordingLiveCoinTipTransport(tipReceipt())
        val note = "😀".repeat(280)
        val accepted = LiveCoinTipRepository(
            sessionProvider = { testSession("token", "refresh") },
            transport = acceptedTransport,
        ).donate("live-456", 25, "donation-key-1", note)
        assertTrue(accepted is LiveCoinTipResult.Success)
        assertEquals(note, acceptedTransport.calls.single().body.getString("note"))

        val rejectedTransport = RecordingLiveCoinTipTransport(tipReceipt())
        val rejected = LiveCoinTipRepository(
            sessionProvider = { testSession("token", "refresh") },
            transport = rejectedTransport,
        ).donate("live-456", 25, "donation-key-1", "😀".repeat(281))
        assertTrue(rejected is LiveCoinTipResult.Failure)
        assertTrue(rejectedTransport.calls.isEmpty())
    }

    @Test
    fun rejectsInvalidTargetAmountAndIdempotencyBeforeNetworkCall() {
        val transport = RecordingLiveCoinTipTransport(tipReceipt())
        val repository = LiveCoinTipRepository(sessionProvider = { testSession("token", "refresh") }, transport = transport)

        assertTrue(repository.donate("../live", 25, "donation-key-1") is LiveCoinTipResult.Failure)
        assertTrue(repository.donate("live-456", 0, "donation-key-1") is LiveCoinTipResult.Failure)
        assertTrue(repository.donate("live-456", 100_001, "donation-key-1") is LiveCoinTipResult.Failure)
        assertTrue(repository.donate("live-456", 25, "short") is LiveCoinTipResult.Failure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun requiresAuthenticationAndPreservesRetryKeyAcrossUnauthorizedRefresh() {
        val unauthenticated = LiveCoinTipRepository(sessionProvider = { null }, transport = RecordingLiveCoinTipTransport(tipReceipt()))
            .donate("live-456", 25, "donation-key-1") as LiveCoinTipResult.Failure
        assertTrue(unauthenticated.authenticationRequired)

        val transport = RecordingLiveCoinTipTransport(tipReceipt()).apply { failFirstWithUnauthorized = true }
        val result = LiveCoinTipRepository(
            sessionProvider = { testSession("expired", "refresh") },
            refreshSessionProvider = { testSession("fresh", "refresh-2") },
            transport = transport,
        ).donate("live-456", 25, "stable-retry-key")

        assertTrue(result is LiveCoinTipResult.Success)
        assertEquals(listOf("expired", "fresh"), transport.calls.map { it.accessToken })
        assertEquals(listOf("stable-retry-key", "stable-retry-key"), transport.calls.map { it.idempotencyKey })
    }

    @Test
    fun marksBackendPolicyErrorsNonRetryableAndTransportErrorsRetryable() {
        val policyTransport = RecordingLiveCoinTipTransport(tipReceipt()).apply { errorStatus = 422 }
        val policy = LiveCoinTipRepository(sessionProvider = { testSession("token", "refresh") }, transport = policyTransport)
            .donate("live-456", 25, "donation-key-1") as LiveCoinTipResult.Failure
        assertEquals(422, policy.statusCode)
        assertFalse(policy.retryable)

        val networkTransport = RecordingLiveCoinTipTransport(tipReceipt()).apply { errorStatus = 503 }
        val network = LiveCoinTipRepository(sessionProvider = { testSession("token", "refresh") }, transport = networkTransport)
            .donate("live-456", 25, "donation-key-1") as LiveCoinTipResult.Failure
        assertTrue(network.retryable)
    }

    @Test
    fun rejectsMalformedReceiptInsteadOfReportingDonationAsSuccessful() {
        val result = LiveCoinTipRepository(
            sessionProvider = { testSession("token", "refresh") },
            transport = RecordingLiveCoinTipTransport(JSONObject("""{"tipId":"","coins":30,"coinBalance":10}""")),
        ).donate("live-456", 25, "donation-key-1")

        assertTrue(result is LiveCoinTipResult.Failure)
    }
}

private data class LiveCoinTipCall(val path: String, val accessToken: String, val idempotencyKey: String, val body: JSONObject)

private class RecordingLiveCoinTipTransport(private val response: JSONObject) : LiveCoinTipTransport {
    val calls = mutableListOf<LiveCoinTipCall>()
    var errorStatus: Int? = null
    var failFirstWithUnauthorized = false

    override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
        calls += LiveCoinTipCall(path, accessToken, idempotencyKey, JSONObject(body.toString()))
        if (failFirstWithUnauthorized && calls.size == 1) throw LiveCoinTipHttpException(401)
        errorStatus?.let { status ->
            throw LiveCoinTipHttpException(status)
        }
        return response
    }
}

private fun tipReceipt() = JSONObject("""{"tipId":"tip-123","targetType":"live","targetId":"live-456","coins":25,"balance":75,"coinBalance":75}""")

private fun testSession(accessToken: String, refreshToken: String) = AccountSession(
    accessToken = accessToken,
    refreshToken = refreshToken,
    user = AccountUser("user-123", "Test User", "test-user", null, null, emptyList()),
)
