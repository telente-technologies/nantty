package com.nantty.android.ui

import com.nantty.android.data.ConnectionFilter
import com.nantty.android.data.ConnectionListPreference
import com.nantty.android.data.ConnectionSort
import com.nantty.android.data.ProfileConnection
import java.text.Collator
import java.util.Locale

internal fun sortAndFilterConnections(
    entries: List<ProfileConnection>,
    preference: ConnectionListPreference,
    showRelationshipFilter: Boolean,
    locale: Locale = Locale.getDefault(),
): List<ProfileConnection> {
    val filtered = if (!showRelationshipFilter) entries else entries.filter { entry ->
        val follows = entry.isFollowing || entry.followState == "accepted"
        when (preference.filter) {
            ConnectionFilter.ALL -> true
            ConnectionFilter.FOLLOWING -> follows
            ConnectionFilter.FOLLOWERS -> entry.followsYou
            ConnectionFilter.MUTUAL -> follows && entry.followsYou
        }
    }

    return when (preference.sort) {
        ConnectionSort.RECENT -> filtered
        ConnectionSort.NAME -> {
            val collator = Collator.getInstance(locale).apply { strength = Collator.PRIMARY }
            filtered.sortedWith { first, second -> collator.compare(first.name, second.name) }
        }
        ConnectionSort.MUTUAL -> filtered.sortedByDescending(ProfileConnection::mutualConnections)
    }
}
