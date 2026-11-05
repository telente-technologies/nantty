package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class PublicProfileRepositoryTest {
    @Test
    fun profileUsesReactNativeRouteAndMapsOnlyPublicProfileFields() {
        val transport = RecordingTransport(profile())
        val repository = PublicProfileRepository("https://api.nantty.com", transport)

        val result = repository.loadProfile("user-42") as PublicProfileResult.Success

        assertEquals(listOf("/api/v1/users/user-42"), transport.paths)
        assertEquals(listOf(null), transport.tokens)
        assertEquals("Ari", result.profile.name)
        assertEquals("ari", result.profile.username)
        assertEquals("https://cdn.nantty.com/ari.jpg", result.profile.avatarUrl)
        assertEquals(14, result.profile.followers)
        assertEquals("blue", result.profile.verificationColor)
        assertTrue(result.profile.canViewerSeePosts)
        assertFalse(result.profile.isPrivate)
        assertFalse(result.profile.isSuspended)
    }

    @Test
    fun acceptedFollowStatusAllowsPrivatePostsAndSendsOptionalBearer() {
        val transport = RecordingTransport(profile(privateProfile = true), followState = "accepted", postsResponse = posts())
        val repository = PublicProfileRepository(
            "https://api.nantty.com",
            transport,
            sessionProvider = { testSession() },
        )

        val profile = (repository.loadProfile("user-42") as PublicProfileResult.Success).profile
        val postPage = repository.loadPosts("user-42") as PublicProfilePostsResult.Success

        assertTrue(profile.canViewerSeePosts)
        assertEquals("post-1", postPage.page.posts.single().id)
        assertEquals(
            listOf(
                "/api/v1/users/user-42",
                "/api/v1/users/user-42/follow-status",
                "/api/v1/users/user-42/posts?visibility=public",
            ),
            transport.paths,
        )
        assertEquals(listOf("test-access-token", "test-access-token", "test-access-token"), transport.tokens)
    }

    @Test
    fun nonAcceptedAndBlockedFollowStatesFailClosed() {
        listOf("none", "requested", "rejected", "blocked").forEach { state ->
            val transport = RecordingTransport(profile(privateProfile = true), followState = state)
            val repository = PublicProfileRepository("https://api.nantty.com", transport, sessionProvider = { testSession() })

            val loaded = (repository.loadProfile("user-42") as PublicProfileResult.Success).profile

            assertFalse("state=$state", loaded.canViewerSeePosts)
            assertEquals(
                listOf("/api/v1/users/user-42", "/api/v1/users/user-42/follow-status"),
                transport.paths,
            )
        }
    }

    @Test
    fun missingUnknownOrUnavailableFollowStatusFailsClosed() {
        listOf(null, "future-state").forEach { state ->
            val transport = RecordingTransport(profile(privateProfile = true), followState = state)
            val repository = PublicProfileRepository("https://api.nantty.com", transport)
            val loaded = (repository.loadProfile("user-42") as PublicProfileResult.Success).profile
            assertFalse(loaded.canViewerSeePosts)
        }

        val failedTransport = RecordingTransport(profile(privateProfile = true), failFollowStatus = true)
        val loaded = (PublicProfileRepository("https://api.nantty.com", failedTransport).loadProfile("user-42") as PublicProfileResult.Success).profile
        assertFalse(loaded.canViewerSeePosts)
    }

    @Test
    fun guestCanLoadPublicProfileAndPostsWithoutAuthorizationToken() {
        val transport = RecordingTransport(profile(), postsResponse = posts())
        val repository = PublicProfileRepository("https://api.nantty.com", transport)

        assertTrue((repository.loadProfile("user-42") as PublicProfileResult.Success).profile.canViewerSeePosts)
        assertTrue(repository.loadPosts("user-42") is PublicProfilePostsResult.Success)

        assertEquals(
            listOf("/api/v1/users/user-42", "/api/v1/users/user-42/posts?visibility=public"),
            transport.paths,
        )
        assertEquals(listOf(null, null), transport.tokens)
    }

    @Test
    fun httpTransportAddsBearerOnlyWhenSessionTokenExists() {
        val requests = mutableListOf<Pair<String, String?>>()
        val transport = JdkPublicProfileTransport("https://api.nantty.com") { url ->
            CapturingConnection(url) { path, token -> requests += path to token }
        }

        transport.get("/api/v1/users/user-42", "session-access-token")
        transport.get("/api/v1/users/public-user", null)

        assertEquals("/api/v1/users/user-42" to "Bearer session-access-token", requests[0])
        assertEquals("/api/v1/users/public-user" to null, requests[1])
    }

    @Test
    fun privateAndSuspendedFlagsAndInactiveVerificationArePreservedSafely() {
        val payload = JSONObject("""{"data":{"id":"u2","name":"Private","username":"private","bio":"","isPrivate":true,"isFollowing":true,"account":{"status":"suspended"},"verification":{"status":"revoked","color":"gold","badgeVisible":true}}}""")
        val repository = PublicProfileRepository(
            "https://api.nantty.com",
            RecordingTransport(payload, followState = "accepted"),
            sessionProvider = { testSession() },
        )

        val profile = (repository.loadProfile("u2") as PublicProfileResult.Success).profile

        assertTrue(profile.isPrivate)
        assertTrue(profile.isSuspended)
        assertTrue(profile.canViewerSeePosts)
        assertNull(profile.verificationColor)
    }

    @Test
    fun publicPostsUseCursorAndExplicitPublicVisibility() {
        val transport = RecordingTransport(postsResponse = posts())
        val repository = PublicProfileRepository("https://api.nantty.com", transport)

        val result = repository.loadPosts("user-42", "next / page") as PublicProfilePostsResult.Success

        assertEquals("/api/v1/users/user-42/posts?cursor=next%20%2F%20page&visibility=public", transport.paths.single())
        assertEquals("post-1", result.page.posts.single().id)
        assertEquals("user-42", result.page.posts.single().authorId)
        assertEquals("next-2", result.page.nextCursor)
    }

    @Test
    fun subscriberPostsUseTheSameAuthenticatedProfileRouteWithExplicitVisibility() {
        val transport = RecordingTransport(postsResponse = posts())
        val repository = PublicProfileRepository(
            "https://api.nantty.com",
            transport,
            sessionProvider = { testSession() },
        )

        val result = repository.loadPosts("user-42", visibility = PublicProfileRepository.SUBSCRIBER_VISIBILITY)

        assertTrue(result is PublicProfilePostsResult.Success)
        assertEquals("/api/v1/users/user-42/posts?visibility=subscribers", transport.paths.single())
        assertEquals(listOf("test-access-token"), transport.tokens)
    }

    @Test
    fun followerListUsesSearchCursorAndMapsPublicFieldsOnly() {
        val connectionResponse = JSONObject(
            """{"data":[{"id":"account-1","name":"Ari Friend","username":"ari_friend","avatarUrl":"https://cdn.nantty.com/ari.png","isFollowing":true,"followsYou":true,"mutualConnections":7,"followState":"accepted","email":"private@example.test"}],"nextCursor":"page-2"}""",
        )
        val transport = RecordingTransport(connectionsResponse = connectionResponse)
        val repository = PublicProfileRepository("https://api.nantty.com", transport, sessionProvider = { testSession() })

        val result = repository.loadConnections("user-42", "followers", " Ari ", "page 1") as ProfileConnectionsResult.Success

        assertEquals("/api/v1/users/user-42/followers?q=Ari&cursor=page%201&limit=20", transport.paths.single())
        assertEquals("test-access-token", transport.tokens.single())
        assertEquals("account-1", result.page.entries.single().id)
        assertEquals("Ari Friend", result.page.entries.single().name)
        assertEquals("ari_friend", result.page.entries.single().username)
        assertEquals("accepted", result.page.entries.single().followState)
        assertTrue(result.page.entries.single().followsYou)
        assertEquals(7, result.page.entries.single().mutualConnections)
        assertEquals("page-2", result.page.nextCursor)
    }

    @Test
    fun connectionListRejectsUnsafeTabsAndOversizedSearchBeforeRequest() {
        val transport = RecordingTransport()
        val repository = PublicProfileRepository("https://api.nantty.com", transport)

        assertTrue(repository.loadConnections("user-42", "unsupported") is ProfileConnectionsResult.Failure)
        assertTrue(repository.loadConnections("user-42", "followers", "x".repeat(101)) is ProfileConnectionsResult.Failure)
        assertTrue(transport.paths.isEmpty())
    }

    @Test
    fun ownerConnectionTabsUseReactNativeRoutesAndLocalSearchInputsAreNotSentForThoseTabs() {
        val transport = RecordingTransport(connectionsResponse = JSONObject("""{"data":[],"nextCursor":null}"""))
        val repository = PublicProfileRepository("https://api.nantty.com", transport, sessionProvider = { testSession() })

        assertTrue(repository.loadConnections("viewer-1", "shopped", "Ari") is ProfileConnectionsResult.Success)
        assertTrue(repository.loadConnections("viewer-1", "suggested", "Ari") is ProfileConnectionsResult.Success)
        assertTrue(repository.loadConnections("viewer-1", "blocked", "Ari") is ProfileConnectionsResult.Success)

        assertEquals(
            listOf(
                "/api/v1/users/viewer-1/connections?tab=shopped&limit=20",
                "/api/v1/users/viewer-1/connections?tab=suggested&limit=20",
                "/api/v1/users/me/blocked?limit=20",
            ),
            transport.paths,
        )
    }

    @Test
    fun forbiddenConnectionListIsDistinguishedForPrivateProfileMessaging() {
        val transport = RecordingTransport(failConnections = true)
        val repository = PublicProfileRepository("https://api.nantty.com", transport)

        val result = repository.loadConnections("user-42", "followers") as ProfileConnectionsResult.Failure

        assertTrue(result.isPrivate)
    }

    @Test
    fun unsupportedPostVisibilityFailsBeforeCallingApi() {
        val transport = RecordingTransport(postsResponse = posts())
        val repository = PublicProfileRepository("https://api.nantty.com", transport)

        assertTrue(repository.loadPosts("user-42", visibility = "all") is PublicProfilePostsResult.Failure)
        assertTrue(transport.paths.isEmpty())
    }

    @Test
    fun malformedProfileIdsAndOversizedCursorsDoNotCallApi() {
        val transport = RecordingTransport(profile())
        val repository = PublicProfileRepository("https://api.nantty.com", transport)

        assertTrue(repository.loadProfile("../users/me") is PublicProfileResult.Failure)
        assertTrue(repository.loadPosts("user-42", "x".repeat(301)) is PublicProfilePostsResult.Failure)
        assertTrue(transport.paths.isEmpty())
    }

    @Test
    fun followAndUnfollowUseAuthenticatedProfileRoutesAndReturnCanonicalState() {
        val transport = RecordingTransport(followState = "requested")
        val repository = PublicProfileRepository("https://api.nantty.com", transport, sessionProvider = { testSession() })

        assertEquals(FollowActionResult.Success("requested"), repository.setFollow("user-42", true))
        assertEquals(FollowActionResult.Success("none"), repository.setFollow("user-42", false))
        assertEquals(listOf("POST /api/v1/users/user-42/follow", "DELETE /api/v1/users/user-42/follow"), transport.writes)
        assertEquals(listOf("test-access-token", "test-access-token"), transport.writeTokens)
    }

    @Test
    fun followWritesFailClosedWithoutSessionAndForInvalidIds() {
        val transport = RecordingTransport()
        val guestRepository = PublicProfileRepository("https://api.nantty.com", transport)

        assertTrue(guestRepository.setFollow("user-42", true) is FollowActionResult.Failure)
        assertTrue(guestRepository.setFollow("../other", false) is FollowActionResult.Failure)
        assertTrue(transport.writes.isEmpty())
    }

    @Test
    fun blockAndUnblockUseAuthenticatedExistingRoutes() {
        val transport = RecordingTransport()
        val repository = PublicProfileRepository("https://api.nantty.com", transport, sessionProvider = { testSession() })

        assertEquals(BlockActionResult.Success, repository.setBlocked("user-42", true))
        assertEquals(BlockActionResult.Success, repository.setBlocked("user-42", false))
        assertEquals(
            listOf("POST /api/v1/users/user-42/block", "DELETE /api/v1/users/user-42/block"),
            transport.writes,
        )
        assertEquals(listOf("test-access-token", "test-access-token"), transport.writeTokens)
    }

    @Test
    fun blockWritesFailClosedWithoutSessionAndForInvalidIds() {
        val transport = RecordingTransport()
        val guestRepository = PublicProfileRepository("https://api.nantty.com", transport)

        assertTrue(guestRepository.setBlocked("user-42", true) is BlockActionResult.Failure)
        assertTrue(guestRepository.setBlocked("../other", false) is BlockActionResult.Failure)
        assertTrue(transport.writes.isEmpty())
    }

    private fun profile(privateProfile: Boolean = false) = JSONObject(
        """{"data":{"id":"user-42","name":"Ari","username":"ari","avatarUrl":"https://cdn.nantty.com/ari.jpg","bannerUrl":"javascript:alert(1)","bio":"A public bio","followers":14,"following":21,"posts":5,"isPrivate":$privateProfile,"isFollowing":true,"verified":true,"email":"private@example.test","phone":"+10000000000","verification":{"status":"active","color":"blue","badgeVisible":true},"account":{"status":"active"}}}""",
    )

    private fun posts() = JSONObject("""{"data":[{"id":"post-1","kind":"post","author":{"id":"user-42","name":"Ari","username":"ari"},"text":"Public post","createdAt":"2026-11-02T10:00:00Z","media":[],"likes":2,"comments":1,"reposts":0,"shares":0}],"nextCursor":"next-2"}""")

    private fun testSession() = AccountSession(
        accessToken = "test-access-token",
        refreshToken = "test-refresh-token",
        user = AccountUser("viewer-1", "Viewer", "viewer", null, null, emptyList()),
    )

    private class RecordingTransport(
        private val profileResponse: JSONObject? = null,
        private val followState: String? = null,
        private val postsResponse: JSONObject? = null,
        private val connectionsResponse: JSONObject? = null,
        private val failConnections: Boolean = false,
        private val failFollowStatus: Boolean = false,
    ) : PublicProfileTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()
        val writes = mutableListOf<String>()
        val writeTokens = mutableListOf<String>()

        override fun get(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            if (path.contains("/followers?") || path.contains("/following?") || path.contains("/connections?") || path.contains("/blocked?")) {
                if (failConnections) throw PublicProfileHttpException(403)
                return connectionsResponse ?: error("Unexpected connections request")
            }
            return when {
                path.endsWith("/follow-status") && failFollowStatus -> error("Unavailable")
                path.endsWith("/follow-status") -> JSONObject().apply { followState?.let { put("state", it) } }
                path.contains("/posts?") -> postsResponse ?: error("Unexpected posts request")
                else -> profileResponse ?: error("Missing profile response")
            }
        }

        override fun post(path: String, accessToken: String): JSONObject {
            writes += "POST $path"
            writeTokens += accessToken
            return JSONObject().put("state", followState ?: "accepted")
        }

        override fun delete(path: String, accessToken: String) {
            writes += "DELETE $path"
            writeTokens += accessToken
        }
    }

    private class CapturingConnection(
        url: URL,
        private val onRequest: (String, String?) -> Unit,
    ) : HttpURLConnection(url) {
        private val headers = mutableMapOf<String, String>()

        override fun setRequestProperty(key: String, value: String) {
            headers[key] = value
        }

        override fun getResponseCode(): Int {
            onRequest(url.path, headers["Authorization"])
            return HTTP_OK
        }

        override fun getInputStream() = ByteArrayInputStream("{}".toByteArray())
        override fun disconnect() = Unit
        override fun usingProxy() = false
        override fun connect() = Unit
    }
}
