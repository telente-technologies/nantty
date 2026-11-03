package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BuyerOrderDetailRepositoryTest {
    @Test
    fun loadsBuyerScopedDetailWithAuthenticatedExactPathAndParsesSafeFields() {
        val transport = RecordingTransport(detail())
        val result = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)
            .loadDetail("order_123") as BuyerOrderDetailResult.Success

        assertEquals("/api/v1/orders/order_123", transport.path)
        assertEquals("orders-access", transport.token)
        assertEquals("order_123", result.order.id)
        assertEquals("NT-1042", result.order.reference)
        assertEquals("Ari Tech", result.order.storeName)
        assertEquals("Headphones", result.order.items.single().name)
        assertEquals(2, result.order.items.single().quantity)
        assertEquals("Large", result.order.items.single().variant)
        assertEquals(245000L, result.order.totalMinor)
        assertEquals("NGN", result.order.currency)
        assertEquals("Swift", result.order.shipment?.courierName)
        assertEquals("https://carrier.example/track/TRACK-1", result.order.shipment?.trackingUrl)
        assertEquals(1, result.order.delivery?.attempts)
    }

    @Test
    fun ignoresTrackingLinksThatCouldUseUnsafeSchemesOrCredentialSpoofing() {
        val unsafe = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail("https://carrier.example@attacker.example/track")))
            .loadDetail("order_123") as BuyerOrderDetailResult.Success
        val malformed = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail("https:carrier.example/track")))
            .loadDetail("order_123") as BuyerOrderDetailResult.Success

        assertNull(unsafe.order.shipment?.trackingUrl)
        assertNull(malformed.order.shipment?.trackingUrl)
    }

    @Test
    fun rejectsMalformedOrderIdsBeforeMakingNetworkRequest() {
        val transport = RecordingTransport(detail())

        val result = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)
            .loadDetail("../another-buyers-order") as BuyerOrderDetailResult.Failure

        assertEquals("That order could not be found.", result.message)
        assertNull(transport.path)
        assertNull(transport.token)
    }

    @Test
    fun missingSessionDoesNotMakeNetworkRequest() {
        val transport = RecordingTransport(detail())

        val result = BuyerOrdersRepository("https://api.nantty.com", { null }, transport)
            .loadDetail("order_123") as BuyerOrderDetailResult.Failure

        assertTrue(result.message.contains("Sign in"))
        assertNull(transport.path)
    }

    @Test
    fun missingAndForeignBuyerOrdersShareGenericNotFoundPresentation() {
        val missing = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 404))
            .loadDetail("order_123") as BuyerOrderDetailResult.Failure
        val foreign = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 404))
            .loadDetail("order_owned_by_someone_else") as BuyerOrderDetailResult.Failure

        assertEquals(missing.message, foreign.message)
        assertEquals("That order could not be found.", missing.message)
        assertFalse(missing.authenticationRequired)
    }

    @Test
    fun authAndServerFailuresDoNotExposeResponseDetails() {
        val unauthorized = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 401))
            .loadDetail("order_123") as BuyerOrderDetailResult.Failure
        val forbidden = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 403))
            .loadDetail("order_123") as BuyerOrderDetailResult.Failure
        val serverError = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 500))
            .loadDetail("order_123") as BuyerOrderDetailResult.Failure

        assertTrue(unauthorized.authenticationRequired)
        assertTrue(forbidden.authenticationRequired)
        assertEquals("Your session has expired. Sign in again to view this order.", forbidden.message)
        assertEquals("Couldn't load this order. Please try again.", serverError.message)
        assertFalse(serverError.message.contains("private response body"))
    }

    private fun detail(trackingUrl: String = "https://carrier.example/track/TRACK-1") = JSONObject(
        """{"id":"order_123","reference":"NT-1042","status":"shipped","fulfilmentStatus":"in_transit","paymentStatus":"paid","paymentMode":"escrow","items":[{"id":"item_1","product":{"id":"product_1","name":"Headphones"},"quantity":2,"variant":"Large"}],"subtotal":{"amountMinor":250000,"currency":"NGN"},"discount":{"amountMinor":5000,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":245000,"currency":"NGN"},"store":{"id":"store_1","name":"Ari Tech"},"createdAt":"2026-11-02T10:30:00Z","escrowReleaseAt":null,"shipment":{"courierName":"Swift","trackingNumber":"TRACK-1","trackingUrl":"$trackingUrl","shippedAt":"2026-11-02T11:00:00Z","estimatedDeliveryAt":"2026-11-04T11:00:00Z"},"delivery":{"status":"in_transit","riderName":null,"riderPhone":null,"estimatedDeliveryAt":"2026-11-04T11:00:00Z","attempts":1,"lastAttemptNote":null},"promotionIssue":null}""",
    )

    private fun signedInSession() = AccountSession(
        "orders-access", "refresh", AccountUser("buyer-1", "Ari", "ari", null, null, emptyList()),
    )

    private class RecordingTransport(
        private val response: JSONObject,
        private val statusCode: Int = 200,
    ) : BuyerOrdersTransport {
        var path: String? = null
        var token: String? = null

        override fun get(path: String, accessToken: String): JSONObject {
            this.path = path
            token = accessToken
            if (statusCode !in 200..299) throw BuyerOrdersHttpException(statusCode)
            return response
        }
    }
}
