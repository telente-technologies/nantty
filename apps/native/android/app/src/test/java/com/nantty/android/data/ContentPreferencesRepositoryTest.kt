package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ContentPreferencesRepositoryTest {
    @Test
    fun loadsServerDerivedAdultEligibility() {
        val calls = mutableListOf<PreferenceCall>()
        val repository = repository(calls) { method, token, body ->
            response("adult", canChange = true, showWithoutWarning = true)
        }

        assertEquals(
            ContentPreferencesResult.Success(ContentPreferences(true, true, ContentAgeBracket.ADULT)),
            repository.load(),
        )
        assertEquals(PreferenceCall("GET", "token", null), calls.single())
    }

    @Test
    fun readsLockedMinorAndUnknownAgePreferencesWithoutLocalBirthdayAssumptions() {
        for (bracket in listOf("minor", "unknown")) {
            val repository = ContentPreferencesRepository(
                sessionProvider = { testSession() },
                transport = ContentPreferencesTransport { _, _, _ -> response(bracket, canChange = false) },
            )
            val result = repository.load() as ContentPreferencesResult.Success
            assertFalse(result.preferences.canChangeSensitiveContentSetting)
            assertFalse(result.preferences.showSensitiveWithoutWarning)
            assertEquals(if (bracket == "minor") ContentAgeBracket.MINOR else ContentAgeBracket.UNKNOWN, result.preferences.ageBracket)
        }
    }

    @Test
    fun updatesOnlyTheRequestedPreferenceAndReturnsServerAuthoritativeState() {
        var requestBody: JSONObject? = null
        val repository = ContentPreferencesRepository(
            sessionProvider = { testSession() },
            transport = ContentPreferencesTransport { method, _, body ->
                assertEquals("PUT", method)
                requestBody = body
                response("adult", canChange = true, showWithoutWarning = true)
            },
        )

        assertEquals(ContentPreferencesResult.Success(ContentPreferences(true, true, ContentAgeBracket.ADULT)), repository.update(true))
        assertEquals("{\"showSensitiveWithoutWarning\":true}", requestBody!!.toString())
    }

    @Test
    fun refreshesOnceAfterUnauthorizedAndDoesNotTreatPolicyForbiddenAsExpiredSession() {
        var refreshed = 0
        var calls = 0
        val repository = ContentPreferencesRepository(
            sessionProvider = { testSession("old-token") },
            refreshSessionProvider = { refreshed++; testSession("new-token") },
            transport = ContentPreferencesTransport { _, token, _ ->
                calls++
                if (token == "old-token") throw ContentPreferencesHttpException(401, "expired")
                response("adult", canChange = true)
            },
        )
        assertTrue(repository.load() is ContentPreferencesResult.Success)
        assertEquals(1, refreshed)
        assertEquals(2, calls)

        val lockedRepository = ContentPreferencesRepository(
            sessionProvider = { testSession() },
            refreshSessionProvider = { refreshed++; testSession("newer-token") },
            transport = ContentPreferencesTransport { _, _, _ -> throw ContentPreferencesHttpException(403, "Adults only") },
        )
        val failure = lockedRepository.update(true) as ContentPreferencesResult.Failure
        assertEquals("Adults only", failure.message)
        assertFalse(failure.authenticationRequired)
        assertEquals(1, refreshed)
    }

    @Test
    fun rejectsInconsistentOrUnknownEligibilityResponses() {
        val unsafe = ContentPreferencesRepository(
            sessionProvider = { testSession() },
            transport = ContentPreferencesTransport { _, _, _ -> response("minor", canChange = false, showWithoutWarning = true) },
        ).load()
        assertTrue(unsafe is ContentPreferencesResult.Failure)

        val unknown = ContentPreferencesRepository(
            sessionProvider = { testSession() },
            transport = ContentPreferencesTransport { _, _, _ -> response("adult", canChange = false) },
        ).load()
        assertTrue(unknown is ContentPreferencesResult.Failure)
    }

    private fun repository(
        calls: MutableList<PreferenceCall>,
        response: (String, String, JSONObject?) -> JSONObject,
    ) = ContentPreferencesRepository(
        sessionProvider = { testSession() },
        transport = ContentPreferencesTransport { method, token, body ->
            calls += PreferenceCall(method, token, body)
            response(method, token, body)
        },
    )

    private fun response(bracket: String, canChange: Boolean, showWithoutWarning: Boolean = false) = JSONObject()
        .put("data", JSONObject()
            .put("showSensitiveWithoutWarning", showWithoutWarning)
            .put("canChangeSensitiveContentSetting", canChange)
            .put("ageBracket", bracket))

    private fun testSession(token: String = "token") = AccountSession(token, "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))

    private data class PreferenceCall(val method: String, val token: String, val body: JSONObject?)
}
