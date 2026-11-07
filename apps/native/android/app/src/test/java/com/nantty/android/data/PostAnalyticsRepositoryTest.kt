package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PostAnalyticsRepositoryTest {
    @Test
    fun requiresAuthenticatedSessionWithoutCallingTransport() {
        val transport = RecordingPostAnalyticsTransport(analyticsEnvelope())
        val result = PostAnalyticsRepository(sessionProvider = { null }, transport = transport).load("post-1")

        assertTrue(result is PostAnalyticsResult.Failure && result.authenticationRequired)
        assertTrue(transport.paths.isEmpty())
    }

    @Test
    fun requestsOnlyTheValidatedPostAnalyticsRouteAndParsesEnvelopeOnce() {
        val transport = RecordingPostAnalyticsTransport(analyticsEnvelope())
        val result = PostAnalyticsRepository(sessionProvider = ::session, transport = transport).load("post-1")

        assertEquals(listOf("/api/v1/posts/post-1/analytics"), transport.paths)
        assertEquals(listOf("access-token"), transport.tokens)
        val analytics = (result as PostAnalyticsResult.Success).analytics
        assertEquals("post-1", analytics.postId)
        assertEquals("post", analytics.kind)
        assertEquals("Ari", analytics.authorName)
        assertEquals(120, analytics.impressions)
        assertEquals(72, analytics.uniqueViewers)
        assertEquals(72, analytics.reach)
        assertEquals(24, analytics.likes)
        assertEquals(0.2, analytics.engagementRate, 0.0001)
        assertEquals(2, analytics.audience.size)
        assertEquals(7, analytics.daily.size)
        assertEquals(45, analytics.video?.watchTimeSeconds)
    }

    @Test
    fun rejectsUnsafeIdsAndResponsesForDifferentPosts() {
        val transport = RecordingPostAnalyticsTransport(analyticsEnvelope())
        val repository = PostAnalyticsRepository(sessionProvider = ::session, transport = transport)

        assertTrue(repository.load("../other") is PostAnalyticsResult.Failure)
        assertTrue(transport.paths.isEmpty())
        assertTrue(runCatching { parsePostAnalytics(JSONObject("""{"postId":"other"}"""), "post-1") }.isFailure)
        assertEquals("/api/v1/posts/post%20with%20space/analytics", buildPostAnalyticsPath("post with space"))
    }

    @Test
    fun distinguishesAuthenticationPrivateAndDeletedResponses() {
        val unauthorized = repositoryWithStatus(401).load("post-1") as PostAnalyticsResult.Failure
        val private = repositoryWithStatus(403).load("post-1") as PostAnalyticsResult.Failure
        val deleted = repositoryWithStatus(404).load("post-1") as PostAnalyticsResult.Failure

        assertTrue(unauthorized.authenticationRequired)
        assertFalse(private.authenticationRequired)
        assertTrue(private.message.contains("private"))
        assertTrue(deleted.message.contains("isn't available"))
    }

    private fun repositoryWithStatus(status: Int) = PostAnalyticsRepository(
        sessionProvider = ::session,
        transport = PostAnalyticsTransport { _, _ -> throw PostAnalyticsHttpException(status) },
    )
}

private class RecordingPostAnalyticsTransport(private val response: JSONObject) : PostAnalyticsTransport {
    val paths = mutableListOf<String>()
    val tokens = mutableListOf<String>()

    override fun get(path: String, accessToken: String): JSONObject {
        paths += path
        tokens += accessToken
        return response
    }
}

private fun session() = AccountSession(
    accessToken = "access-token",
    refreshToken = "refresh-token",
    user = AccountUser("author-1", "Ari", "ari", null, null, emptyList()),
)

private fun analyticsEnvelope() = JSONObject(
    """{"data":{
        "postId":"post-1","kind":"post","hasLink":true,
        "author":{"id":"author-1","name":"Ari"},"postedAt":"2026-11-07T10:00:00Z",
        "impressions":120,"uniqueViewers":72,"reach":72,"likes":24,"comments":8,"reposts":3,
        "shares":4,"saves":5,"profileVisits":6,"linkClicks":2,"newFollows":1,"engagements":24,
        "engagementRate":0.2,"video":{"views":7,"watchTimeSeconds":45,"averageWatchSeconds":6.4,"completedViews":2,"completionRate":0.285},
        "audience":[{"label":"Followers","share":30},{"label":"Non-followers","share":70}],
        "daily":[
            {"day":"2026-11-01","impressions":10},{"day":"2026-11-02","impressions":11},
            {"day":"2026-11-03","impressions":12},{"day":"2026-11-04","impressions":13},
            {"day":"2026-11-05","impressions":14},{"day":"2026-11-06","impressions":15},
            {"day":"2026-11-07","impressions":16},{"day":"invalid","impressions":100}
        ]
    }}""",
)
