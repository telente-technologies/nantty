package com.nantty.android.notifications

import android.content.Context
import java.security.MessageDigest

/** Keeps only the last token registered for an account so opt-out/sign-out can revoke it. */
internal class PushTokenStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun read(accountId: String): String? = preferences.getString(key(accountId), null)

    fun write(accountId: String, token: String) {
        check(preferences.edit().putString(key(accountId), token).commit()) {
            "Could not save the push registration state."
        }
    }

    fun clear(accountId: String) {
        preferences.edit().remove(key(accountId)).commit()
    }

    private fun key(accountId: String): String {
        require(accountId.isNotBlank())
        val digest = MessageDigest.getInstance("SHA-256").digest(accountId.toByteArray(Charsets.UTF_8))
        return "token_${digest.joinToString("") { "%02x".format(it) }}"
    }

    private companion object {
        const val PREFERENCES = "nantty_native_push_registration_v1"
    }
}
