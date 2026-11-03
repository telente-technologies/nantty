package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.MessagesTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class MessagesScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun displaysPeerTypeTimestampAndUnreadButNeverMessageContent() {
        val transport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                MessagesScreen(MessagesRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Ari Oyinlola").assertIsDisplayed()
        compose.onNode(hasText("Direct message ·", substring = true)).assertIsDisplayed()
        compose.onNode(hasContentDescription("Ari Oyinlola, Direct message", substring = true)).assertIsDisplayed()
        compose.onNodeWithText("Secret encrypted preview").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals("/api/v1/conversations?folder=chats&filter=all&limit=20", transport.path)
            assertEquals("inbox-access", transport.accessToken)
        }
    }

    @Test
    fun showsEmptyInboxState() {
        compose.setContent {
            MaterialTheme {
                MessagesScreen(MessagesRepository("https://api.nantty.com", ::signedInSession, MessagesTransport { _, _ -> JSONObject("{\"data\":[],\"nextCursor\":null}") }), Executor { it.run() })
            }
        }
        compose.onNodeWithText("No conversations yet").assertIsDisplayed()
    }

    @Test
    fun retriesInboxLoadAfterFailure() {
        val transport = FakeTransport(failFirst = true)
        compose.setContent {
            MaterialTheme {
                MessagesScreen(MessagesRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }
        compose.onNodeWithText("Try again").assertIsDisplayed().performClick()
        compose.onNodeWithText("Ari Oyinlola").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, transport.calls) }
    }

    private class FakeTransport(private val failFirst: Boolean = false) : MessagesTransport {
        var calls = 0
        var path: String? = null
        var accessToken: String? = null

        override fun get(path: String, accessToken: String): JSONObject {
            calls += 1
            this.path = path
            this.accessToken = accessToken
            if (failFirst && calls == 1) error("Offline")
            return JSONObject(
                """{"data":[{"id":"11111111-1111-4111-8111-111111111111","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"Ari Oyinlola"},"lastMessage":"Secret encrypted preview","lastMessageAt":"2026-10-01T12:00:00.000Z","unread":3}],"nextCursor":null}""",
            )
        }
    }

    companion object {
        private fun signedInSession() = AccountSession(
            "inbox-access", "refresh", AccountUser("22222222-2222-4222-8222-222222222222", "Ari", "ari", null, null, emptyList()),
        )
    }
}
