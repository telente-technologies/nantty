package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthSessionTest {
    @Test
    fun parsesLoginResponseIncludingAccountRoles() {
        val session = parseAccountSession(mapOf(
            "accessToken" to "access",
            "refreshToken" to "refresh",
            "user" to mapOf(
                "id" to "account-1",
                "name" to "Ari",
                "username" to "ari",
                "email" to "ari@example.com",
                "avatarUrl" to "https://cdn.nantty.com/avatar.png",
                "roles" to listOf("user", "creator"),
            ),
        ))

        assertEquals("access", session?.accessToken)
        assertEquals("refresh", session?.refreshToken)
        assertEquals("account-1", session?.user?.id)
        assertEquals("ari@example.com", session?.user?.email)
        assertEquals(listOf("user", "creator"), session?.user?.roles)
        assertEquals("https://cdn.nantty.com/avatar.png", session?.user?.avatarUrl)
    }

    @Test
    fun parsesDataWrappedResponseAndRejectsInsecureAvatar() {
        val session = parseAccountSession(mapOf("data" to mapOf(
            "accessToken" to "access",
            "refreshToken" to "refresh",
            "user" to mapOf("id" to "a", "name" to "Name", "username" to "name", "avatarUrl" to "http://remote.example/avatar.png"),
        )))
        assertNull(session?.user?.avatarUrl)
    }

    @Test
    fun rejectsMissingRequiredSessionFields() {
        assertNull(parseAccountSession(mapOf("accessToken" to "access", "refreshToken" to "refresh")))
        assertNull(parseAccountSession(mapOf("accessToken" to " ", "refreshToken" to "refresh", "user" to emptyMap<String, Any?>())))
    }

    @Test
    fun refreshRotationPreservesIdentityAndRequiresBothTokens() {
        val original = AccountSession("old-access", "old-refresh", AccountUser("id", "Name", "name", null, null, listOf("user")))
        val next = rotatedSession(original, SessionTokens("new-access", "new-refresh"))
        assertEquals("new-access", next?.accessToken)
        assertEquals("new-refresh", next?.refreshToken)
        assertEquals(original.user, next?.user)
        assertNull(rotatedSession(original, SessionTokens("", "new-refresh")))
    }

    @Test
    fun apiBaseRequiresHttpsExceptLoopbackDevelopmentHosts() {
        assertEquals("https://api.nantty.com", trustedApiOrigin(" https://api.nantty.com/ "))
        assertEquals("http://10.0.2.2:8080", trustedApiOrigin("http://10.0.2.2:8080"))
        assertEquals("http://localhost:3000", trustedApiOrigin("http://localhost:3000"))
        assertNull(trustedApiOrigin("http://api.nantty.com"))
        assertNull(trustedApiOrigin("https://user:password@api.nantty.com"))
        assertNull(trustedApiOrigin("https://api.nantty.com/v1"))
        assertFalse(trustedApiOrigin("https://api.nantty.com?debug=true") != null)
        assertTrue(AuthApi.CONNECT_TIMEOUT_MS in 1..15_000)
        assertTrue(AuthApi.READ_TIMEOUT_MS in 1..20_000)
    }
}
