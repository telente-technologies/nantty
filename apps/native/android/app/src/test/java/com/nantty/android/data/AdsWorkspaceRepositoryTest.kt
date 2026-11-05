package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.HttpURLConnection
import java.util.Base64

class AdsWorkspaceRepositoryTest {
    private val boostId = "11111111-1111-4111-8111-111111111111"
    private val encodedCursor = Base64.getUrlEncoder().withoutPadding().encodeToString(
        "22222222-2222-4222-8222-222222222222".toByteArray(Charsets.UTF_8),
    )

    @Test
    fun loadsAuthenticatedAllBoostsAndParsesServerFields() {
        val transport = RecordingTransport(boostPage())
        val result = repository(transport).loadBoosts() as AdsWorkspaceResult.Success

        assertEquals("/api/v1/ads/boosts?limit=20", transport.path)
        assertEquals("ads-access", transport.tokens.single())
        val boost = result.value.boosts.single()
        assertEquals(boostId, boost.id)
        assertEquals(AdsWorkspaceBoostStatus.ACTIVE, boost.status)
        assertEquals("product", boost.destinationType)
        assertEquals(AdsWorkspaceMoney(500_000, "NGN"), boost.totalBudget)
        assertEquals(AdsWorkspaceMoney(125_000, "NGN"), boost.spent)
        assertEquals("Product views", boost.keyResultLabel)
        assertEquals(23L, boost.keyResultValue)
        assertEquals(encodedCursor, result.value.nextCursor)
    }

    @Test
    fun mapsStatusFiltersToBackendStatusContractAndEncodesQueryValues() {
        assertEquals(
            "/api/v1/ads/boosts?status=in_review%2Cpending_payment&limit=20",
            buildAdsWorkspaceBoostsPath(AdsWorkspaceFilter.IN_REVIEW),
        )
        assertEquals(
            "/api/v1/ads/boosts?status=completed%2Ccancelled&cursor=$encodedCursor&limit=20",
            buildAdsWorkspaceBoostsPath(AdsWorkspaceFilter.COMPLETED, encodedCursor),
        )
        assertTrue(isAdsWorkspaceCursor(encodedCursor))
        assertFalse(isAdsWorkspaceCursor("not-a-server-cursor"))
    }

    @Test
    fun rejectsInvalidCursorBeforeNetworkRequest() {
        val transport = RecordingTransport(boostPage())
        val result = repository(transport).loadBoosts(cursor = "not-a-cursor")

        assertTrue(result is AdsWorkspaceResult.Failure)
        assertEquals(0, transport.calls)
    }

    @Test
    fun refusesRequestsWithoutAnAuthenticatedSession() {
        val transport = RecordingTransport(boostPage())
        val result = AdsWorkspaceRepository("https://api.nantty.com", { null }, transport).loadBoosts()

        assertTrue(result is AdsWorkspaceResult.Failure)
        assertEquals(0, transport.calls)
    }

    @Test
    fun refreshesSessionOnceAfterUnauthorizedRead() {
        val tokens = mutableListOf<String>()
        val transport = AdsWorkspaceTransport { _, token ->
            tokens += token
            if (token == "expired") throw AdsWorkspaceHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
            balancePayload()
        }
        val repository = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { signedInSession().copy(accessToken = "expired") },
            transport = transport,
            refreshSessionProvider = { signedInSession().copy(accessToken = "refreshed") },
        )

        assertTrue(repository.loadBalance() is AdsWorkspaceResult.Success)
        assertEquals(listOf("expired", "refreshed"), tokens)
    }

    @Test
    fun identifiesAuthenticationFailuresWithoutTreatingOtherFailuresAsAuth() {
        val expired = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = AdsWorkspaceTransport { _, _ -> throw AdsWorkspaceHttpException(401) },
        ).loadBoosts() as AdsWorkspaceResult.Failure
        val unavailable = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = AdsWorkspaceTransport { _, _ -> throw AdsWorkspaceHttpException(503) },
        ).loadBoosts() as AdsWorkspaceResult.Failure

        assertTrue(expired.authenticationRequired)
        assertFalse(unavailable.authenticationRequired)
    }

    @Test
    fun loadsOnlyReadOnlyAdBalanceAndParsesAllBalanceFigures() {
        val transport = RecordingTransport(balancePayload())
        val result = repository(transport).loadBalance() as AdsWorkspaceResult.Success

        assertEquals("/api/v1/ads/boosts/balance", transport.path)
        assertEquals("ads-access", transport.tokens.single())
        assertEquals(
            AdsWorkspaceBalance(
                spendable = AdsWorkspaceMoney(400_000, "NGN"),
                balance = AdsWorkspaceMoney(300_000, "NGN"),
                credit = AdsWorkspaceMoney(150_000, "NGN"),
                committed = AdsWorkspaceMoney(50_000, "NGN"),
                withdrawable = AdsWorkspaceMoney(100_000, "NGN"),
                pendingSettlement = AdsWorkspaceMoney(20_000, "NGN"),
            ),
            result.value,
        )
    }

    @Test
    fun loadsOwnedCampaignDetailAndReportUsingBackendReadRoutes() {
        val detail = boostPage().getJSONArray("data").getJSONObject(0)
        val report = JSONObject("""{"currency":"NGN","resultLabel":"Product views","totals":{"impressions":500,"reach":250,"clicks":23,"results":23,"spend":{"amountMinor":125000,"currency":"NGN"},"costPerResult":{"amountMinor":5434,"currency":"NGN"}},"series":[{"date":"2026-11-01","impressions":500,"reach":250,"clicks":23,"results":23,"spend":{"amountMinor":125000,"currency":"NGN"}}]}""")
        val paths = mutableListOf<String>()
        val repository = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = AdsWorkspaceTransport { path, _ ->
                paths += path
                if (path.endsWith("/report")) report else detail
            },
        )

        val boostResult = repository.loadBoost(boostId) as AdsWorkspaceResult.Success
        val reportResult = repository.loadBoostReport(boostId) as AdsWorkspaceResult.Success

        assertEquals(listOf("/api/v1/ads/boosts/$boostId", "/api/v1/ads/boosts/$boostId/report"), paths)
        assertEquals(AdsWorkspaceBoostStatus.ACTIVE, boostResult.value.status)
        assertEquals("product_visits", boostResult.value.goal)
        assertEquals(23L, reportResult.value.totals.results)
        assertEquals("Product views", reportResult.value.resultLabel)
        assertEquals("2026-11-01", reportResult.value.series.single().date)
    }

    @Test
    fun changesBoostLifecycleWithAuthenticatedIdempotentPostAndParsesCanonicalResponse() {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String>()
        val keys = mutableListOf<String>()
        val response = boostPage().getJSONArray("data").getJSONObject(0).apply {
            put("status", "paused")
            put("actions", JSONObject("""{"pause":false,"resume":true,"stop":true,"changeBudget":true,"resubmit":false}"""))
        }
        val repository = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = RecordingTransport(boostPage()),
            mutationTransport = AdsWorkspaceMutationTransport { path, token, key, body ->
                paths += path
                tokens += token
                keys += key
                assertTrue(body.length() == 0)
                response
            },
        )

        val result = repository.changeBoostStatus(boostId, AdsWorkspaceStatusAction.PAUSE, "pause-key-123456") as AdsWorkspaceResult.Success

        assertEquals(listOf("/api/v1/ads/boosts/$boostId/pause"), paths)
        assertEquals(listOf("ads-access"), tokens)
        assertEquals(listOf("pause-key-123456"), keys)
        assertEquals(AdsWorkspaceBoostStatus.PAUSED, result.value.status)
        assertFalse(result.value.actions.pause)
        assertTrue(result.value.actions.resume)
        assertTrue(result.value.actions.stop)
    }

    @Test
    fun rejectsInvalidBoostLifecycleInputBeforeNetworkRequest() {
        var calls = 0
        val repository = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            mutationTransport = AdsWorkspaceMutationTransport { _, _, _, _ -> calls++; boostPage() },
        )

        assertTrue(repository.changeBoostStatus("bad-id", AdsWorkspaceStatusAction.STOP) is AdsWorkspaceResult.Failure)
        assertTrue(repository.changeBoostStatus(boostId, AdsWorkspaceStatusAction.STOP, "bad key") is AdsWorkspaceResult.Failure)
        assertEquals(0, calls)
    }

    @Test
    fun rejectsMalformedReportValuesWithoutSubstitutingClientDefaults() {
        val result = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = AdsWorkspaceTransport { _, _ -> JSONObject("""{"currency":"NGN","resultLabel":"Results","totals":{"impressions":-1}}""") },
        ).loadBoostReport(boostId)

        assertTrue(result is AdsWorkspaceResult.Failure)
    }

    @Test
    fun rejectsIncompleteOrInvalidPayloadsInsteadOfInventingValues() {
        val incompleteBalance = AdsWorkspaceRepository(
            "https://api.nantty.com", ::signedInSession, RecordingTransport(JSONObject("""{"data":{"balance":{"amountMinor":10,"currency":"NGN"}}}""")),
        ).loadBalance()
        val malformedBoost = AdsWorkspaceRepository(
            "https://api.nantty.com", ::signedInSession, RecordingTransport(JSONObject("""{"data":[{"id":"$boostId","status":"mystery"}],"nextCursor":null}""")),
        ).loadBoosts()
        val badNextCursor = AdsWorkspaceRepository(
            "https://api.nantty.com", ::signedInSession, RecordingTransport(JSONObject("""{"data":[],"nextCursor":"opaque-invalid-cursor"}""")),
        ).loadBoosts()

        assertTrue(incompleteBalance is AdsWorkspaceResult.Failure)
        assertTrue(malformedBoost is AdsWorkspaceResult.Failure)
        assertTrue(badNextCursor is AdsWorkspaceResult.Failure)
    }

    @Test
    fun returnsAnActuallyEmptyPageWhenTheServerReturnsNoBoosts() {
        val result = repository(RecordingTransport(JSONObject("""{"data":[],"nextCursor":null}"""))).loadBoosts()
            as AdsWorkspaceResult.Success

        assertTrue(result.value.boosts.isEmpty())
        assertEquals(null, result.value.nextCursor)
    }

    private fun repository(transport: AdsWorkspaceTransport) = AdsWorkspaceRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = ::signedInSession,
        transport = transport,
    )

    private fun signedInSession() = AccountSession(
        accessToken = "ads-access",
        refreshToken = "ads-refresh",
        user = AccountUser("33333333-3333-4333-8333-333333333333", "Ari", "ari", null, null, emptyList()),
    )

    private fun boostPage() = JSONObject(
        """{"data":[{"id":"$boostId","postId":"","destinationType":"product","targetId":"44444444-4444-4444-8444-444444444444","status":"active","goal":"product_visits","budgetType":"total","dailyBudget":{"amountMinor":50000,"currency":"NGN"},"durationDays":10,"totalBudget":{"amountMinor":500000,"currency":"NGN"},"spent":{"amountMinor":125000,"currency":"NGN"},"startsAt":"2026-11-01T00:00:00Z","endsAt":"2026-11-11T00:00:00Z","scheduledStartAt":null,"createdAt":"2026-10-31T12:00:00Z","audience":{"mode":"automatic"},"results":{"impressions":500,"reach":250,"clicks":23,"profileVisits":0,"storeVisits":0,"productVisits":23,"messages":0},"keyResult":{"label":"Product views","value":23},"costPerResult":{"amountMinor":5434,"currency":"NGN"},"rejectionReason":null,"paymentMethod":"ad_balance","actions":{"pause":true,"resume":false,"stop":true,"changeBudget":true,"resubmit":false}}],"nextCursor":"$encodedCursor"}""",
    )

    private fun balancePayload() = JSONObject(
        """{"data":{"accountId":"55555555-5555-4555-8555-555555555555","balance":{"amountMinor":300000,"currency":"NGN"},"credit":{"amountMinor":150000,"currency":"NGN"},"committed":{"amountMinor":50000,"currency":"NGN"},"spendable":{"amountMinor":400000,"currency":"NGN"},"withdrawable":{"amountMinor":100000,"currency":"NGN"},"pendingSettlement":{"amountMinor":20000,"currency":"NGN"},"creditLots":[],"cashback":{"enabled":true,"percent":5},"topUp":{"available":true},"withdrawal":{"available":true}}}""",
    )

    private class RecordingTransport(private val response: JSONObject) : AdsWorkspaceTransport {
        var calls = 0
        var path: String? = null
        val tokens = mutableListOf<String>()

        override fun get(path: String, accessToken: String): JSONObject {
            calls += 1
            this.path = path
            tokens += accessToken
            return response
        }
    }
}
