package com.nantty.android.ui

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.ChatThreadTransport
import com.nantty.android.data.MessagesRepository
import com.nantty.android.ui.theme.NanttyTheme
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.Executor

class ChannelInvitationAcceptanceTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun acceptingInvitationReturnsTheSubscribedChannelForImmediateOpening() {
        val channelId = "11111111-1111-4111-8111-111111111111"
        val invitationId = "22222222-2222-4222-8222-222222222222"
        val repository = MessagesRepository(
            sessionProvider = {
                AccountSession("access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
            },
            threadTransport = ChatThreadTransport { method, path, _, _ ->
                when {
                    method == "GET" && path.startsWith("/api/v1/channel-invitations") -> JSONObject("""{"data":{"data":[{"id":"$invitationId","channelId":"$channelId","channelTitle":"Nantty updates","status":"pending","createdAt":"2026-11-06T12:00:00Z","expiresAt":"2030-01-01T00:00:00Z"}],"nextCursor":null}}""")
                    method == "POST" && path.endsWith("/$invitationId/accept") -> JSONObject("""{"data":{"id":"$invitationId","channelId":"$channelId","channelTitle":"Nantty updates","status":"accepted","createdAt":"2026-11-06T12:00:00Z","expiresAt":"2030-01-01T00:00:00Z"}}""")
                    method == "GET" && path == "/api/v1/conversations/$channelId" -> JSONObject("""{"data":{"id":"$channelId","kind":"channel","title":"Nantty updates","lastMessageAt":"2026-11-06T12:00:00Z","unread":0}}""")
                    else -> error("Unexpected channel invitation request: $method $path")
                }
            },
        )
        var openedChannelId: String? = null
        var openedChannelTitle: String? = null

        compose.setContent {
            NanttyTheme {
                ChannelInvitationsDialog(
                    repository = repository,
                    executor = Executor { it.run() },
                    onDismiss = {},
                    onChannelAccepted = { invitation ->
                        openAcceptedChannelConversation(
                            invitation = invitation,
                            repository = repository,
                            executor = Executor { it.run() },
                            onOpened = { openedChannelId = it.id; openedChannelTitle = it.title },
                            onFailure = { message, _ -> error(message) },
                        )
                    },
                    onReauthenticate = {},
                )
            }
        }

        compose.onNodeWithText("Accept").performClick()
        compose.waitForIdle()

        assertEquals(channelId, openedChannelId)
        assertEquals("Nantty updates", openedChannelTitle)
    }
}
