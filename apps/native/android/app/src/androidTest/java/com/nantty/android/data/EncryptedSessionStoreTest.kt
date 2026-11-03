package com.nantty.android.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EncryptedSessionStoreTest {
    @Test
    fun sessionRoundTripsEncryptedAndClearRemovesIt() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val preferences = context.getSharedPreferences("nantty_account_session_v1", 0)
        preferences.edit().clear().commit()
        val store = EncryptedSessionStore(context)
        val session = AccountSession("access-secret-sentinel", "refresh-secret-sentinel", AccountUser("user-1", "Ari", "ari", "ari@example.com", null, listOf("user")))

        store.write(session)
        val storedValue = preferences.getString("encrypted_session", "").orEmpty()
        assertFalse(storedValue.contains(session.accessToken))
        assertFalse(storedValue.contains(session.refreshToken))
        assertEquals(session, store.read())

        store.clear()
        assertNull(store.read())
    }
}
