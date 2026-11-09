package com.nantty.android.data

import android.content.Context
import java.security.MessageDigest

/** Persists per-account feed-card frequency state; no profile or verification data is cached here. */
internal class GetVerifiedCardPreferencesStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun read(accountId: String): GetVerifiedCardHistory {
        if (!isValidAccountId(accountId)) return GetVerifiedCardHistory()
        val key = storageKey(accountId)
        return GetVerifiedCardHistory(
            lastImpressionAt = preferences.getLong("$key.lastImpressionAt", 0L).takeIf { it > 0L },
            dismissalsSinceSnooze = preferences.getInt("$key.dismissals", 0).coerceIn(0, GetVerifiedCardFrequency.DISMISSALS_BEFORE_SNOOZE - 1),
            snoozedUntil = preferences.getLong("$key.snoozedUntil", 0L).takeIf { it > 0L },
            neverShowAgain = preferences.getBoolean("$key.neverShowAgain", false),
        )
    }

    @Synchronized
    fun write(accountId: String, history: GetVerifiedCardHistory): Boolean {
        if (!isValidAccountId(accountId)) return false
        val key = storageKey(accountId)
        return preferences.edit()
            .putLong("$key.lastImpressionAt", history.lastImpressionAt ?: 0L)
            .putInt("$key.dismissals", history.dismissalsSinceSnooze.coerceIn(0, GetVerifiedCardFrequency.DISMISSALS_BEFORE_SNOOZE - 1))
            .putLong("$key.snoozedUntil", history.snoozedUntil ?: 0L)
            .putBoolean("$key.neverShowAgain", history.neverShowAgain)
            .commit()
    }

    private fun storageKey(accountId: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(accountId.toByteArray(Charsets.UTF_8))
        return "$ACCOUNT_KEY_PREFIX${digest.joinToString("") { "%02x".format(it) }}"
    }

    private fun isValidAccountId(value: String) = value.isNotBlank() && value.length <= MAX_ACCOUNT_ID_LENGTH

    private companion object {
        const val PREFERENCES_NAME = "nantty.getVerifiedCardPreferences.v1"
        const val ACCOUNT_KEY_PREFIX = "account."
        const val MAX_ACCOUNT_ID_LENGTH = 200
    }
}
