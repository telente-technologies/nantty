package com.nantty.android.data

import android.content.Context
import java.util.UUID

/** Stable pseudonymous identifier used only for the backend's affiliate-click deduplication. */
internal class AffiliateVisitorIdStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun getOrCreate(): String {
        preferences.getString(VISITOR_ID_KEY, null)?.takeIf(::isValidAffiliateVisitorId)?.let { return it }
        return UUID.randomUUID().toString().also { id ->
            check(preferences.edit().putString(VISITOR_ID_KEY, id).commit()) { "Could not save the affiliate visitor identifier." }
        }
    }

    private companion object {
        const val PREFERENCES_NAME = "affiliate_visitor"
        const val VISITOR_ID_KEY = "visitor_id"
    }
}

private fun isValidAffiliateVisitorId(value: String): Boolean =
    value.length in 8..80 && value.all { it.isLetterOrDigit() || it == '-' || it == '_' }
