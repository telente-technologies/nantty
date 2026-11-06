package com.nantty.android.ui

import com.nantty.android.data.StoryAdDestination
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.net.URI

class StoryAdDestinationRouteTest {
    @Test
    fun mapsEverySupportedInAppStoryAdDestination() {
        assertEquals(StoryAdDestinationRoute.Product("product-1"), StoryAdDestination("product", "product-1", null).toRoute())
        assertEquals(StoryAdDestinationRoute.Store("store-1"), StoryAdDestination("store", "store-1", null).toRoute())
        assertEquals(StoryAdDestinationRoute.Post("post-1"), StoryAdDestination("post", "post-1", null).toRoute())
        assertEquals(StoryAdDestinationRoute.Profile("profile-1"), StoryAdDestination("profile", "profile-1", null).toRoute())
        assertEquals(StoryAdDestinationRoute.Messages, StoryAdDestination("messages", null, null).toRoute())
    }

    @Test
    fun routesTrustedHttpsDestinationsForBothUrlKinds() {
        assertEquals(
            StoryAdDestinationRoute.External(URI("https://advertiser.example/campaign")),
            StoryAdDestination("url", null, "https://advertiser.example/campaign").toRoute(),
        )
        assertEquals(
            StoryAdDestinationRoute.External(URI("https://play.google.com/store/apps/details?id=example")),
            StoryAdDestination("app_store", null, "https://play.google.com/store/apps/details?id=example").toRoute(),
        )
    }

    @Test
    fun rejectsUnsupportedOrUnsafeDestinations() {
        assertNull(StoryAdDestination("unknown", "id", null).toRoute())
        assertNull(StoryAdDestination("product", "  ", null).toRoute())
        assertNull(StoryAdDestination("url", null, "javascript:alert(1)").toRoute())
        assertNull(StoryAdDestination("app_store", null, "https://user:secret@store.example/path").toRoute())
        assertNull(StoryAdDestination("url", null, "https://store.example/path#fragment").toRoute())
    }
}
