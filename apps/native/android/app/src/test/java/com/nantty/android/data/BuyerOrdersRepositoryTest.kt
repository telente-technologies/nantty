package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BuyerOrdersRepositoryTest {
    @Test
    fun loadsOnlyAuthenticatedBuyerOrdersAndParsesCursorPage() {
        val transport = RecordingTransport(page())
        val repository = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)

        val result = repository.load() as BuyerOrdersResult.Success

        assertEquals("GET", transport.method)
        assertEquals("/api/v1/orders?limit=20", transport.path)
        assertEquals("orders-access", transport.token)
        assertEquals("order-1", result.page.orders.single().id)
        assertEquals("Wireless headphones, Case", result.page.orders.single().itemSummary)
        assertEquals(245000L, result.page.orders.single().totalMinor)
        assertEquals("cursor-2", result.page.nextCursor)
    }

    @Test
    fun addsOnlySupportedStatusAndEncodedCursorFilters() {
        val transport = RecordingTransport(JSONObject("""{"data":[],"nextCursor":null}"""))
        val repository = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)

        repository.load(BuyerOrderFilter.TO_SHIP, "cursor /+=")

        assertEquals("/api/v1/orders?limit=20&status=to_ship&cursor=cursor%20%2F%2B%3D", transport.path)
    }

    @Test
    fun doesNotCallTransportWithoutAnAccessSession() {
        val transport = RecordingTransport(page())
        val result = BuyerOrdersRepository("https://api.nantty.com", { null }, transport).load() as BuyerOrdersResult.Failure

        assertTrue(result.message.contains("Sign in"))
        assertEquals(null, transport.path)
        assertEquals(null, transport.token)
    }

    @Test
    fun unauthorizedResponseOffersAuthenticationRecovery() {
        val transport = RecordingTransport(page(), statusCode = 401)
        val result = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport).load() as BuyerOrdersResult.Failure

        assertTrue(result.authenticationRequired)
        assertTrue(result.message.contains("session has expired"))
    }

    @Test
    fun parsesEmptyPageAndFallbackDisplayFieldsWithoutInventingMoney() {
        val repository = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(page(empty = true)))
        val result = repository.load() as BuyerOrdersResult.Success

        assertTrue(result.page.orders.isEmpty())
        assertEquals(null, result.page.nextCursor)
        assertFalse(buildBuyerOrdersPath(BuyerOrderFilter.ALL).contains("status="))
    }

    private fun page(empty: Boolean = false) = JSONObject(
        if (empty) """{"data":[],"nextCursor":null}"""
        else """{"data":[{"id":"order-1","reference":"NT-1042","status":"shipped","paymentStatus":"paid","store":{"name":"Ari Tech"},"items":[{"product":{"name":"Wireless headphones"},"quantity":1},{"product":{"name":"Case"},"quantity":2}],"total":{"amountMinor":245000,"currency":"NGN"},"createdAt":"2026-11-02T10:30:00Z"}],"nextCursor":"cursor-2"}""",
    )

    private fun signedInSession() = AccountSession(
        "orders-access", "refresh", AccountUser("buyer-1", "Ari", "ari", null, null, emptyList()),
    )

    private class RecordingTransport(
        private val response: JSONObject,
        private val statusCode: Int = 200,
    ) : BuyerOrdersTransport {
        var method: String? = null
        var path: String? = null
        var token: String? = null

        override fun get(path: String, accessToken: String): JSONObject {
            method = "GET"
            this.path = path
            token = accessToken
            if (statusCode !in 200..299) throw BuyerOrdersHttpException(statusCode)
            return response
        }
    }
}
