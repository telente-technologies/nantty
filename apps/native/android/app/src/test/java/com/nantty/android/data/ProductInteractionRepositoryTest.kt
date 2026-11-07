package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

class ProductInteractionRepositoryTest {
    @Test
    fun recordsCategoryAndProductEventsOnlyAfterAnalyticsAndPersonalizationConsent() {
        val requests = mutableListOf<InteractionConnection>()
        val repository = ProductInteractionRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "viewer-token" },
            openConnection = { url ->
                InteractionConnection(url, when {
                    url.path.endsWith("/users/me/consents") -> 200 to """{"data":[{"consentType":"analytics","status":"granted"},{"consentType":"personalization","status":"granted"}]}"""
                    else -> 202 to "{}"
                }).also(requests::add)
            },
        )

        assertTrue(repository.recordCategoryViewed("category-from-api"))
        assertTrue(repository.recordProductClicked("product-from-api"))

        assertEquals(3, requests.size)
        assertEquals("GET", requests[0].requestMethod)
        assertEquals("Bearer viewer-token", requests[0].getRequestProperty("Authorization"))
        assertEvent(requests[1], "category.viewed", "categoryId", "category-from-api")
        assertEvent(requests[2], "product.clicked", "productId", "product-from-api")
    }

    @Test
    fun skipsEventsWhenEitherRequiredConsentIsMissingAndAvoidsInvalidIdentifiers() {
        var requests = 0
        val repository = ProductInteractionRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "viewer-token" },
            openConnection = { url ->
                requests++
                InteractionConnection(url, 200 to """{"data":[{"consentType":"analytics","status":"granted"}]}""")
            },
        )

        assertFalse(repository.recordCategoryViewed("../private"))
        assertFalse(repository.recordCategoryViewed("category-1"))
        assertFalse(repository.recordProductClicked("product-1"))
        assertEquals("Only the consent lookup is sent while personalization consent is absent.", 1, requests)
    }

    @Test
    fun doesNotSendTrackingRequestsForGuestSessions() {
        var opened = false
        val repository = ProductInteractionRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { null },
            openConnection = { opened = true; error("Unexpected request") },
        )
        assertFalse(repository.recordCategoryViewed("category-1"))
        assertFalse(opened)
    }

    @Test
    fun recordsConsentGatedSearchesAndProductClicksWithSearchContext() {
        val requests = mutableListOf<InteractionConnection>()
        val repository = ProductInteractionRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "viewer-token" },
            openConnection = { url ->
                InteractionConnection(url, when {
                    url.path.endsWith("/users/me/consents") -> 200 to """{"data":[{"consentType":"analytics","status":"granted"},{"consentType":"personalization","status":"granted"}]}"""
                    else -> 202 to "{}"
                }).also(requests::add)
            },
        )

        assertTrue(repository.recordSearchPerformed("shoes", 4))
        assertTrue(repository.recordSearchProductClicked("product-1", "shoes", 4))

        val searchPayload = eventPayload(requests[1])
        assertEquals("search.performed", eventName(requests[1]))
        assertEquals("shoes", searchPayload.getString("query"))
        assertEquals(4, searchPayload.getInt("resultCount"))
        val clickPayload = eventPayload(requests[2])
        assertEquals("product.clicked", eventName(requests[2]))
        assertEquals("search", clickPayload.getString("surface"))
        assertEquals("shoes", clickPayload.getString("query"))
        assertEquals(4, clickPayload.getInt("resultCount"))
    }

    @Test
    fun recordsRecommendationClicksWithTheirSurfaceAttribution() {
        val requests = mutableListOf<InteractionConnection>()
        val repository = ProductInteractionRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "viewer-token" },
            openConnection = { url ->
                InteractionConnection(url, when {
                    url.path.endsWith("/users/me/consents") -> 200 to """{"data":[{"consentType":"analytics","status":"granted"},{"consentType":"personalization","status":"granted"}]}"""
                    else -> 202 to "{}"
                }).also(requests::add)
            },
        )

        assertTrue(repository.recordProductClicked("product-1", "mart_recommendations"))

        assertEquals("mart_recommendations", eventPayload(requests.last()).getString("surface"))
    }

    private fun assertEvent(connection: InteractionConnection, eventName: String, payloadKey: String, payloadValue: String) {
        assertEquals("POST", connection.requestMethod)
        assertEquals("https://api.nantty.com/api/v1/analytics/product-interactions", connection.url.toString())
        val row = JSONObject(connection.requestBody.toString(Charsets.UTF_8.name())).getJSONArray("events").getJSONObject(0)
        assertEquals(eventName, row.getString("event"))
        assertEquals(payloadValue, row.getJSONObject("payload").getString(payloadKey))
        assertTrue(row.getString("occurredAt").isNotBlank())
    }

    private fun eventName(connection: InteractionConnection): String =
        JSONObject(connection.requestBody.toString(Charsets.UTF_8.name())).getJSONArray("events").getJSONObject(0).getString("event")

    private fun eventPayload(connection: InteractionConnection): JSONObject =
        JSONObject(connection.requestBody.toString(Charsets.UTF_8.name())).getJSONArray("events").getJSONObject(0).getJSONObject("payload")
}

private class InteractionConnection(url: URL, private val response: Pair<Int, String>) : HttpURLConnection(url) {
    val requestBody = ByteArrayOutputStream()
    override fun getResponseCode(): Int = response.first
    override fun getInputStream() = ByteArrayInputStream(response.second.toByteArray())
    override fun getOutputStream() = requestBody
    override fun getErrorStream() = ByteArrayInputStream(response.second.toByteArray())
    override fun usingProxy(): Boolean = false
    override fun connect() = Unit
    override fun disconnect() = Unit
}
