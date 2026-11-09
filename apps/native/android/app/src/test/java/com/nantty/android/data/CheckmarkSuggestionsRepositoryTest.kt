package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckmarkSuggestionsRepositoryTest {
    @Test
    fun callsReactNativeEndpointsAndKeepsServerSuggestionRulesAndEligibility() {
        val transport = RecordingCheckmarkTransport(
            getResponses = mapOf(
                CheckmarkSuggestionsRepository.SUGGESTIONS_PATH to suggestionsPayload(),
                CheckmarkSuggestionsRepository.PLANS_PATH to plansPayload(),
                CheckmarkSuggestionsRepository.MY_VERIFICATION_PATH to myVerificationPayload(),
                CheckmarkSuggestionsRepository.DISCOUNTS_PATH to discountsPayload(),
            ),
        )
        val repository = CheckmarkSuggestionsRepository(sessionProvider = ::checkmarkSession, transport = transport)

        val suggestions = (repository.loadSuggestions() as CheckmarkSuggestionsResult.Success).value
        val plans = (repository.loadPlans() as CheckmarkSuggestionsResult.Success).value
        val mine = (repository.loadMyVerification() as CheckmarkSuggestionsResult.Success).value
        val discounts = (repository.loadDiscounts() as CheckmarkSuggestionsResult.Success).value

        assertEquals(
            listOf(
                "GET ${CheckmarkSuggestionsRepository.SUGGESTIONS_PATH}",
                "GET ${CheckmarkSuggestionsRepository.PLANS_PATH}",
                "GET ${CheckmarkSuggestionsRepository.MY_VERIFICATION_PATH}",
                "GET ${CheckmarkSuggestionsRepository.DISCOUNTS_PATH}",
            ),
            transport.calls,
        )
        assertEquals(listOf("session-token", "session-token", "session-token", "session-token"), transport.tokens)
        assertEquals("blue", suggestions.single().color)
        assertFalse("eligible comes from the response, not client-side rule evaluation", suggestions.single().eligible)
        assertEquals("Server-defined age threshold", suggestions.single().rules.first().label)
        assertFalse(suggestions.single().rules.first().met)
        assertEquals("plan-blue-monthly", plans.single().id)
        assertEquals("blue", plans.single().planCode)
        assertEquals("NGN", plans.single().price.currency)
        assertEquals("Blue badge", plans.single().perks.single().title)
        assertEquals("active", mine.current?.status)
        assertEquals("business", mine.current?.type)
        assertEquals("application-1", mine.application?.id)
        assertEquals("2027-03-01T00:00:00Z", mine.reverificationDueAt)
        assertEquals("offer-token", discounts.offers.single().token)
        assertEquals(25L, discounts.offers.single().discount.percentOff)
        assertEquals(20L, discounts.yearlyPercentOff)
        assertEquals(15L, discounts.bundle?.percentOff)
    }

    @Test
    fun parsesFixedAmountOfferAndSupportsOptionalNullResponseFields() {
        val discounts = parseCheckmarkVerificationDiscounts(
            """{"offers":[{"linkId":"link-2","token":"fixed-token","plans":[{"planCode":"gold","planLabel":"Gold"}],"discount":{"kind":"fixed_amount","amountOff":{"amountMinor":125000,"currency":"NGN"}},"durationCycles":2,"expiresAt":null,"sentAt":"2026-01-01T00:00:00Z"}],"yearlyPercentOff":0,"bundle":null}""",
        )

        assertNull(discounts.offers.single().discount.percentOff)
        assertEquals(125000L, discounts.offers.single().discount.amountOff?.amountMinor)
        assertEquals("NGN", discounts.offers.single().discount.amountOff?.currency)
        assertNull(discounts.offers.single().expiresAt)
        assertNull(discounts.bundle)
    }

    @Test
    fun parsesVerificationPlansFromTheCursorPageShapeReturnedByGo() {
        val plans = parseCheckmarkVerificationPlans(
            """{"data":[{"id":"plan-blue-monthly","planCode":"blue","name":"Verified","color":"blue","tier":"VERIFIED","price":{"amountMinor":399000,"currency":"NGN"},"interval":"month","channel":"web","storeProductId":null,"perks":[{"title":"Blue badge","description":"Show your verified badge."}]}],"nextCursor":null}""",
        )

        assertEquals(1, plans.size)
        assertEquals("Verified", plans.single().name)
        assertEquals(399000L, plans.single().price.amountMinor)
        assertNull(plans.single().storeProductId)
    }

    @Test
    fun dismissUsesOnlySupportedServerRouteColorsAndNoBody() {
        val transport = RecordingCheckmarkTransport(postResponse = "")
        val repository = CheckmarkSuggestionsRepository(sessionProvider = ::checkmarkSession, transport = transport)

        assertTrue(repository.dismissSuggestion("blue") is CheckmarkSuggestionsResult.Success)
        assertTrue(repository.dismissSuggestion("gold") is CheckmarkSuggestionsResult.Success)
        assertTrue(repository.dismissSuggestion("black") is CheckmarkSuggestionsResult.Failure)
        assertEquals(
            listOf(
                "POST ${CheckmarkSuggestionsRepository.SUGGESTIONS_PATH}/blue/dismiss",
                "POST ${CheckmarkSuggestionsRepository.SUGGESTIONS_PATH}/gold/dismiss",
            ),
            transport.calls,
        )
    }

    @Test
    fun requiresSessionAndRefreshesOnceOnlyAfterUnauthorized() {
        val unauthorizedTransport = object : CheckmarkSuggestionsTransport {
            val tokens = mutableListOf<String>()
            override fun get(path: String, accessToken: String): String {
                tokens += accessToken
                if (accessToken == "session-token") throw CheckmarkSuggestionsHttpException(401)
                return "[]"
            }
            override fun post(path: String, accessToken: String) = ""
        }
        var refreshCalls = 0
        val repository = CheckmarkSuggestionsRepository(
            sessionProvider = ::checkmarkSession,
            refreshSessionProvider = { refreshCalls++; checkmarkSession("refreshed-token") },
            transport = unauthorizedTransport,
        )

        assertTrue(repository.loadSuggestions() is CheckmarkSuggestionsResult.Success)
        assertEquals(listOf("session-token", "refreshed-token"), unauthorizedTransport.tokens)
        assertEquals(1, refreshCalls)

        val anonymousTransport = RecordingCheckmarkTransport()
        val anonymous = CheckmarkSuggestionsRepository(sessionProvider = { null }, transport = anonymousTransport)
            .loadSuggestions()
        assertTrue(anonymous is CheckmarkSuggestionsResult.Failure && anonymous.authenticationRequired)
        assertTrue(anonymousTransport.calls.isEmpty())
    }

    @Test
    fun doesNotRefreshOnForbiddenAndRejectsMalformedJsonSafely() {
        var refreshCalls = 0
        val forbiddenTransport = object : CheckmarkSuggestionsTransport {
            override fun get(path: String, accessToken: String): String = throw CheckmarkSuggestionsHttpException(403)
            override fun post(path: String, accessToken: String) = ""
        }
        val forbidden = CheckmarkSuggestionsRepository(
            sessionProvider = ::checkmarkSession,
            refreshSessionProvider = { refreshCalls++; checkmarkSession("fresh") },
            transport = forbiddenTransport,
        ).loadSuggestions()
        assertTrue(forbidden is CheckmarkSuggestionsResult.Failure && forbidden.authenticationRequired)
        assertEquals(0, refreshCalls)

        val malformed = CheckmarkSuggestionsRepository(
            sessionProvider = ::checkmarkSession,
            transport = RecordingCheckmarkTransport(getResponses = mapOf(CheckmarkSuggestionsRepository.SUGGESTIONS_PATH to "{bad json")),
        ).loadSuggestions()
        assertTrue(malformed is CheckmarkSuggestionsResult.Failure)
    }
}

private class RecordingCheckmarkTransport(
    private val getResponses: Map<String, String> = emptyMap(),
    private val postResponse: String = "",
) : CheckmarkSuggestionsTransport {
    val calls = mutableListOf<String>()
    val tokens = mutableListOf<String>()

    override fun get(path: String, accessToken: String): String {
        calls += "GET $path"
        tokens += accessToken
        return getResponses[path] ?: "[]"
    }

    override fun post(path: String, accessToken: String): String {
        calls += "POST $path"
        tokens += accessToken
        return postResponse
    }
}

private fun checkmarkSession(token: String = "session-token") = AccountSession(
    accessToken = token,
    refreshToken = "refresh-token",
    user = AccountUser("account-1", "Test User", "test.user", null, null, emptyList()),
)

private fun suggestionsPayload() = """[
    {"color":"blue","eligible":false,"dismissed":false,"headline":"Grow your profile","detail":"Server-owned explanation","rules":[{"label":"Server-defined age threshold","met":false},{"label":"Identity requirement","met":true}]}
]"""

private fun plansPayload() = """{"data":[
    {"id":"plan-blue-monthly","planCode":"blue","name":"Verified","color":"blue","tier":"VERIFIED","price":{"amountMinor":399000,"currency":"NGN"},"interval":"month","channel":"web","storeProductId":null,"perks":[{"title":"Blue badge","description":"Show your verified badge."}]}
],"nextCursor":null}"""

private fun myVerificationPayload() = """{
    "current":{"status":"active","type":"business","color":"gold","tier":"PRO","badgeVisible":true,"graceEndsAt":null},
    "subscription":null,
    "application":{"id":"application-1","color":"gold","status":"approved","submittedAt":"2026-10-01T00:00:00Z","rejectionReason":null},
    "handleReserved":true,
    "reverificationDueAt":"2027-03-01T00:00:00Z"
}"""

private fun discountsPayload() = """{
    "offers":[{"linkId":"link-1","token":"offer-token","plans":[{"planCode":"blue","planLabel":"Blue monthly"}],"discount":{"kind":"percentage","percentOff":25},"durationCycles":3,"expiresAt":null,"sentAt":"2026-10-01T00:00:00Z"}],
    "yearlyPercentOff":20,
    "bundle":{"percentOff":15}
}"""
