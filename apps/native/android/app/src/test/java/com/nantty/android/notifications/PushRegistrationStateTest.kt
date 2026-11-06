package com.nantty.android.notifications

import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class PushRegistrationStateTest {
    @Test
    fun rotatedTokenIsUnregisteredBeforeNewTokenIsRegisteredAndStored() {
        val events = mutableListOf<String>()

        val synced = syncRotatedPushToken(
            previousToken = "old-token",
            currentToken = "new-token",
            unregister = { token -> events += "unregister:$token"; Result.success(Unit) },
            register = { token -> events += "register:$token"; Result.success(Unit) },
            store = { token -> events += "store:$token" },
        )

        assertTrue(synced)
        assertEquals(listOf("unregister:old-token", "register:new-token", "store:new-token"), events)
    }

    @Test
    fun failedOldTokenCleanupRetriesWithoutRegisteringOrStoringNewToken() {
        val events = mutableListOf<String>()

        val synced = syncRotatedPushToken(
            previousToken = "old-token",
            currentToken = "new-token",
            unregister = { token -> events += "unregister:$token"; Result.failure(IOException("network")) },
            register = { token -> events += "register:$token"; Result.success(Unit) },
            store = { token -> events += "store:$token" },
        )

        assertFalse(synced)
        assertEquals(listOf("unregister:old-token"), events)
    }

    @Test
    fun sameTokenDoesNotUnregisterAndRegistrationFailureLeavesStoredTokenUntouched() {
        val events = mutableListOf<String>()

        val synced = syncRotatedPushToken(
            previousToken = "same-token",
            currentToken = "same-token",
            unregister = { token -> events += "unregister:$token"; Result.success(Unit) },
            register = { token -> events += "register:$token"; Result.failure(IOException("network")) },
            store = { token -> events += "store:$token" },
        )

        assertFalse(synced)
        assertEquals(listOf("register:same-token"), events)
    }

    @Test
    fun tokenRegistrationRequiresAccountOptInOsPermissionAndFirebaseProjectConfig() {
        assertFalse(mayRegisterPushToken(false, true, true))
        assertFalse(mayRegisterPushToken(true, false, true))
        assertFalse(mayRegisterPushToken(true, true, false))
        assertTrue(mayRegisterPushToken(true, true, true))
    }

    @Test
    fun notificationTapRecognizesAppGeneratedAndFirebaseSystemNotifications() {
        assertTrue(isNotificationInboxTap(true, emptySet()))
        assertTrue(isNotificationInboxTap(false, setOf("google.message_id")))
        assertTrue(isNotificationInboxTap(false, setOf("gcm.notification.e")))
        assertFalse(isNotificationInboxTap(false, setOf("android.intent.action.MAIN")))
    }

    @Test
    fun incompleteFirebaseProjectConfigGracefullyNoOps() {
        assertFalse(FirebaseProjectConfig("", "", "", "").isComplete)
        assertTrue(FirebaseProjectConfig("app-id", "api-key", "project", "sender").isComplete)
    }

    @Test
    fun storedRegistrationIsRevokedWhenFirebaseConfigIsUnavailable() {
        assertEquals(
            PushTokenSyncAction.REVOKE,
            pushTokenSyncAction(
                accountPreferenceEnabled = true,
                osPermissionGranted = true,
                firebaseConfigured = false,
                hasStoredRegistration = true,
            ),
        )
        assertEquals(
            PushTokenSyncAction.NO_OP,
            pushTokenSyncAction(
                accountPreferenceEnabled = true,
                osPermissionGranted = true,
                firebaseConfigured = false,
                hasStoredRegistration = false,
            ),
        )
        assertEquals(
            "Sign-out must revoke the stored server token even after Firebase configuration is removed.",
            PushTokenSyncAction.REVOKE,
            pushTokenSyncAction(
                accountPreferenceEnabled = false,
                osPermissionGranted = false,
                firebaseConfigured = false,
                hasStoredRegistration = true,
            ),
        )
    }

    @Test
    fun accountOptOutRevokesExistingRegistrationWithoutBlockingPreferenceState() {
        assertEquals(
            PushTokenSyncAction.REVOKE,
            pushTokenSyncAction(
                accountPreferenceEnabled = false,
                osPermissionGranted = true,
                firebaseConfigured = true,
                hasStoredRegistration = true,
            ),
        )
    }
}
