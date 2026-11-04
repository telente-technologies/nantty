package com.nantty.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class GuestBrowsingPolicyTest {
    @Test
    fun guestNavigationOnlyExposesPublicFeedAndMart() {
        assertEquals(listOf(Destination.Feed, Destination.Mart, Destination.Discover), visibleDestinations(isGuest = true))
    }

    @Test
    fun signedInNavigationRetainsTheExistingDestinationSet() {
        assertEquals(
            listOf(Destination.Feed, Destination.Discover, Destination.Notifications, Destination.Messages, Destination.Wallet, Destination.Profile),
            visibleDestinations(isGuest = false),
        )
    }
}
