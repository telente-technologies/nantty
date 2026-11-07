package com.nantty.android.data

import com.nantty.android.security.chatcrypto.ChatDeviceRegistrationRequest
import com.nantty.android.security.chatcrypto.ChatDeviceAddress
import com.nantty.android.security.chatcrypto.ChatWireOneTimePreKey
import com.nantty.android.security.chatcrypto.ChatWireSignedPreKey
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.HttpURLConnection

class ChatDeviceKeyDirectoryRepositoryTest {
    @Test
    fun registrationUsesTheAuthenticatedSocialContractAndParsesCanonicalStatus() {
        val transport = RecordingTransport { method, path, token, body ->
            assertEquals("PUT", method)
            assertEquals("/api/v1/chat/keys/devices/device_01", path)
            assertEquals("access-token", token)
            val request = requireNotNull(body)
            assertEquals(731, request.getInt("registrationId"))
            assertEquals("identity-b64", request.getString("identityKey"))
            assertEquals(11, request.getJSONObject("signedPreKey").getInt("keyId"))
            assertEquals(1, request.getJSONArray("oneTimePreKeys").length())
            status("device_01", "identity-b64", 11, 1)
        }
        val repository = ChatDeviceKeyDirectoryRepository(
            sessionProvider = { signedInSession("access-token") },
            transport = transport,
        )

        val result = repository.registerDevice(
            "device_01",
            ChatDeviceRegistrationRequest(
                registrationId = 731,
                identityKey = "identity-b64",
                signedPreKey = ChatWireSignedPreKey(11, "signed-key-b64", "signature-b64"),
                oneTimePreKeys = listOf(ChatWireOneTimePreKey(12, "one-time-key-b64")),
            ),
        )

        assertEquals("device_01", result.deviceId)
        assertEquals(1, transport.calls)
    }

    @Test
    fun fetchReturnsNullOnlyForDeviceNotFoundAndRetriesOneUnauthorizedWithRefreshedToken() {
        var calls = 0
        val transport = RecordingTransport { _, _, token, _ ->
            calls++
            if (token == "old-token") throw MessagesHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
            status("device_02", "identity-b64", 21, 25)
        }
        val repository = ChatDeviceKeyDirectoryRepository(
            sessionProvider = { signedInSession("old-token") },
            refreshSessionProvider = { signedInSession("new-token") },
            transport = transport,
        )

        assertEquals(25, repository.fetchDeviceStatus("device_02")?.oneTimePreKeyCount)
        assertEquals(2, calls)

        val missing = ChatDeviceKeyDirectoryRepository(
            sessionProvider = { signedInSession("access-token") },
            transport = RecordingTransport { _, _, _, _ -> throw MessagesHttpException(HttpURLConnection.HTTP_NOT_FOUND) },
        )
        assertNull(missing.fetchDeviceStatus("device_02"))
    }

    @Test
    fun removalUsesTheAccountScopedDeleteRouteAndRejectsUnsafeDeviceIds() {
        val transport = RecordingTransport { method, path, _, _ ->
            assertEquals("DELETE", method)
            assertEquals("/api/v1/chat/keys/devices/device_03", path)
            JSONObject()
        }
        val repository = ChatDeviceKeyDirectoryRepository(
            sessionProvider = { signedInSession("access-token") },
            transport = transport,
        )
        repository.removeDevice("device_03")
        assertEquals(1, transport.calls)
        assertTrue(runCatching { repository.removeDevice("../other-account") }.isFailure)
    }

    @Test
    fun listsOnlyRequestedUsersAndTheirRegisteredDevices() {
        val userId = "0190f0a0-0000-7000-8000-00000000d001"
        val transport = RecordingTransport { method, path, _, body ->
            assertEquals("POST", method)
            assertEquals("/api/v1/chat/keys/devices/query", path)
            assertEquals(userId, requireNotNull(body).getJSONArray("userIds").getString(0))
            JSONObject().put("data", org.json.JSONArray().put(
                JSONObject().put("userId", userId).put("devices", org.json.JSONArray().put(
                    JSONObject().put("deviceId", "device_04").put("registrationId", 42).put("identityKey", "identity-b64"),
                )),
            ))
        }
        val repository = ChatDeviceKeyDirectoryRepository(
            sessionProvider = { signedInSession("access-token") },
            transport = transport,
        )

        val result = repository.listDevices(listOf(userId))

        assertEquals(userId, result.single().userId)
        assertEquals("device_04", result.single().devices.single().deviceId)
        assertEquals(42, result.single().devices.single().registrationId)
    }

    @Test
    fun claimsOneTimePrekeyBundleUsingTheAuthenticatedContract() {
        val userId = "0190f0a0-0000-7000-8000-00000000d002"
        val deviceId = "device_05"
        val transport = RecordingTransport { method, path, token, body ->
            assertEquals("POST", method)
            assertEquals("/api/v1/chat/keys/bundles", path)
            assertEquals("access-token", token)
            val address = requireNotNull(body).getJSONArray("devices").getJSONObject(0)
            assertEquals(userId, address.getString("userId"))
            assertEquals(deviceId, address.getString("deviceId"))
            JSONObject().put("data", org.json.JSONArray().put(
                JSONObject()
                    .put("userId", userId)
                    .put("deviceId", deviceId)
                    .put("registrationId", 77)
                    .put("identityKey", "identity-b64")
                    .put("signedPreKey", JSONObject().put("keyId", 31).put("publicKey", "signed-b64").put("signature", "signature-b64"))
                    .put("oneTimePreKey", JSONObject().put("keyId", 32).put("publicKey", "one-time-b64")),
            ))
        }
        val repository = ChatDeviceKeyDirectoryRepository(
            sessionProvider = { signedInSession("access-token") },
            transport = transport,
        )

        val bundle = repository.claimPreKeyBundles(listOf(ChatDeviceAddress(userId, deviceId))).single()

        assertEquals(userId, bundle.userId)
        assertEquals(deviceId, bundle.deviceId)
        assertEquals(77, bundle.registrationId)
        assertEquals(31, bundle.signedPreKey.keyId)
        assertEquals(32, bundle.oneTimePreKey?.keyId)
    }

    @Test
    fun rejectsUnexpectedBundleDevicesAndQueriesOutsideServerLimit() {
        val userId = "0190f0a0-0000-7000-8000-00000000d003"
        val repository = ChatDeviceKeyDirectoryRepository(
            sessionProvider = { signedInSession("access-token") },
            transport = RecordingTransport { _, _, _, _ ->
                JSONObject().put("data", org.json.JSONArray().put(
                    JSONObject()
                        .put("userId", userId)
                        .put("deviceId", "other_device")
                        .put("registrationId", 1)
                        .put("identityKey", "identity-b64")
                        .put("signedPreKey", JSONObject().put("keyId", 1).put("publicKey", "signed").put("signature", "signature"))
                        .put("oneTimePreKey", JSONObject.NULL),
                ))
            },
        )

        assertTrue(runCatching { repository.claimPreKeyBundles(listOf(ChatDeviceAddress(userId, "device_06"))) }.isFailure)
        assertTrue(runCatching { repository.listDevices(List(301) { userId }) }.isFailure)
    }

    @Test
    fun chatTransportAllowsOnlyTheExactDeviceLookupAndBundleRoutes() {
        val transport = JdkChatThreadTransport("not-a-trusted-origin")
        val allowed = listOf(
            "/api/v1/chat/keys/devices/query",
            "/api/v1/chat/keys/bundles",
        )
        allowed.forEach { path ->
            val error = runCatching { transport.request("POST", path, "token", JSONObject()) }.exceptionOrNull()
            assertEquals("Configure an HTTPS Nantty API URL to use messages.", error?.message)
        }

        val unsupported = runCatching {
            transport.request("POST", "/api/v1/chat/keys/bundles/extra", "token", JSONObject())
        }.exceptionOrNull()
        assertEquals("Unsupported conversation request.", unsupported?.message)
    }

    private class RecordingTransport(
        private val respond: (String, String, String, JSONObject?) -> JSONObject,
    ) : ChatThreadTransport {
        var calls = 0
            private set

        override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
            calls++
            return respond(method, path, accessToken, body)
        }
    }

    private fun signedInSession(token: String) = AccountSession(
        accessToken = token,
        refreshToken = "refresh-token",
        user = AccountUser("0190f0a0-0000-7000-8000-00000000d001", "Ari", "ari", null, null, emptyList()),
    )

    private fun status(deviceId: String, identityKey: String, signedPreKeyId: Int, count: Int) = JSONObject()
        .put("deviceId", deviceId)
        .put("identityKey", identityKey)
        .put("signedPreKeyId", signedPreKeyId)
        .put("oneTimePreKeyCount", count)
}
