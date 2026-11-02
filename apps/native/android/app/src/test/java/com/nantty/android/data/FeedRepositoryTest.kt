package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedRepositoryTest {
    @Test
    fun missingBaseUrlFailsClearlyWithoutRequest() {
        val result = FeedRepository("").loadForYou()
        assertTrue(result is FeedResult.Failure)
        assertTrue((result as FeedResult.Failure).message.contains("NANTTY_API_BASE_URL"))
    }

    @Test
    fun rejectsInsecureRemoteBaseUrl() {
        val result = FeedRepository("http://api.example.com").loadForYou()
        assertEquals("Feed unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2).", (result as FeedResult.Failure).message)
    }
}
