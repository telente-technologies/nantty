package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StoryAdsRepositoryTest {
    @Test
    fun sendsExactDecisionPathPayloadAndAuthorization() {
        val transport = RecordingStoryAdsTransport(JSONObject("""{"ad":null,"declinedReason":"no_fill"}"""))
        val result = repository(transport).decideStoryAd(
            contentId = "story-17",
            sessionId = "story_ads_session_42",
            slotsSinceLastAd = 6,
            neighbourContentIds = (1..12).map { "story-$it" }.take(10),
            slotIndex = 9,
        ) as StoryAdDecisionResult.Success

        val request = transport.calls.single()
        assertEquals(StoryAdsRepository.DECIDE_PATH, request.path)
        assertEquals("access-token", request.accessToken)
        assertEquals(setOf("slot", "sessionId"), request.body.keys().asSequence().toSet())
        assertEquals("story_ads_session_42", request.body.getString("sessionId"))
        val slot = request.body.getJSONObject("slot")
        assertEquals(setOf("kind", "contentId", "neighbourContentIds", "slotsSinceLastAd", "slotIndex"),
            slot.keys().asSequence().toSet())
        assertEquals("story", slot.getString("kind"))
        assertEquals("story-17", slot.getString("contentId"))
        assertEquals(10, slot.getJSONArray("neighbourContentIds").length())
        assertEquals(6, slot.getInt("slotsSinceLastAd"))
        assertEquals(9, slot.getInt("slotIndex"))
        assertNull(result.ad)
        assertEquals("no_fill", result.declinedReason)
    }

    @Test
    fun parsesGoDecisionDtoAndItsCreative() {
        val transport = RecordingStoryAdsTransport(validDecision())
        val result = repository(transport).decideStoryAd("story-17", "session-1", 2, listOf("story-18"), 4)
            as StoryAdDecisionResult.Success
        val ad = requireNotNull(result.ad)

        assertEquals("ad-91", ad.adId)
        assertEquals("token_abcdefgh", ad.impressionToken)
        assertEquals("2026-11-06T13:00:00Z", ad.expiresAt)
        assertEquals("stories", ad.placement)
        assertEquals("story", ad.slotKind)
        assertEquals("story", ad.format)
        assertEquals("Sponsored", ad.label)
        assertEquals(5, ad.skipAfterSeconds)
        assertEquals(1, ad.media.size)
        assertEquals(StoryAdMedia("video", "https://cdn.nantty.test/story.mp4", "https://cdn.nantty.test/poster.jpg", 1080, 1920, 7), ad.media.single())
        assertEquals("A headline", ad.headline)
        assertEquals("A short sponsored message", ad.primaryText)
        assertEquals("Learn more", ad.callToAction)
        assertEquals(StoryAdDestination("url", null, "https://advertiser.test/offer"), ad.destination)
        assertEquals(StoryAdIdentity("Brand", "brand", "https://cdn.nantty.test/avatar.jpg"), ad.identity)
        assertNull(result.declinedReason)
    }

    @Test
    fun recordsImpressionAndClickWithReactNativeEventFields() {
        val transport = RecordingStoryAdsTransport(validDecision())
        val repository = repository(transport)
        val ad = (repository.decideStoryAd("story-17", "session-1", 0, emptyList(), 0) as StoryAdDecisionResult.Success).ad!!

        assertTrue(repository.recordImpression(ad).isSuccess)
        assertTrue(repository.recordClick(ad).isSuccess)
        assertEquals(listOf(StoryAdsRepository.DECIDE_PATH, StoryAdsRepository.EVENTS_PATH, StoryAdsRepository.EVENTS_PATH),
            transport.calls.map { it.path })

        listOf("impression", "click").forEachIndexed { index, type ->
            val event = transport.calls[index + 1].body.getJSONArray("events").getJSONObject(0)
            assertEquals(setOf("campaignId", "placement", "type", "itemId", "token"), event.keys().asSequence().toSet())
            assertEquals("ad-91", event.getString("campaignId"))
            assertEquals("stories", event.getString("placement"))
            assertEquals(type, event.getString("type"))
            assertEquals("ad-91", event.getString("itemId"))
            assertEquals("token_abcdefgh", event.getString("token"))
        }
    }

    @Test
    fun rejectsInvalidRequestIdsAndEventIdsBeforeTransport() {
        val transport = RecordingStoryAdsTransport(validDecision())
        val repository = repository(transport)

        assertTrue(repository.decideStoryAd("../story", "session-1", 0, emptyList(), 0) is StoryAdDecisionResult.Failure)
        assertTrue(repository.decideStoryAd("story-1", "bad/session", 0, emptyList(), 0) is StoryAdDecisionResult.Failure)
        assertTrue(repository.decideStoryAd("story-1", "session-1", -1, emptyList(), 0) is StoryAdDecisionResult.Failure)
        assertTrue(repository.decideStoryAd("story-1", "session-1", 0, List(11) { "n$it" }, 0) is StoryAdDecisionResult.Failure)
        assertTrue(repository.decideStoryAd("story-1", "session-1", 0, listOf("bad/id"), 0) is StoryAdDecisionResult.Failure)
        assertTrue(transport.calls.isEmpty())

        val invalidAd = sampleAd().copy(adId = "bad/id")
        assertTrue(repository.recordImpression(invalidAd).isFailure)
        assertTrue(repository.recordClick(invalidAd).isFailure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun rejectsUntrustedCreativeUrlsWithoutReturningOrTrackingAd() {
        val unsafeMedia = validDecision().put("ad", validDecision().getJSONObject("ad").let { ad ->
            val creative = ad.getJSONObject("creative")
            creative.put("media", JSONArray().put(JSONObject().put("kind", "image").put("url", "javascript:alert(1)")))
            ad
        })
        val transport = RecordingStoryAdsTransport(unsafeMedia)
        val repository = repository(transport)
        val result = repository.decideStoryAd("story-1", "session-1", 0, emptyList(), 0) as StoryAdDecisionResult.Failure

        assertFalse(result.authenticationRequired)
        assertEquals(1, transport.calls.size)
        assertTrue(transport.calls.none { it.path == StoryAdsRepository.EVENTS_PATH })
        assertEquals(1, transport.calls.size)

        val unsafeDestination = validDecision().also { payload ->
            payload.getJSONObject("ad").getJSONObject("creative").put(
                "destination", JSONObject().put("type", "url").put("url", "https://trusted.test@evil.test/path"),
            )
        }
        assertTrue(repository(RecordingStoryAdsTransport(unsafeDestination))
            .decideStoryAd("story-1", "session-1", 0, emptyList(), 0) is StoryAdDecisionResult.Failure)
    }

    @Test
    fun refreshesExpiredSessionOnceAndRetriesSameDecisionContract() {
        val transport = RecordingStoryAdsTransport(validDecision()).apply { rejectFirstRequest = true }
        val result = StoryAdsRepository(
            sessionProvider = { storyTestSession("expired-token") },
            refreshSessionProvider = { storyTestSession("fresh-token") },
            transport = transport,
        ).decideStoryAd("story-17", "session-1", 2, listOf("story-18"), 4)

        assertTrue(result is StoryAdDecisionResult.Success)
        assertEquals(listOf("expired-token", "fresh-token"), transport.calls.map { it.accessToken })
        assertEquals(transport.calls[0].body.toString(), transport.calls[1].body.toString())
    }

    @Test
    fun eventRequestAlsoUsesRefreshedSession() {
        val transport = RecordingStoryAdsTransport(validDecision()).apply { rejectFirstEvent = true }
        val repository = StoryAdsRepository(
            sessionProvider = { storyTestSession("expired-token") },
            refreshSessionProvider = { storyTestSession("fresh-token") },
            transport = transport,
        )
        val ad = (repository.decideStoryAd("story-17", "session-1", 0, emptyList(), 0) as StoryAdDecisionResult.Success).ad!!

        assertTrue(repository.recordImpression(ad).isSuccess)
        val eventCalls = transport.calls.filter { it.path == StoryAdsRepository.EVENTS_PATH }
        assertEquals(listOf("expired-token", "fresh-token"), eventCalls.map { it.accessToken })
        assertEquals(eventCalls[0].body.toString(), eventCalls[1].body.toString())
    }

    @Test
    fun missingSessionIsReportedAsAuthenticationRequired() {
        val transport = RecordingStoryAdsTransport(validDecision())
        val result = StoryAdsRepository(sessionProvider = { null }, transport = transport)
            .decideStoryAd("story-1", "session-1", 0, emptyList(), 0)

        assertTrue(result is StoryAdDecisionResult.Failure && result.authenticationRequired)
        assertTrue(transport.calls.isEmpty())
    }
}

private data class StoryAdsCall(val path: String, val accessToken: String, val body: JSONObject)

private class RecordingStoryAdsTransport(private val response: JSONObject) : StoryAdsTransport {
    val calls = mutableListOf<StoryAdsCall>()
    var rejectFirstRequest = false
    var rejectFirstEvent = false
    private var rejectedRequest = false
    private var rejectedEvent = false

    override fun post(path: String, accessToken: String, body: JSONObject): JSONObject {
        calls += StoryAdsCall(path, accessToken, JSONObject(body.toString()))
        if (rejectFirstRequest && path == StoryAdsRepository.DECIDE_PATH && !rejectedRequest) {
            rejectedRequest = true
            throw StoryAdsHttpException(401)
        }
        if (rejectFirstEvent && path == StoryAdsRepository.EVENTS_PATH && !rejectedEvent) {
            rejectedEvent = true
            throw StoryAdsHttpException(401)
        }
        return JSONObject(response.toString())
    }
}

private fun repository(transport: StoryAdsTransport) = StoryAdsRepository(
    sessionProvider = { storyTestSession("access-token") },
    transport = transport,
)

private fun storyTestSession(token: String) = AccountSession(
    accessToken = token,
    refreshToken = "refresh-token",
    user = AccountUser("user-1", "Viewer", "viewer", null, null, emptyList()),
)

private fun validDecision() = JSONObject(
    """{"ad":{"adId":"ad-91","impressionToken":"token_abcdefgh","expiresAt":"2026-11-06T13:00:00Z","placement":"stories","slotKind":"story","format":"story","label":"Sponsored","skipAfterSeconds":5,"creative":{"media":[{"id":"media-1","kind":"video","url":"https://cdn.nantty.test/story.mp4","posterUrl":"https://cdn.nantty.test/poster.jpg","width":1080,"height":1920,"durationSeconds":7}],"headline":"A headline","primaryText":"A short sponsored message","callToAction":"Learn more","destination":{"type":"url","targetId":null,"url":"https://advertiser.test/offer"},"identity":{"name":"Brand","handle":"@brand","avatarUrl":"https://cdn.nantty.test/avatar.jpg","verifiedBusiness":true}}}}""",
)

private fun sampleAd() = StoryDecidedAd(
    adId = "ad-91",
    impressionToken = "token_abcdefgh",
    expiresAt = "2026-11-06T13:00:00Z",
    placement = "stories",
    slotKind = "story",
    format = "story",
    label = "Sponsored",
    skipAfterSeconds = 5,
    media = listOf(StoryAdMedia("image", "https://cdn.nantty.test/image.jpg", null, null, null, null)),
    headline = "Headline",
    primaryText = "Text",
    callToAction = "Learn more",
    destination = StoryAdDestination("url", null, "https://advertiser.test"),
    identity = StoryAdIdentity("Brand", "brand", null),
)
