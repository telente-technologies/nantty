package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StoriesRepositoryTest {
    @Test
    fun storyPublishingUsesTheExistingSocialEndpointAndStoryPayload() {
        val session = AccountSession("access", "refresh", AccountUser("owner", "Owner", "owner", null, null, emptyList()))
        var requestedPath: String? = null
        var token: String? = null
        var requestBody: JSONObject? = null
        val repository = StoriesRepository(sessionProvider = { session }, transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject()
            override fun post(path: String, accessToken: String) = JSONObject()
            override fun post(path: String, accessToken: String, body: JSONObject) = JSONObject(
                """{"data":{"id":"00000000-0000-0000-0000-000000000003"}}""",
            ).also {
                requestedPath = path
                requestBody = body
                token = accessToken
            }
        })

        val result = repository.publishStory(
            "00000000-0000-0000-0000-000000000001",
            soundId = "00000000-0000-0000-0000-000000000002",
            look = "warm",
        )

        assertEquals(StoryPublishResult.Success("00000000-0000-0000-0000-000000000003"), result)
        assertEquals("/api/v1/stories", requestedPath)
        assertEquals("access", token)
        assertEquals("00000000-0000-0000-0000-000000000001", requestBody?.getString("mediaId"))
        assertEquals("00000000-0000-0000-0000-000000000002", requestBody?.getString("soundId"))
        assertEquals("warm", requestBody?.getString("look"))
    }

    @Test
    fun ownerStoryDeletionUsesExistingPostsRouteAndIdempotencyKey() {
        val session = AccountSession("access", "refresh", AccountUser("owner", "Owner", "owner", null, null, emptyList()))
        var requestedPath: String? = null
        var token: String? = null
        var requestKey: String? = null
        val repository = StoriesRepository(sessionProvider = { session }, transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject()
            override fun post(path: String, accessToken: String) = JSONObject()
            override fun delete(path: String, accessToken: String, idempotencyKey: String) = JSONObject().also {
                requestedPath = path
                token = accessToken
                requestKey = idempotencyKey
            }
        })

        assertEquals(StoryDeleteResult.Success, repository.deleteOwnStory("story-1", "delete-story-1"))
        assertEquals("/api/v1/posts/story-1", requestedPath)
        assertEquals("access", token)
        assertEquals("delete-story-1", requestKey)
    }

    @Test
    fun storyDeletionRejectsUnsafeIdsAndInvalidIdempotencyKeysBeforeTransport() {
        var requested = false
        val repository = StoriesRepository(
            sessionProvider = { AccountSession("access", "refresh", AccountUser("owner", "Owner", "owner", null, null, emptyList())) },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?) = JSONObject()
                override fun post(path: String, accessToken: String) = JSONObject()
                override fun delete(path: String, accessToken: String, idempotencyKey: String) = JSONObject().also { requested = true }
            },
        )

        assertTrue(repository.deleteOwnStory("../another-users-story") is StoryDeleteResult.Failure)
        assertTrue(repository.deleteOwnStory("..") is StoryDeleteResult.Failure)
        assertTrue(repository.deleteOwnStory("story-1", "bad key") is StoryDeleteResult.Failure)
        assertFalse(requested)
    }

    @Test
    fun profileStoryRingUsesServerVisibilityAndParsesUnseenState() {
        val session = AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
        var requestedPath: String? = null
        var token: String? = null
        val repository = StoriesRepository(sessionProvider = { session }, transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject("""{"data":{"hasActiveStory":true,"hasUnseenStory":true}}""").also { requestedPath = path; token = accessToken }
            override fun post(path: String, accessToken: String) = JSONObject()
        })

        assertEquals(StoryRingStatusResult.Success(StoryRingStatus(true, true)), repository.loadStoryRingStatus("profile-1"))
        assertEquals("/api/v1/users/profile-1/story-status", requestedPath)
        assertEquals("access", token)
    }

    @Test
    fun profileStoryRingHidesInvalidOrInconsistentStatusWithoutExposingIt() {
        var requested = false
        val repository = StoriesRepository(transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject("""{"data":{"hasActiveStory":false,"hasUnseenStory":true}}""").also { requested = true }
            override fun post(path: String, accessToken: String) = JSONObject()
        })

        assertTrue(repository.loadStoryRingStatus("../private") is StoryRingStatusResult.Failure)
        assertFalse(requested)
        assertEquals(StoryRingStatusResult.Success(StoryRingStatus(false, false)), repository.loadStoryRingStatus("profile-1"))
    }

    @Test
    fun ownerAnalyticsUsesExistingSocialContractAndParsesMetrics() {
        val session = AccountSession("access", "refresh", AccountUser("owner", "Owner", "owner", null, null, emptyList()))
        var requestedPath: String? = null
        var token: String? = null
        val repository = StoriesRepository(sessionProvider = { session }, transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject(
                """{"data":{"impressions":120,"uniqueViewers":85,"likes":5,"comments":4,"shares":7,"profileVisits":3,"newFollows":2,"postedAt":"2026-11-06T10:00:00.000Z"}}""",
            ).also { requestedPath = path; token = accessToken }
            override fun post(path: String, accessToken: String) = JSONObject()
        })

        val result = repository.loadAnalytics("story-1")

        assertEquals("/api/v1/posts/story-1/analytics", requestedPath)
        assertEquals("access", token)
        assertEquals(StoryAnalyticsResult.Success(StoryAnalytics(120, 85, 5, 4, 7, 3, 2, "2026-11-06T10:00:00.000Z")), result)
    }

    @Test
    fun storyViewersParsesUniqueSummariesAndCursor() {
        val session = AccountSession("access", "refresh", AccountUser("owner", "Owner", "owner", null, null, emptyList()))
        var requestedPath: String? = null
        val repository = StoriesRepository(sessionProvider = { session }, transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject(
                """{"data":{"viewers":[{"id":"u1","name":"Ada","username":"ada","avatarUrl":"https://cdn.nantty.com/a.jpg"},{"id":"u1","name":"Duplicate"},{"id":"u2","name":"Sam","avatarUrl":"javascript:alert(1)"}],"total":9,"nextCursor":"cursor/next"}}""",
            ).also { requestedPath = path }
            override fun post(path: String, accessToken: String) = JSONObject()
        })

        val result = repository.loadViewers("story-1", "cursor/prev")

        assertEquals("/api/v1/stories/story-1/viewers?cursor=cursor%2Fprev", requestedPath)
        assertEquals(
            StoryViewersResult.Success(
                StoryViewersPage(
                    listOf(StoryViewerSummary("u1", "Ada", "ada", "https://cdn.nantty.com/a.jpg"), StoryViewerSummary("u2", "Sam", "", null)),
                    9,
                    "cursor/next",
                ),
            ),
            result,
        )
    }

    @Test
    fun analyticsRejectsMalformedIdsAndRequiresAnAuthenticatedOwnerSession() {
        var requested = false
        val transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject().also { requested = true }
            override fun post(path: String, accessToken: String) = JSONObject()
        }
        val anonymous = StoriesRepository(transport = transport)
        assertTrue(anonymous.loadAnalytics("story-1") is StoryAnalyticsResult.Failure)
        val authenticated = StoriesRepository(
            sessionProvider = { AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList())) },
            transport = transport,
        )
        assertTrue(authenticated.loadAnalytics("../admin") is StoryAnalyticsResult.Failure)
        assertTrue(authenticated.loadViewers("../admin") is StoryViewersResult.Failure)
        assertFalse(requested)
        assertFalse(authenticated.canOpenOwnerAnalytics(StoryItem("story-1", "someone-else", "Author", "author", null, FeedMedia("m1", "image", "https://cdn.nantty.com/story.jpg", null, null, null), "", false, null, null)))
        val owner = StoriesRepository(
            sessionProvider = { AccountSession("access", "refresh", AccountUser("author-1", "Author", "author", null, null, emptyList())) },
            transport = transport,
        )
        assertTrue(owner.canOpenOwnerAnalytics(StoryItem("story-1", "author-1", "Author", "author", null, FeedMedia("m1", "image", "https://cdn.nantty.com/story.jpg", null, null, null), "", false, null, null)))
    }

    @Test
    fun trayRequiresAuthenticationAndDoesNotCallTransport() {
        var requested = false
        val repository = StoriesRepository(
            sessionProvider = { null },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject { requested = true; return JSONObject() }
                override fun post(path: String, accessToken: String): JSONObject { requested = true; return JSONObject() }
            },
        )

        val result = repository.loadTray()

        assertTrue(result is StoryTrayResult.Failure && result.authenticationRequired)
        assertFalse(requested)
    }

    @Test
    fun trayParsesVisibleUniqueUsersAndSeenState() {
        val session = AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
        val repository = StoriesRepository(transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject(
                """{"data":[{"user":{"id":"user-1","name":"Ada","username":"ada","avatarUrl":"https://cdn.nantty.com/a.jpg"},"hasUnseen":true},{"user":{"id":"user-1","name":"Duplicate"},"hasUnseen":false},{"user":{"id":"user-2","name":"Sam","avatarUrl":"javascript:alert(1)"},"hasUnseen":false}]}""",
            )
            override fun post(path: String, accessToken: String) = JSONObject()
        }, sessionProvider = { session })

        val result = repository.loadTray() as StoryTrayResult.Success

        assertEquals(2, result.entries.size)
        assertEquals("Ada", result.entries.first().name)
        assertEquals("https://cdn.nantty.com/a.jpg", result.entries.first().avatarUrl)
        assertTrue(result.entries.first().hasUnseen)
        assertNull(result.entries.last().avatarUrl)
    }

    @Test
    fun publicStoriesUseOptionalAuthenticationAndParseReadyImageVideoAndSound() {
        val session = AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
        var requestedPath: String? = null
        var token: String? = null
        val repository = StoriesRepository(
            sessionProvider = { session },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject {
                    requestedPath = path
                    token = accessToken
                    return JSONObject("""{"data":[
                        {"id":"story-1","author":{"id":"author-1","name":"Ada","username":"ada","avatarUrl":"https://cdn.nantty.com/avatar.jpg"},"media":{"id":"media-1","type":"image","url":"https://cdn.nantty.com/story.jpg","status":"ready"},"createdAt":"2026-11-06T10:00:00.000Z","seen":false,"sound":{"id":"sound-1","title":"Original","owner":{"username":"sam"}},"look":"warm"},
                        {"id":"story-2","author":{"id":"author-1","name":"Ada"},"media":{"id":"media-2","type":"video","url":null,"hlsUrl":"https://cdn.nantty.com/story.m3u8","posterUrl":"https://cdn.nantty.com/poster.jpg","status":"ready"},"createdAt":"2026-11-06T10:01:00.000Z","seen":true,"look":"invented"},
                        {"id":"story-3","author":{"id":"author-1","name":"Ada"},"media":{"id":"media-3","type":"image","url":"http://insecure.invalid/story.jpg","status":"ready"},"createdAt":"now"}
                    ]}""")
                }
                override fun post(path: String, accessToken: String) = JSONObject()
            },
        )

        val result = repository.loadUserStories("author-1") as StoryFeedResult.Success

        assertEquals("/api/v1/users/author-1/stories", requestedPath)
        assertEquals("access", token)
        assertEquals(2, result.stories.size)
        assertEquals("image", result.stories[0].media.type)
        assertEquals("Original", result.stories[0].sound?.title)
        assertEquals("warm", result.stories[0].look)
        assertEquals("https://cdn.nantty.com/story.m3u8", result.stories[1].media.url)
        assertNull(result.stories[1].look)
    }

    @Test
    fun guestCanLoadPublicStoriesWithoutAuthorizationButCannotMarkSeen() {
        var getToken: String? = "unexpected"
        var postCount = 0
        val repository = StoriesRepository(
            sessionProvider = { null },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?): JSONObject {
                    getToken = accessToken
                    return JSONObject("""{"data":[]}""")
                }
                override fun post(path: String, accessToken: String): JSONObject { postCount++; return JSONObject() }
            },
        )

        assertTrue(repository.loadUserStories("public-user") is StoryFeedResult.Success)
        val seen = repository.markSeen("story-1")

        assertNull(getToken)
        assertTrue(seen is StorySeenResult.Failure && seen.authenticationRequired)
        assertEquals(0, postCount)
    }

    @Test
    fun markSeenUsesAuthenticatedStoryEndpoint() {
        val session = AccountSession("access", "refresh", AccountUser("viewer", "Viewer", "viewer", null, null, emptyList()))
        var requestedPath: String? = null
        var token: String? = null
        val repository = StoriesRepository(
            sessionProvider = { session },
            transport = object : StoriesTransport {
                override fun get(path: String, accessToken: String?) = JSONObject()
                override fun post(path: String, accessToken: String): JSONObject {
                    requestedPath = path
                    token = accessToken
                    return JSONObject()
                }
            },
        )

        assertTrue(repository.markSeen("story/unsafe") is StorySeenResult.Failure)
        assertNull(requestedPath)
        assertEquals(StorySeenResult.Success, repository.markSeen("story-1"))
        assertEquals("/api/v1/stories/story-1/seen", requestedPath)
        assertEquals("access", token)
    }

    @Test
    fun storyPathsEncodeIdsAndRejectMalformedIdsBeforeTransport() {
        assertEquals("/api/v1/users/a%20b%2F1/stories", buildUserStoriesPath("a b/1"))
        assertEquals("/api/v1/stories/a%20b%2F1/seen", buildMarkSeenPath("a b/1"))
        var requested = false
        val repository = StoriesRepository(transport = object : StoriesTransport {
            override fun get(path: String, accessToken: String?) = JSONObject().also { requested = true }
            override fun post(path: String, accessToken: String) = JSONObject().also { requested = true }
        })

        assertTrue(repository.loadUserStories("../admin") is StoryFeedResult.Failure)
        assertTrue(repository.markSeen("/admin") is StorySeenResult.Failure)
        assertFalse(requested)
    }
}
