package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BrandProfilesRepositoryTest {
    @Test
    fun loadUsesAuthenticatedProfileContractsAndIdentifiesServerActiveProfile() {
        val transport = RecordingBrandProfilesTransport()
        val repository = BrandProfilesRepository(
            baseUrl = "https://api.nantty.com",
            transport = transport,
            sessionProvider = ::brandProfilesSession,
        )

        val result = repository.load() as BrandProfilesResult.Success

        assertEquals(listOf("GET ${BrandProfilesRepository.PROFILES_PATH}", "GET ${BrandProfilesRepository.ACTING_PROFILE_PATH}"), transport.calls)
        assertEquals(listOf("session-access-token", "session-access-token"), transport.tokens)
        assertEquals("brand-2", result.state.activeProfile.id)
        assertFalse(result.state.profiles.first().active)
        assertTrue(result.state.profiles.last().active)
        assertEquals("brand", result.state.profiles.last().kind)
        assertNull(result.state.profiles.first().avatarUrl)
    }

    @Test
    fun switchUsesPutAndSendsOnlySelectedProfileId() {
        val transport = RecordingBrandProfilesTransport()
        val repository = BrandProfilesRepository("https://api.nantty.com", transport, ::brandProfilesSession)

        val result = repository.switchActingProfile("brand-2") as ActingProfileSwitchResult.Success

        assertEquals("PUT ${BrandProfilesRepository.ACTING_PROFILE_PATH}", transport.calls.single())
        assertEquals("session-access-token", transport.tokens.single())
        assertEquals(setOf("profileId"), transport.putBody!!.keys().asSequence().toSet())
        assertEquals("brand-2", transport.putBody!!.getString("profileId"))
        assertEquals("brand-2", result.profile.id)
    }

    @Test
    fun missingSessionDoesNotCallAnyEndpoint() {
        val transport = RecordingBrandProfilesTransport()
        val repository = BrandProfilesRepository("https://api.nantty.com", transport)

        assertTrue(repository.load() is BrandProfilesResult.Failure)
        assertTrue(repository.switchActingProfile("brand-2") is ActingProfileSwitchResult.Failure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun rejectsUnknownSwitchResponseAndProfilesNotOwnedByList() {
        val transport = RecordingBrandProfilesTransport().apply { switchResponseId = "another-profile" }
        val repository = BrandProfilesRepository("https://api.nantty.com", transport, ::brandProfilesSession)
        assertTrue(repository.switchActingProfile("brand-2") is ActingProfileSwitchResult.Failure)

        val mismatched = RecordingBrandProfilesTransport().apply { activeResponseId = "not-listed" }
        val mismatchRepository = BrandProfilesRepository("https://api.nantty.com", mismatched, ::brandProfilesSession)
        assertTrue(mismatchRepository.load() is BrandProfilesResult.Failure)
    }

    @Test
    fun parserMapsOnlyDisplayFieldsAndRejectsMalformedProfile() {
        val repository = BrandProfilesRepository("https://api.nantty.com", RecordingBrandProfilesTransport(), ::brandProfilesSession)
        val parsed = repository.parseProfiles(profileListPayload())

        assertEquals(2, parsed.size)
        assertEquals("Ari", parsed.first().name)
        assertEquals("ari", parsed.first().handle)
        assertFalse(parsed.first().onHold)
        assertTrue(runCatching { repository.parseProfiles(JSONObject().put("data", JSONArray().put(JSONObject().put("id", "bad")))) }.isFailure)
    }
}

private class RecordingBrandProfilesTransport : BrandProfilesTransport {
    val calls = mutableListOf<String>()
    val tokens = mutableListOf<String>()
    var putBody: JSONObject? = null
    var activeResponseId = "brand-2"
    var switchResponseId = "brand-2"

    override fun get(path: String, accessToken: String): JSONObject {
        calls += "GET $path"
        tokens += accessToken
        return if (path == BrandProfilesRepository.PROFILES_PATH) profileListPayload() else profilePayload(activeResponseId, "brand", "Studio North")
    }

    override fun put(path: String, accessToken: String, body: JSONObject): JSONObject {
        calls += "PUT $path"
        tokens += accessToken
        putBody = body
        return profilePayload(switchResponseId, "brand", "Studio North")
    }
}

private fun profileListPayload() = JSONObject().put("data", JSONArray()
    .put(profilePayload("person-1", "person", "Ari").getJSONObject("data").put("handle", "ari"))
    .put(profilePayload("brand-2", "brand", "Studio North").getJSONObject("data").put("handle", "studio-north").put("active", true))
)

private fun profilePayload(id: String, kind: String, name: String) = JSONObject().put("data", JSONObject()
    .put("id", id)
    .put("kind", kind)
    .put("type", kind)
    .put("name", name)
    .put("handle", name.lowercase().replace(' ', '-'))
    .put("avatarUrl", JSONObject.NULL)
    .put("active", id == "brand-2")
    .put("onHold", false)
    .put("email", "private@example.test")
    .put("roles", JSONArray().put("admin"))
)

private fun brandProfilesSession() = AccountSession(
    accessToken = "session-access-token",
    refreshToken = "session-refresh-token",
    user = AccountUser("account-1", "Ari", "ari", "private@example.test", null, listOf("user")),
)
