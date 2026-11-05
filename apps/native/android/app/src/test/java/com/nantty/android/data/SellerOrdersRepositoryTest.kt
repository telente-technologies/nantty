package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SellerOrdersRepositoryTest {
    @Test
    fun loadsAuthenticatedSellerOrderListAndCountsFromRnEndpoint() {
        var path: String? = null
        var token: String? = null
        val repository = repository { requestPath, accessToken ->
            path = requestPath
            token = accessToken
            JSONObject("""{"data":[${orderJson()}],"nextCursor":"cursor/next","countsByStatus":{"new":1,"shipped":2}}""")
        }

        val page = repository.load().success<SellerOrdersPage>()

        assertEquals(SellerOrdersRepository.SELLER_ORDERS_PATH, path)
        assertEquals("seller-access", token)
        assertEquals("cursor/next", page.nextCursor)
        assertEquals(mapOf("new" to 1, "shipped" to 2), page.countsByStatus)
        assertEquals("order-123", page.orders.single().id)
        assertEquals("buyer-123", page.orders.single().buyer.id)
        assertEquals("Canvas bag", page.orders.single().lines.single().name)
        assertEquals("creator-1", page.orders.single().attributedCreator?.id)
    }

    @Test
    fun fetchesAuthenticatedDetailAndParsesSellerFields() {
        var path: String? = null
        var token: String? = null
        val repository = repository { requestPath, accessToken ->
            path = requestPath
            token = accessToken
            JSONObject("""{"data":${orderJson()}}""")
        }

        val order = repository.loadDetail("order-123").success<SellerOrder>()

        assertEquals("/api/v1/seller/orders/order-123", path)
        assertEquals("/api/v1/seller/orders/order%2F123%20%3F", buildSellerOrderDetailPath("order/123 ?"))
        assertEquals("seller-access", token)
        assertEquals("order-123", order.id)
        assertEquals("INV-123", order.invoiceNumber)
        assertEquals("Ada Buyer", order.buyer.name)
        assertEquals("08000000000", order.shippingAddress.phone)
        assertEquals(125_000L, order.total.amountMinor)
        assertEquals("NGN", order.total.currency)
        assertEquals("GIG", order.fulfilment?.courier)
        assertEquals("in_transit", order.delivery.status)
        assertEquals("Order paid", order.timeline.single().summary)
        assertEquals("Keep at front desk", order.notes.single().body)
    }

    @Test
    fun signedOutAndEmptyAccessTokenFailWithoutCallingTransport() {
        var called = false
        val transport = SellerOrdersTransport { _, _ ->
            called = true
            JSONObject()
        }
        val signedOut = SellerOrdersRepository("https://api.nantty.com", { null }, transport).load().failure()
        val noToken = SellerOrdersRepository(
            "https://api.nantty.com",
            { signedInSession().copy(accessToken = " ") },
            transport,
        ).loadDetail("order-123").failure()

        assertTrue(signedOut.authenticationRequired)
        assertTrue(noToken.authenticationRequired)
        assertFalse(called)
    }

    @Test
    fun rejectsInvalidOrderIdsBeforeNetworkAndMapsForbiddenResponseToAuthFailure() {
        var called = false
        val transport = SellerOrdersTransport { _, _ ->
            called = true
            throw SellerOrdersHttpException(403)
        }
        val repository = SellerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)

        assertTrue(repository.loadDetail("bad\u0000id").failure().message.isNotBlank())
        assertFalse(called)
        assertTrue(repository.loadDetail("order-123").failure().authenticationRequired)
    }

    @Test
    fun malformedSellerOrderPayloadFailsInsteadOfFillingMissingValues() {
        val repository = repository { _, _ -> JSONObject("""{"data":[{}],"nextCursor":null,"countsByStatus":{}}""") }

        assertTrue(repository.load().failure().message.isNotBlank())
    }

    private fun repository(transport: SellerOrdersTransport) = SellerOrdersRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = ::signedInSession,
        transport = transport,
    )

    private fun SellerOrdersResult<*>.failure() = this as SellerOrdersResult.Failure
    private inline fun <reified T> SellerOrdersResult<*>.success() = (this as SellerOrdersResult.Success<T>).value

    companion object {
        private fun orderJson() = """{
          "id":"order-123","orderNumber":"NAN-123","invoiceNumber":"INV-123",
          "buyer":{"id":"buyer-123","name":"Ada Buyer","username":"ada","phone":"08000000000"},
          "shippingAddress":{"recipientName":"Ada Buyer","phone":"08000000000","line1":"1 Main St","city":"Lagos","state":"Lagos","country":"NG"},
          "lines":[{"id":"line-1","productId":"product-1","variantId":"variant-1","name":"Canvas bag","variantTitle":"Blue","sku":"BAG-BLUE","imageUrl":"https://cdn.nantty.com/bag.jpg","quantity":1,"unitPrice":{"amountMinor":125000,"currency":"NGN"},"lineTotal":{"amountMinor":125000,"currency":"NGN"}}],
          "subtotal":{"amountMinor":125000,"currency":"NGN"},"discount":{"amountMinor":0,"currency":"NGN"},
          "storeCredit":{"amountMinor":0,"currency":"NGN"},"shippingFee":{"amountMinor":0,"currency":"NGN"},
          "total":{"amountMinor":125000,"currency":"NGN"},"sellerPayout":{"amountMinor":125000,"currency":"NGN"},
          "status":"shipped","escrowStatus":"held","escrowReleaseAt":null,
          "fulfilment":{"courier":"GIG","trackingNumber":"TRACK-1","trackingUrl":"https://track.example/1","shippedAt":"2026-11-01T10:00:00Z","fromLocationId":"location-1"},
          "attributedCreator":{"id":"creator-1","username":"maker"},"createdAt":"2026-10-31T10:00:00Z","deliveredAt":null,
          "paymentStatus":"paid","paymentMode":"escrow","paymentProvider":"transfer","paymentReference":"PAY-1","paidAt":"2026-10-31T10:01:00Z",
          "refundedAmount":{"amountMinor":0,"currency":"NGN"},"refunds":[],
          "delivery":{"status":"in_transit","riderName":null,"riderPhone":null,"estimatedDeliveryAt":null,"attempts":0,"lastAttemptNote":null},
          "timeline":[{"id":"event-1","kind":"paid","summary":"Order paid","actorName":"Ada","createdAt":"2026-10-31T10:01:00Z"}],
          "notes":[{"id":"note-1","body":"Keep at front desk","authorName":"Seller","createdAt":"2026-10-31T10:02:00Z"}],"conversationId":"conversation-1"
        }"""

        private fun signedInSession() = AccountSession(
            "seller-access", "seller-refresh", AccountUser("seller-1", "Seller", "seller", null, null, listOf("seller")),
        )
    }
}
