package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

class PostDetailRepositoryTest {
    @Test
    fun threadPathUsesSupportedSortAndCursorEncoding() {
        assertEquals(
            "/api/v1/posts/post%20one/thread?sort=latest&cursor=cursor%20%2F%2B",
            buildPostThreadPath("post one", ThreadSort.LATEST, "cursor /+"),
        )
        assertEquals(
            "/api/v1/posts/post-1/thread?sort=likes",
            buildPostThreadPath("post-1", ThreadSort.MOST_LIKED, null),
        )
        assertEquals(
            "/api/v1/posts/post-1/thread?sort=relevant&filter=quotes&cursor=cursor%20%2F%2B",
            buildPostThreadPath("post-1", ThreadSort.RELEVANT, "cursor /+", PostThreadFilter.QUOTES),
        )
    }

    @Test
    fun quoteFilterLoadsTypedQuoteRowsAndPreservesQuotedPostPreview() {
        val transport = RecordingTransport().apply {
            responses += JSONObject("""{"data":{"id":"post-1","text":"Original post","quotes":1,"author":{"name":"Ari","username":"ari"}}}""")
            responses += JSONObject("""{"data":[{"type":"quote","id":"quote-post-1","postId":"post-1","quotePost":{"id":"quote-post-1","kind":"post","author":{"name":"Bea","username":"bea","avatarUrl":"https://cdn.nantty.com/bea.jpg","verified":true,"verification":{"color":"blue"}},"text":"A quoted response","thumbnail":{"type":"image","url":"https://cdn.nantty.com/quote.jpg","blurhash":null},"mediaCount":1,"createdAt":"2026-11-06T10:00:00Z"},"likes":2,"commentCount":0,"isPostAuthor":false,"createdAt":"2026-11-06T10:00:00Z"}],"nextCursor":null}""")
        }

        val result = PostDetailRepository("https://api.nantty.com", { null }, transport)
            .load("post-1", sort = ThreadSort.RELEVANT, filter = PostThreadFilter.QUOTES) as PostDetailResult.Success

        assertEquals("/api/v1/posts/post-1/thread?sort=relevant&filter=quotes", transport.calls[1].path)
        assertEquals(1, result.post.quotes)
        assertTrue(result.comments.isEmpty())
        assertEquals("quote-post-1", result.quotes.single().id)
        assertEquals("Bea", result.quotes.single().quotedPost.authorName)
        assertEquals("A quoted response", result.quotes.single().quotedPost.text)
        assertEquals("https://cdn.nantty.com/quote.jpg", result.quotes.single().quotedPost.thumbnailUrl)
        assertEquals(listOf(PostThreadRow.Quote(result.quotes.single())), result.threadRows)
    }

    @Test
    fun commentThreadPathEncodesCommentIdAndPaginationCursor() {
        assertEquals(
            "/api/v1/comments/comment%20one%2Ftwo/thread?cursor=cursor%20%2F%2B",
            buildCommentThreadPath("comment one/two", "cursor /+"),
        )
        assertEquals("/api/v1/comments/comment-1/thread", buildCommentThreadPath("comment-1", null))
    }

    @Test
    fun commentRepliesUseExistingPaginatedThreadEndpointAndParseRows() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply {
            responses += JSONObject("""{"data":{"data":[{"id":"reply-1","text":"A nested reply","replyCount":0,"author":{"name":"Bea","username":"bea"}}],"nextCursor":"next /+"}}""")
        }

        val page = PostDetailRepository("https://api.nantty.com", { session }, transport)
            .loadCommentReplies("comment one/two", "older cursor").getOrThrow()

        assertEquals("GET", transport.calls.single().method)
        assertEquals("/api/v1/comments/comment%20one%2Ftwo/thread?cursor=older%20cursor", transport.calls.single().path)
        assertEquals("access-secret", transport.calls.single().accessToken)
        assertEquals("reply-1", page.comments.single().id)
        assertEquals("A nested reply", page.comments.single().text)
        assertEquals("next /+", page.nextCursor)
    }

    @Test
    fun commentRepliesRejectBlankIdWithoutNetworkRequest() {
        val transport = RecordingTransport()

        assertTrue(PostDetailRepository("https://api.nantty.com", { null }, transport).loadCommentReplies(" ").isFailure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun paginationHelpersRemoveDuplicateRootsAndDetectRepeatedCursors() {
        val first = threadComment("root-1", "First")
        val second = threadComment("root-2", "Second")

        assertEquals(listOf(first, second), appendUniqueThreadComments(listOf(first), listOf(first, second)))
        assertTrue(isRepeatedThreadCursor("cursor-2", "cursor-2", setOf("cursor-1")))
        assertTrue(isRepeatedThreadCursor("cursor-3", "cursor-1", setOf("cursor-1", "cursor-2")))
        assertFalse(isRepeatedThreadCursor("cursor-2", null, setOf("cursor-1")))
        assertFalse(isRepeatedThreadCursor("cursor-2", "cursor-3", setOf("cursor-1")))
    }

    @Test
    fun extractsOnlyUniqueSafeHttpsLinksFromPostText() {
        assertEquals(
            listOf("https://example.com/story", "https://another.example/path?x=1"),
            extractSafePostLinks("Read https://example.com/story. Then https://example.com/story and https://another.example/path?x=1, but ignore http://insecure.example and javascript:alert(1)."),
        )
    }

    @Test
    fun rejectsCredentialsAndMalformedExternalLinks() {
        assertEquals(emptyList<String>(), extractSafePostLinks("https://user:password@example.com https:// https://?bad"))
    }

    @Test
    fun parsesPostMediaAndNestedThreadFromApiShape() {
        val transport = RecordingTransport().apply {
            responses += JSONObject("""{"data":{"id":"post-1","text":"Actual post","createdAt":"2026-11-02T10:00:00Z","author":{"name":"Ari","username":"ari","avatarUrl":"https://cdn.nantty.com/ari.jpg"},"likes":3,"comments":1,"reposts":2,"liked":true,"reposted":false,"bookmarked":true,"media":[{"id":"m1","type":"image","url":"https://cdn.nantty.com/post.jpg","status":"ready"},{"id":"m2","type":"image","url":"https://cdn.nantty.com/pending.jpg","status":"processing"}]}}""")
            responses += JSONObject("""{"data":[{"type":"comment","id":"c1","text":"Root reply","createdAt":"2026-11-02T10:01:00Z","likes":2,"liked":true,"replyCount":1,"connector":{"depth":0},"author":{"name":"Bea","username":"bea"},"media":[{"id":"cm1","type":"image","url":"https://cdn.nantty.com/reply.jpg","status":"ready"}],"inlineReplies":[{"type":"comment","id":"c2","text":"Nested reply","createdAt":"2026-11-02T10:02:00Z","likes":0,"liked":false,"replyCount":0,"connector":{"depth":1},"author":{"name":"Cal","username":"cal"},"inlineReplies":[]}]}],"nextCursor":"next-cursor"}""")
        }

        val result = PostDetailRepository("https://api.nantty.com", { null }, transport).load("post-1") as PostDetailResult.Success

        assertEquals("Actual post", result.post.text)
        assertEquals(listOf(3, 2, true, false, true), listOf(result.post.likes, result.post.reposts, result.post.liked, result.post.reposted, result.post.bookmarked))
        assertEquals(listOf("https://cdn.nantty.com/post.jpg"), result.post.media.map { it.url })
        assertEquals("Root reply", result.comments.single().text)
        assertEquals(0, result.comments.single().depth)
        assertEquals("Nested reply", result.comments.single().replies.single().text)
        assertEquals(listOf(true, false), listOf(result.comments.single().liked, result.comments.single().replies.single().liked))
        assertEquals(1, result.comments.single().replies.single().depth)
        assertEquals("https://cdn.nantty.com/reply.jpg", result.comments.single().media.single().url)
        assertEquals("next-cursor", result.nextCursor)
        assertEquals("GET", transport.calls[0].method)
        assertEquals("/api/v1/posts/post-1", transport.calls[0].path)
        assertEquals("/api/v1/posts/post-1/thread?sort=relevant", transport.calls[1].path)
    }

    @Test
    fun replyUsesExistingAuthenticatedCommentContractAndParentId() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply { responses += JSONObject("{}") }
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        val result = repository.reply("post-1", "  A reply  ", "parent-1")

        assertTrue(result.isSuccess)
        val call = transport.calls.single()
        assertEquals("POST", call.method)
        assertEquals("/api/v1/posts/post-1/comments", call.path)
        assertEquals("access-secret", call.accessToken)
        assertEquals("A reply", call.body?.getString("text"))
        assertEquals("parent-1", call.body?.getString("parentCommentId"))
    }

    @Test
    fun replyCanUseLoadedManagedProfileWithoutChangingBearerOrParentContract() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply { responses += JSONObject("{}") }
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        val result = repository.reply("post-1", "A reply", "parent-1", "brand-1", expectedAccountId = "u1")

        assertTrue(result.isSuccess)
        val call = transport.calls.single()
        assertEquals("access-secret", call.accessToken)
        assertEquals("brand-1", call.body?.getString("asProfileId"))
        assertEquals("parent-1", call.body?.getString("parentCommentId"))
    }

    @Test
    fun commentProfilesUseAuthenticatedExistingRouteAndExcludeHeldOrNonCommentProfiles() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply {
            responses += JSONObject("""{"data":[
                {"id":"business-1","kind":"business","name":"Ari Goods","handle":"arigoods","onHold":false},
                {"id":"brand-1","kind":"brand","name":"Ari Studio","handle":"aristudio","onHold":false},
                {"id":"store-1","kind":"store","name":"Ari Shop","handle":"arishop","onHold":true},
                {"id":"gov-1","kind":"government","name":"Office","handle":"office","onHold":false},
                {"id":"person-1","kind":"person","name":"Ari","handle":"ari","onHold":false}
            ],"nextCursor":null}""")
        }

        val profiles = PostDetailRepository("https://api.nantty.com", { session }, transport)
            .listCommentProfiles("u1").getOrThrow()

        assertEquals(listOf("business-1", "brand-1"), profiles.map { it.id })
        assertEquals("GET", transport.calls.single().method)
        assertEquals("/api/v1/users/me/profiles", transport.calls.single().path)
        assertEquals("access-secret", transport.calls.single().accessToken)
    }

    @Test
    fun missingOnHoldForManagedProfileFailsClosedAndAccountMismatchDoesNotRequest() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply {
            responses += JSONObject("""{"data":[{"id":"brand-1","kind":"brand","name":"Ari Studio","handle":"aristudio"}]}""")
        }
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        assertTrue(repository.listCommentProfiles("u1").isFailure)
        assertTrue(repository.listCommentProfiles("another-account").isFailure)
        assertEquals(1, transport.calls.size)
    }

    @Test
    fun unauthenticatedReplyIsBlockedBeforeNetworkRequest() {
        val transport = RecordingTransport()
        val result = PostDetailRepository("https://api.nantty.com", { null }, transport).reply("post-1", "hello")

        assertFalse(result.isSuccess)
        assertTrue(result.exceptionOrNull()?.message.orEmpty().contains("Sign in"))
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun replyRejectsAProfileSelectionFromAnotherAccountBeforeNetworkRequest() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        val result = repository.reply("post-1", "hello", asProfileId = "old-account-profile", expectedAccountId = "u2")

        assertTrue(result.isFailure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun likeAndUnlikeUseAuthenticatedPostRoutesWithoutInventedPayloads() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply { responses += JSONObject("{}" ); responses += JSONObject("{}") }
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        assertTrue(repository.setLiked("post-1", true).isSuccess)
        assertTrue(repository.setLiked("post-1", false).isSuccess)
        assertEquals(listOf("POST", "DELETE"), transport.calls.map { it.method })
        assertEquals("/api/v1/posts/post-1/like", transport.calls.first().path)
        assertTrue(transport.calls.all { it.accessToken == "access-secret" && it.body == null })
    }

    @Test
    fun commentLikeAndUnlikeUseTheAuthenticatedCommentRouteAndBoundAccount() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply { responses += JSONObject("{}"); responses += JSONObject("{}") }
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        assertTrue(repository.setCommentLiked("comment/one", true, "u1").isSuccess)
        assertTrue(repository.setCommentLiked("comment/one", false, "u1").isSuccess)

        assertEquals(listOf("POST", "DELETE"), transport.calls.map { it.method })
        assertEquals("/api/v1/comments/comment%2Fone/like", transport.calls.first().path)
        assertTrue(transport.calls.all { it.accessToken == "access-secret" && it.body == null })
    }

    @Test
    fun commentLikeRejectsMissingSessionTokenAndChangedAccountBeforeNetworkRequest() {
        val transport = RecordingTransport()
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))

        assertTrue(PostDetailRepository("https://api.nantty.com", { null }, transport).setCommentLiked("comment-1", true, "u1").isFailure)
        assertTrue(PostDetailRepository("https://api.nantty.com", { session }, transport).setCommentLiked("comment-1", true, "u2").isFailure)
        assertTrue(PostDetailRepository("https://api.nantty.com", { session.copy(accessToken = "") }, transport).setCommentLiked("comment-1", true, "u1").isFailure)
        assertTrue(PostDetailRepository("https://api.nantty.com", { session }, transport).setCommentLiked(" ", true, "u1").isFailure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun updatingNestedCommentLikePreservesTreeAndIsIdempotent() {
        val nested = threadComment("nested", "Nested").copy(likes = 4)
        val root = threadComment("root", "Root").copy(replies = listOf(nested))

        val liked = updateThreadCommentLike(listOf(root), "nested", true)
        val likedAgain = updateThreadCommentLike(liked, "nested", true)
        val unliked = updateThreadCommentLike(likedAgain, "nested", false)

        assertEquals("Root", unliked.single().text)
        assertEquals("Nested", unliked.single().replies.single().text)
        assertEquals(4, unliked.single().replies.single().likes)
        assertFalse(unliked.single().replies.single().liked)
    }

    @Test
    fun repostAndUndoUseAuthenticatedPostRoutesAndDocumentedEmptyPostBody() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply { responses += JSONObject("{}"); responses += JSONObject("{}") }
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        assertTrue(repository.setReposted("post-1", true).isSuccess)
        assertTrue(repository.setReposted("post-1", false).isSuccess)
        assertEquals(listOf("POST", "DELETE"), transport.calls.map { it.method })
        assertTrue(transport.calls.all { it.path == "/api/v1/posts/post-1/repost" && it.accessToken == "access-secret" })
        assertTrue(transport.calls.first().body?.length() == 0)
        assertEquals(null, transport.calls.last().body)
    }

    @Test
    fun saveAndUnsaveUseTheExistingAuthenticatedSavesContract() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply { responses += JSONObject(); responses += JSONObject() }
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        assertTrue(repository.setSaved("post-1", true).isSuccess)
        assertTrue(repository.setSaved("post 2/+", false).isSuccess)
        assertEquals(listOf("POST", "DELETE"), transport.calls.map { it.method })
        assertEquals("/api/v1/saves", transport.calls[0].path)
        assertEquals("post", transport.calls[0].body?.getString("type"))
        assertEquals("post-1", transport.calls[0].body?.getString("targetId"))
        assertEquals("/api/v1/saves?type=post&targetId=post%202%2F%2B", transport.calls[1].path)
        assertEquals(null, transport.calls[1].body)
        assertTrue(transport.calls.all { it.accessToken == "access-secret" })
    }

    @Test
    fun shareUsesOptionalAuthEmptyBodyAndExistingPostShareRoute() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        assertTrue(repository.recordPostShare("post-1").isSuccess)

        val call = transport.calls.single()
        assertEquals("POST", call.method)
        assertEquals("/api/v1/posts/post-1/share", call.path)
        assertEquals("access-secret", call.accessToken)
        assertEquals(0, call.body?.length())
    }

    @Test
    fun shareCanBeRecordedForGuestAndEncodesPostIdAsOnePathSegment() {
        val transport = RecordingTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { null }, transport)

        assertTrue(repository.recordPostShare("post/one").isSuccess)

        assertEquals("/api/v1/posts/post%2Fone/share", transport.calls.single().path)
        assertEquals(null, transport.calls.single().accessToken)
    }

    @Test
    fun shareRejectsMissingPostIdWithoutNetworkRequest() {
        val transport = RecordingTransport()

        assertTrue(PostDetailRepository("https://api.nantty.com", { null }, transport).recordPostShare(" ").isFailure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun linkClickUsesAuthenticatedBatchContractWithoutSendingDestinationUrl() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport().apply { responses += JSONObject("""{"accepted":1,"skipped":0}""") }

        val result = PostDetailRepository("https://api.nantty.com", { session }, transport)
            .recordPostLinkClick("post-1", expectedAccountId = "u1")

        assertTrue(result.isSuccess)
        val call = transport.calls.single()
        val event = call.body?.getJSONArray("events")?.getJSONObject(0)
        assertEquals("POST", call.method)
        assertEquals("/api/v1/feeds/interactions/batch", call.path)
        assertEquals("access-secret", call.accessToken)
        assertEquals("post-1", event?.getString("postId"))
        assertEquals("link_click", event?.getString("kind"))
        assertEquals("post_detail", event?.getString("surface"))
        assertFalse(call.body.toString().contains("https://"))
    }

    @Test
    fun linkClickRejectsSignedOutAndChangedAccountsBeforeNetworkRequest() {
        val transport = RecordingTransport()
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)

        assertTrue(PostDetailRepository("https://api.nantty.com", { null }, transport).recordPostLinkClick("post-1", "u1").isFailure)
        assertTrue(repository.recordPostLinkClick("post-1", expectedAccountId = "u2").isFailure)
        assertTrue(repository.recordPostLinkClick(" ", expectedAccountId = "u1").isFailure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun savingIsBlockedBeforeNetworkWhenNoSessionIsAvailable() {
        val transport = RecordingTransport()
        val result = PostDetailRepository("https://api.nantty.com", { null }, transport).setSaved("post-1", true)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message.orEmpty().contains("Sign in"))
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun savingIsBlockedWhenTheCurrentSessionHasNoBearerToken() {
        val guestSession = AccountSession("", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport()

        assertTrue(PostDetailRepository("https://api.nantty.com", { guestSession }, transport).setSaved("post-1", true).isFailure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun reactionWritesAreBlockedBeforeNetworkWhenNoEncryptedSessionIsAvailable() {
        val transport = RecordingTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { null }, transport)

        assertTrue(repository.setLiked("post-1", true).isFailure)
        assertTrue(repository.setReposted("post-1", true).isFailure)
        assertTrue(transport.calls.isEmpty())
    }

    @Test
    fun videoReplyThumbnailIsRenderedAsSupportedCommentMedia() {
        val transport = RecordingTransport().apply {
            responses += JSONObject("""{"id":"p1","author":{"name":"Ari"},"media":[]}""")
            responses += JSONObject("""{"data":[{"id":"c1","text":"Watch this","author":{"name":"Bea"},"videoReplies":[{"clipId":"clip-1","thumbnailUrl":"https://cdn.nantty.com/clip.jpg","createdAt":"2026-11-02T10:00:00Z"}]}]}""")
        }

        val result = PostDetailRepository("https://api.nantty.com", { null }, transport).load("p1") as PostDetailResult.Success

        val media = result.comments.single().media.single()
        assertEquals("video", media.type)
        assertEquals("https://cdn.nantty.com/clip.jpg", media.posterUrl)
    }

    private fun threadComment(id: String, text: String) = ThreadComment(
        id = id,
        authorName = "Ari",
        username = "ari",
        avatarUrl = null,
        text = text,
        createdAt = "",
        likes = 0,
        replyCount = 0,
        depth = 0,
        media = emptyList(),
        replies = emptyList(),
    )

    private class RecordingTransport : PostDetailTransport {
        data class Call(val method: String, val path: String, val accessToken: String?, val body: JSONObject?)
        val calls = mutableListOf<Call>()
        val responses = ArrayDeque<JSONObject>()

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject {
            calls += Call(method, path, accessToken, body)
            return responses.removeFirstOrNull() ?: JSONObject()
        }
    }
}
