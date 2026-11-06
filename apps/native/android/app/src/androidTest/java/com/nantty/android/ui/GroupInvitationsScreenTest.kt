package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.runtime.mutableStateOf
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.ChatThreadTransport
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.MessagesTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class GroupInvitationsScreenTest {
    @get:Rule val compose = createComposeRule()

    private val groupId = "11111111-1111-4111-8111-111111111111"
    private val invitationId = "22222222-2222-4222-8222-222222222222"
    private val memberId = "33333333-3333-4333-8333-333333333333"

    @Test
    fun receivedInvitationAcceptRecordsConsentAndExplicitlyDoesNotJoin() {
        val requests = mutableListOf<String>()
        val repository = repository(thread = { method, path, _, _ ->
            requests += "$method $path"
            when {
                method == "GET" && path.startsWith("/api/v1/group-invitations?") -> page(status = "pending")
                method == "POST" && path.endsWith("/accept") -> invitation(status = "accepted", membership = "awaiting_secure_key_handoff")
                else -> error("Unexpected request: $method $path")
            }
        })

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithContentDescription("Open group invitations").performClick()
        compose.onNodeWithText("Ari Oyinlola").assertIsDisplayed()
        compose.onNodeWithText("Accept").performClick()

        compose.onNode(hasText("Consent recorded. You are not a group member yet", substring = true)).assertIsDisplayed()
        compose.onNode(hasText("Accepted · secure key handoff pending. You have not joined this group.", substring = true)).assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(
                listOf(
                    "GET /api/v1/group-invitations?direction=received&limit=20",
                    "POST /api/v1/group-invitations/$invitationId/accept",
                ),
                requests,
            )
        }
    }

    @Test
    fun sentInvitationCanBeRevokedFromSentInbox() {
        val requests = mutableListOf<String>()
        val repository = repository(thread = { method, path, _, _ ->
            requests += "$method $path"
            when {
                method == "GET" && path.startsWith("/api/v1/group-invitations?") -> page(status = "pending")
                method == "DELETE" -> invitation(status = "revoked")
                else -> error("Unexpected request: $method $path")
            }
        })

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithContentDescription("Open group invitations").performClick()
        compose.onNodeWithText("Sent").performClick()
        compose.onNodeWithText("Revoke").performClick()
        compose.onNodeWithText("Invitation revoked.").assertIsDisplayed()

        compose.runOnIdle {
            assertEquals(
                listOf(
                    "GET /api/v1/group-invitations?direction=received&limit=20",
                    "GET /api/v1/group-invitations?direction=sent&limit=20",
                    "DELETE /api/v1/conversations/$groupId/invitations/$invitationId",
                ),
                requests,
            )
        }
    }

    @Test
    fun groupConversationCanSearchAndSendMemberInvitation() {
        val requests = mutableListOf<String>()
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = MessagesTransport { _, _ ->
                JSONObject("""{"data":[{"id":"$groupId","kind":"group","title":"Studio group","lastMessageAt":"2026-11-05T12:00:00Z","unread":0}],"nextCursor":null}""")
            },
            threadTransport = ChatThreadTransport { method, path, _, body ->
                requests += "$method $path"
                when {
                    method == "GET" && path == "/api/v1/conversations/$groupId/invitation-links?limit=20" -> JSONObject("""{"data":{"data":[],"nextCursor":null}}""")
                    method == "GET" && path.startsWith("/api/v1/conversations/search?") -> JSONObject(
                        """{"data":{"conversations":[],"people":[{"id":"$memberId","name":"Ari Oyinlola","username":"ari","avatarUrl":null,"verified":true}]}}""",
                    )
                    method == "POST" && path == "/api/v1/conversations/$groupId/invitations" -> {
                        assertEquals(memberId, body?.optString("inviteeId"))
                        invitation(status = "pending")
                    }
                    else -> error("Unexpected request: $method $path")
                }
            },
        )

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithContentDescription("Invite a member to Studio group").performClick()
        compose.onNodeWithText("Search by name or username").performTextInput("ari")
        compose.onNodeWithContentDescription("Select Ari Oyinlola, @ari").performClick()
        compose.onNodeWithText("Send 1 invitation").performClick()
        compose.onNode(hasText("1 invitation sent.", substring = true)).assertIsDisplayed()

        compose.runOnIdle {
            assertEquals(
                listOf(
                    "GET /api/v1/conversations/$groupId/invitation-links?limit=20",
                    "GET /api/v1/conversations/search?q=ari",
                    "POST /api/v1/conversations/$groupId/invitations",
                ),
                requests,
            )
        }
    }

    @Test
    fun inviteDialogShowsAvatarsAndRetriesOnlyPeopleWhoseInvitationFailed() {
        val secondMemberId = "66666666-6666-4666-8666-666666666666"
        val requests = mutableListOf<String>()
        var secondInviteAttempts = 0
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = MessagesTransport { _, _ ->
                JSONObject("""{"data":[{"id":"$groupId","kind":"group","title":"Studio group","lastMessageAt":"2026-11-05T12:00:00Z","unread":0}],"nextCursor":null}""")
            },
            threadTransport = ChatThreadTransport { method, path, _, body ->
                requests += "$method $path ${body?.optString("inviteeId").orEmpty()}"
                when {
                    method == "GET" && path == "/api/v1/conversations/$groupId/invitation-links?limit=20" -> JSONObject("""{"data":{"data":[],"nextCursor":null}}""")
                    method == "GET" && path.startsWith("/api/v1/conversations/search?") -> JSONObject(
                        """{"data":{"conversations":[],"people":[{"id":"$memberId","name":"Ari Oyinlola","username":"ari","avatarUrl":"https://images.nantty.com/ari.jpg"},{"id":"$secondMemberId","name":"Tola Ade","username":"tola","avatarUrl":null}]}}""",
                    )
                    method == "POST" && path == "/api/v1/conversations/$groupId/invitations" && body?.optString("inviteeId") == memberId -> invitation(status = "pending")
                    method == "POST" && path == "/api/v1/conversations/$groupId/invitations" && body?.optString("inviteeId") == secondMemberId -> {
                        secondInviteAttempts++
                        if (secondInviteAttempts == 1) throw com.nantty.android.data.MessagesHttpException(409)
                        invitation(status = "pending")
                    }
                    else -> error("Unexpected request: $method $path")
                }
            },
        )

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithContentDescription("Invite a member to Studio group").performClick()
        compose.onNodeWithText("Search by name or username").performTextInput("members")
        compose.onNodeWithContentDescription("Select Ari Oyinlola, @ari").assertIsDisplayed().performClick()
        compose.onNodeWithContentDescription("Select Tola Ade, @tola").assertIsDisplayed().performClick()
        compose.onNodeWithText("2 selected").assertIsDisplayed()
        compose.onNodeWithText("Send 2 invitations").performClick()

        compose.onNodeWithText("1 invitation sent. Each person must accept before consent is recorded; secure key handoff is still required before group access.").assertIsDisplayed()
        compose.onNodeWithText("1 invitation couldn't be sent. The remaining people are still selected so you can retry.").assertIsDisplayed()
        compose.onNodeWithText("Send 1 invitation").performClick()
        compose.onNodeWithText("1 invitation sent. Each person must accept before consent is recorded; secure key handoff is still required before group access.").assertIsDisplayed()
        compose.onNodeWithText("0 selected").assertDoesNotExist()

        compose.runOnIdle {
            assertEquals(
                listOf(
                    "GET /api/v1/conversations/$groupId/invitation-links?limit=20 ",
                    "GET /api/v1/conversations/search?q=members ",
                    "POST /api/v1/conversations/$groupId/invitations $memberId",
                    "POST /api/v1/conversations/$groupId/invitations $secondMemberId",
                    "POST /api/v1/conversations/$groupId/invitations $secondMemberId",
                ),
                requests,
            )
        }
    }

    @Test
    fun invitationInboxShowsEmptyStateAndCanRetryAfterFailure() {
        var calls = 0
        val repository = repository(thread = { method, path, _, _ ->
            if (method == "GET" && path.startsWith("/api/v1/group-invitations?")) {
                calls += 1
                if (calls == 1) throw com.nantty.android.data.MessagesHttpException(503)
                JSONObject("""{"data":{"data":[],"nextCursor":null}}""")
            } else error("Unexpected request: $method $path")
        })

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithContentDescription("Open group invitations").performClick()
        compose.onNodeWithText("Try again").assertIsDisplayed().performClick()
        compose.onNodeWithText("No group invitations received.").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, calls) }
    }

    @Test
    fun sharedLinkPreviewClaimCreatesPendingRequestThenRequiresInboxAcceptance() {
        val token = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG"
        val requests = mutableListOf<String>()
        val repository = repository(thread = { method, path, _, _ ->
            requests += "$method $path"
            when {
                method == "GET" && path == "/api/v1/conversations/invitation-links/$token/preview" -> JSONObject(
                    """{"data":{"group":{"title":"Studio group","memberCount":8},"expiresAt":"2026-11-13T12:00:00Z"}}""",
                )
                method == "POST" && path == "/api/v1/conversations/invitation-links/$token/claim" -> invitation(status = "pending")
                method == "GET" && path.startsWith("/api/v1/group-invitations?") -> page(status = "pending")
                method == "POST" && path.endsWith("/accept") -> invitation(status = "accepted", membership = "awaiting_secure_key_handoff")
                else -> error("Unexpected request: $method $path")
            }
        })

        compose.setContent {
            val pendingToken = androidx.compose.runtime.remember { mutableStateOf<String?>(token) }
            MaterialTheme {
                MessagesScreen(
                    repository = repository,
                    executor = Executor { it.run() },
                    initialGroupInvitationToken = pendingToken.value,
                    onInitialGroupInvitationTokenHandled = { pendingToken.value = null },
                )
            }
        }
        compose.onNodeWithText("Studio group").assertIsDisplayed()
        compose.onNodeWithText("Request invitation").performClick()
        compose.onNodeWithText("Ari Oyinlola").assertIsDisplayed()
        compose.onNodeWithText("Accept").performClick()
        compose.onNode(hasText("Consent recorded. You are not a group member yet", substring = true)).assertIsDisplayed()

        compose.runOnIdle {
            assertEquals(
                listOf(
                    "GET /api/v1/conversations/invitation-links/$token/preview",
                    "POST /api/v1/conversations/invitation-links/$token/claim",
                    "GET /api/v1/group-invitations?direction=received&limit=20",
                    "POST /api/v1/group-invitations/$invitationId/accept",
                ),
                requests,
            )
        }
    }

    @Test
    fun groupAdminsCanListAndRevokeInvitationLinks() {
        val linkId = "55555555-5555-4555-8555-555555555555"
        val requests = mutableListOf<String>()
        var revoked = false
        val repository = repository(thread = { method, path, _, _ ->
            requests += "$method $path"
            when {
                method == "GET" && path == "/api/v1/conversations/$groupId/invitation-links?limit=20" -> {
                    val revokedAt = if (revoked) "\"2026-11-06T12:00:00Z\"" else "null"
                    JSONObject("""{"data":{"data":[{"id":"$linkId","conversationId":"$groupId","createdAt":"2026-11-06T10:00:00Z","expiresAt":"2026-11-13T10:00:00Z","revokedAt":$revokedAt}],"nextCursor":null}}""")
                }
                method == "DELETE" && path == "/api/v1/conversations/$groupId/invitation-links/$linkId" -> {
                    revoked = true
                    JSONObject("""{"data":{"id":"$linkId","conversationId":"$groupId","revokedAt":"2026-11-06T12:00:00Z"}}""")
                }
                else -> error("Unexpected request: $method $path")
            }
        })

        compose.setContent {
            MaterialTheme {
                GroupInvitationLinksManager(groupId, repository, Executor { it.run() }, {}, refreshGeneration = 0)
            }
        }
        compose.onNodeWithText("Active link").assertIsDisplayed()
        compose.onNodeWithText("Revoke").performClick()
        compose.onNodeWithText("Revoked link").assertIsDisplayed()
        compose.onNodeWithText("Revoke").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals(
                listOf(
                    "GET /api/v1/conversations/$groupId/invitation-links?limit=20",
                    "DELETE /api/v1/conversations/$groupId/invitation-links/$linkId",
                    "GET /api/v1/conversations/$groupId/invitation-links?limit=20",
                ),
                requests,
            )
        }
    }

    private fun repository(thread: (String, String, String, JSONObject?) -> JSONObject) = MessagesRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = ::signedInSession,
        transport = MessagesTransport { _, _ -> JSONObject("""{"data":[],"nextCursor":null}""") },
        threadTransport = ChatThreadTransport(thread),
    )

    private fun page(status: String) = JSONObject("""{"data":{"data":[${invitationRow(status)}],"nextCursor":null}}""")

    private fun invitation(status: String, membership: String? = null): JSONObject {
        val row = JSONObject(invitationRow(status))
        membership?.let { row.put("membershipStatus", it) }
        return JSONObject().put("data", row)
    }

    private fun invitationRow(status: String) = JSONObject()
        .put("id", invitationId)
        .put("conversationId", groupId)
        .put("status", status)
        .put("createdAt", "2026-11-05T12:00:00Z")
        .put("expiresAt", "2026-11-12T12:00:00Z")
        .put("counterpart", JSONObject().put("id", memberId).put("name", "Ari Oyinlola").put("username", "ari"))
        .toString()

    private fun signedInSession() = AccountSession(
        "session-access",
        "session-refresh",
        AccountUser("44444444-4444-4444-8444-444444444444", "Sam", "sam", null, null, emptyList()),
    )
}
