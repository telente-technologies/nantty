package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class ProductAdsRepositoryTest {
    @Test
    fun requestsMartProductSlotAndParsesOnlySupportedProductCreative() {
        val transport = RecordingProductAdsTransport(validDecision())
        val repository = ProductAdsRepository(
            baseUrl = "https://api.nantty.test",
            accessTokenProvider = { "viewer-token" },
            transport = transport,
        )

        val result = repository.decideMartProductAd("mart_ads_session_1") as ProductAdResult.Success
        val request = transport.calls.single()
        val ad = requireNotNull(result.ad)

        assertEquals(ProductAdsRepository.DECIDE_PATH, request.path)
        assertEquals("viewer-token", request.accessToken)
        assertEquals(setOf("slot", "sessionId"), request.body.keys().asSequence().toSet())
        assertEquals(ProductAdsRepository.MART_SLOT_KIND, request.body.getJSONObject("slot").getString("kind"))
        assertEquals("mart_ads_session_1", request.body.getString("sessionId"))
        assertEquals("product-ad-1", ad.adId)
        assertEquals("Canvas tote", ad.headline)
        assertEquals("https://cdn.nantty.test/tote.jpg", ad.imageUrl)
        assertEquals("adaatelier", ad.advertiserHandle)
        assertEquals("https://cdn.nantty.test/ada-avatar.jpg", ad.advertiserAvatarUrl)
        assertEquals("product-1", ad.productId)
        assertTrue(ad.verifiedBusiness)
    }

    @Test
    fun recordsSignedImpressionAndClickUsingMartEventContract() {
        val transport = RecordingProductAdsTransport(validDecision())
        val repository = ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = transport)
        val ad = requireNotNull((repository.decideMartProductAd("session-1") as ProductAdResult.Success).ad)

        assertTrue(repository.recordImpression(ad))
        assertTrue(repository.recordClick(ad))
        assertEquals(listOf(ProductAdsRepository.DECIDE_PATH, ProductAdsRepository.EVENTS_PATH, ProductAdsRepository.EVENTS_PATH), transport.calls.map { it.path })
        val event = transport.calls[1].body.getJSONArray("events").getJSONObject(0)
        assertEquals("mart", event.getString("placement"))
        assertEquals("impression", event.getString("type"))
        assertEquals("product-ad-1", event.getString("campaignId"))
        assertEquals("signed-token-123", event.getString("token"))
        assertEquals(transport.calls[1].idempotencyKey, event.getString("eventId"))
    }

    @Test
    fun requestsTheFeedProductSlotAndUsesFeedPlacementForSignedEvents() {
        val transport = RecordingProductAdsTransport(validDecision(placement = "feed", slotKind = "feedProduct"))
        val repository = ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = transport)
        val result = repository.decideFeedProductAd("feed_session_1", 8, listOf("post-8", "post-9")) as ProductAdResult.Success
        val ad = requireNotNull(result.ad)
        val request = transport.calls.first()

        assertEquals(ProductAdsRepository.DECIDE_PATH, request.path)
        assertEquals("feedProduct", request.body.getJSONObject("slot").getString("kind"))
        assertEquals(8, request.body.getJSONObject("slot").getInt("slotIndex"))
        assertEquals(8, request.body.getJSONObject("slot").getInt("slotsSinceLastAd"))
        assertEquals(listOf("post-8", "post-9"), request.body.getJSONObject("slot").getJSONArray("neighbourContentIds").let { rows ->
            (0 until rows.length()).map(rows::getString)
        })
        assertEquals("feed", ad.placement)
        assertEquals("feedProduct", ad.slotKind)
        assertTrue(repository.recordImpression(ad))
        assertTrue(repository.recordClick(ad))
        val events = transport.calls.drop(1).map { it.body.getJSONArray("events").getJSONObject(0) }
        assertEquals(listOf("impression", "click"), events.map { it.getString("type") })
        assertTrue(events.all { it.getString("placement") == "feed" && it.getString("token") == "signed-token-123" })

        val genericFeedPost = RecordingProductAdsTransport(validDecision(placement = "feed", slotKind = "feedPost"))
        val genericResult = ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = genericFeedPost)
            .decideFeedProductAd("feed_session_2", 8, emptyList())
        assertTrue(genericResult is ProductAdResult.Failure)
    }

    @Test
    fun requestsSearchProductSlotAndUsesSearchPlacementForSignedEvents() {
        val transport = RecordingProductAdsTransport(validDecision(placement = "search", slotKind = "searchTile"))
        val repository = ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = transport)

        val result = repository.decideSearchProductAd("search_ads_session_1") as ProductAdResult.Success
        val ad = requireNotNull(result.ad)
        val request = transport.calls.single()

        assertEquals(ProductAdsRepository.DECIDE_PATH, request.path)
        assertEquals(setOf("slot", "sessionId"), request.body.keys().asSequence().toSet())
        assertEquals(ProductAdsRepository.SEARCH_SLOT_KIND, request.body.getJSONObject("slot").getString("kind"))
        assertEquals("search", ad.placement)
        assertEquals("searchTile", ad.slotKind)
        assertEquals("product-1", ad.productId)
        assertTrue(repository.recordImpression(ad))
        assertTrue(repository.recordClick(ad))

        val events = transport.calls.drop(1).map { it.body.getJSONArray("events").getJSONObject(0) }
        assertEquals(listOf("impression", "click"), events.map { it.getString("type") })
        assertTrue(events.all { it.getString("placement") == "search" && it.getString("token") == "signed-token-123" })
    }

    @Test
    fun feedDecisionRejectsMalformedNeighboursBeforeNetworkCall() {
        val transport = RecordingProductAdsTransport(validDecision(placement = "feed", slotKind = "feedProduct"))
        val repository = ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = transport)

        assertTrue(repository.decideFeedProductAd("feed_session_1", 8, listOf("../unsafe")) is ProductAdResult.Failure)
        assertTrue(repository.decideFeedProductAd("feed_session_1", -1, emptyList()) is ProductAdResult.Failure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun rejectsInvalidRequestsAndUnsafeOrNonProductCreatives() {
        val transport = RecordingProductAdsTransport(validDecision())
        val repository = ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = transport)
        assertTrue(repository.decideMartProductAd("invalid/session") is ProductAdResult.Failure)
        assertTrue(transport.calls.isEmpty())

        val wrongFormat = validDecision().apply { getJSONObject("ad").put("format", "store") }
        assertTrue(ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = RecordingProductAdsTransport(wrongFormat))
            .decideMartProductAd("session-1") is ProductAdResult.Failure)

        val unsafe = validDecision().apply {
            getJSONObject("ad").getJSONObject("creative").put("media", JSONArray().put(JSONObject().put("kind", "image").put("url", "http://unsafe.test/tote.jpg")))
        }
        assertTrue(ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = RecordingProductAdsTransport(unsafe))
            .decideMartProductAd("session-1") is ProductAdResult.Failure)
        assertFalse(repository.recordClick(MartProductAd("bad/id", "token", "", "Sponsored", "", "", "", "", "", false, "")))
    }

    @Test
    fun retainsSignedEventAfterTransportFailureAndRetriesForOnlyItsAccountWithSameKey() {
        val now = Instant.parse("2026-11-07T12:00:00Z")
        val store = InMemoryProductAdEventStore()
        val calls = mutableListOf<ProductAdsCall>()
        var rejectFirstEvent = true
        val transport = ProductAdsTransport { path, token, body, key ->
            calls += ProductAdsCall(path, token, body, key)
            if (path == ProductAdsRepository.EVENTS_PATH && rejectFirstEvent) {
                rejectFirstEvent = false
                error("temporary network failure")
            }
            if (path == ProductAdsRepository.DECIDE_PATH) validDecision() else JSONObject()
        }
        val firstRepository = ProductAdsRepository(
            accessTokenProvider = { "bearer-not-persisted" },
            accountIdProvider = { "account-one" },
            transport = transport,
            pendingEventStore = store,
            now = { now },
        )
        val ad = requireNotNull((firstRepository.decideMartProductAd("session-1") as ProductAdResult.Success).ad)

        assertTrue(firstRepository.recordClick(ad))
        val queued = store.read("account-one").single()
        assertTrue(queued.eventId.length >= 16)
        assertEquals(queued.eventId, queued.requestJson().getString("eventId"))
        assertFalse(queued.storageJson().toString().contains("bearer-not-persisted"))
        assertTrue(store.read("account-two").isEmpty())

        val nextSessionRepository = ProductAdsRepository(
            accessTokenProvider = { "rotated-bearer" },
            accountIdProvider = { "account-one" },
            transport = transport,
            pendingEventStore = store,
            now = { now },
        )
        assertTrue(nextSessionRepository.flushPendingEvents())
        assertTrue(store.read("account-one").isEmpty())
        val delivered = calls.last()
        assertEquals(queued.eventId, delivered.idempotencyKey)
        assertEquals(queued.eventId, delivered.body.getJSONArray("events").getJSONObject(0).getString("eventId"))
        assertEquals("rotated-bearer", delivered.accessToken)
    }

    @Test
    fun doesNotQueueEventsAfterTheirSignedAdTokenExpires() {
        val now = Instant.parse("2026-11-07T12:00:00Z")
        val store = InMemoryProductAdEventStore()
        val transport = RecordingProductAdsTransport(validDecision())
        val repository = ProductAdsRepository(
            accessTokenProvider = { "viewer-token" },
            accountIdProvider = { "viewer-account" },
            transport = transport,
            pendingEventStore = store,
            now = { now },
        )
        val expired = requireNotNull((repository.decideMartProductAd("session-1") as ProductAdResult.Success).ad)
            .copy(expiresAt = "2026-11-07T11:59:59Z")

        assertFalse(repository.recordImpression(expired))
        assertTrue(store.read("viewer-account").isEmpty())
        assertTrue(transport.calls.none { it.path == ProductAdsRepository.EVENTS_PATH })
    }

    private fun validDecision(placement: String = "mart", slotKind: String = "martTile"): JSONObject = JSONObject(
        """{"ad":{"adId":"product-ad-1","impressionToken":"signed-token-123","expiresAt":"2099-11-07T13:00:00Z","placement":"$placement","slotKind":"$slotKind","format":"product","label":"Ad","creative":{"format":"product","media":[{"kind":"image","url":"https://cdn.nantty.test/tote.jpg"}],"headline":"Canvas tote","primaryText":"Woven by hand","callToAction":"shop_now","destination":{"type":"product","targetId":"product-1"},"identity":{"name":"Ada Atelier","handle":"adaatelier","avatarUrl":"https://cdn.nantty.test/ada-avatar.jpg","verifiedBusiness":true}}}}""",
    )
}

private data class ProductAdsCall(val path: String, val accessToken: String, val body: JSONObject, val idempotencyKey: String? = null)

private class RecordingProductAdsTransport(private val response: JSONObject) : ProductAdsTransport {
    val calls = mutableListOf<ProductAdsCall>()
    override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
        calls += ProductAdsCall(path, accessToken, body, idempotencyKey)
        return if (path == ProductAdsRepository.DECIDE_PATH) response else JSONObject()
    }
}
