package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SellerReturnsRepositoryTest {
    @Test
    fun loadsStoreScopedCursorPageAndExactStatusFilter() {
        val calls = mutableListOf<Call>()
        val repository = repository { call ->
            calls += call
            JSONObject(pageJson(nextCursor = "next/cursor"))
        }

        val page = repository.load(STORE_ID, SellerReturnStatus.REQUESTED).success<SellerReturnsPage>()

        assertEquals("GET", calls.single().method)
        assertEquals("/api/v1/seller/returns?limit=25&status=requested", calls.single().path)
        assertEquals(ACCESS_TOKEN, calls.single().accessToken)
        assertEquals(STORE_ID, calls.single().storeId)
        assertEquals(RETURN_ID, page.returns.single().id)
        assertEquals("NAN-001", page.returns.single().orderNumber)
        assertEquals("Item one", page.returns.single().lines.single().name)
        assertEquals("next/cursor", page.nextCursor)
    }

    @Test
    fun loadMoreEncodesCursorAndLeavesAllStatusUnfiltered() {
        var path: String? = null
        val repository = repository { call ->
            path = call.path
            JSONObject(pageJson(nextCursor = null, rows = "[]"))
        }

        repository.load(STORE_ID, SellerReturnStatus.ALL, cursor = "opaque/cursor +", limit = 50).success<SellerReturnsPage>()

        assertEquals("/api/v1/seller/returns?limit=50&cursor=opaque%2Fcursor%20%2B", path)
    }

    @Test
    fun approveAndDeclinePostCanonicalActionsAndDeclineNote() {
        val calls = mutableListOf<Call>()
        val repository = repository { call ->
            calls += call
            JSONObject(returnJson(status = if (call.path.endsWith("/approve")) "approved" else "declined"))
        }

        assertEquals("approved", repository.approve(STORE_ID, RETURN_ID).success<SellerReturnRequest>().status)
        assertEquals("declined", repository.decline(STORE_ID, RETURN_ID, "Not eligible").success<SellerReturnRequest>().status)

        assertEquals("/api/v1/seller/returns/$RETURN_ID/approve", calls[0].path)
        assertEquals("POST", calls[0].method)
        assertEquals(null, calls[0].body)
        assertEquals("/api/v1/seller/returns/$RETURN_ID/decline", calls[1].path)
        assertEquals("Not eligible", calls[1].body?.getString("note"))
        assertEquals(STORE_ID, calls[1].storeId)
    }

    @Test
    fun receiveSendsBothRestockAndLocationIdFields() {
        var body: JSONObject? = null
        val repository = repository { call ->
            body = call.body
            JSONObject(returnJson(status = "refunded"))
        }

        val returned = repository.receive(STORE_ID, RETURN_ID, SellerReturnReceiptInput(true, LOCATION_ID))
            .success<SellerReturnRequest>()

        assertEquals("refunded", returned.status)
        assertEquals(true, body?.getBoolean("restock"))
        assertEquals(LOCATION_ID, body?.getString("locationId"))
    }

    @Test
    fun receiveWithoutRestockSendsFalseAndNullLocation() {
        var body: JSONObject? = null
        val repository = repository { call ->
            body = call.body
            JSONObject(returnJson(status = "refunded"))
        }

        repository.receive(STORE_ID, RETURN_ID, SellerReturnReceiptInput(false, null)).success<SellerReturnRequest>()

        assertEquals(false, body?.getBoolean("restock"))
        assertTrue(body?.isNull("locationId") == true)
    }

    @Test
    fun invalidIdentifiersNotesAndRestockLocationFailBeforeNetwork() {
        var called = false
        val repository = repository { called = true; JSONObject(returnJson()) }

        assertTrue(repository.load("not-a-store-id") is SellerReturnsResult.Failure)
        assertTrue(repository.approve(STORE_ID, "not-a-return-id") is SellerReturnsResult.Failure)
        assertTrue(repository.decline(STORE_ID, RETURN_ID, "no") is SellerReturnsResult.Failure)
        assertTrue(repository.receive(STORE_ID, RETURN_ID, SellerReturnReceiptInput(true, null)) is SellerReturnsResult.Failure)
        assertFalse(called)
    }

    @Test
    fun returnsActiveLocationsOnlyWithLocationDetails() {
        val repository = repository { call ->
            assertEquals("/api/v1/seller/locations", call.path)
            JSONObject("""{"data":[
              {"id":"$LOCATION_ID","name":"Lagos Store","city":"Ikeja","state":"Lagos","active":true,"isDefault":true},
              {"id":"$OTHER_LOCATION_ID","name":"Closed Store","city":"Lagos","state":"Lagos","active":false,"isDefault":false}
            ],"nextCursor":null}""")
        }

        val locations = repository.loadLocations(STORE_ID).success<List<SellerReturnLocation>>()

        assertEquals(1, locations.size)
        assertEquals("Lagos Store", locations.single().name)
        assertEquals(true, locations.single().isDefault)
    }

    @Test
    fun signedOutFailsWithoutNetworkAndStorePermissionIsNotMisreportedAsAuthentication() {
        var called = false
        val transport = SellerReturnsTransport { _, _, _, _, _ -> called = true; JSONObject() }
        val signedOut = SellerReturnsRepository("https://api.nantty.com", { null }, transport)
            .load(STORE_ID) as SellerReturnsResult.Failure
        val forbidden = SellerReturnsRepository("https://api.nantty.com", ::session, SellerReturnsTransport { _, _, _, _, _ ->
            throw SellerReturnsHttpException(403)
        }).load(STORE_ID) as SellerReturnsResult.Failure

        assertTrue(signedOut.authenticationRequired)
        assertFalse(called)
        assertFalse(forbidden.authenticationRequired)
        assertTrue(forbidden.permissionDenied)
    }

    @Test
    fun statusActionsFollowBackendTransitions() {
        assertEquals(setOf("approve", "decline"), sellerReturnActions("requested"))
        assertEquals(setOf("receive"), sellerReturnActions("approved"))
        assertTrue(sellerReturnActions("declined").isEmpty())
        assertTrue(sellerReturnActions("refunded").isEmpty())
    }

    @Test
    fun declineNoteLengthUsesTrimmedUtf8BytesLikeGoValidator() {
        assertFalse(isValidSellerReturnDeclineNote("  no "))
        assertTrue(isValidSellerReturnDeclineNote("  wrong  "))
        assertTrue(isValidSellerReturnDeclineNote("😀".repeat(125)))
        assertFalse(isValidSellerReturnDeclineNote("😀".repeat(126)))
    }

    @Test
    fun rejectsMalformedOrMismatchedMutationResponse() {
        val repository = repository { call ->
            JSONObject(returnJson(id = if (call.method == "POST") OTHER_RETURN_ID else RETURN_ID))
        }

        val result = repository.approve(STORE_ID, RETURN_ID) as SellerReturnsResult.Failure

        assertTrue(result.message.isNotBlank())
    }

    private fun repository(block: (Call) -> JSONObject) = SellerReturnsRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = ::session,
        transport = SellerReturnsTransport { method, path, token, storeId, body ->
            block(Call(method, path, token, storeId, body))
        },
    )

    private inline fun <reified T> SellerReturnsResult<*>.success(): T =
        (this as SellerReturnsResult.Success<T>).value

    private data class Call(
        val method: String,
        val path: String,
        val accessToken: String,
        val storeId: String,
        val body: JSONObject?,
    )

    companion object {
        private const val STORE_ID = "11111111-1111-4111-8111-111111111111"
        private const val RETURN_ID = "22222222-2222-4222-8222-222222222222"
        private const val OTHER_RETURN_ID = "33333333-3333-4333-8333-333333333333"
        private const val LOCATION_ID = "44444444-4444-4444-8444-444444444444"
        private const val OTHER_LOCATION_ID = "55555555-5555-4555-8555-555555555555"
        private const val ORDER_ID = "66666666-6666-4666-8666-666666666666"
        private const val ORDER_LINE_ID = "77777777-7777-4777-8777-777777777777"
        private const val ACCESS_TOKEN = "seller-access-token"

        private fun session() = AccountSession(
            ACCESS_TOKEN,
            "seller-refresh-token",
            AccountUser("seller-id", "Seller", "seller", null, null, listOf("seller")),
        )

        private fun pageJson(nextCursor: String?, rows: String = "[${returnJson()}]") =
            """{"data":$rows,"nextCursor":${nextCursor?.let { "\"$it\"" } ?: "null"}}"""

        private fun returnJson(
            id: String = RETURN_ID,
            status: String = "requested",
        ) = """{
          "id":"$id","orderId":"$ORDER_ID","orderNumber":"NAN-001","buyerName":"Ari Buyer",
          "lines":[{"orderLineId":"$ORDER_LINE_ID","name":"Item one","quantity":2}],
          "reason":"Damaged item","status":"$status","declineNote":null,
          "refundAmount":{"amountMinor":250000,"currency":"NGN"},"createdAt":"2026-11-07T10:00:00Z"
        }"""
    }
}
