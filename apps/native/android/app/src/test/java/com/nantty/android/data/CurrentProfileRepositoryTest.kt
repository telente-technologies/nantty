package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CurrentProfileRepositoryTest {
    @Test
    fun loadUsesOnlyCurrentUserEndpointAndMapsDisplaySafeFields() {
        val transport = RecordingCurrentProfileTransport(profilePayload())
        val repository = CurrentProfileRepository(
            baseUrl = "https://api.nantty.com",
            transport = transport,
            sessionProvider = { currentSession() },
        )

        val result = repository.load() as CurrentProfileResult.Success

        assertEquals(1, transport.getCalls)
        assertEquals(0, transport.patchCalls)
        assertEquals("session-access-token", transport.accessToken)
        assertEquals("account-1", result.profile.accountId)
        assertEquals("Ari", result.profile.name)
        assertEquals("ari", result.profile.username)
        assertEquals("Only the details I choose.", result.profile.bio)
        assertEquals("https://cdn.nantty.com/ari.jpg", result.profile.avatarUrl)
        assertTrue(result.profile.isPrivate)
        assertEquals(12, result.profile.followers)
        assertFalse(result.profile.isVerified)
    }

    @Test
    fun mismatchedResponseAccountFailsClosed() {
        val repository = CurrentProfileRepository(
            baseUrl = "https://api.nantty.com",
            transport = RecordingCurrentProfileTransport(profilePayload(accountId = "someone-else")),
            sessionProvider = { currentSession() },
        )

        val result = repository.load() as CurrentProfileResult.Failure

        assertTrue(result.message.contains("does not match"))
    }

    @Test
    fun missingSessionNeverCallsTransport() {
        val transport = RecordingCurrentProfileTransport(profilePayload())
        val repository = CurrentProfileRepository("https://api.nantty.com", transport)

        assertTrue(repository.load() is CurrentProfileResult.Failure)
        assertEquals(0, transport.getCalls)
        assertEquals(0, transport.patchCalls)
    }

    @Test
    fun updateSendsOnlySupportedProfileFieldsThroughMePatch() {
        val transport = RecordingCurrentProfileTransport(profilePayload(name = "Updated Ari", bio = "New bio", isPrivate = false))
        val repository = CurrentProfileRepository(
            baseUrl = "https://api.nantty.com",
            transport = transport,
            sessionProvider = { currentSession() },
        )

        val result = repository.update(CurrentProfileUpdate(" Updated Ari ", " New bio ", false)) as CurrentProfileResult.Success

        assertEquals(0, transport.getCalls)
        assertEquals(1, transport.patchCalls)
        assertEquals("session-access-token", transport.accessToken)
        assertEquals(setOf("name", "bio", "isPrivate"), transport.patchFields!!.keys().asSequence().toSet())
        assertEquals("Updated Ari", transport.patchFields!!.getString("name"))
        assertEquals("New bio", transport.patchFields!!.getString("bio"))
        assertFalse(transport.patchFields!!.getBoolean("isPrivate"))
        assertEquals("Updated Ari", result.profile.name)
    }

    @Test
    fun updateSendsAvatarAndBannerMediaIdsOnlyWhenUploaded() {
        val transport = RecordingCurrentProfileTransport(profilePayload())
        val repository = CurrentProfileRepository(
            baseUrl = "https://api.nantty.com",
            transport = transport,
            sessionProvider = { currentSession() },
        )

        repository.update(CurrentProfileUpdate(
            name = "Ari",
            bio = "Bio",
            isPrivate = true,
            avatarMediaId = "profile/avatar-1",
            bannerMediaId = "profile/banner-1",
        ))

        assertEquals(setOf("name", "bio", "isPrivate", "avatarMediaId", "bannerMediaId"), transport.patchFields!!.keys().asSequence().toSet())
        assertEquals("profile/avatar-1", transport.patchFields!!.getString("avatarMediaId"))
        assertEquals("profile/banner-1", transport.patchFields!!.getString("bannerMediaId"))
    }

    @Test
    fun invalidLengthsNeverReachServer() {
        val transport = RecordingCurrentProfileTransport(profilePayload())
        val repository = CurrentProfileRepository(
            baseUrl = "https://api.nantty.com",
            transport = transport,
            sessionProvider = { currentSession() },
        )

        assertTrue(repository.update(CurrentProfileUpdate("x".repeat(51), "", false)) is CurrentProfileResult.Failure)
        assertTrue(repository.update(CurrentProfileUpdate("Ari", "x".repeat(161), false)) is CurrentProfileResult.Failure)
        assertTrue(repository.update(CurrentProfileUpdate(" ", "", false)) is CurrentProfileResult.Failure)
        assertEquals(0, transport.patchCalls)
    }

    @Test
    fun absentAvatarIsNull() {
        val payload = profilePayload().put("data", profilePayload().getJSONObject("data").put("avatarUrl", JSONObject.NULL))
        val repository = CurrentProfileRepository("https://api.nantty.com", RecordingCurrentProfileTransport(payload)) {
            currentSession()
        }

        val result = repository.load() as CurrentProfileResult.Success

        assertNull(result.profile.avatarUrl)
    }
}

private class RecordingCurrentProfileTransport(
    private val response: JSONObject,
) : CurrentProfileTransport {
    var getCalls = 0
    var patchCalls = 0
    var accessToken: String? = null
    var patchFields: JSONObject? = null

    override fun getMe(accessToken: String): JSONObject {
        getCalls += 1
        this.accessToken = accessToken
        return response
    }

    override fun patchMe(accessToken: String, fields: JSONObject): JSONObject {
        patchCalls += 1
        this.accessToken = accessToken
        patchFields = fields
        return response
    }
}

private fun currentSession() = AccountSession(
    accessToken = "session-access-token",
    refreshToken = "session-refresh-token",
    user = AccountUser("account-1", "Ari", "ari", "private@example.test", null, listOf("user")),
)

private fun profilePayload(
    accountId: String = "account-1",
    name: String = "Ari",
    bio: String = "Only the details I choose.",
    isPrivate: Boolean = true,
) = JSONObject().put("data", JSONObject()
    .put("id", accountId)
    .put("name", name)
    .put("username", "ari")
    .put("bio", bio)
    .put("avatarUrl", "https://cdn.nantty.com/ari.jpg")
    .put("bannerUrl", JSONObject.NULL)
    .put("isPrivate", isPrivate)
    .put("verified", false)
    .put("isCreator", false)
    .put("followers", 12)
    .put("following", 4)
    .put("posts", 2)
    .put("email", "must-not-be-mapped@example.test")
    .put("roles", listOf("admin"))
    .put("birthday", "2000-01-01")
)
