package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.ChatThreadTransport
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfileTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class ProfileConnectionsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun followerListLoadsFromApiAndOpensSelectedProfile() {
        val transport = ConnectionsTransport()
        var selectedUserId: String? = null
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "profile-1",
                    initialTab = "followers",
                    repository = PublicProfileRepository("https://api.nantty.com", transport),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = { selectedUserId = it },
                )
            }
        }

        compose.onNodeWithText("Ari Friend").assertIsDisplayed().performClick()
        compose.runOnIdle {
            assertEquals("/api/v1/users/profile-1/followers?limit=20", transport.requestPath)
            assertEquals("account-1", selectedUserId)
        }
    }

    @Test
    fun guestFollowActionRequiresSignInWithoutCallingWriteEndpoint() {
        val transport = ConnectionsTransport()
        var signInRequired = false
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "profile-1",
                    initialTab = "followers",
                    repository = PublicProfileRepository("https://api.nantty.com", transport),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                    onRequireSignIn = { signInRequired = true },
                )
            }
        }

        compose.onNodeWithContentDescription("Follow Ari Friend").performClick()
        compose.runOnIdle {
            assertEquals(true, signInRequired)
            assertEquals(0, transport.writeCount)
        }
    }

    @Test
    fun connectionMenuStartsConversationAndReturnsCanonicalConversation() {
        val viewerId = "00000000-0000-4000-8000-000000000001"
        val peerId = "00000000-0000-4000-8000-000000000002"
        val session = testSession().copy(user = testSession().user.copy(id = viewerId))
        val connections = ConnectionsTransport(entriesJson = """{"data":[{"id":"$peerId","name":"Ari Friend","username":"ari_friend","followState":"accepted","isFollowing":true}],"nextCursor":null}""")
        var requestPath: String? = null
        var requestBody: JSONObject? = null
        var opened: InboxConversation? = null
        val messages = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { session },
            threadTransport = ChatThreadTransport { method, path, token, body ->
                assertEquals("POST", method)
                assertEquals("access-token", token)
                requestPath = path
                requestBody = body
                JSONObject("""{"data":{"id":"00000000-0000-4000-8000-000000000003","kind":"direct","peer":{"id":"$peerId","name":"Ari Friend","avatarUrl":null},"lastMessageAt":"","unread":0}}""")
            },
        )
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = viewerId,
                    initialTab = "followers",
                    repository = PublicProfileRepository("https://api.nantty.com", connections, { session }),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                    messagesRepository = messages,
                    onOpenConversation = { opened = it },
                )
            }
        }

        compose.onNodeWithContentDescription("More options for Ari Friend").performClick()
        compose.onNodeWithText("Send message").performClick()
        compose.runOnIdle {
            assertEquals("/api/v1/conversations", requestPath)
            assertEquals(JSONObject().put("userId", peerId).toString(), requestBody.toString())
            assertEquals("00000000-0000-4000-8000-000000000003", opened?.id)
        }
    }

    @Test
    fun signedInFollowUsesCanonicalServerStateAndUnfollowRequiresConfirmation() {
        val transport = ConnectionsTransport()
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "profile-1",
                    initialTab = "followers",
                    repository = PublicProfileRepository(
                        "https://api.nantty.com",
                        transport,
                        sessionProvider = ::testSession,
                    ),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Follow Ari Friend").performClick()
        compose.onNodeWithContentDescription("Following Ari Friend").assertIsDisplayed().performClick()
        compose.onNodeWithText("Unfollow @ari_friend?").assertIsDisplayed()
        compose.onNodeWithText("Unfollow").performClick()
        compose.runOnIdle {
            assertEquals(2, transport.writeCount)
            assertEquals("/api/v1/users/account-1/follow", transport.writePath)
            assertEquals(1, transport.deleteCount)
        }
    }

    @Test
    fun requestedFollowMustBeConfirmedBeforeCanceling() {
        val transport = ConnectionsTransport(initialFollowState = "requested")
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "profile-1",
                    initialTab = "followers",
                    repository = PublicProfileRepository(
                        "https://api.nantty.com",
                        transport,
                        sessionProvider = ::testSession,
                    ),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Requested Ari Friend").performClick()
        compose.onNodeWithText("Cancel follow request?").assertIsDisplayed()
        compose.onNodeWithText("Cancel request").performClick()
        compose.runOnIdle {
            assertEquals(1, transport.deleteCount)
            assertEquals("/api/v1/users/account-1/follow", transport.writePath)
        }
    }

    @Test
    fun followFailureKeepsRowUnchangedAndAllowsRetry() {
        val transport = ConnectionsTransport().apply { failNextPost = true }
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "profile-1",
                    initialTab = "followers",
                    repository = PublicProfileRepository(
                        "https://api.nantty.com",
                        transport,
                        sessionProvider = ::testSession,
                    ),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Follow Ari Friend").performClick()
        compose.onNodeWithText("Network unavailable").assertIsDisplayed()
        compose.onNodeWithContentDescription("Follow Ari Friend").performClick()
        compose.onNodeWithContentDescription("Following Ari Friend").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, transport.writeCount) }
    }

    @Test
    fun dismissingUnfollowConfirmationDoesNotChangeRelationship() {
        val transport = ConnectionsTransport(initialFollowState = "accepted")
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "profile-1",
                    initialTab = "followers",
                    repository = PublicProfileRepository(
                        "https://api.nantty.com",
                        transport,
                        sessionProvider = ::testSession,
                    ),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Following Ari Friend").performClick()
        compose.onNodeWithText("Unfollow @ari_friend?").assertIsDisplayed()
        compose.onNodeWithText("Cancel").performClick()
        compose.onNodeWithContentDescription("Following Ari Friend").assertIsDisplayed()
        compose.runOnIdle { assertEquals(0, transport.writeCount) }
    }

    @Test
    fun blockRequiresConfirmationAndUnblockUsesServerRoute() {
        val transport = ConnectionsTransport()
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "profile-1",
                    initialTab = "followers",
                    repository = PublicProfileRepository(
                        "https://api.nantty.com",
                        transport,
                        sessionProvider = ::testSession,
                    ),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithContentDescription("More options for Ari Friend").performClick()
        compose.onNodeWithText("Block Ari Friend").performClick()
        compose.onNodeWithText("Block Ari Friend?").assertIsDisplayed()
        compose.onNodeWithText("Block").performClick()
        compose.onNodeWithContentDescription("More options for Ari Friend").performClick()
        compose.onNodeWithText("Unblock Ari Friend").performClick()
        compose.runOnIdle {
            assertEquals(2, transport.writeCount)
            assertEquals("/api/v1/users/account-1/block", transport.writePath)
            assertEquals(1, transport.deleteCount)
        }
    }

    @Test
    fun ownerOnlyConnectionTabsLoadBlockedListFromCurrentAccountRoute() {
        val transport = ConnectionsTransport()
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "viewer-1",
                    initialTab = "blocked",
                    repository = PublicProfileRepository(
                        "https://api.nantty.com",
                        transport,
                        sessionProvider = ::testSession,
                    ),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithText("Shopped").assertIsDisplayed()
        compose.onNodeWithText("Suggested").assertIsDisplayed()
        compose.onNodeWithText("Blocked").assertIsDisplayed()
        compose.onNodeWithText("Ari Friend").assertIsDisplayed()
        compose.runOnIdle { assertEquals("/api/v1/users/me/blocked?limit=20", transport.requestPath) }
    }

    @Test
    fun ownerListSearchFiltersLocallyWithoutRepeatingTheApiRequest() {
        val transport = ConnectionsTransport()
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "viewer-1",
                    initialTab = "suggested",
                    repository = PublicProfileRepository(
                        "https://api.nantty.com",
                        transport,
                        sessionProvider = ::testSession,
                    ),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithText("Ari Friend").assertIsDisplayed()
        compose.onNodeWithText("Search people").performTextInput("nobody")
        compose.onNodeWithText("No one matches \"nobody\"").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(1, transport.requestCount)
            assertEquals("/api/v1/users/viewer-1/connections?tab=suggested&limit=20", transport.requestPath)
        }
    }

    @Test
    fun relationshipFilterUsesApiRelationshipMetadata() {
        val transport = ConnectionsTransport(
            entriesJson = """{"data":[{"id":"ari","name":"Ari Friend","username":"ari_friend","isFollowing":true,"followState":"accepted","followsYou":false,"mutualConnections":2},{"id":"bola","name":"Bola Friend","username":"bola_friend","isFollowing":false,"followState":"none","followsYou":true,"mutualConnections":4}],"nextCursor":null}""",
        )
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "viewer-1",
                    initialTab = "followers",
                    repository = PublicProfileRepository("https://api.nantty.com", transport, sessionProvider = ::testSession),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithText("Ari Friend").assertIsDisplayed()
        compose.onNodeWithText("Bola Friend").assertIsDisplayed()
        compose.onNodeWithContentDescription("Sort and filter. Default (most recent)").performClick()
        compose.onNodeWithText("People who follow you").performClick()
        compose.onNodeWithText("Bola Friend").assertIsDisplayed()
        compose.onNodeWithText("Ari Friend").assertDoesNotExist()
    }

    @Test
    fun ownerOnlyConnectionTabsAreHiddenOnAnotherUsersProfile() {
        compose.setContent {
            MaterialTheme {
                ProfileConnectionsScreen(
                    userId = "profile-1",
                    initialTab = "suggested",
                    repository = PublicProfileRepository(
                        "https://api.nantty.com",
                        ConnectionsTransport(),
                        sessionProvider = ::testSession,
                    ),
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithText("Followers").assertIsDisplayed()
        compose.onNodeWithText("Following").assertIsDisplayed()
        compose.onNodeWithText("Shopped").assertDoesNotExist()
        compose.onNodeWithText("Suggested").assertDoesNotExist()
        compose.onNodeWithText("Blocked").assertDoesNotExist()
    }

    private fun testSession() = AccountSession(
        accessToken = "access-token",
        refreshToken = "refresh-token",
        user = AccountUser("viewer-1", "Viewer", "viewer", null, null, emptyList()),
    )

    private class ConnectionsTransport(
        private val initialFollowState: String = "none",
        private val entriesJson: String? = null,
    ) : PublicProfileTransport {
        var requestPath: String? = null
        var requestCount = 0
        var writePath: String? = null
        var writeCount = 0
        var deleteCount = 0
        var failNextPost = false

        override fun get(path: String, accessToken: String?): JSONObject {
            requestPath = path
            requestCount += 1
            return JSONObject(entriesJson ?: """{"data":[{"id":"account-1","name":"Ari Friend","username":"ari_friend","followState":"$initialFollowState","isFollowing":${initialFollowState == "accepted"}}],"nextCursor":null}""")
        }

        override fun post(path: String, accessToken: String): JSONObject {
            writePath = path
            writeCount += 1
            if (failNextPost) {
                failNextPost = false
                error("Network unavailable")
            }
            return JSONObject("""{"data":{"state":"accepted"}}""")
        }

        override fun delete(path: String, accessToken: String) {
            writePath = path
            writeCount += 1
            deleteCount += 1
        }
    }
}
