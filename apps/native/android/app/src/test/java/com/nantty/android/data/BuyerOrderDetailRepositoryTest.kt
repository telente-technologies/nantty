package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class BuyerOrderDetailRepositoryTest {
    @Test
    fun loadsBuyerScopedDetailWithAuthenticatedExactPathAndIgnoresCourierTrackingLinks() {
        val transport = RecordingTransport(detail())
        val result = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)
            .loadDetail("order_123") as BuyerOrderDetailResult.Success

        assertEquals("/api/v1/orders/order_123", transport.path)
        assertEquals("orders-access", transport.token)
        assertEquals("order_123", result.order.id)
        assertEquals("NT-1042", result.order.reference)
        assertEquals("Ari Tech", result.order.storeName)
        assertEquals("store_1", result.order.storeId)
        assertEquals("Headphones", result.order.items.single().name)
        assertEquals(2, result.order.items.single().quantity)
        assertEquals("Large", result.order.items.single().variant)
        assertEquals(245000L, result.order.totalMinor)
        assertEquals("NGN", result.order.currency)
        assertEquals("Swift", result.order.shipment?.courierName)
        assertEquals("TRACK-1", result.order.shipment?.trackingNumber)
        assertEquals(1, result.order.delivery?.attempts)
    }

    @Test
    fun ignoresCourierTrackingUrlsRegardlessOfSchemeOrHost() {
        val unsafe = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail("https://carrier.example@attacker.example/track")))
            .loadDetail("order_123") as BuyerOrderDetailResult.Success
        val malformed = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail("https:carrier.example/track")))
            .loadDetail("order_123") as BuyerOrderDetailResult.Success

        assertEquals("TRACK-1", unsafe.order.shipment?.trackingNumber)
        assertEquals("TRACK-1", malformed.order.shipment?.trackingNumber)
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
    fun rejectsOrderDetailWithoutAUsableStoreId() {
        val payload = detail().apply { getJSONObject("store").put("id", "../unsafe") }

        val result = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(payload))
            .loadDetail("order_123") as BuyerOrderDetailResult.Failure

        assertEquals("Couldn't load this order. Check your connection and try again.", result.message)
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

    @Test
    fun confirmsReceiptWithAuthenticatedPostAndFreshUuidIdempotencyKey() {
        val transport = RecordingTransport(detail(status = "completed"))
        val result = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)
            .confirmReceipt("order_123") as BuyerOrderReceiptResult.Success

        assertEquals("/api/v1/orders/order_123/confirm-receipt", transport.postPath)
        assertEquals("orders-access", transport.postToken)
        assertTrue(runCatching { UUID.fromString(transport.idempotencyKey) }.isSuccess)
        assertEquals("completed", result.order.status)
        assertEquals(1, transport.postCalls)
    }

    @Test
    fun createsANewIdempotencyKeyForEachDeliberateConfirmationAttempt() {
        val transport = RecordingTransport(detail(status = "completed"))
        val repository = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)

        assertTrue(repository.confirmReceipt("order_123") is BuyerOrderReceiptResult.Success)
        val firstKey = transport.idempotencyKeys.last()
        assertTrue(repository.confirmReceipt("order_123") is BuyerOrderReceiptResult.Success)

        assertEquals(2, transport.idempotencyKeys.distinct().size)
        assertTrue(transport.idempotencyKeys.all { runCatching { UUID.fromString(it) }.isSuccess })
        assertTrue(firstKey != transport.idempotencyKeys.last())
    }

    @Test
    fun retriesTheSameConfirmationWithTheCallersIdempotencyKey() {
        val transport = RecordingTransport(detail(status = "completed"))
        val repository = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)

        assertTrue(repository.confirmReceipt("order_123", "receipt-action-0001") is BuyerOrderReceiptResult.Success)
        assertTrue(repository.confirmReceipt("order_123", "receipt-action-0001") is BuyerOrderReceiptResult.Success)

        assertEquals(listOf("receipt-action-0001", "receipt-action-0001"), transport.idempotencyKeys)
    }

    @Test
    fun onlyTreatsACompletedServerResponseAsReceiptConfirmation() {
        val deliveredResponse = BuyerOrdersRepository(
            "https://api.nantty.com",
            ::signedInSession,
            RecordingTransport(detail(status = "delivered")),
        ).confirmReceipt("order_123") as BuyerOrderReceiptResult.Failure

        assertFalse(deliveredResponse.authenticationRequired)
        assertTrue(deliveredResponse.message.contains("couldn't verify"))
    }

    @Test
    fun shippedAndDeliveredOrdersAreEligibleForTheBuyerReceiptAction() {
        assertTrue(buyerCanConfirmReceipt("shipped"))
        assertTrue(buyerCanConfirmReceipt("delivered"))
        assertFalse(buyerCanConfirmReceipt("completed"))
        assertFalse(buyerCanConfirmReceipt("disputed"))
        assertFalse(buyerCanConfirmReceipt("cancelled"))
    }

    @Test
    fun cancellationUsesBuyerRouteAndOnlyAcceptsConfirmedCancelledStatus() {
        val transport = RecordingTransport(detail(status = "cancelled"))
        val result = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)
            .cancelOrder("order_123") as BuyerOrderCancellationResult.Success

        assertEquals("/api/v1/orders/order_123/cancel", transport.cancelPath)
        assertEquals("orders-access", transport.cancelToken)
        assertEquals("Cancelled by buyer", transport.cancelReason)
        assertEquals("cancelled", result.order.status)
    }

    @Test
    fun cancellationEligibilityMatchesBuyerBackendStatusRules() {
        assertTrue(buyerCanCancelOrder("new"))
        assertTrue(buyerCanCancelOrder("pending"))
        assertFalse(buyerCanCancelOrder("paid"))
        assertFalse(buyerCanCancelOrder("shipped"))
        assertFalse(buyerCanCancelOrder("cancelled"))
        assertEquals("/api/v1/orders/order_123/cancel", buildBuyerOrderCancelPath("order_123"))
        assertFalse(runCatching { buildBuyerOrderCancelPath("../foreign") }.isSuccess)
    }

    @Test
    fun rejectsMalformedOrderIdAndMissingSessionBeforePosting() {
        val transport = RecordingTransport(detail())
        val repository = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport)
        val malformed = repository.confirmReceipt("../foreign") as BuyerOrderReceiptResult.Failure
        val malformedKey = repository.confirmReceipt("order_123", "bad key") as BuyerOrderReceiptResult.Failure
        val signedOut = BuyerOrdersRepository("https://api.nantty.com", { null }, transport)
            .confirmReceipt("order_123") as BuyerOrderReceiptResult.Failure

        assertEquals("That order could not be found.", malformed.message)
        assertTrue(malformedKey.message.contains("safely prepare"))
        assertTrue(signedOut.authenticationRequired)
        assertEquals(0, transport.postCalls)
    }

    @Test
    fun mapsAuthenticationAndConflictFailuresWithoutExposingServerBody() {
        val unauthorized = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 401))
            .confirmReceipt("order_123") as BuyerOrderReceiptResult.Failure
        val forbidden = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 403))
            .confirmReceipt("order_123") as BuyerOrderReceiptResult.Failure
        val conflict = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 409))
            .confirmReceipt("order_123") as BuyerOrderReceiptResult.Failure
        val serverError = BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(detail(), 500))
            .confirmReceipt("order_123") as BuyerOrderReceiptResult.Failure

        assertTrue(unauthorized.authenticationRequired)
        assertTrue(forbidden.authenticationRequired)
        assertTrue(conflict.message.contains("can no longer be confirmed"))
        assertFalse(serverError.message.contains("private response body"))
    }

    private fun detail(trackingUrl: String = "https://carrier.example/track/TRACK-1", status: String = "shipped") = JSONObject(
        """{"id":"order_123","reference":"NT-1042","status":"$status","fulfilmentStatus":"in_transit","paymentStatus":"paid","paymentMode":"escrow","items":[{"id":"item_1","product":{"id":"product_1","name":"Headphones"},"quantity":2,"variant":"Large"}],"subtotal":{"amountMinor":250000,"currency":"NGN"},"discount":{"amountMinor":5000,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":245000,"currency":"NGN"},"store":{"id":"store_1","name":"Ari Tech"},"createdAt":"2026-11-02T10:30:00Z","escrowReleaseAt":null,"shipment":{"courierName":"Swift","trackingNumber":"TRACK-1","trackingUrl":"$trackingUrl","shippedAt":"2026-11-02T11:00:00Z","estimatedDeliveryAt":"2026-11-04T11:00:00Z"},"delivery":{"status":"in_transit","riderName":null,"riderPhone":null,"estimatedDeliveryAt":"2026-11-04T11:00:00Z","attempts":1,"lastAttemptNote":null},"promotionIssue":null}""",
    )

    private fun signedInSession() = AccountSession(
        "orders-access", "refresh", AccountUser("buyer-1", "Ari", "ari", null, null, emptyList()),
    )

    private class RecordingTransport(
        private val response: JSONObject,
        private val statusCode: Int = 200,
    ) : BuyerOrderReceiptTransport, BuyerOrderCancellationTransport {
        var path: String? = null
        var token: String? = null
        var postPath: String? = null
        var postToken: String? = null
        var idempotencyKey: String = ""
        val idempotencyKeys = mutableListOf<String>()
        var postCalls = 0
        var cancelPath: String? = null
        var cancelToken: String? = null
        var cancelReason: String? = null

        override fun get(path: String, accessToken: String): JSONObject {
            this.path = path
            token = accessToken
            if (statusCode !in 200..299) throw BuyerOrdersHttpException(statusCode)
            return response
        }

        override fun post(path: String, accessToken: String, idempotencyKey: String): JSONObject {
            postPath = path
            postToken = accessToken
            this.idempotencyKey = idempotencyKey
            idempotencyKeys += idempotencyKey
            postCalls += 1
            if (statusCode !in 200..299) throw BuyerOrdersHttpException(statusCode)
            return response
        }

        override fun cancel(path: String, accessToken: String, reason: String): JSONObject {
            cancelPath = path
            cancelToken = accessToken
            cancelReason = reason
            if (statusCode !in 200..299) throw BuyerOrdersHttpException(statusCode)
            return response
        }
    }
}
