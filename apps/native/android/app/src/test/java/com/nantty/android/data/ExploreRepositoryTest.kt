package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExploreRepositoryTest {
    @Test
    fun categoriesUseContractPathAndSafelySkipMalformedAndDuplicateRows() {
        val transport = RecordingExploreTransport(
            """{"data":[{"id":"for_you","label":"For you"},null,{"id":"for_you","label":"Duplicate"},{"id":"news","label":"News"},{"id":"sports","label":" "}]}""",
        )
        val result = ExploreRepository(transport = transport).loadCategories()

        assertEquals("/api/v1/explore/categories", transport.path)
        assertEquals(listOf(ExploreCategory("for_you", "For you"), ExploreCategory("news", "News")), (result as ExploreResult.Success).value)
    }

    @Test
    fun trendsOmitDefaultCategoryAndUseRequestedLimit() {
        val transport = RecordingExploreTransport("""{"scope":"in Nigeria","items":[{"hashtag":"afrobeats","label":"#afrobeats","category":"music","categoryLabel":"Music","postCount":12,"authorCount":7,"rank":1,"scope":"in Nigeria","context":"Music · Trending"}]}""")
        val result = ExploreRepository(transport = transport).loadTrends(limit = 8) as ExploreResult.Success

        assertEquals("/api/v1/explore/trends?limit=8", transport.path)
        assertEquals(ExploreTrend("afrobeats", "#afrobeats", "music", "Music", 12, 7, 1, "in Nigeria", "Music · Trending"), result.value.items.single())
    }

    @Test
    fun trendsSendNonDefaultCategoryAndSanitizeCountsAndRank() {
        val transport = RecordingExploreTransport("""{"items":[{"hashtag":"tech","category":"tech","categoryLabel":"Technology","postCount":-3,"authorCount":2,"rank":0}]}""")
        val result = ExploreRepository(transport = transport).loadTrends("tech") as ExploreResult.Success

        assertEquals("/api/v1/explore/trends?category=tech&limit=10", transport.path)
        assertEquals(0, result.value.items.single().postCount)
        assertEquals(1, result.value.items.single().rank)
    }

    @Test
    fun headlinesOmitDefaultCategoryAndRejectUnsafeCoverImage() {
        val transport = RecordingExploreTransport("""{"scope":"in Nigeria","items":[{"id":"headline-1","title":"A headline","summary":"Summary","category":"news","categoryLabel":"News","postIds":["p1",null,"p2"],"postCount":9,"authorCount":5,"hashtags":["lagos",null],"coverImageUrl":"javascript:alert(1)","sourceLabel":"Summarised from posts"}]}""")
        val result = ExploreRepository(transport = transport).loadHeadlines() as ExploreResult.Success

        assertEquals("/api/v1/explore/headlines", transport.path)
        assertEquals(listOf("p1", "p2"), result.value.items.single().postIds)
        assertEquals(listOf("lagos"), result.value.items.single().hashtags)
        assertNull(result.value.items.single().coverImageUrl)
    }

    @Test
    fun followSuggestionsPassLimitAndParseNestedUserContract() {
        val transport = RecordingExploreTransport("""{"data":[{"user":{"id":"user-1","name":"Ada","username":"ada","avatarUrl":"https://cdn.nantty.com/ada.jpg","verified":true,"verification":{"status":"active","type":"business","color":"gold","tier":"PREMIUM","badgeVisible":true}},"reason":{"code":"popular_in_region","label":"Popular in your region"},"isOfficial":false,"checkmarkTier":"PREMIUM","isPrivate":false},null]}""")
        val result = ExploreRepository(transport = transport).loadWhoToFollow(5) as ExploreResult.Success

        assertEquals("/api/v1/explore/who-to-follow?limit=5", transport.path)
        assertEquals(
            ExploreSuggestion(ExploreUserSummary("user-1", "Ada", "ada", "https://cdn.nantty.com/ada.jpg", true, "gold"), "popular_in_region", "Popular in your region", false, "PREMIUM", false),
            result.value.single(),
        )
    }

    @Test
    fun followSuggestionsCanIncludePrivateAccountsForTheSignedInFeedModule() {
        val transport = RecordingExploreTransport("""{"data":[]}""")
        val result = ExploreRepository(transport = transport).loadWhoToFollow(20, includePrivate = true)

        assertTrue(result is ExploreResult.Success)
        assertEquals("/api/v1/explore/who-to-follow?limit=20&includePrivate=true", transport.path)
    }

    @Test
    fun postsSendCategoryAndEncodeOpaqueCursorThenParseRankedPostPage() {
        val transport = RecordingExploreTransport(
            """{"data":[{"id":"post-1","kind":"post","author":{"id":"user-1","name":"Ada","username":"ada"},"text":"Explore post","ranking":{"boostMultiplier":1.04,"explanations":[{"code":"trending_topic","label":"Trending","detail":"afrobeats"},null]}}],"nextCursor":"next/2"}""",
        )
        val result = ExploreRepository(transport = transport).loadPosts("music", "cursor/+==") as ExploreResult.Success

        assertEquals("/api/v1/explore/posts-for-you?category=music&cursor=cursor%2F%2B%3D%3D", transport.path)
        assertEquals("post-1", result.value.posts.single().post.id)
        assertEquals(1.04, result.value.posts.single().boostMultiplier!!, 0.0001)
        assertEquals(listOf(ExploreRankingExplanation("trending_topic", "Trending", "afrobeats")), result.value.posts.single().explanations)
        assertEquals("next/2", result.value.nextCursor)
    }

    @Test
    fun requestsUseAvailableBearerTokenAndAllowGuestAccess() {
        val transport = RecordingExploreTransport("""{"data":[]}""")
        val session = AccountSession(
            accessToken = "session-token",
            refreshToken = "refresh-token",
            user = AccountUser("user-1", "Ada", "ada", null, null, emptyList()),
        )
        val repository = ExploreRepository(sessionProvider = { session }, transport = transport)
        repository.loadCategories()
        assertEquals("session-token", transport.accessToken)

        val guestTransport = RecordingExploreTransport("""{"data":[]}""")
        assertTrue(ExploreRepository(transport = guestTransport).loadCategories() is ExploreResult.Success)
        assertNull(guestTransport.accessToken)
    }

    @Test
    fun malformedRequiredPayloadAndBadFiltersReturnActionableFailures() {
        val transport = RecordingExploreTransport("""{"items":[]}""")
        val repository = ExploreRepository(transport = transport)

        val malformed = repository.loadCategories() as ExploreResult.Failure
        assertTrue(malformed.message.contains("incomplete Explore categories"))
        assertFalse(malformed.authenticationRequired)
        assertTrue(repository.loadPosts("unknown") is ExploreResult.Failure)
        assertTrue(repository.loadWhoToFollow(0) is ExploreResult.Failure)
        assertTrue(repository.loadPosts(cursor = "x".repeat(ExploreRepository.MAX_CURSOR_LENGTH + 1)) is ExploreResult.Failure)
    }

    @Test
    fun forbiddenResponseIsNotReportedAsAuthenticationRequiredUnlessTransportIdentifiesIt() {
        val transport = ExploreTransport { _, _ -> throw ExploreHttpException(403) }
        val result = ExploreRepository(transport = transport).loadCategories() as ExploreResult.Failure

        assertTrue(result.authenticationRequired)
        assertTrue(result.message.contains("Sign in"))
    }

    private class RecordingExploreTransport(private val body: String) : ExploreTransport {
        var path: String? = null
        var accessToken: String? = null

        override fun get(path: String, accessToken: String?): JSONObject {
            this.path = path
            this.accessToken = accessToken
            return JSONObject(body)
        }
    }
}
