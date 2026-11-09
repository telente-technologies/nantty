package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BuyerOrderReturnRepositoryTest {
    @Test
    fun postsAuthenticatedReturnRequestUsingTheExistingOrderRouteAndExactBody() {
        val transport = RecordingTransport()
        val result = repository(transport).requestReturn(
            ORDER_ID,
            listOf(BuyerReturnLineRequest(ITEM_ID, 2)),
            "  Item arrived damaged  ",
        ) as BuyerOrderReturnRequestResult.Success

        assertEquals("/api/v1/orders/$ORDER_ID/returns", transport.path)
        assertEquals("orders-access", transport.accessToken)
        assertEquals(ITEM_ID, transport.body?.getJSONArray("lines")?.getJSONObject(0)?.getString("orderItemId"))
        assertEquals(2, transport.body?.getJSONArray("lines")?.getJSONObject(0)?.getInt("quantity"))
        assertEquals("Item arrived damaged", transport.body?.getString("reason"))
        assertEquals(RETURN_ID, result.receipt.id)
        assertEquals(ORDER_ID, result.receipt.orderId)
        assertEquals("requested", result.receipt.status)
    }

    @Test
    fun rejectsInvalidRequestBoundsDuplicateIdsAndInvalidIdentifiersBeforeNetwork() {
        val transport = RecordingTransport()
        val repo = repository(transport)
        val valid = BuyerReturnLineRequest(ITEM_ID, 1)
        val invalidRequests = listOf(
            emptyList(),
            listOf(BuyerReturnLineRequest(ITEM_ID, 0)),
            listOf(BuyerReturnLineRequest(ITEM_ID, 100)),
            listOf(BuyerReturnLineRequest("not-an-id", 1)),
            listOf(valid, valid),
            List(51) { BuyerReturnLineRequest("00000000-0000-4000-8000-${it.toString().padStart(12, '0')}", 1) },
        )

        invalidRequests.forEach { lines ->
            assertTrue(repo.requestReturn(ORDER_ID, lines, "Reason is long enough") is BuyerOrderReturnRequestResult.Failure)
        }
        assertTrue(repo.requestReturn(ORDER_ID, listOf(valid), "no") is BuyerOrderReturnRequestResult.Failure)
        assertTrue(repo.requestReturn(ORDER_ID, listOf(valid), "r".repeat(501)) is BuyerOrderReturnRequestResult.Failure)
        assertTrue(repo.requestReturn("../another-order", listOf(valid), "Reason is long enough") is BuyerOrderReturnRequestResult.Failure)
        assertEquals(0, transport.calls)
    }

    @Test
    fun missingSessionDoesNotPostAndRequiresAuthentication() {
        val transport = RecordingTransport()
        val result = BuyerReturnsRepository("https://api.nantty.com", { null }, transport)
            .requestReturn(ORDER_ID, listOf(BuyerReturnLineRequest(ITEM_ID, 1)), "Reason is long enough")
            as BuyerOrderReturnRequestResult.Failure

        assertTrue(result.authenticationRequired)
        assertEquals(0, transport.calls)
    }

    @Test
    fun mapsEligibilityAndActiveRequestConflictsAndInvalidLinesWithoutLeakingServerBody() {
        val conflict = repository(RecordingTransport(statusCode = 409))
            .requestReturn(ORDER_ID, listOf(BuyerReturnLineRequest(ITEM_ID, 1)), "Reason is long enough")
            as BuyerOrderReturnRequestResult.Failure
        val invalidLines = repository(RecordingTransport(statusCode = 422))
            .requestReturn(ORDER_ID, listOf(BuyerReturnLineRequest(ITEM_ID, 1)), "Reason is long enough")
            as BuyerOrderReturnRequestResult.Failure
        val unauthorized = repository(RecordingTransport(statusCode = 401))
            .requestReturn(ORDER_ID, listOf(BuyerReturnLineRequest(ITEM_ID, 1)), "Reason is long enough")
            as BuyerOrderReturnRequestResult.Failure

        assertTrue(conflict.conflict)
        assertTrue(conflict.message.contains("active return request"))
        assertTrue(invalidLines.message.contains("quantities"))
        assertTrue(unauthorized.authenticationRequired)
        assertFalse(conflict.message.contains("private response body"))
    }

    @Test
    fun acceptsOnlyTheServerConfirmedRequestForTheSameOrder() {
        val differentOrder = repository(RecordingTransport(response = receipt(OTHER_ORDER_ID)))
            .requestReturn(ORDER_ID, listOf(BuyerReturnLineRequest(ITEM_ID, 1)), "Reason is long enough")
        val wrongState = repository(RecordingTransport(response = receipt(ORDER_ID, status = "declined")))
            .requestReturn(ORDER_ID, listOf(BuyerReturnLineRequest(ITEM_ID, 1)), "Reason is long enough")

        assertTrue(differentOrder is BuyerOrderReturnRequestResult.Failure)
        assertTrue(wrongState is BuyerOrderReturnRequestResult.Failure)
    }

    @Test
    fun returnActionIsShownOnlyForDeliveredOrCompletedOrders() {
        assertTrue(buyerCanRequestReturn("delivered"))
        assertTrue(buyerCanRequestReturn("completed"))
        assertFalse(buyerCanRequestReturn("shipped"))
        assertFalse(buyerCanRequestReturn("cancelled"))
        assertEquals("/api/v1/orders/$ORDER_ID/returns", buildBuyerOrderReturnPath(ORDER_ID))
        assertFalse(runCatching { buildBuyerOrderReturnPath("../foreign") }.isSuccess)
    }

    private fun repository(transport: RecordingTransport) = BuyerReturnsRepository(
        "https://api.nantty.com",
        ::signedInSession,
        transport,
    )

    private class RecordingTransport(
        private val response: JSONObject = receipt(ORDER_ID),
        private val statusCode: Int = 201,
    ) : BuyerReturnsTransport {
        var path: String? = null
        var accessToken: String? = null
        var body: JSONObject? = null
        var calls = 0

        override fun get(path: String, accessToken: String): JSONObject = error("GET is not expected")

        override fun post(path: String, accessToken: String, body: JSONObject): JSONObject {
            calls += 1
            this.path = path
            this.accessToken = accessToken
            this.body = body
            if (statusCode !in 200..299) throw BuyerOrdersHttpException(statusCode)
            return response
        }
    }

    companion object {
        private const val ORDER_ID = "123e4567-e89b-42d3-a456-426614174000"
        private const val OTHER_ORDER_ID = "123e4567-e89b-42d3-a456-426614174001"
        private const val ITEM_ID = "123e4567-e89b-42d3-a456-426614174002"
        private const val RETURN_ID = "123e4567-e89b-42d3-a456-426614174003"

        private fun receipt(orderId: String, status: String = "requested") = JSONObject()
            .put("id", RETURN_ID)
            .put("orderId", orderId)
            .put("status", status)

        private fun signedInSession() = AccountSession(
            "orders-access", "refresh", AccountUser("buyer-1", "Ari", "ari", null, null, emptyList()),
        )
    }
}
