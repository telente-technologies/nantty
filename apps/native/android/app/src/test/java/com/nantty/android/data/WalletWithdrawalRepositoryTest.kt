package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WalletWithdrawalRepositoryTest {
    private val payoutAccountId = "00000000-0000-4000-8000-000000000001"

    @Test
    fun loadsCurrentPayoutStatusAndPublicFeeFromExistingRoutes() {
        val transport = WithdrawalTransport().apply {
            responses[WalletRepository.PAYOUT_ONBOARDING_PATH] = JSONObject("""{"status":"verified","withdrawalsEnabled":true}""")
            responses[WalletRepository.PAYOUT_FEES_PATH] = JSONObject("""{"currency":"NGN","kind":"flat","fee":{"amountMinor":500,"currency":"NGN"},"arrivalEstimate":"Same day","firstPayoutNote":"First payout note"}""")
        }
        val repository = repository(transport)

        val status = repository.loadPayoutReadiness() as WalletPayoutReadinessResult.Success
        val fee = repository.loadPayoutFee() as WalletPayoutFeeResult.Success

        assertEquals("/api/v1/payments/payout-onboarding/me", transport.paths[0])
        assertEquals("wallet-access", transport.tokens[0])
        assertTrue(status.value.withdrawalsEnabled)
        assertEquals("verified", status.value.status)
        assertEquals(WalletMoney(500, "NGN"), fee.value.amount)
        assertEquals("flat", fee.value.kind)
        assertEquals("Same day", fee.value.arrivalEstimate)
        assertEquals("First payout note", fee.value.firstPayoutNote)
    }

    @Test
    fun quoteUsesExistingServerQuoteContractAndReturnsServerFee() {
        val transport = WithdrawalTransport().apply {
            responses["/api/v1/wallets/me/withdrawals/quote?payoutAccountId=$payoutAccountId&amountMinor=25000&currency=NGN"] = JSONObject(
                """{"amount":{"amountMinor":25000,"currency":"NGN"},"fee":{"amountMinor":500,"currency":"NGN"},"netAmount":{"amountMinor":24500,"currency":"NGN"},"payoutAccountId":"$payoutAccountId"}""",
            )
        }

        val result = repository(transport).quoteWithdrawal(payoutAccountId, WalletMoney(25000, "NGN")).getOrThrow()

        assertEquals("/api/v1/wallets/me/withdrawals/quote?payoutAccountId=$payoutAccountId&amountMinor=25000&currency=NGN", transport.paths.single())
        assertEquals("wallet-access", transport.tokens.single())
        assertEquals(WalletMoney(500, "NGN"), result.fee)
        assertEquals(WalletMoney(24500, "NGN"), result.netAmount)
    }

    @Test
    fun postsWithdrawalWithStepUpAndIdempotencyHeadersAndExistingPayload() {
        val transport = WithdrawalTransport().apply {
            responses[WalletRepository.WITHDRAWALS_PATH] = JSONObject("""{"id":"withdrawal-1","withdrawalStatus":"queued"}""")
        }

        val result = repository(transport).requestWithdrawal(
            payoutAccountId = payoutAccountId,
            amount = WalletMoney(25000, "NGN"),
            stepUpToken = "one-time-token",
            idempotencyKey = "stable-retry-key",
        ) as WalletWithdrawalResult.Success

        assertEquals("withdrawal-1", result.value.id)
        assertEquals("queued", result.value.status)
        assertEquals("POST", transport.method)
        assertEquals(WalletRepository.WITHDRAWALS_PATH, transport.paths.single())
        assertEquals("wallet-access", transport.tokens.single())
        assertEquals("one-time-token", transport.headers[WalletRepository.STEP_UP_HEADER])
        assertEquals("stable-retry-key", transport.headers[WalletRepository.IDEMPOTENCY_HEADER])
        assertEquals(payoutAccountId, transport.body?.getString("payoutAccountId"))
        assertEquals(25000L, transport.body?.getJSONObject("amount")?.getLong("amountMinor"))
        assertEquals("NGN", transport.body?.getJSONObject("amount")?.getString("currency"))
    }

    @Test
    fun returnsStepUpAndPaymentErrorCodesWithoutHidingServerMessage() {
        val stepUpTransport = WithdrawalTransport().apply {
            requestFailure = PayoutHttpException(403, "Confirm again", "STEP_UP_REUSED")
        }
        val stepUp = repository(stepUpTransport).requestWithdrawal(payoutAccountId, WalletMoney(1000, "NGN"), "old-token", "key")
        assertTrue((stepUp as WalletWithdrawalResult.Failure).stepUpRequired)
        assertEquals("STEP_UP_REUSED", stepUp.code)
        assertEquals("Confirm again", stepUp.message)

        val paymentTransport = WithdrawalTransport().apply {
            requestFailure = PayoutHttpException(422, "Verify your payout details", "VERIFICATION_REQUIRED")
        }
        val payment = repository(paymentTransport).requestWithdrawal(payoutAccountId, WalletMoney(1000, "NGN"), "fresh-token", "key-2")
        assertFalse((payment as WalletWithdrawalResult.Failure).stepUpRequired)
        assertEquals("VERIFICATION_REQUIRED", payment.code)
        assertEquals("Verify your payout details", payment.message)
    }

    private fun repository(transport: WithdrawalTransport) = WalletRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = ::signedInSession,
        transport = transport,
    )

    private fun signedInSession() = AccountSession(
        "wallet-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()),
    )

    private class WithdrawalTransport : WalletTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()
        val responses = mutableMapOf<String, JSONObject>()
        var method: String? = null
        var headers: Map<String, String> = emptyMap()
        var body: JSONObject? = null
        var requestFailure: PayoutHttpException? = null

        override fun get(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            return responses[path] ?: error("No fake response for $path")
        }

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, headers: Map<String, String>): JSONObject {
            this.method = method
            this.body = body
            this.headers = headers
            paths += path
            tokens += accessToken
            requestFailure?.let { throw it }
            return responses[path] ?: error("No fake response for $path")
        }
    }
}
