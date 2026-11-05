package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SellerShipmentRepositoryTest {
    @Test
    fun choosesActiveDefaultPostsShipmentAndReturnsCanonicalRefetchedOrder() {
        val calls = mutableListOf<ShipmentCall>()
        val repository = repository { method, path, token, body, key ->
            calls += ShipmentCall(method, path, token, body, key)
            when (path) {
                SellerShipmentRepository.LOCATIONS_PATH -> JSONObject(
                    """{"data":[{"id":"$LOCATION_INACTIVE","active":false,"isDefault":true},{"id":"$LOCATION_ACTIVE","active":true,"isDefault":false},{"id":"$LOCATION_DEFAULT","active":true,"isDefault":true}]}""",
                )
                "/api/v1/seller/orders/$ORDER_ID/fulfilment" -> JSONObject("""{"data":{"accepted":true}}""")
                "/api/v1/seller/orders/$ORDER_ID" -> JSONObject("""{"data":${orderJson()}}""")
                else -> error("Unexpected path $path")
            }
        }

        val order = repository.markAsShipped(
            ORDER_ID,
            SellerShipmentInput("  Swift Courier  ", "TRACK-432", " https://track.example/abc "),
            "shipment_key_01",
        ).success()

        assertEquals("shipped", order.status)
        assertEquals(3, calls.size)
        assertEquals("GET", calls[0].method)
        assertEquals(SellerShipmentRepository.LOCATIONS_PATH, calls[0].path)
        assertEquals("seller-access", calls[0].token)
        assertEquals("POST", calls[1].method)
        assertEquals("/api/v1/seller/orders/$ORDER_ID/fulfilment", calls[1].path)
        assertEquals("shipment_key_01", calls[1].idempotencyKey)
        assertEquals("Swift Courier", calls[1].body?.getString("courier"))
        assertEquals("TRACK-432", calls[1].body?.getString("trackingNumber"))
        assertEquals("https://track.example/abc", calls[1].body?.getString("trackingUrl"))
        assertEquals(LOCATION_DEFAULT, calls[1].body?.getString("fromLocationId"))
        assertEquals("GET", calls[2].method)
        assertEquals("/api/v1/seller/orders/$ORDER_ID", calls[2].path)
    }

    @Test
    fun fallsBackToFirstActiveLocationAndOmitsBlankOptionalTrackingUrl() {
        var posted: JSONObject? = null
        val repository = repository { _, path, _, body, _ ->
            when (path) {
                SellerShipmentRepository.LOCATIONS_PATH -> JSONObject(
                    """{"data":[{"id":"$LOCATION_INACTIVE","active":false,"isDefault":true},{"id":"$LOCATION_ACTIVE","active":true,"isDefault":false}]}""",
                )
                "/api/v1/seller/orders/$ORDER_ID/fulfilment" -> {
                    posted = body
                    JSONObject()
                }
                else -> JSONObject("""{"data":${orderJson()}}""")
            }
        }

        assertTrue(repository.markAsShipped(ORDER_ID, SellerShipmentInput("GIG", "ABCD", "  "), "retry_key_02").success().status == "shipped")
        assertEquals(LOCATION_ACTIVE, posted?.getString("fromLocationId"))
        assertFalse(posted?.has("trackingUrl") ?: true)
    }

    @Test
    fun invalidOrderLocationTrackingUrlAndIdempotencyAreRejectedBeforeWrite() {
        var writes = 0
        val transport = SellerShipmentTransport { method, path, _, _, _ ->
            if (method == "POST") writes++
            if (path == SellerShipmentRepository.LOCATIONS_PATH) {
                JSONObject("""{"data":[{"id":"$LOCATION_DEFAULT","active":true,"isDefault":true}]}""")
            } else JSONObject("""{"data":${orderJson()}}""")
        }
        val repository = SellerShipmentRepository("https://api.nantty.com", ::shipmentSession, transport)

        assertTrue(repository.markAsShipped("not-a-uuid", SellerShipmentInput("GIG", "ABCD"), "shipment_key_01").failure().message.isNotBlank())
        assertTrue(repository.markAsShipped(ORDER_ID, SellerShipmentInput("GIG", "abc_"), "shipment_key_01").failure().message.isNotBlank())
        assertTrue(repository.markAsShipped(ORDER_ID, SellerShipmentInput("GIG", "ABCD", "http://track.example"), "shipment_key_01").failure().message.isNotBlank())
        assertTrue(repository.markAsShipped(ORDER_ID, SellerShipmentInput("GIG", "ABCD", "https://user:pass@track.example"), "shipment_key_01").failure().message.isNotBlank())
        assertTrue(repository.markAsShipped(ORDER_ID, SellerShipmentInput("GIG", "ABCD"), "bad key").failure().message.isNotBlank())
        assertEquals(0, writes)
    }

    @Test
    fun missingActiveLocationAndSignedOutSessionReturnTypedFailuresWithoutPosting() {
        var writes = 0
        val transport = SellerShipmentTransport { method, path, _, _, _ ->
            if (method == "POST") writes++
            if (path == SellerShipmentRepository.LOCATIONS_PATH) JSONObject("""{"data":[{"id":"$LOCATION_DEFAULT","active":false,"isDefault":true}]}""")
            else JSONObject("""{"data":${orderJson()}}""")
        }
        val shipment = SellerShipmentInput("GIG", "ABCD")
        val missing = SellerShipmentRepository("https://api.nantty.com", ::shipmentSession, transport)
            .markAsShipped(ORDER_ID, shipment, "shipment_key_01").failure()
        val signedOut = SellerShipmentRepository("https://api.nantty.com", { null }, transport)
            .markAsShipped(ORDER_ID, shipment, "shipment_key_01").failure()

        assertTrue(missing.message.contains("active store location"))
        assertTrue(signedOut.authenticationRequired)
        assertEquals(0, writes)
    }

    @Test
    fun forbiddenResponseIsMappedToAuthenticationRequired() {
        val transport = SellerShipmentTransport { _, _, _, _, _ -> throw SellerShipmentHttpException(403) }
        val failure = SellerShipmentRepository("https://api.nantty.com", ::shipmentSession, transport)
            .markAsShipped(ORDER_ID, SellerShipmentInput("GIG", "ABCD"), "shipment_key_01").failure()

        assertTrue(failure.authenticationRequired)
    }

    private fun repository(transport: SellerShipmentTransport) = SellerShipmentRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = ::shipmentSession,
        transport = transport,
    )

    private fun SellerShipmentResult.success() = (this as SellerShipmentResult.Success).order
    private fun SellerShipmentResult.failure() = this as SellerShipmentResult.Failure

    private data class ShipmentCall(
        val method: String,
        val path: String,
        val token: String,
        val body: JSONObject?,
        val idempotencyKey: String?,
    )

    companion object {
        private const val ORDER_ID = "00000000-0000-4000-8000-000000000101"
        private const val LOCATION_INACTIVE = "00000000-0000-4000-8000-000000000102"
        private const val LOCATION_ACTIVE = "00000000-0000-4000-8000-000000000103"
        private const val LOCATION_DEFAULT = "00000000-0000-4000-8000-000000000104"

        private fun shipmentSession() = AccountSession(
            "seller-access", "seller-refresh", AccountUser("seller-1", "Seller", "seller", null, null, listOf("seller")),
        )

        private fun orderJson() = """{
          "id":"$ORDER_ID","orderNumber":"NAN-101","invoiceNumber":"INV-101",
          "buyer":{"id":"buyer-1","name":"Ada","username":"ada","phone":"08000000000"},
          "shippingAddress":{"recipientName":"Ada","phone":"08000000000","line1":"1 Main St","city":"Lagos","state":"Lagos","country":"NG"},
          "lines":[{"id":"line-1","productId":"product-1","variantId":"variant-1","name":"Bag","variantTitle":"Blue","sku":"BAG-BLUE","imageUrl":null,"quantity":1,"unitPrice":{"amountMinor":125000,"currency":"NGN"},"lineTotal":{"amountMinor":125000,"currency":"NGN"}}],
          "subtotal":{"amountMinor":125000,"currency":"NGN"},"discount":{"amountMinor":0,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shippingFee":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":125000,"currency":"NGN"},"sellerPayout":{"amountMinor":125000,"currency":"NGN"},
          "status":"shipped","escrowStatus":"held","escrowReleaseAt":null,
          "fulfilment":{"courier":"GIG","trackingNumber":"ABCD","trackingUrl":null,"shippedAt":"2026-11-01T10:00:00Z","fromLocationId":"$LOCATION_DEFAULT"},
          "attributedCreator":null,"createdAt":"2026-10-31T10:00:00Z","deliveredAt":null,"paymentStatus":"paid","paymentMode":"escrow","paymentProvider":"transfer","paymentReference":"PAY-1","paidAt":"2026-10-31T10:01:00Z",
          "refundedAmount":{"amountMinor":0,"currency":"NGN"},"refunds":[],"delivery":{"status":"in_transit","riderName":null,"riderPhone":null,"estimatedDeliveryAt":null,"attempts":0,"lastAttemptNote":null},"timeline":[],"notes":[],"conversationId":null
        }"""
    }
}
