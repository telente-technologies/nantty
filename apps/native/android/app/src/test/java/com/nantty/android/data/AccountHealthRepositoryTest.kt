package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountHealthRepositoryTest {
    @Test
    fun loadsAuthenticatedAccountStatusAndParsesLegalActions() {
        val transport = RecordingAccountHealthTransport(accountHealthPayload())
        val repository = AccountHealthRepository(::session) { method, path, token, body -> transport.request(method, path, token, body) }

        val result = repository.load() as AccountHealthResult.Success

        assertEquals("GOOD_STANDING", result.health.status)
        assertEquals(setOf("GOING_LIVE"), result.health.restrictions)
        assertEquals("strike-1", result.health.strikes.single().id)
        assertTrue(result.health.strikes.single().canAppeal)
        assertEquals("claim-1", result.health.notices.single().claimId)
        assertTrue(result.health.notices.single().canCounterNotice)
        assertEquals("GET", transport.method)
        assertEquals("/api/v1/account/status", transport.path)
        assertEquals("access-token", transport.accessToken)
    }

    @Test
    fun appealAndCounterNoticeUseExistingAuthenticatedContracts() {
        val requests = mutableListOf<Triple<String, String, JSONObject?>>()
        val repository = AccountHealthRepository(::session) { method, path, _, body ->
            requests += Triple(method, path, body)
            JSONObject("{}")
        }

        assertTrue(repository.appeal("strike-1", "This content is my original work.") is AccountHealthActionResult.Success)
        assertTrue(repository.submitCounterNotice("claim-1", "I have a license from the rights holder.", "owner@example.com", true) is AccountHealthActionResult.Success)

        assertEquals(2, requests.size)
        assertEquals("POST", requests[0].first)
        assertEquals("/api/v1/account/status/strikes/strike-1/appeal", requests[0].second)
        assertEquals("This content is my original work.", requests[0].third?.optString("message"))
        assertEquals("/api/v1/copyright/claims/claim-1/counter-notices", requests[1].second)
        assertTrue(requests[1].third?.optBoolean("goodFaith") == true)
    }

    @Test
    fun rejectsMissingSessionAndInvalidLegalActionInputsBeforeTransport() {
        var requested = false
        val repository = AccountHealthRepository({ null }) { _, _, _, _ -> requested = true; JSONObject() }

        assertTrue((repository.load() as AccountHealthResult.Failure).authenticationRequired)
        assertTrue((repository.appeal("../strike", "A message with sufficient detail") as AccountHealthActionResult.Failure).message.isNotBlank())
        assertFalse(requested)

        val signedIn = AccountHealthRepository(::session) { _, _, _, _ -> requested = true; JSONObject() }
        assertTrue((signedIn.submitCounterNotice("claim-1", "too short", "invalid", false) as AccountHealthActionResult.Failure).message.isNotBlank())
        assertFalse(requested)
    }
}

private class RecordingAccountHealthTransport(private val response: JSONObject) : AccountHealthTransport {
    var method: String? = null
    var path: String? = null
    var accessToken: String? = null
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        this.method = method
        this.path = path
        this.accessToken = accessToken
        return response
    }
}

private fun session() = AccountSession("access-token", "refresh-token", AccountUser("account-1", "Owner", "owner", null, null, emptyList()))

private fun accountHealthPayload() = JSONObject(
    """{"data":{"accountId":"account-1","status":"GOOD_STANDING","restrictions":["GOING_LIVE"],"canMonetise":true,"canGoLive":false,"activeStrikeCount":1,"copyrightStrikesInWindow":1,"pendingTakedownCount":1,"restrictionThreshold":3,"strikeWindowDays":90,"strikeLifetimeDays":365,"takedownDeadlineHours":72,"warnings":[],"strikes":[{"id":"strike-1","kind":"STRIKE","policy":"Copyright","reason":"Unlicensed audio","source":"REPORT","issuedAt":"2026-11-01T00:00:00Z","status":"ACTIVE","appealStatus":"NONE","canAppeal":true}],"notices":[{"claimId":"claim-1","state":"AWAITING_REMOVAL","workTitle":"Track","claimantName":"Rights holder","reason":"Unlicensed use","decidedAt":"2026-11-01T00:00:00Z","canCounterNotice":true}]}}""",
)
