package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CreatorWorkspaceRepositoryTest {
    @Test
    fun loadsEligibilityAndApplicationUsingAuthenticatedContracts() {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String>()
        val repository = CreatorWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = CreatorWorkspaceTransport { path, token ->
                paths += path
                tokens += token
                when (path) {
                    CreatorWorkspaceRepository.ELIGIBILITY_PATH -> JSONObject(
                        """{"eligible":true,"decision":"manual_review","decisionNote":"Team review required.","requirements":[{"key":"followers","label":"At least 1,000 real followers","currentValue":1200,"requiredValue":1000,"met":true}]}""",
                    )
                    CreatorWorkspaceRepository.APPLICATION_PATH -> JSONObject(
                        """{"id":"app-1","status":"pending","contentCategories":["tech"],"submittedAt":"2026-11-01T12:00:00Z","reviewedAt":null,"rejectionReason":null,"reapplyAvailableAt":null}""",
                    )
                    else -> error("Unexpected path: $path")
                }
            },
        )

        val eligibility = repository.loadEligibility() as CreatorWorkspaceResult.Success
        val application = repository.loadApplication() as CreatorWorkspaceResult.Success

        assertTrue(eligibility.value.eligible)
        assertEquals("manual_review", eligibility.value.decision)
        assertEquals(1200, eligibility.value.requirements.single().currentValue)
        assertEquals("pending", application.value?.status)
        assertNull(application.value?.rejectionReason)
        assertEquals(listOf(CreatorWorkspaceRepository.ELIGIBILITY_PATH, CreatorWorkspaceRepository.APPLICATION_PATH), paths)
        assertEquals(listOf("creator-access", "creator-access"), tokens)
    }

    @Test
    fun representsMissingApplicationAsEmptyNotAnError() {
        val repository = repository { path, _ ->
            assertEquals(CreatorWorkspaceRepository.APPLICATION_PATH, path)
            JSONObject().put("data", JSONObject.NULL)
        }

        val result = repository.loadApplication() as CreatorWorkspaceResult.Success

        assertNull(result.value)
    }

    @Test
    fun loadsDashboardForOnlySupportedReactNativePeriodsAndParsesBackendMoneyDto() {
        var path: String? = null
        val repository = repository { requested, _ ->
            path = requested
            JSONObject(
                """{"period":"week","currency":"NGN","earnings":{"gifts":{"amountMinor":2500,"currency":"NGN"},"tips":{"amountMinor":500,"currency":"NGN"},"affiliateCommissions":{"amountMinor":1000,"currency":"NGN"},"subscriptions":{"amountMinor":0,"currency":"NGN"},"adRevenue":{"amountMinor":0,"currency":"NGN"},"bonuses":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":3500,"currency":"NGN"}},"pendingBalance":{"amountMinor":500,"currency":"NGN"},"availableBalance":{"amountMinor":3000,"currency":"NGN"},"followersGained":12,"topContent":[{"id":"live-1","kind":"live","title":"Studio session","thumbnailUrl":null,"views":42,"earnings":{"amountMinor":2500,"currency":"NGN"}}]}""",
            )
        }

        val result = repository.loadDashboard(CreatorDashboardPeriod.WEEK) as CreatorWorkspaceResult.Success

        assertEquals("${CreatorWorkspaceRepository.DASHBOARD_PATH}?period=week", path)
        assertEquals(CreatorDashboardPeriod.WEEK, result.value.period)
        assertEquals(3500L, result.value.earnings.total.amountMinor)
        assertEquals("NGN", result.value.pendingBalance.currency)
        assertEquals(12L, result.value.followersGained)
        assertEquals("Studio session", result.value.topContent.single().title)
    }

    @Test
    fun rejectsDashboardResponseForDifferentPeriodAndMalformedEligibility() {
        val dashboardRepository = repository { _, _ ->
            JSONObject("""{"period":"month","earnings":{},"pendingBalance":{},"availableBalance":{},"topContent":[]}""")
        }
        val dashboard = dashboardRepository.loadDashboard(CreatorDashboardPeriod.WEEK) as CreatorWorkspaceResult.Failure
        assertTrue(dashboard.message.contains("different period"))

        val eligibilityRepository = repository { _, _ -> JSONObject("""{"eligible":false,"decision":"unknown","requirements":[]}""") }
        val eligibility = eligibilityRepository.loadEligibility() as CreatorWorkspaceResult.Failure
        assertFalse(eligibility.authenticationRequired)
    }

    @Test
    fun doesNotRequestWithoutSessionAndRefreshesOnceAfterUnauthorized() {
        var requestCount = 0
        val signedOut = CreatorWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = CreatorWorkspaceTransport { _, _ -> requestCount += 1; JSONObject() },
        ).loadEligibility() as CreatorWorkspaceResult.Failure
        assertTrue(signedOut.authenticationRequired)
        assertEquals(0, requestCount)

        val seenTokens = mutableListOf<String>()
        val retrying = CreatorWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            refreshSessionProvider = { signedInSession().copy(accessToken = "creator-refreshed") },
            transport = CreatorWorkspaceTransport { _, token ->
                seenTokens += token
                if (seenTokens.size == 1) throw CreatorWorkspaceHttpException(401)
                JSONObject("""{"eligible":false,"decision":"not_eligible","decisionNote":"Keep growing.","requirements":[]}""")
            },
        )

        assertTrue(retrying.loadEligibility() is CreatorWorkspaceResult.Success)
        assertEquals(listOf("creator-access", "creator-refreshed"), seenTokens)
    }

    private fun repository(transport: CreatorWorkspaceTransport) = CreatorWorkspaceRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = ::signedInSession,
        transport = transport,
    )

    private fun signedInSession() = AccountSession(
        "creator-access",
        "creator-refresh",
        AccountUser("account-1", "Creator", "creator", null, null, emptyList()),
    )
}
