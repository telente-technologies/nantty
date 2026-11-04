package com.nantty.android.data

class AccountSessionRepository(
    private val api: AuthSessionApi,
    private val sessionStore: SessionStore,
) {
    @Volatile private var currentSession: AccountSession? = null
    @Volatile private var hasRestored = false

    @Synchronized
    fun restore(): AccountSession? {
        if (hasRestored) return currentSession
        val saved = sessionStore.read()
        if (saved == null) {
            hasRestored = true
            return null
        }
        try {
            val rotated = rotatedSession(saved, api.refresh(saved.refreshToken))
                ?: throw AuthApiException("Nantty returned an incomplete session.")
            sessionStore.write(rotated)
            currentSession = rotated
            hasRestored = true
            return rotated
        } catch (error: AuthApiException) {
            if (error.statusCode == 401 || error.statusCode == 403) {
                sessionStore.clear()
                currentSession = null
                hasRestored = true
            }
            throw error
        } catch (error: AuthNetworkException) {
            throw error
        } catch (_: Exception) {
            sessionStore.clear()
            currentSession = null
            hasRestored = true
            throw AuthApiException("Could not securely update your session. Please sign in again.")
        }
    }

    @Synchronized
    fun signIn(identifier: String, password: String): AccountSession {
        val session = api.login(identifier, password)
        return persistSession(session)
    }

    /** Persists a session created by another first-party auth flow (for example, registration). */
    @Synchronized
    fun signInWithSession(session: AccountSession, rememberOnDevice: Boolean = true): AccountSession {
        if (rememberOnDevice) return persistSession(session)
        sessionStore.clear()
        currentSession = session
        hasRestored = true
        return session
    }

    private fun persistSession(session: AccountSession): AccountSession {
        try {
            sessionStore.write(session)
        } catch (_: Exception) {
            runCatching { api.logout(session.accessToken) }
            throw AuthApiException("Could not securely save your session on this device. Please try again.")
        }
        currentSession = session
        hasRestored = true
        return session
    }

    @Synchronized
    fun signOut() {
        val session = currentSession ?: sessionStore.read()
        try {
            if (session != null) api.logout(session.accessToken)
        } finally {
            sessionStore.clear()
            currentSession = null
            hasRestored = true
        }
    }

    @Synchronized
    fun refreshSession(): AccountSession? {
        val session = currentSession ?: sessionStore.read() ?: return null
        return try {
            val refreshed = rotatedSession(session, api.refresh(session.refreshToken))
                ?: throw AuthApiException("Nantty returned an incomplete session.")
            sessionStore.write(refreshed)
            currentSession = refreshed
            hasRestored = true
            refreshed
        } catch (error: AuthApiException) {
            if (error.statusCode == 401 || error.statusCode == 403) {
                sessionStore.clear()
                currentSession = null
                hasRestored = true
                null
            } else {
                throw error
            }
        }
    }

    fun sessionOrNull(): AccountSession? = currentSession
}
