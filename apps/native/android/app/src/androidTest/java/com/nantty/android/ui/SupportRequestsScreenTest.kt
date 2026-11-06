package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.SupportTicketRepository
import com.nantty.android.data.SupportTicketTransport
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class SupportRequestsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun loadsRequesterTicketsAndOpensTheContactSupportForm() {
        val paths = mutableListOf<String>()
        val transport = object : SupportTicketTransport {
            override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject {
                paths += path
                return when (path) {
                    SupportTicketRepository.TICKETS_PATH -> JSONObject().put("data", JSONArray().put(ticketSummary()))
                    SupportTicketRepository.UNREAD_COUNT_PATH -> JSONObject().put("count", 2)
                    else -> error("Unexpected request: $path")
                }
            }
        }
        val repository = SupportTicketRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { AccountSession("buyer-token", "refresh", AccountUser("buyer", "Ari", "ari", null, null, emptyList())) },
            transport = transport,
        )

        compose.setContent {
            MaterialTheme {
                SupportRequestsScreen(repository, Executor { it.run() }, onBack = {}, onAuthenticationRequired = {})
            }
        }

        compose.onNodeWithText("Order hasn't arrived").assertIsDisplayed()
        compose.onNodeWithText("Support requests · 2 unread").assertIsDisplayed()
        compose.onNodeWithText("Contact support").performClick()
        compose.onNodeWithText("What do you need help with?").assertIsDisplayed()
        compose.runOnIdle {
            assert(paths.contains(SupportTicketRepository.TICKETS_PATH))
            assert(paths.contains(SupportTicketRepository.UNREAD_COUNT_PATH))
        }
    }

    @Test
    fun opensExistingTicketThreadFromTheRequesterList() {
        val transport = object : SupportTicketTransport {
            override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject = when {
                path == SupportTicketRepository.TICKETS_PATH -> JSONObject().put("data", JSONArray().put(ticketSummary()))
                path == SupportTicketRepository.UNREAD_COUNT_PATH -> JSONObject().put("count", 0)
                path.endsWith("/read") -> JSONObject()
                path.endsWith("/" + TICKET_ID) -> JSONObject().put("data", ticketDetail())
                else -> error("Unexpected request: $path")
            }
        }
        val repository = SupportTicketRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { AccountSession("buyer-token", "refresh", AccountUser("buyer", "Ari", "ari", null, null, emptyList())) },
            transport = transport,
        )
        compose.setContent {
            MaterialTheme {
                SupportRequestsScreen(repository, Executor { it.run() }, onBack = {}, onAuthenticationRequired = {})
            }
        }

        compose.onNodeWithContentDescription("Order hasn't arrived, Open, 2 unread replies").performClick()
        compose.onNodeWithText("We're looking into this").assertIsDisplayed()
    }

    @Test
    fun recentOrderChoiceCanBeLinkedWithoutTypingIdentifiers() {
        compose.setContent {
            MaterialTheme {
                SupportTicketCreationScreen(
                    onCreate = {},
                    onCancel = {},
                    recentOrderOptions = listOf(
                        SupportOrderOption(ORDER_ID, "NT-1042"),
                        SupportOrderOption("0192a4f0-0000-7000-8000-000000000001", "NT-1041"),
                    ),
                )
            }
        }

        compose.onNodeWithText("Order NT-1042").performClick()
        compose.onNodeWithText("Linked to Order NT-1042").assertIsDisplayed()
    }

    private fun ticketSummary() = JSONObject(
        """{"id":"$TICKET_ID","reference":"SUP-1042","subject":"Order hasn't arrived","category":"order","status":"open","linkedReference":{"kind":"order","id":"$ORDER_ID","label":"Order NT-1042"},"lastMessagePreview":"We're looking into this","unreadCount":2,"satisfactionScore":null,"canRate":false,"canReply":true,"createdAt":"2026-11-05T10:00:00Z","updatedAt":"2026-11-05T10:00:00Z"}""",
    )

    private fun ticketDetail() = ticketSummary().put(
        "messages",
        JSONArray().put(JSONObject().put("id", "message-1").put("fromSupport", true).put("authorName", "Nantty Support").put("text", "We're looking into this").put("attachmentUrls", JSONArray()).put("createdAt", "2026-11-05T10:00:00Z")),
    ).put("agentTyping", false)

    companion object {
        private const val TICKET_ID = "0192a4f0-0000-7000-8000-000000000123"
        private const val ORDER_ID = "0192a4f0-0000-7000-8000-000000000000"
    }
}
