package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountSessionRepositoryTest {
    @Test
    fun refreshSessionRotatesBothTokensInEncryptedStoreBoundary() {
        val initial = session("old-access", "old-refresh")
        val store = MemorySessionStore(initial)
        val api = FakeAuthApi().apply { refreshed = SessionTokens("new-access", "new-refresh") }
        val repository = AccountSessionRepository(api, store)

        val refreshed = repository.refreshSession()

        assertEquals("new-access", refreshed?.accessToken)
        assertEquals("new-refresh", refreshed?.refreshToken)
        assertEquals(initial.user, refreshed?.user)
        assertEquals(refreshed, store.saved)
    }

    @Test
    fun rejectedRefreshClearsTheSavedSession() {
        val store = MemorySessionStore(session("expired", "revoked"))
        val api = FakeAuthApi().apply { refreshFailure = AuthApiException("expired", 401) }
        val repository = AccountSessionRepository(api, store)

        assertNull(repository.refreshSession())
        assertNull(store.saved)
        assertEquals(1, store.clearCalls)
    }

    @Test
    fun transientRefreshFailurePreservesTheSessionForRetry() {
        val initial = session("access", "refresh")
        val store = MemorySessionStore(initial)
        val api = FakeAuthApi().apply { refreshFailure = AuthNetworkException("offline") }
        val repository = AccountSessionRepository(api, store)

        val failed = runCatching { repository.refreshSession() }

        assertTrue(failed.isFailure)
        assertEquals(initial, store.saved)
        assertEquals(0, store.clearCalls)
    }

    private fun session(access: String, refresh: String) = AccountSession(
        access,
        refresh,
        AccountUser("account-1", "Ari", "ari", null, null, listOf("user")),
    )

    private class MemorySessionStore(var saved: AccountSession?) : SessionStore {
        var clearCalls = 0
        override fun read() = saved
        override fun write(session: AccountSession) { saved = session }
        override fun clear() { clearCalls += 1; saved = null }
    }

    private class FakeAuthApi : AuthSessionApi {
        var refreshed = SessionTokens("access-next", "refresh-next")
        var refreshFailure: Exception? = null
        override fun login(identifier: String, password: String): AccountSession = error("Not used")
        override fun refresh(refreshToken: String): SessionTokens {
            refreshFailure?.let { throw it }
            return refreshed
        }
        override fun logout(accessToken: String) = Unit
    }
}
