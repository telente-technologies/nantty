package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PushDeviceTokenRepositoryTest {
    @Test
    fun registerUsesNativeAndroidFcmContractAndAuthenticatedSession() {
        val calls = mutableListOf<Call>()
        val repository = PushDeviceTokenRepository(
            sessionProvider = { session("access") },
            transport = { method, path, access, body ->
                calls += Call(method, path, access, body?.let { JSONObject(it.toString()) })
                201
            },
        )

        assertTrue(repository.register("fcm-token-123").isSuccess)
        val call = calls.single()
        assertEquals("POST", call.method)
        assertEquals(PushDeviceTokenRepository.DEVICE_TOKENS_PATH, call.path)
        assertEquals("access", call.accessToken)
        assertEquals("fcm-token-123", call.body?.getString("token"))
        assertEquals("android", call.body?.getString("platform"))
        assertEquals("fcm", call.body?.getString("provider"))
    }

    @Test
    fun unregisterSendsOnlyTokenAndCanInferProviderFromStoredRegistration() {
        var request: Call? = null
        val repository = PushDeviceTokenRepository(
            sessionProvider = { session("access") },
            transport = { method, path, access, body ->
                request = Call(method, path, access, body?.let { JSONObject(it.toString()) })
                204
            },
        )

        assertTrue(repository.unregister("fcm-token-123").isSuccess)
        assertEquals("DELETE", request?.method)
        assertEquals(PushDeviceTokenRepository.DEVICE_TOKENS_PATH, request?.path)
        assertEquals("access", request?.accessToken)
        assertEquals("fcm-token-123", request?.body?.getString("token"))
        assertEquals(1, request?.body?.length())
    }

    @Test
    fun retriesUnauthorizedRequestOnceWithRefreshedSession() {
        val tokens = mutableListOf<String>()
        var requests = 0
        val repository = PushDeviceTokenRepository(
            sessionProvider = { session("expired") },
            refreshSessionProvider = { session("fresh") },
            transport = { _, _, access, _ ->
                tokens += access
                if (requests++ == 0) 401 else 204
            },
        )

        assertTrue(repository.register("fcm-token-123").isSuccess)
        assertEquals(listOf("expired", "fresh"), tokens)
    }

    @Test
    fun rejectsInvalidTokensAndMissingAuthenticationBeforeTransport() {
        var requested = false
        val repository = PushDeviceTokenRepository(
            sessionProvider = { null },
            transport = { _, _, _, _ -> requested = true; 200 },
        )

        assertTrue(repository.register("  ").isFailure)
        assertTrue(repository.register("x".repeat(PushDeviceTokenRepository.MAX_TOKEN_LENGTH + 1)).isFailure)
        assertTrue(repository.register("token").isFailure)
        assertTrue(!requested)
    }

    private fun session(accessToken: String) = AccountSession(
        accessToken = accessToken,
        refreshToken = "refresh",
        user = AccountUser("user-1", "Ada", "ada", null, null, emptyList()),
    )

    private data class Call(val method: String, val path: String, val accessToken: String, val body: JSONObject?)
}
