package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdsBalanceRepositoryTest {
    private val session = AccountSession("access", "refresh", AccountUser("user-1", "User", "user", "user@example.com", null, emptyList()))

    @Test
    fun parsesServerEligibilityCreditLotsAndLimitsWithoutDerivingBusinessRules() {
        val repo = repository { _, _, _, _, _ -> balancePayload() }

        val balance = (repo.loadBalance() as AdsBalanceResult.Success).value

        assertEquals(AdsWorkspaceMoney(45_000, "NGN"), balance.spendable)
        assertEquals(AdsWorkspaceMoney(30_000, "NGN"), balance.withdrawable)
        assertEquals(AdsWorkspaceMoney(1_000, "NGN"), balance.topUpMinimum)
        assertEquals(AdsWorkspaceMoney(500_000, "NGN"), balance.topUpMaximum)
        assertEquals(listOf(AdsWorkspaceMoney(1_000, "NGN"), AdsWorkspaceMoney(2_000, "NGN")), balance.suggestedTopUps)
        assertTrue(balance.topUpAvailable)
        assertFalse(balance.withdrawal.available)
        assertEquals("VERIFICATION_REQUIRED", balance.withdrawal.reasonCode)
        assertEquals(1, balance.creditLots.size)
        assertEquals("Welcome credit", balance.creditLots.single().reason)
    }

    @Test
    fun transactionsUseCanonicalRouteAndEncodeCursor() {
        val calls = mutableListOf<Triple<String, String, String?>>()
        val repo = repository { method, path, token, _, _ ->
            calls += Triple(method, path, token)
            JSONObject("""{"data":{"data":[{"id":"tx-1","pot":"balance","kind":"withdrawal","amount":{"amountMinor":-2500,"currency":"NGN"},"description":"Withdrawn to your Nantty wallet","createdAt":"2026-11-08T12:00:00Z"}],"nextCursor":null}}""")
        }

        val page = (repo.loadTransactions("MzMzMzMzMzMtMzMzMy00MzMzLTgzMzMtMzMzMzMzMzMzMzMz") as AdsBalanceResult.Success).value

        assertEquals(listOf(Triple("GET", "${AdsBalanceRepository.TRANSACTIONS_PATH}?cursor=MzMzMzMzMzMtMzMzMy00MzMzLTgzMzMtMzMzMzMzMzMzMzMz", "access")), calls)
        assertEquals(-2_500L, page.items.single().amount.amountMinor)
        assertEquals("withdrawal", page.items.single().kind)
    }

    @Test
    fun topUpUsesCanonicalHostedCheckoutEndpointAndIdempotencyHeader() {
        var request: Triple<String, JSONObject?, Map<String, String>>? = null
        val repo = repository { method, path, _, body, headers ->
            assertEquals(AdsBalanceRepository.TOP_UPS_PATH, path)
            request = Triple(method, body, headers)
            JSONObject("""{"data":{"topUpId":"top-1","reference":"ref-1","checkoutUrl":"https://checkout.example/pay/abc"}}""")
        }

        val result = repo.startTopUp(AdsWorkspaceMoney(12_345, "NGN"), "topup_key_12345")

        assertEquals("https://checkout.example/pay/abc", (result as AdsBalanceResult.Success).value.checkoutUrl)
        assertEquals("POST", request?.first)
        assertEquals(12_345L, request?.second?.getJSONObject("amount")?.getLong("amountMinor"))
        assertEquals("NGN", request?.second?.getJSONObject("amount")?.getString("currency"))
        assertEquals("topup_key_12345", request?.third?.get(AdsBalanceRepository.IDEMPOTENCY_HEADER))
    }

    @Test
    fun rejectsUnsafeCheckoutLinksAndInvalidIdempotencyBeforeReturningSuccess() {
        var calls = 0
        val repo = repository { _, _, _, _, _ ->
            calls++
            JSONObject("""{"data":{"topUpId":"top-1","reference":"ref-1","checkoutUrl":"javascript:alert(1)"}}""")
        }

        assertTrue(repo.startTopUp(AdsWorkspaceMoney(1_000, "NGN"), "bad key") is AdsBalanceResult.Failure)
        assertEquals(0, calls)
        val unsafe = repo.startTopUp(AdsWorkspaceMoney(1_000, "NGN"), "topup_key_12345")
        assertTrue(unsafe is AdsBalanceResult.Failure)
        assertEquals(1, calls)
    }

    @Test
    fun withdrawalQuoteUsesServerFeeNetAndEligibilityValues() {
        var body: JSONObject? = null
        val repo = repository { _, path, _, requestBody, _ ->
            assertEquals(AdsBalanceRepository.WITHDRAWAL_QUOTE_PATH, path)
            body = requestBody
            JSONObject("""{"data":{"amount":{"amountMinor":10000,"currency":"NGN"},"fee":{"amountMinor":150,"currency":"NGN"},"net":{"amountMinor":9850,"currency":"NGN"},"destination":"wallet","withdrawable":{"amountMinor":25000,"currency":"NGN"}}}""")
        }

        val quote = (repo.quoteWithdrawal(AdsWorkspaceMoney(10_000, "NGN")) as AdsBalanceResult.Success).value

        assertEquals(10_000L, body?.getJSONObject("amount")?.getLong("amountMinor"))
        assertEquals(150L, quote.fee.amountMinor)
        assertEquals(9_850L, quote.net.amountMinor)
        assertEquals("wallet", quote.destination)
        assertEquals(25_000L, quote.withdrawable.amountMinor)
    }

    @Test
    fun withdrawalSendsBothStepUpAndIdempotencyProofsAndKeepsServerAmounts() {
        var capturedHeaders: Map<String, String>? = null
        val repo = repository { _, path, _, _, headers ->
            assertEquals(AdsBalanceRepository.WITHDRAWALS_PATH, path)
            capturedHeaders = headers
            JSONObject("""{"data":{"id":"withdrawal-1","status":"completed","amount":{"amountMinor":20000,"currency":"NGN"},"fee":{"amountMinor":300,"currency":"NGN"},"net":{"amountMinor":19700,"currency":"NGN"},"destination":"wallet","createdAt":"2026-11-08T12:00:00Z"}}""")
        }

        val result = repo.withdraw(AdsWorkspaceMoney(20_000, "NGN"), "withdraw_key_12345", "step-up-once")

        assertEquals("withdraw_key_12345", capturedHeaders?.get(AdsBalanceRepository.IDEMPOTENCY_HEADER))
        assertEquals("step-up-once", capturedHeaders?.get(AdsBalanceRepository.STEP_UP_HEADER))
        val withdrawal = (result as AdsBalanceResult.Success).value
        assertEquals(300L, withdrawal.fee.amountMinor)
        assertEquals(19_700L, withdrawal.net.amountMinor)
        assertEquals("completed", withdrawal.status)
    }

    @Test
    fun withdrawalRejectsMissingStepUpOrInvalidRequestKeyWithoutNetworkCall() {
        var calls = 0
        val repo = repository { _, _, _, _, _ -> calls++; JSONObject() }

        assertTrue(repo.withdraw(AdsWorkspaceMoney(10_000, "NGN"), "withdraw_key_12345", " ") is AdsBalanceResult.Failure)
        assertTrue(repo.withdraw(AdsWorkspaceMoney(10_000, "NGN"), "bad", "step-up") is AdsBalanceResult.Failure)
        assertEquals(0, calls)
    }

    @Test
    fun unauthorizedRequestRetriesOnceWithRefreshedSession() {
        val calls = mutableListOf<String?>()
        val repo = AdsBalanceRepository(
            baseUrl = "https://api.nantty.test",
            sessionProvider = { session },
            refreshSessionProvider = { session.copy(accessToken = "refreshed") },
            transport = AdsBalanceTransport { _, _, token, _, _ ->
                calls += token
                if (token == "access") throw AdsBalanceHttpException(401, "Unauthorized")
                balancePayload()
            },
        )

        assertTrue(repo.loadBalance() is AdsBalanceResult.Success)
        assertEquals(listOf("access", "refreshed"), calls)
    }

    @Test
    fun missingSessionIsReportedAsAuthenticationRequiredWithoutNetworkCall() {
        var calls = 0
        val repo = AdsBalanceRepository(
            baseUrl = "https://api.nantty.test",
            sessionProvider = { null },
            transport = AdsBalanceTransport { _, _, _, _, _ -> calls++; balancePayload() },
        )

        val result = repo.loadBalance() as AdsBalanceResult.Failure

        assertTrue(result.authenticationRequired)
        assertEquals(0, calls)
    }

    private fun repository(request: (String, String, String?, JSONObject?, Map<String, String>) -> JSONObject) = AdsBalanceRepository(
        baseUrl = "https://api.nantty.test",
        sessionProvider = { session },
        transport = AdsBalanceTransport { method, path, token, body, headers -> request(method, path, token, body, headers) },
    )

    private fun balancePayload() = JSONObject(
        """{"data":{"accountId":"account-1","balance":{"amountMinor":30000,"currency":"NGN"},"credit":{"amountMinor":20000,"currency":"NGN"},"committed":{"amountMinor":5000,"currency":"NGN"},"spendable":{"amountMinor":45000,"currency":"NGN"},"withdrawable":{"amountMinor":30000,"currency":"NGN"},"pendingSettlement":{"amountMinor":1000,"currency":"NGN"},"creditLots":[{"id":"lot-1","source":"admin_issued","remaining":{"amountMinor":20000,"currency":"NGN"},"expiresAt":null,"reason":"Welcome credit","createdAt":"2026-11-01T00:00:00Z"}],"cashback":{"enabled":true,"percent":4},"topUp":{"available":true,"reasonCode":null,"reason":null,"minimum":{"amountMinor":1000,"currency":"NGN"},"maximum":{"amountMinor":500000,"currency":"NGN"},"suggested":[{"amountMinor":1000,"currency":"NGN"},{"amountMinor":2000,"currency":"NGN"}]},"withdrawal":{"available":false,"reasonCode":"VERIFICATION_REQUIRED","reason":"Verify payouts first.","minimum":{"amountMinor":5000,"currency":"NGN"}}}}""",
    )
}
