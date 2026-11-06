package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class FeedRepositoryTest {
    @Test
    fun missingBaseUrlFailsClearlyWithoutRequest() {
        val result = FeedRepository("").loadForYou()
        assertTrue(result is FeedResult.Failure)
        assertTrue((result as FeedResult.Failure).message.contains("NANTTY_API_BASE_URL"))
    }

    @Test
    fun feedUrlEncodesOpaqueCursorAndKeepsPageSizeBounded() {
        val url = buildForYouUrl("https://api.nantty.com/", "opaque cursor/+==")

        assertEquals(
            "https://api.nantty.com/api/v1/feeds/for-you?limit=10&cursor=opaque+cursor%2F%2B%3D%3D",
            url.toString(),
        )
    }

    @Test
    fun forYouTopicFilterIsEncodedAndFollowingFeedIgnoresTopic() {
        assertEquals(
            "https://api.nantty.com/api/v1/feeds/for-you?limit=10&cursor=cursor%2F2&topicId=street+food",
            buildForYouUrl("https://api.nantty.com/", "cursor/2", "street food").toString(),
        )
        assertEquals(
            "https://api.nantty.com/api/v1/feeds/following?limit=10",
            buildFeedUrl("https://api.nantty.com/", FeedType.FOLLOWING, null, "street-food").toString(),
        )
    }

    @Test
    fun followedTopicsRequireSessionAndUseAuthenticatedUserTopicsRoute() {
        var opened = false
        val noSessionRepository = FeedRepository("https://api.nantty.com") {
            opened = true
            error("No request should be made without an access token")
        }
        assertEquals(FeedTopicsResult.AuthenticationRequired, noSessionRepository.loadFollowedTopics(null))
        assertEquals(false, opened)

        lateinit var requestedUrl: URL
        lateinit var connection: RecordingConnection
        val repository = FeedRepository("https://api.nantty.com/") { url ->
            requestedUrl = url
            RecordingConnection(url, 200, """{"data":[{"id":"fashion","name":"Fashion"}]}""").also { connection = it }
        }
        val result = repository.loadFollowedTopics("access-token") as FeedTopicsResult.Success

        assertEquals("https://api.nantty.com/api/v1/users/me/topics", requestedUrl.toString())
        assertEquals("GET", connection.requestMethod)
        assertEquals("Bearer access-token", connection.headers["Authorization"])
        assertEquals(listOf(FeedTopic("fashion", "Fashion")), result.topics)
    }

    @Test
    fun topicParsingDropsMalformedAndDuplicateRowsWithoutInventingTopics() {
        val result = FeedRepository().parseTopics(
            """{"data":[{"id":"fashion","name":"Fashion"},{"id":"fashion","name":"Duplicate"},{"id":"","name":"Missing ID"},{"id":"music","name":"  "},null]}""",
        ) as FeedTopicsResult.Success

        assertEquals(listOf(FeedTopic("fashion", "Fashion")), result.topics)
    }

    @Test
    fun followingUrlUsesAuthenticatedFeedRouteAndOpaqueCursor() {
        assertEquals(
            "https://api.nantty.com/api/v1/feeds/following?limit=10&cursor=opaque+cursor%2F%2B%3D%3D",
            buildFollowingUrl("https://api.nantty.com/", "opaque cursor/+==").toString(),
        )
    }

    @Test
    fun followingFeedDoesNotSendRequestWithoutSessionToken() {
        var opened = false
        val repository = FeedRepository("https://api.nantty.com") {
            opened = true
            error("No connection should be opened without a session")
        }

        assertEquals(FeedResult.AuthenticationRequired, repository.loadFollowing(null))
        assertEquals(false, opened)
        assertEquals(FeedResult.AuthenticationRequired, repository.loadFollowing("  "))
    }

    @Test
    fun followingRequestSendsBearerTokenAndCursorToExpectedRoute() {
        lateinit var requestedUrl: URL
        lateinit var connection: RecordingConnection
        val repository = FeedRepository("https://api.nantty.com") { url ->
            requestedUrl = url
            RecordingConnection(url, 200, """{"data":[],"nextCursor":"next"}""").also { connection = it }
        }

        val result = repository.loadFollowing("access-token", "cursor-2")

        assertEquals("https://api.nantty.com/api/v1/feeds/following?limit=10&cursor=cursor-2", requestedUrl.toString())
        assertEquals("GET", connection.requestMethod)
        assertEquals("Bearer access-token", connection.headers["Authorization"])
        assertTrue(result is FeedResult.Success)
    }

    @Test
    fun followingHttpUnauthorizedBecomesAuthenticationRequired() {
        val repository = FeedRepository("https://api.nantty.com") { url -> RecordingConnection(url, 401, "{}") }
        assertEquals(FeedResult.AuthenticationRequired, repository.loadFollowing("expired-token"))
    }

    @Test
    fun followingForbiddenResponseIsNotMisreportedAsAnExpiredSession() {
        val repository = FeedRepository("https://api.nantty.com") { url -> RecordingConnection(url, 403, "{}") }
        assertEquals("Feed request failed (HTTP 403). Please try again later.", (repository.loadFollowing("access-token") as FeedResult.Failure).message)
    }

    @Test
    fun appendsNewPageInOrderWithoutRepeatingIds() {
        val first = FeedRepository().parsePage(
            """{"data":[{"id":"post-1","author":{"name":"Ari"}}],"nextCursor":"next"}""",
        ) as FeedResult.Success
        val second = FeedRepository().parsePage(
            """{"data":[{"id":"post-1","author":{"name":"Ari"}},{"id":"post-2","author":{"name":"Sam"}}],"nextCursor":null}""",
        ) as FeedResult.Success

        assertEquals(listOf("post-1", "post-2"), appendUniqueFeedPosts(first.posts, second.posts).map(FeedPost::id))
    }

    @Test
    fun rejectsInsecureRemoteBaseUrl() {
        val result = FeedRepository("http://api.example.com").loadForYou()
        assertEquals("Feed unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2).", (result as FeedResult.Failure).message)
    }

    @Test
    fun parsesPostViewAuthorEngagementAndReadyMedia() {
        val result = FeedRepository().parsePage(
            """{"data":[{"id":"post-1","kind":"clip","author":{"id":"author-1","name":"Ari","username":"ari","avatarUrl":"https://cdn.nantty.com/ari.jpg","verified":true,"verification":{"status":"active","color":"gold","badgeVisible":true}},"postedAs":{"name":"Ari Studio","handle":"aristudio","avatarUrl":"https://cdn.nantty.com/studio.jpg"},"text":"A real post","likes":4,"comments":2,"reposts":1,"shares":3,"liked":true,"reposted":false,"bookmarked":true,"isFollowingAuthor":true,"createdAt":"2026-11-02T10:00:00.000Z","media":[{"id":"image-1","type":"image","url":"https://cdn.nantty.com/post.jpg","status":"ready","width":1200,"height":800},{"id":"video-1","type":"video","url":"https://cdn.nantty.com/video.mp4","posterUrl":"https://cdn.nantty.com/poster.jpg","status":"ready"},{"id":"processing","type":"image","url":"https://cdn.nantty.com/wait.jpg","status":"processing"}]}],"nextCursor":"next"}""",
        ) as FeedResult.Success

        val post = result.posts.single()
        assertEquals("Ari", post.authorName)
        assertEquals("https://cdn.nantty.com/ari.jpg", post.avatarUrl)
        assertTrue(post.verified)
        assertEquals("gold", post.verificationColor)
        assertEquals("Ari Studio", post.postedAsName)
        assertEquals("aristudio", post.postedAsHandle)
        assertEquals("https://cdn.nantty.com/studio.jpg", post.postedAsAvatarUrl)
        assertEquals("clip", post.kind)
        assertEquals(listOf(4, 2, 1, 3), listOf(post.likes, post.comments, post.reposts, post.shares))
        assertEquals(true, post.liked)
        assertEquals(false, post.reposted)
        assertEquals(true, post.bookmarked)
        assertEquals("author-1", post.authorId)
        assertTrue(post.isFollowingAuthor)
        assertEquals(2, post.media.size)
        assertEquals("https://cdn.nantty.com/poster.jpg", post.media[1].posterUrl)
        assertEquals("next", result.nextCursor)
    }

    @Test
    fun parsesEmbeddedQuotedPostAndUnavailableQuoteState() {
        val result = FeedRepository().parsePage(
            """{"data":[{"id":"quote-1","kind":"post","text":"My thought","isQuote":true,"resharedFromUnavailable":false,"resharedFrom":{"id":"original-1","kind":"post","text":"Original post text","createdAt":"2026-11-05T10:00:00Z","author":{"id":"author-1","name":"Ada","username":"ada","avatarUrl":"https://cdn.nantty.com/ada.jpg","verification":{"status":"active","color":"gold","badgeVisible":true}},"media":[{"id":"original-image","type":"image","url":"https://cdn.nantty.com/original.jpg","status":"ready"}]}},{"id":"quote-2","resharedFromUnavailable":true},{"id":"quote-3","resharedFrom":{"id":""}}]}""",
        ) as FeedResult.Success

        val embedded = result.posts.first()
        assertEquals(true, embedded.isQuote)
        assertEquals("original-1", embedded.quotedPost?.id)
        assertEquals("Ada", embedded.quotedPost?.authorName)
        assertEquals("gold", embedded.quotedPost?.verificationColor)
        assertEquals("Original post text", embedded.quotedPost?.text)
        assertEquals("https://cdn.nantty.com/original.jpg", embedded.quotedPost?.thumbnailUrl)
        val unavailable = result.posts.last()
        assertEquals(null, unavailable.quotedPost)
        assertEquals(true, unavailable.quotedPostUnavailable)
        assertEquals(true, result.posts[1].quotedPostUnavailable)
    }

    @Test
    fun ignoresUntrustedAndNotReadyMediaUrls() {
        val result = FeedRepository().parsePage(
            """{"data":[{"id":"post-1","author":{},"media":[{"type":"image","url":"http://cdn.example.com/image.jpg","status":"ready"},{"type":"image","url":"https://user:pass@cdn.example.com/image.jpg","status":"ready"},{"type":"image","url":"https://cdn.example.com/working.jpg","status":"processing"},{"type":"image","url":"https://cdn.example.com/valid.jpg","status":"ready"}]}]}""",
        ) as FeedResult.Success

        assertEquals(listOf("https://cdn.example.com/valid.jpg"), result.posts.single().media.map { it.url })
    }

    @Test
    fun doesNotShowLegacyBlueBadgeWhenModernVerificationIsInactive() {
        val result = FeedRepository().parsePage(
            """{"data":[{"id":"post-1","author":{"name":"Ari","username":"ari","verified":true,"verification":{"status":"expired","color":"gold","badgeVisible":false,"tier":"VERIFIED"}}}]}""",
        ) as FeedResult.Success

        assertEquals(false, result.posts.single().verified)
        assertEquals(null, result.posts.single().verificationColor)
    }
}

private class RecordingConnection(
    url: URL,
    private val status: Int,
    private val responseBody: String,
) : HttpURLConnection(url) {
    val headers = mutableMapOf<String, String>()

    override fun setRequestProperty(key: String, value: String) {
        headers[key] = value
    }

    override fun getResponseCode(): Int = status

    override fun getInputStream() = ByteArrayInputStream(responseBody.toByteArray())

    override fun getErrorStream() = ByteArrayInputStream(responseBody.toByteArray())

    override fun connect() = Unit

    override fun disconnect() = Unit

    override fun usingProxy(): Boolean = false
}
