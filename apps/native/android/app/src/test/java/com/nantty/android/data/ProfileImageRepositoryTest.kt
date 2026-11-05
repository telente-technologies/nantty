package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileImageRepositoryTest {
    @Test
    fun createsAuthenticatedIntentAndUploadsBytesWithServerHeaders() {
        val transport = RecordingTransport()
        val repository = ProfileImageRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::profileImageSession,
            transport = transport,
        )

        val result = repository.upload("avatar", ProfileImageData("image/png", byteArrayOf(1, 2, 3)))

        assertEquals(ProfileImageUploadResult.Success("media-avatar-1"), result)
        assertEquals(ProfileImageRepository.UPLOAD_INTENT_PATH, transport.path)
        assertEquals("profile-token", transport.accessToken)
        assertEquals("avatar", transport.body?.getString("purpose"))
        assertEquals("image/png", transport.body?.getString("contentType"))
        assertEquals(3, transport.body?.getInt("sizeBytes"))
        assertEquals("https://uploads.nantty.com/signed/avatar", transport.uploadedIntent?.uploadUrl)
        assertTrue(transport.uploadedBytes!!.contentEquals(byteArrayOf(1, 2, 3)))
    }

    @Test
    fun rejectsUnsupportedContentTypeBeforeRequestingAnIntent() {
        val transport = RecordingTransport()
        val repository = repository(transport)

        val result = repository.upload("avatar", ProfileImageData("image/gif", byteArrayOf(1)))

        assertTrue(result is ProfileImageUploadResult.Failure)
        assertEquals(null, transport.body)
    }

    @Test
    fun refusesUploadIntentWithUnsafeUrlOrAuthorizationHeader() {
        val unsafeUrl = RecordingTransport(uploadUrl = "http://uploads.nantty.com/file")
        val unsafeHeader = RecordingTransport(headers = mapOf("Authorization" to "unexpected"))
        val image = ProfileImageData("image/jpeg", byteArrayOf(7))

        assertTrue(repository(unsafeUrl).upload("banner", image) is ProfileImageUploadResult.Failure)
        assertTrue(repository(unsafeHeader).upload("banner", image) is ProfileImageUploadResult.Failure)
        assertEquals(null, unsafeUrl.uploadedBytes)
        assertEquals(null, unsafeHeader.uploadedBytes)
    }

    @Test
    fun requiresSessionAndAcceptsOnlyAvatarOrBannerPurpose() {
        val transport = RecordingTransport()
        val signedOut = ProfileImageRepository("https://api.nantty.com", { null }, transport)

        assertTrue(signedOut.upload("avatar", ProfileImageData("image/jpeg", byteArrayOf(7))) is ProfileImageUploadResult.Failure)
        assertTrue(repository(transport).upload("cover", ProfileImageData("image/jpeg", byteArrayOf(7))) is ProfileImageUploadResult.Failure)
        assertEquals(null, transport.body)
    }

    private fun repository(transport: ProfileImageTransport) = ProfileImageRepository(
        "https://api.nantty.com",
        ::profileImageSession,
        transport,
    )

    private class RecordingTransport(
        private val uploadUrl: String = "https://uploads.nantty.com/signed/avatar",
        private val headers: Map<String, String> = mapOf("Content-Type" to "image/png"),
    ) : ProfileImageTransport {
        var path: String? = null
        var accessToken: String? = null
        var body: JSONObject? = null
        var uploadedIntent: ProfileImageUploadIntent? = null
        var uploadedBytes: ByteArray? = null

        override fun createIntent(path: String, accessToken: String, body: JSONObject): JSONObject {
            this.path = path
            this.accessToken = accessToken
            this.body = body
            return JSONObject()
                .put("mediaId", "media-avatar-1")
                .put("uploadUrl", uploadUrl)
                .put("method", "PUT")
                .put("headers", JSONObject(headers))
                .put("maximumSizeBytes", ProfileImageRepository.MAX_PROFILE_IMAGE_BYTES)
        }

        override fun upload(intent: ProfileImageUploadIntent, bytes: ByteArray) {
            uploadedIntent = intent
            uploadedBytes = bytes
        }
    }
}

private fun profileImageSession() = AccountSession(
    accessToken = "profile-token",
    refreshToken = "refresh-token",
    user = AccountUser("account-1", "Ari", "ari", null, null, emptyList()),
)
