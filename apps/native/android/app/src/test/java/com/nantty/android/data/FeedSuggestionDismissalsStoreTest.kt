package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Test
import org.json.JSONArray

class FeedSuggestionDismissalsStoreTest {
    @Test
    fun decoderRejectsUnsafeIdsAndDeduplicatesValues() {
        val ids = decodeFeedSuggestionDismissals(JSONArray(listOf("user_1", "user_1", "unsafe/id", "a".repeat(201))).toString())

        assertEquals(setOf("user_1"), ids)
    }

    @Test
    fun decoderKeepsOnlyTheMostRecentTwoHundredDismissals() {
        val raw = JSONArray((1..250).map { "user_$it" }).toString()

        val ids = decodeFeedSuggestionDismissals(raw)

        assertEquals(FeedSuggestionDismissalsStore.MAXIMUM_DISMISSED_ACCOUNTS, ids.size)
        assertEquals(false, "user_1" in ids)
        assertEquals(true, "user_250" in ids)
    }

    @Test
    fun decoderTreatsMalformedStorageAsEmpty() {
        assertEquals(emptySet<String>(), decodeFeedSuggestionDismissals("not-json"))
    }
}
