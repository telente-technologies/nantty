package com.nantty.android.ui

import com.nantty.android.data.ConnectionFilter
import com.nantty.android.data.ConnectionListPreference
import com.nantty.android.data.ConnectionSort
import com.nantty.android.data.ProfileConnection
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale

class ConnectionListOrderingTest {
    private val people = listOf(
        person("c", "chidi", isFollowing = true, followsYou = false, mutualConnections = 2),
        person("a", "Ada", isFollowing = true, followsYou = true, mutualConnections = 9),
        person("b", "Bola", isFollowing = false, followsYou = true, mutualConnections = 5),
    )

    @Test
    fun defaultSortPreservesServerOrder() {
        assertEquals(listOf("c", "a", "b"), sort(ConnectionSort.RECENT).map(ProfileConnection::id))
    }

    @Test
    fun nameSortIsCaseInsensitiveAndLocaleAware() {
        assertEquals(listOf("a", "b", "c"), sort(ConnectionSort.NAME).map(ProfileConnection::id))
    }

    @Test
    fun mutualSortIsDescendingAndStableForTies() {
        val tied = people + person("d", "Dami", isFollowing = false, followsYou = false, mutualConnections = 5)
        assertEquals(
            listOf("a", "b", "d", "c"),
            sortAndFilterConnections(tied, ConnectionListPreference(sort = ConnectionSort.MUTUAL), true).map(ProfileConnection::id),
        )
    }

    @Test
    fun relationshipFiltersMatchReactNativeSemantics() {
        assertEquals(listOf("c", "a"), filter(ConnectionFilter.FOLLOWING).map(ProfileConnection::id))
        assertEquals(listOf("a", "b"), filter(ConnectionFilter.FOLLOWERS).map(ProfileConnection::id))
        assertEquals(listOf("a"), filter(ConnectionFilter.MUTUAL).map(ProfileConnection::id))
    }

    @Test
    fun blockedListsIgnoreRelationshipFiltersButStillAllowSorting() {
        val preference = ConnectionListPreference(sort = ConnectionSort.NAME, filter = ConnectionFilter.MUTUAL)
        assertEquals(
            listOf("a", "b", "c"),
            sortAndFilterConnections(people, preference, showRelationshipFilter = false, locale = Locale.US).map(ProfileConnection::id),
        )
    }

    private fun sort(sort: ConnectionSort) = sortAndFilterConnections(
        entries = people,
        preference = ConnectionListPreference(sort = sort),
        showRelationshipFilter = true,
        locale = Locale.US,
    )

    private fun filter(filter: ConnectionFilter) = sortAndFilterConnections(
        entries = people,
        preference = ConnectionListPreference(filter = filter),
        showRelationshipFilter = true,
        locale = Locale.US,
    )

    private fun person(id: String, name: String, isFollowing: Boolean, followsYou: Boolean, mutualConnections: Int) = ProfileConnection(
        id = id,
        name = name,
        username = id,
        avatarUrl = null,
        isFollowing = isFollowing,
        followState = if (isFollowing) "accepted" else "none",
        verified = false,
        followsYou = followsYou,
        mutualConnections = mutualConnections,
    )
}
