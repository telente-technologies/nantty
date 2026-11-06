package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

class ClipsRepositoryTest {
    @Test
    fun clipsPathUsesSocialFeedContractAndEncodesCursor() {
        assertEquals("/api/v1/clips?tab=forYou&limit=10", buildClipsPath(ClipsFeedTab.FOR_YOU, null))
        assertEquals("/api/v1/clips?tab=following&limit=10&cursor=opaque+cursor%2F2", buildClipsPath(ClipsFeedTab.FOLLOWING, "opaque cursor/2"))
    }

    @Test
    fun followingRequiresSessionAndDoesNotCallTransport() {
        var requested = false
        val repository = ClipsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = ClipsTransport { _, _ ->
                requested = true
                JSONObject()
            },
        )

        val result = repository.load(ClipsFeedTab.FOLLOWING)

        assertTrue(result is ClipsResult.Failure && result.authenticationRequired)
        assertFalse(requested)
    }

    @Test
    fun forYouAllowsGuestBrowsingWithoutAuthorizationHeader() {
        var receivedToken: String? = "not-cleared"
        val repository = ClipsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = ClipsTransport { _, token ->
                receivedToken = token
                JSONObject("""{"data":[],"nextCursor":null}""")
            },
        )

        val result = repository.load(ClipsFeedTab.FOR_YOU)

        assertTrue(result is ClipsResult.Success)
        assertNull(receivedToken)
    }

    @Test
    fun forYouUsesOptionalAuthAndParsesOnlyReadyClipFields() {
        val session = AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
        var path: String? = null
        var token: String? = null
        val payload = JSONObject(
            """{"data":[{"id":"clip-1","kind":"clip","author":{"id":"creator-1","name":"Ada","username":"ada"},"durationSeconds":23,"viewerHasAccess":false,"isFollowingAuthor":true,"likes":2,"media":[{"id":"video-1","type":"video","url":"https://cdn.nantty.com/clip.mp4","posterUrl":"https://cdn.nantty.com/poster.jpg","status":"ready"}],"sound":{"id":"sound-1","title":"Original audio","audioUrl":"https://cdn.nantty.com/audio.mp3","coverUrl":"https://cdn.nantty.com/sound.jpg"}},{"id":"post-1","kind":"post","author":{"id":"creator-2","name":"Sam"}}],"nextCursor":"next/page"}""",
        )
        val repository = ClipsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { session },
            transport = ClipsTransport { requestedPath, accessToken ->
                path = requestedPath
                token = accessToken
                payload
            },
        )

        val result = repository.load(ClipsFeedTab.FOR_YOU) as ClipsResult.Success
        val clip = result.page.items.single()

        assertEquals("/api/v1/clips?tab=forYou&limit=10", path)
        assertEquals("access", token)
        assertEquals("clip-1", clip.post.id)
        assertEquals(23, clip.durationSeconds)
        assertFalse(clip.viewerHasAccess)
        assertTrue(clip.isFollowingAuthor)
        assertEquals("https://cdn.nantty.com/clip.mp4", clip.post.media.single().url)
        assertEquals("Original audio", clip.sound?.title)
        assertEquals("https://cdn.nantty.com/audio.mp3", clip.sound?.audioUrl)
        assertEquals("next/page", result.page.nextCursor)
    }

    @Test
    fun nestedTransportEnvelopeAndNullCursorAreParsed() {
        val repository = ClipsRepository(transport = ClipsTransport { _, _ ->
            JSONObject("""{"data":{"data":[{"id":"clip-1","kind":"clip","author":{"name":"Ada"},"durationSeconds":0}],"nextCursor":null}}""")
        })

        val result = repository.load(ClipsFeedTab.FOR_YOU) as ClipsResult.Success

        assertEquals("clip-1", result.page.items.single().post.id)
        assertNull(result.page.nextCursor)
    }

    @Test
    fun invalidCursorIsRejectedBeforeTransport() {
        var requested = false
        val repository = ClipsRepository(transport = ClipsTransport { _, _ ->
            requested = true
            JSONObject()
        })

        val result = repository.load(ClipsFeedTab.FOR_YOU, " ")

        assertTrue(result is ClipsResult.Failure)
        assertFalse(requested)
    }
}
