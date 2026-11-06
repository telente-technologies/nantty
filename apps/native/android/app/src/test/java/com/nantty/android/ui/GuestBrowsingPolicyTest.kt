package com.nantty.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class GuestBrowsingPolicyTest {
    @Test
    fun guestNavigationOnlyExposesPublicFeedAndMart() {
        assertEquals(listOf(Destination.Feed, Destination.Clips, Destination.Mart, Destination.Discover, Destination.Spaces), visibleDestinations(isGuest = true))
    }

    @Test
    fun signedInNavigationRetainsTheExistingDestinationSet() {
        assertEquals(
            listOf(Destination.Feed, Destination.Clips, Destination.Discover, Destination.Spaces, Destination.Notifications, Destination.Messages, Destination.Wallet, Destination.Profile),
            visibleDestinations(isGuest = false),
        )
    }
}
