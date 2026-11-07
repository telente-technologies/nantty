package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IdentityVerificationRepositoryTest {
    @Test
    fun loadsJourneyFromAuthenticatedJourneyEndpointAndParsesStatusSemantics() {
        val transport = RecordingIdentityTransport(journeyPayload())
        val repository = IdentityVerificationRepository(sessionProvider = ::identitySession, transport = transport)

        val result = repository.loadJourney()

        assertEquals(listOf("GET /api/v1/verification/journey"), transport.calls)
        assertEquals(listOf("access-token"), transport.tokens)
        val journey = (result as IdentityVerificationResult.Success).value
        assertEquals("gold", journey.color)
        assertEquals("requested", journey.eligibility?.state)
        assertEquals("request", journey.eligibility?.tier)
        assertEquals(listOf("account_age_below_threshold"), journey.eligibility?.reasons)
        assertEquals("awaiting_capture", journey.case?.status)
        assertFalse(journey.case?.consentGiven ?: true)
    }

    @Test
    fun eligibilityRequestPostsEmptyBodyThenParsesServerOwnedEligibility() {
        val transport = RecordingIdentityTransport(JSONObject("""{"data":{"state":"eligible","tier":"buy_now","trustScore":91,"reasons":[],"canBuyNow":true,"requestedAt":null,"nextCheckAt":null}}"""))
        val repository = IdentityVerificationRepository(sessionProvider = ::identitySession, transport = transport)

        val result = repository.requestEligibility()

        assertEquals(listOf("POST /api/v1/verification/eligibility/request"), transport.calls)
        assertEquals("{}", transport.bodies.single()?.toString())
        val eligibility = (result as IdentityVerificationResult.Success).value
        assertTrue(eligibility.canBuyNow)
        assertEquals("eligible", eligibility.state)
        assertEquals(91, eligibility.trustScore)
    }

    @Test
    fun documentTypeOptionsAreFetchedForTheSelectedCountryFromTheExistingContract() {
        val transport = RecordingIdentityTransport(JSONObject("""{"country":"GH","documentTypes":["GHANA_CARD","PASSPORT","invalid value"],"governmentLookup":true}"""))
        val repository = IdentityVerificationRepository(sessionProvider = ::identitySession, transport = transport)

        val result = repository.loadDocumentTypes("GH")

        assertEquals(listOf("GET /api/v1/verification/document-types?country=GH"), transport.calls)
        val options = (result as IdentityVerificationResult.Success).value
        assertEquals("GH", options.country)
        assertEquals(listOf("GHANA_CARD", "PASSPORT"), options.documentTypes)
        assertTrue(options.governmentLookup)
        assertTrue(repository.loadDocumentTypes("GHA") is IdentityVerificationResult.Failure)
    }

    @Test
    fun capturePostsRnFieldsToEncodedCaseRouteAndParsesHostedUrl() {
        val transport = RecordingIdentityTransport(JSONObject("""{"data":{"mode":"hosted_link","url":"https://verify.example/check/abc","token":null,"product":"identity","jobId":"job-1"}}"""))
        val repository = IdentityVerificationRepository(sessionProvider = ::identitySession, transport = transport)

        val result = repository.startCapture(
            "case_123",
            IdentityCaptureRequest("consent-v4", true, "android", "NG", "NIN_SLIP"),
        )

        assertEquals(listOf("POST /api/v1/verification/cases/case_123/capture"), transport.calls)
        val body = transport.bodies.single()!!
        assertEquals("consent-v4", body.getString("consentVersion"))
        assertTrue(body.getBoolean("consentAccepted"))
        assertEquals("android", body.getString("platform"))
        assertEquals("NG", body.getString("documentCountry"))
        assertEquals("NIN_SLIP", body.getString("documentType"))
        assertEquals("https://verify.example/check/abc", (result as IdentityVerificationResult.Success).value.url)
    }

    @Test
    fun requiresSessionBeforeRequestsAndRefreshesOnlyAfterUnauthorized() {
        var calls = 0
        val transport = object : IdentityVerificationTransport {
            override fun get(path: String, accessToken: String): JSONObject {
                calls += 1
                if (accessToken == "access-token") throw IdentityVerificationHttpException(401)
                return journeyPayload()
            }
            override fun post(path: String, accessToken: String, body: JSONObject) = journeyPayload()
        }
        val repository = IdentityVerificationRepository(
            sessionProvider = ::identitySession,
            refreshSessionProvider = { identitySession().copy(accessToken = "refreshed-token") },
            transport = transport,
        )

        assertTrue(repository.loadJourney() is IdentityVerificationResult.Success)
        assertEquals(2, calls)
        val anonymous = IdentityVerificationRepository(sessionProvider = { null }, transport = transport).loadJourney()
        assertTrue(anonymous is IdentityVerificationResult.Failure && anonymous.authenticationRequired)
    }

    @Test
    fun rejectsUnsupportedCaseIdsConsentAndCaptureUrls() {
        val transport = RecordingIdentityTransport(journeyPayload())
        val repository = IdentityVerificationRepository(sessionProvider = ::identitySession, transport = transport)

        assertTrue(repository.startCapture("../case", IdentityCaptureRequest("v1", true, "android", "NG", "NIN_SLIP")) is IdentityVerificationResult.Failure)
        assertTrue(repository.startCapture("case-1", IdentityCaptureRequest("v1", false, "android", "NG", "NIN_SLIP")) is IdentityVerificationResult.Failure)
        assertTrue(transport.calls.isEmpty())
        assertTrue(runCatching { parseIdentityCaptureSession(JSONObject("""{"mode":"hosted_link","url":"javascript:alert(1)"}""")) }.isFailure)
        assertTrue(runCatching { parseIdentityCaptureSession(JSONObject("""{"mode":"hosted_link","url":"https://user:pass@example.com"}""")) }.isFailure)
    }
}

private class RecordingIdentityTransport(private val response: JSONObject) : IdentityVerificationTransport {
    val calls = mutableListOf<String>()
    val tokens = mutableListOf<String>()
    val bodies = mutableListOf<JSONObject?>()

    override fun get(path: String, accessToken: String): JSONObject {
        calls += "GET $path"
        tokens += accessToken
        bodies += null
        return response
    }

    override fun post(path: String, accessToken: String, body: JSONObject): JSONObject {
        calls += "POST $path"
        tokens += accessToken
        bodies += body
        return response
    }
}

private fun identitySession() = AccountSession(
    accessToken = "access-token",
    refreshToken = "refresh-token",
    user = AccountUser("user-1", "Oyin", "oyin", null, null, emptyList()),
)

private fun journeyPayload() = JSONObject(
    """{"data":{
        "profileId":"profile-1","profileType":"person","color":"gold","blackVetting":false,
        "planCode":"gold-monthly","consentVersion":"consent-v4",
        "eligibility":{"state":"requested","tier":"request","trustScore":68,"reasons":["account_age_below_threshold"],"canBuyNow":false,"requestedAt":"2026-11-01T00:00:00Z","nextCheckAt":"2026-11-08T00:00:00Z"},
        "case":{"id":"case_123","color":"gold","planCode":"gold-monthly","paymentChannel":"web","status":"awaiting_capture","refundStatus":"not_applicable","refundMethod":"card","refundScope":"full","consentGiven":false,"decisionReason":"","createdAt":"2026-11-06T00:00:00Z","decidedAt":null,"verifiedAt":null,"canRetry":false},
        "checkmark":null
    }}""",
)
