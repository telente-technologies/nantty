package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfileTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class PublicProfileScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun publicProfileLoadsOnlyProfileAndPublicPostsAndOpensPost() {
        val transport = ProfileTransport()
        var openedPost: String? = null
        compose.setContent {
            MaterialTheme {
                PublicProfileScreen(
                    "user-42",
                    PublicProfileRepository("https://api.nantty.com", transport),
                    Executor { it.run() },
                    onBack = {},
                    onOpenPost = { openedPost = it },
                )
            }
        }

        compose.onNodeWithText("Ari O.").assertIsDisplayed()
        compose.onNodeWithText("A real public profile").assertIsDisplayed()
        compose.onNodeWithText("A public post").performClick()
        compose.runOnIdle {
            assertEquals("post-1", openedPost)
            assertEquals(listOf("/api/v1/users/user-42", "/api/v1/users/user-42/posts?visibility=public"), transport.paths)
        }
    }

    @Test
    fun privateProfileRemainsLockedAndDoesNotRequestPostsEvenIfResponseHasFollowFlag() {
        val transport = ProfileTransport(privateProfile = true)
        compose.setContent {
            MaterialTheme {
                PublicProfileScreen("user-42", PublicProfileRepository("https://api.nantty.com", transport), Executor { it.run() }, onBack = {}, onOpenPost = {})
            }
        }

        compose.onNodeWithText("This account is private").assertIsDisplayed()
        compose.onNodeWithText("A private public-preview post").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals(listOf("/api/v1/users/user-42", "/api/v1/users/user-42/follow-status"), transport.paths)
        }
    }

    @Test
    fun acceptedFollowerCanSeePrivatePosts() {
        val transport = ProfileTransport(privateProfile = true, followState = "accepted")
        compose.setContent {
            MaterialTheme {
                PublicProfileScreen("user-42", PublicProfileRepository("https://api.nantty.com", transport), Executor { it.run() }, onBack = {}, onOpenPost = {})
            }
        }

        compose.onNodeWithText("Posts").assertIsDisplayed()
        compose.onNodeWithText("A public post").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(
                listOf(
                    "/api/v1/users/user-42",
                    "/api/v1/users/user-42/follow-status",
                    "/api/v1/users/user-42/posts?visibility=public",
                ),
                transport.paths,
            )
        }
    }

    @Test
    fun profileLoadFailureCanBeRetried() {
        val transport = ProfileTransport(failProfileOnce = true)
        compose.setContent {
            MaterialTheme {
                PublicProfileScreen("user-42", PublicProfileRepository("https://api.nantty.com", transport), Executor { it.run() }, onBack = {}, onOpenPost = {})
            }
        }

        compose.onNodeWithText("Profile unavailable").assertIsDisplayed()
        compose.onNodeWithText("Try again").performClick()
        compose.onNodeWithText("Ari O.").assertIsDisplayed()
        compose.runOnIdle { assertEquals("/api/v1/users/user-42/posts?visibility=public", transport.paths.last()) }
    }

    @Test
    fun publicPostFailureCanBeRetriedWithoutReloadingProfile() {
        val transport = ProfileTransport(failPostsOnce = true)
        compose.setContent {
            MaterialTheme {
                PublicProfileScreen("user-42", PublicProfileRepository("https://api.nantty.com", transport), Executor { it.run() }, onBack = {}, onOpenPost = {})
            }
        }

        compose.onNodeWithText("Posts could not load").assertIsDisplayed()
        compose.onNodeWithText("Try again").performClick()
        compose.onNodeWithText("A public post").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(listOf("/api/v1/users/user-42", "/api/v1/users/user-42/posts?visibility=public", "/api/v1/users/user-42/posts?visibility=public"), transport.paths)
        }
    }

    @Test
    fun backControlHasAccessibleProfileNavigationAction() {
        compose.setContent {
            MaterialTheme {
                PublicProfileScreen("user-42", PublicProfileRepository("https://api.nantty.com", ProfileTransport()), Executor { it.run() }, onBack = {}, onOpenPost = {})
            }
        }

        compose.onNodeWithContentDescription("Back").assertIsDisplayed()
    }

    @Test
    fun privateProfileFollowCreatesRequestWithoutShowingPrivatePosts() {
        val transport = ProfileTransport(privateProfile = true)
        val repository = PublicProfileRepository(
            "https://api.nantty.com",
            transport,
            sessionProvider = { testSession() },
        )
        compose.setContent {
            MaterialTheme {
                PublicProfileScreen("user-42", repository, Executor { it.run() }, onBack = {}, onOpenPost = {})
            }
        }

        compose.onNodeWithContentDescription("Follow @ari").performClick()
        compose.onNodeWithText("Requested").assertIsDisplayed()
        compose.onNodeWithText("This account is private").assertIsDisplayed()
        compose.onNodeWithText("A public post").assertDoesNotExist()
        compose.runOnIdle { assertEquals(listOf("POST /api/v1/users/user-42/follow"), transport.writes) }
    }

    private fun testSession() = com.nantty.android.data.AccountSession(
        accessToken = "test-access-token",
        refreshToken = "test-refresh-token",
        user = com.nantty.android.data.AccountUser("viewer-1", "Viewer", "viewer", null, null, emptyList()),
    )

    private class ProfileTransport(
        private val privateProfile: Boolean = false,
        private val followState: String? = null,
        private var failProfileOnce: Boolean = false,
        private var failPostsOnce: Boolean = false,
    ) : PublicProfileTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()
        val writes = mutableListOf<String>()

        override fun get(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            if (path.endsWith("/follow-status")) {
                return JSONObject().apply { followState?.let { put("state", it) } }
            }
            if (path.endsWith("/posts?visibility=public")) {
                if (failPostsOnce) {
                    failPostsOnce = false
                    error("Offline")
                }
                return JSONObject(
                """{"data":[{"id":"post-1","kind":"post","author":{"id":"user-42","name":"Ari O.","username":"ari"},"text":"A public post","createdAt":"2026-11-02T10:00:00Z","media":[],"likes":1,"comments":0,"reposts":0,"shares":0}],"nextCursor":null}""",
                )
            }
            if (failProfileOnce) {
                failProfileOnce = false
                error("Offline")
            }
            val locked = if (privateProfile) "true" else "false"
            return JSONObject("""{"data":{"id":"user-42","name":"Ari O.","username":"ari","bio":"A real public profile","followers":12,"following":4,"posts":1,"isPrivate":$locked,"isFollowing":true,"account":{"status":"active"}}}""")
        }

        override fun post(path: String, accessToken: String): JSONObject {
            writes += "POST $path"
            return JSONObject().put("state", "requested")
        }

        override fun delete(path: String, accessToken: String) { writes += "DELETE $path" }

    }
}
