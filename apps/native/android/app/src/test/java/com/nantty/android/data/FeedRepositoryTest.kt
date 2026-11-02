package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedRepositoryTest {
    @Test
    fun missingBaseUrlFailsClearlyWithoutRequest() {
        val result = FeedRepository("").loadForYou()
        assertTrue(result is FeedResult.Failure)
        assertTrue((result as FeedResult.Failure).message.contains("NANTTY_API_BASE_URL"))
    }

    @Test
    fun rejectsInsecureRemoteBaseUrl() {
        val result = FeedRepository("http://api.example.com").loadForYou()
        assertEquals("Feed unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2).", (result as FeedResult.Failure).message)
    }

    @Test
    fun parsesPostViewAuthorEngagementAndReadyMedia() {
        val result = FeedRepository().parsePage(
            """{"data":[{"id":"post-1","kind":"clip","author":{"name":"Ari","username":"ari","avatarUrl":"https://cdn.nantty.com/ari.jpg","verified":true,"verification":{"status":"active","color":"gold","badgeVisible":true}},"postedAs":{"name":"Ari Studio","handle":"aristudio","avatarUrl":"https://cdn.nantty.com/studio.jpg"},"text":"A real post","likes":4,"comments":2,"reposts":1,"shares":3,"createdAt":"2026-11-02T10:00:00.000Z","media":[{"id":"image-1","type":"image","url":"https://cdn.nantty.com/post.jpg","status":"ready","width":1200,"height":800},{"id":"video-1","type":"video","url":"https://cdn.nantty.com/video.mp4","posterUrl":"https://cdn.nantty.com/poster.jpg","status":"ready"},{"id":"processing","type":"image","url":"https://cdn.nantty.com/wait.jpg","status":"processing"}]}],"nextCursor":"next"}""",
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
        assertEquals(2, post.media.size)
        assertEquals("https://cdn.nantty.com/poster.jpg", post.media[1].posterUrl)
        assertEquals("next", result.nextCursor)
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
