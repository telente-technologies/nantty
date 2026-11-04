package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.FollowRequestsTransport
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class FollowRequestsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun loadsPendingRequestsAndAcceptRemovesOnlyAfterServerSuccess() {
        val transport = FollowRequestsScreenTransport()
        val repository = FollowRequestsRepository("https://api.nantty.com", transport, ::followRequestsSession)
        compose.setContent {
            MaterialTheme {
                FollowRequestsScreen(repository, Executor { it.run() }, onBack = {}, onReauthenticate = {})
            }
        }

        compose.onNodeWithText("Follow requests").assertIsDisplayed()
        compose.onNodeWithText("Ari wants to follow you").assertIsDisplayed()
        compose.onNodeWithText("Confirm").performClick()
        compose.onNodeWithText("Ari wants to follow you").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals("GET /api/v1/users/me/follow-requests?limit=20", transport.calls.first())
            assertEquals("POST /api/v1/follow-requests/request-1/accept", transport.calls.last())
        }
    }

    @Test
    fun requesterIdentityOpensTheirPublicProfile() {
        val repository = FollowRequestsRepository("https://api.nantty.com", FollowRequestsScreenTransport(), ::followRequestsSession)
        var openedProfileId: String? = null
        compose.setContent {
            MaterialTheme {
                FollowRequestsScreen(
                    repository,
                    Executor { it.run() },
                    onBack = {},
                    onReauthenticate = {},
                    onOpenProfile = { openedProfileId = it },
                )
            }
        }

        compose.onNodeWithContentDescription("Ari, @ari").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals("requester-1", openedProfileId) }
    }
}

private class FollowRequestsScreenTransport : FollowRequestsTransport {
    val calls = mutableListOf<String>()

    override fun request(method: String, path: String, accessToken: String): JSONObject {
        calls += "$method $path"
        return if (method == "GET") JSONObject().put("data", JSONArray().put(JSONObject()
            .put("id", "request-1")
            .put("createdAt", "2026-11-04T10:00:00Z")
            .put("requester", JSONObject().put("id", "requester-1").put("name", "Ari").put("username", "ari"))))
        else JSONObject()
    }
}

private fun followRequestsSession() = AccountSession(
    accessToken = "session-token",
    refreshToken = "refresh-token",
    user = AccountUser("account-1", "Sam", "sam", "private@example.test", null, listOf("user")),
)
