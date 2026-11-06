package com.nantty.android.notifications

internal fun mayRegisterPushToken(
    accountPreferenceEnabled: Boolean,
    osPermissionGranted: Boolean,
    firebaseConfigured: Boolean,
): Boolean = accountPreferenceEnabled && osPermissionGranted && firebaseConfigured

internal enum class PushTokenSyncAction { REGISTER, REVOKE, NO_OP }

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
