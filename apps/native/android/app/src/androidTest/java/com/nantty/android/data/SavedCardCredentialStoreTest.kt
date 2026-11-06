package com.nantty.android.data

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SavedCardCredentialStoreTest {
    private val context: Context = ApplicationProvider.getApplicationContext()

    @Test
    fun credentialRoundTripsEncryptedAndCanBeRemoved() {
        val accountId = "saved-card-test-buyer"
        val store = AndroidSavedCardCredentialStore(context) { accountId }
        val card = DeviceSavedCard(UUID.randomUUID().toString(), "Visa", "4242", 8, 2030)

        store.remove()
        store.save(card)

        assertEquals(card, store.readDisplay())
        val records = context.getSharedPreferences("nantty_saved_card_v1", Context.MODE_PRIVATE).all.values
        assertTrue(records.any { it is String && !it.contains(card.savedCardId) && !it.contains(card.last4) })

        store.remove()
        assertNull(store.readDisplay())
        assertNull(store.readSavedCardIdAfterUserConfirmation())
    }

    @Test
    fun invalidCardDataIsRejectedBeforeStorage() {
        val store = AndroidSavedCardCredentialStore(context) { "invalid-card-test-buyer" }
        store.remove()

        val invalid = DeviceSavedCard("../saved-card", "Visa", "4242", 8, 2030)
        assertFalse(runCatching { store.save(invalid) }.isSuccess)
        assertNull(store.readDisplay())
    }

    @Test
    fun savedCardIsIsolatedPerSignedInAccount() {
        val firstAccount = AndroidSavedCardCredentialStore(context) { "buyer-one" }
        val secondAccount = AndroidSavedCardCredentialStore(context) { "buyer-two" }
        val card = DeviceSavedCard(UUID.randomUUID().toString(), "Visa", "4242", 8, 2030)

        firstAccount.remove()
        secondAccount.remove()
        firstAccount.save(card)

        assertEquals(card, firstAccount.readDisplay())
        assertNull(secondAccount.readDisplay())

        firstAccount.remove()
        secondAccount.remove()
    }
}
