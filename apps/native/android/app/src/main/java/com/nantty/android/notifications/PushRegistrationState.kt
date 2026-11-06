package com.nantty.android.notifications

internal fun mayRegisterPushToken(
    accountPreferenceEnabled: Boolean,
    osPermissionGranted: Boolean,
    firebaseConfigured: Boolean,
): Boolean = accountPreferenceEnabled && osPermissionGranted && firebaseConfigured

internal enum class PushTokenSyncAction { REGISTER, REVOKE, NO_OP }

/** Removes an account's previous server registration before publishing a rotated FCM token. */
internal fun syncRotatedPushToken(
    previousToken: String?,
    currentToken: String,
    unregister: (String) -> Result<Unit>,
    register: (String) -> Result<Unit>,
    store: (String) -> Unit,
): Boolean {
    if (!previousToken.isNullOrBlank() && previousToken != currentToken) {
        if (unregister(previousToken).isFailure) return false
    }
    if (register(currentToken).isFailure) return false
    store(currentToken)
    return true
}

internal fun pushTokenSyncAction(
    accountPreferenceEnabled: Boolean,
    osPermissionGranted: Boolean,
    firebaseConfigured: Boolean,
    hasStoredRegistration: Boolean,
): PushTokenSyncAction = when {
    !firebaseConfigured && hasStoredRegistration -> PushTokenSyncAction.REVOKE
    !firebaseConfigured -> PushTokenSyncAction.NO_OP
    mayRegisterPushToken(accountPreferenceEnabled, osPermissionGranted, firebaseConfigured) -> PushTokenSyncAction.REGISTER
    hasStoredRegistration -> PushTokenSyncAction.REVOKE
    else -> PushTokenSyncAction.NO_OP
}

internal fun isNotificationInboxTap(explicitPushExtra: Boolean, intentExtraKeys: Set<String>): Boolean =
    explicitPushExtra || intentExtraKeys.any { it == "google.message_id" || it.startsWith("gcm.notification.") }
