package com.nantty.android.data

import android.content.Context
import org.json.JSONArray
import java.security.MessageDigest

/** Small, account-scoped local dismissal history for the optional feed suggestion rail. */
internal class FeedSuggestionDismissalsStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun read(accountId: String): Set<String> = decodeFeedSuggestionDismissals(preferences.getString(storageKey(accountId), null))

    @Synchronized
    fun dismiss(accountId: String, suggestedAccountId: String): Boolean {
        if (accountId.isBlank() || !suggestedAccountId.matches(ACCOUNT_ID_PATTERN)) return false
        val key = storageKey(accountId)
        val next = (decodeFeedSuggestionDismissals(preferences.getString(key, null)) + suggestedAccountId)
            .toList()
            .takeLast(MAXIMUM_DISMISSED_ACCOUNTS)
        return preferences.edit().putString(key, JSONArray(next).toString()).commit()
    }

    private fun storageKey(accountId: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(accountId.toByteArray(Charsets.UTF_8))
        return "$ACCOUNT_KEY_PREFIX${digest.joinToString("") { "%02x".format(it) }}"
    }

    companion object {
        private const val PREFERENCES_NAME = "nantty.feedSuggestionPreferences.v1"
        private const val ACCOUNT_KEY_PREFIX = "account."
        const val MAXIMUM_DISMISSED_ACCOUNTS = 200
        internal val ACCOUNT_ID_PATTERN = Regex("[A-Za-z0-9_-]{1,200}")
    }
}

internal fun decodeFeedSuggestionDismissals(raw: String?): Set<String> {
    if (raw.isNullOrBlank()) return emptySet()
    return runCatching {
        val rows = JSONArray(raw)
        buildList {
            for (index in 0 until rows.length()) {
                val id = rows.optString(index).takeIf { it.matches(FeedSuggestionDismissalsStore.ACCOUNT_ID_PATTERN) } ?: continue
                if (id !in this) add(id)
            }
        }.takeLast(FeedSuggestionDismissalsStore.MAXIMUM_DISMISSED_ACCOUNTS).toSet()
    }.getOrDefault(emptySet())
}
