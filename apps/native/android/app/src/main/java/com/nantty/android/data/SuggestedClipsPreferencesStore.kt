package com.nantty.android.data

import android.content.Context
import java.security.MessageDigest

/** Account-scoped cooldown for the optional Suggested Clips feed rail. */
internal class SuggestedClipsPreferencesStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun hiddenUntil(accountKey: String, nowMillis: Long = System.currentTimeMillis()): Long =
        preferences.getLong(storageKey(accountKey), 0L).takeIf { it > nowMillis } ?: 0L

    @Synchronized
    fun hideFor(accountKey: String, days: Int, nowMillis: Long = System.currentTimeMillis()): Boolean {
        if (days !in ALLOWED_HIDE_DAYS || accountKey.isBlank() || accountKey.length > MAX_ACCOUNT_KEY_LENGTH) return false
        val durationMillis = days.toLong() * MILLIS_PER_DAY
        val until = (nowMillis + durationMillis).takeIf { it >= nowMillis } ?: Long.MAX_VALUE
        return preferences.edit().putLong(storageKey(accountKey), until).commit()
    }

    private fun storageKey(accountKey: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(accountKey.toByteArray(Charsets.UTF_8))
        return "$ACCOUNT_KEY_PREFIX${digest.joinToString("") { "%02x".format(it) }}"
    }

    private companion object {
        const val PREFERENCES_NAME = "nantty.suggestedClipsPreferences.v1"
        const val ACCOUNT_KEY_PREFIX = "account."
        const val MAX_ACCOUNT_KEY_LENGTH = 200
        const val MILLIS_PER_DAY = 86_400_000L
        val ALLOWED_HIDE_DAYS = setOf(7, 30)
    }
}
