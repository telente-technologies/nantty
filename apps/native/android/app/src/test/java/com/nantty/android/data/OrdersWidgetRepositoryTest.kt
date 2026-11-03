package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OrdersWidgetRepositoryTest {
    @Test
    fun requestsOnlyAuthenticatedOrdersEndpointAndPersistsOnlyMinimalStatusSummary() {
        val transport = QueueTransport(payload("""{"orders":[{"id":"private-order-id","reference":"private-ref","statusLabel":"Being prepared","etaAt":"2026-11-03T10:00:00Z","itemTitle":"Private purchase","storeName":"Private store","deepLink":"nantty://orders/private-order-id"}],"activeCount":1,"generatedAt":"2026-11-02T10:00:00Z"}"""))
        val repository = OrdersWidgetRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { session("access-1") },
            refreshSession = { null },
            transport = transport,
        )

        val result = repository.load() as OrdersWidgetLoadResult.Ready

        assertEquals(OrdersWidgetRepository.ORDERS_PATH, transport.paths.single())
        assertEquals("access-1", transport.tokens.single())
        assertEquals(1, result.payload.activeCount)
        assertEquals(listOf("Being prepared"), result.payload.statusLabels)
        assertTrue(result.payload.toString().contains("private-order-id").not())
        assertTrue(result.payload.toString().contains("Private purchase").not())
    }

    @Test
    fun retriesUnauthorizedRequestOnceWithRotatedSession() {
        val transport = QueueTransport(
            OrdersWidgetHttpException(401),
            payload("""{"orders":[],"activeCount":0,"generatedAt":"2026-11-02T10:00:00Z"}"""),
        )
        val repository = OrdersWidgetRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { session("expired") },
            refreshSession = { session("rotated") },
            transport = transport,
        )

        assertTrue((repository.load() as OrdersWidgetLoadResult.Ready).payload.statusLabels.isEmpty())
        assertEquals(listOf("expired", "rotated"), transport.tokens)
    }

    @Test
    fun signedOutDoesNotMakeAnAuthenticatedRequest() {
        val transport = QueueTransport(payload("""{"orders":[],"activeCount":0}"""))
        val repository = OrdersWidgetRepository("https://api.nantty.com", { null }, { null }, transport)

        assertEquals(OrdersWidgetLoadResult.SignedOut, repository.load())
        assertTrue(transport.paths.isEmpty())
    }

    @Test
    fun responseSanitizationBoundsCountAndRemovesControlCharacters() {
        val parsed = sanitizeOrdersWidgetPayload(parseOrdersWidgetPayload(payload("""{"orders":[
            {"statusLabel":"Confirmed\n\u0001"}, {"statusLabel":"Second"}, {"statusLabel":"Third"}, {"statusLabel":"Never shown"}
        ],"activeCount":-4}""")))

        assertEquals(0, parsed.activeCount)
        assertEquals(listOf("Confirmed", "Second", "Third"), parsed.statusLabels)
    }

    @Test
    fun decodesTheReactNativeOrderItemContractBeforeSnapshotSanitization() {
        val parsed = parseOrdersWidgetPayload(payload("""{"orders":[{"id":"order-1","reference":"NT-1","status":"shipped","statusLabel":"On the way","etaAt":"2026-11-03T10:00:00Z","itemTitle":"Lamp","itemCount":2,"imageUrl":"https://cdn.nantty.com/lamp.png","storeName":"Store","deepLink":"nantty://orders/order-1"}],"activeCount":1,"generatedAt":"2026-11-02T10:00:00Z"}"""))
        val item = parsed.orders.single()

        assertEquals("order-1", item.id)
        assertEquals("NT-1", item.reference)
        assertEquals("shipped", item.status)
        assertEquals("On the way", item.statusLabel)
        assertEquals("2026-11-03T10:00:00Z", item.etaAt)
        assertEquals("Lamp", item.itemTitle)
        assertEquals(2, item.itemCount)
        assertEquals("https://cdn.nantty.com/lamp.png", item.imageUrl)
        assertEquals("Store", item.storeName)
        assertEquals("nantty://orders/order-1", item.deepLink)
        assertEquals(listOf("On the way"), sanitizeOrdersWidgetPayload(parsed).statusLabels)
    }

    @Test
    fun failedRefreshKeepsOnlyRecentMinimalSnapshotAndRedactsOldData() {
        val previous = OrdersWidgetSnapshot(OrdersWidgetState.READY, 2, listOf("Being prepared"), 1_000)

        val recent = ordersWidgetSnapshotAfterFailure(previous, 1_000 + 60_000)
        val old = ordersWidgetSnapshotAfterFailure(previous, 1_000 + OrdersWidgetSnapshotStore.MAX_STALE_DETAIL_AGE_MS + 1)

        assertEquals(OrdersWidgetState.STALE, recent.state)
        assertEquals(listOf("Being prepared"), recent.statusLabels)
        assertEquals(OrdersWidgetState.ERROR, old.state)
        assertTrue(old.statusLabels.isEmpty())
    }

    private fun session(access: String) = AccountSession(access, "refresh", AccountUser("account", "Name", "name", null, null, emptyList()))

    private fun payload(json: String) = JSONObject(json)

    private class QueueTransport(vararg responses: Any) : OrdersWidgetTransport {
        private val responses = ArrayDeque(responses.toList())
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String>()

        override fun get(path: String, accessToken: String): JSONObject {
            paths += path
            tokens += accessToken
            val response = responses.removeFirst()
            if (response is Exception) throw response
            return response as JSONObject
        }
    }
}
