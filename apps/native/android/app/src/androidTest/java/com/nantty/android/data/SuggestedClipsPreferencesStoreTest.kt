package com.nantty.android.data

import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SuggestedClipsPreferencesStoreTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun hideCooldownIsAccountScopedAndExpiresAtItsRecordedTime() {
        val store = SuggestedClipsPreferencesStore(context)
        val account = "suggested-clips-test-account-${System.nanoTime()}"
        val now = 1_800_000_000_000L

        assertTrue(store.hideFor(account, days = 7, nowMillis = now))
        assertEquals(now + 7 * 86_400_000L, store.hiddenUntil(account, nowMillis = now))
        assertEquals(0L, store.hiddenUntil("another-account", nowMillis = now))
        assertEquals(0L, store.hiddenUntil(account, nowMillis = now + 7 * 86_400_000L))
    }

    @Test
    fun onlySupportedDurationsAndSafeAccountKeysAreStored() {
        val store = SuggestedClipsPreferencesStore(context)
        val now = 1_800_000_000_000L

        assertFalse(store.hideFor("account", days = 14, nowMillis = now))
        assertFalse(store.hideFor(" ", days = 7, nowMillis = now))
        assertFalse(store.hideFor("a".repeat(201), days = 30, nowMillis = now))
        assertEquals(0L, store.hiddenUntil("account", nowMillis = now))
    }
}
