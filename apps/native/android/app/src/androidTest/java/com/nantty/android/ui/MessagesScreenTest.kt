package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.MessagesTransport
import com.nantty.android.data.ChatThreadTransport
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
            assertEquals("/api/v1/conversations?filter=all&limit=20", transport.path)
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

    @Test
    fun searchesPeopleAndCreatesConversationThroughBackendBeforeOpeningThread() {
        val personId = "66666666-6666-4666-8666-666666666666"
        val conversationId = "77777777-7777-4777-8777-777777777777"
        val requestedPaths = mutableListOf<String>()
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = MessagesTransport { _, _ -> JSONObject("""{"data":[],"nextCursor":null}""") },
            threadTransport = ChatThreadTransport { method, path, _, body ->
                requestedPaths += "$method $path"
                when {
                    method == "GET" && path.startsWith("/api/v1/conversations/search?") -> JSONObject("""{"data":{"conversations":[],"people":[{"id":"$personId","name":"Ari Oyinlola","username":"ari","avatarUrl":null}]}}""")
                    method == "POST" && path == "/api/v1/conversations" -> {
                        assertEquals(personId, body?.optString("userId"))
                        JSONObject("""{"data":{"id":"$conversationId","kind":"direct","peer":{"id":"$personId","name":"Ari Oyinlola","username":"ari","avatarUrl":null},"lastMessageAt":"","unread":0}}""")
                    }
                    method == "GET" && path == "/api/v1/conversations/$conversationId/messages?limit=30" -> JSONObject("""{"data":[],"nextCursor":null}""")
                    method == "POST" && path == "/api/v1/conversations/$conversationId/read" -> JSONObject()
                    else -> error("Unexpected request: $method $path")
                }
            },
        )

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithContentDescription("Search messages and people").performClick()
        compose.onNodeWithText("Search messages and people").performTextInput("Ari")
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Ari Oyinlola").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Ari Oyinlola").performClick()
        compose.onNodeWithText("Encrypted message. Secure decryption is not available in this Android build yet").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(true, requestedPaths.contains("GET /api/v1/conversations/search?q=Ari"))
            assertEquals(true, requestedPaths.contains("POST /api/v1/conversations"))
        }
    }

    @Test
    fun switchingToDirectResetsListAndDoesNotReuseAllFilterCursor() {
        val requestedPaths = mutableListOf<String>()
        val cursor = "33333333-3333-4333-8333-333333333333"
        val transport = MessagesTransport { path, _ ->
            requestedPaths += path
            when {
                path.contains("filter=direct") -> JSONObject(
                    """{"data":[{"id":"11111111-1111-4111-8111-111111111111","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"Direct filter result"},"lastMessageAt":"2026-10-01T12:00:00.000Z","unread":0}],"nextCursor":null}""",
                )
                path.contains("&cursor=") -> JSONObject("{\"data\":[],\"nextCursor\":null}")
                else -> JSONObject(
                    """{"data":[{"id":"11111111-1111-4111-8111-111111111111","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"All filter result"},"lastMessageAt":"2026-10-01T12:00:00.000Z","unread":0}],"nextCursor":"$cursor"}""",
                )
            }
        }
        compose.setContent {
            MaterialTheme { MessagesScreen(MessagesRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() }) }
        }

        compose.onNodeWithText("Load more conversations").assertIsDisplayed().performClick()
        compose.onNodeWithText("Direct Messages").assertIsDisplayed().performClick()
        compose.onNodeWithText("Direct filter result").assertIsDisplayed()

        compose.runOnIdle {
            assertEquals(
                listOf(
                    "/api/v1/conversations?filter=all&limit=20",
                    "/api/v1/conversations?filter=all&limit=20&cursor=$cursor",
                    "/api/v1/conversations?filter=direct&limit=20",
                ),
                requestedPaths,
            )
        }
    }

    @Test
    fun requestsFolderUsesServerFolderAndAcceptsTheRequest() {
        val conversationId = "11111111-1111-4111-8111-111111111111"
        var requestedFolder: String? = null
        var actionRequest: String? = null
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = MessagesTransport { path, _ ->
                requestedFolder = path
                JSONObject("""{"data":[{"id":"$conversationId","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"Request sender"},"inboxFolder":"requests","lastMessageAt":"2026-10-01T12:00:00Z","unread":0}],"nextCursor":null}""")
            },
            threadTransport = ChatThreadTransport { method, path, _, body ->
                assertEquals(null, body)
                actionRequest = "$method $path"
                JSONObject()
            },
        )

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithText("Chats").performClick()
        compose.onNodeWithContentDescription("Requests inbox folder").performClick()
        compose.onNodeWithText("Request sender").assertIsDisplayed()
        compose.onNodeWithText("They won't see you've read this until you accept.").assertIsDisplayed()
        compose.onNodeWithText("Accept").performClick()

        compose.runOnIdle {
            assertEquals("/api/v1/conversations?folder=requests&limit=20", requestedFolder)
            assertEquals("POST /api/v1/conversations/$conversationId/accept", actionRequest)
        }
    }

    @Test
    fun openingRequestDoesNotSendReadReceiptOrExposeMarkReadAction() {
        val conversationId = "11111111-1111-4111-8111-111111111111"
        val threadRequests = mutableListOf<String>()
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = MessagesTransport { _, _ ->
                JSONObject("""{"data":[{"id":"$conversationId","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"Request sender"},"inboxFolder":"requests","lastMessageAt":"2026-10-01T12:00:00Z","unread":0}],"nextCursor":null}""")
            },
            threadTransport = ChatThreadTransport { method, path, _, _ ->
                threadRequests += "$method $path"
                JSONObject("""{"data":[],"nextCursor":null}""")
            },
        )

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithText("Chats").performClick()
        compose.onNodeWithContentDescription("Requests inbox folder").performClick()
        compose.onNodeWithText("Request sender").performClick()
        compose.onNodeWithContentDescription("Mark conversation as read").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals(listOf("GET /api/v1/conversations/$conversationId/messages?limit=30"), threadRequests)
        }
    }

    @Test
    fun lateResponseFromPreviousFilterCannotReplaceSelectedFilter() {
        val executor = QueuedExecutor()
        val transport = MessagesTransport { path, _ ->
            val name = if (path.contains("filter=direct")) "Current direct result" else "Stale all result"
            JSONObject(
                """{"data":[{"id":"11111111-1111-4111-8111-111111111111","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"$name"},"lastMessageAt":"2026-10-01T12:00:00.000Z","unread":0}],"nextCursor":null}""",
            )
        }
        compose.setContent {
            MaterialTheme { MessagesScreen(MessagesRepository("https://api.nantty.com", ::signedInSession, transport), executor) }
        }
        compose.waitForIdle()
        compose.onNodeWithText("Direct Messages").performClick()
        compose.waitForIdle()

        executor.runAt(1) // Complete the active direct-filter request first.
        compose.waitForIdle()
        executor.runAt(0) // The older all-filter response must now be ignored.
        compose.waitForIdle()

        compose.onNodeWithText("Current direct result").assertIsDisplayed()
        compose.onNodeWithText("Stale all result").assertDoesNotExist()
    }

    @Test
    fun opensThreadButKeepsCiphertextHiddenAndComposerDisabledUntilCryptoIsAvailable() {
        val conversationId = "11111111-1111-4111-8111-111111111111"
        val threadTransport = ChatThreadTransport { method, path, token, _ ->
            when {
                method == "GET" && path == "/api/v1/conversations/$conversationId/messages?limit=30" -> {
                    assertEquals("inbox-access", token)
                    JSONObject("""{"data":[{"id":"33333333-3333-4333-8333-333333333333","conversationId":"$conversationId","senderId":"22222222-2222-4222-8222-222222222222","createdAt":"2026-10-01T12:00:00.000Z","kind":"text","text":"plaintext must not render","encryption":{"deviceId":"device-a","ciphertext":"ciphertext-must-not-render","protocol":"signal-v1"}}],"nextCursor":null}""")
                }
                method == "POST" && path == "/api/v1/conversations/$conversationId/read" -> JSONObject()
                else -> error("Unexpected thread request: $method $path")
            }
        }
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = FakeTransport(),
            threadTransport = threadTransport,
        )

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithText("Ari Oyinlola").performClick()
        compose.onNodeWithText("Encrypted message. Secure decryption is not available in this Android build yet").assertIsDisplayed()
        compose.onNodeWithText("ciphertext-must-not-render").assertDoesNotExist()
        compose.onNodeWithText("plaintext must not render").assertDoesNotExist()
        compose.onNodeWithContentDescription("Send message").assertIsNotEnabled()
    }

    @Test
    fun openingThreadLoadsOlderCursorPagesBeforeShowingFinalTimeline() {
        val conversationId = "11111111-1111-4111-8111-111111111111"
        val newestId = "33333333-3333-4333-8333-333333333333"
        val olderId = "44444444-4444-4444-8444-444444444444"
        val historyPaths = mutableListOf<String>()
        val threadTransport = ChatThreadTransport { method, path, _, _ ->
            when {
                method == "GET" && path == "/api/v1/conversations/$conversationId/messages?limit=30" -> {
                    historyPaths += path
                    JSONObject("""{"data":[{"id":"$newestId","conversationId":"$conversationId","senderId":"22222222-2222-4222-8222-222222222222","createdAt":"2026-10-01T12:00:00.000Z","kind":"text","text":"must stay hidden","encryption":{"ciphertext":"opaque-new","protocol":"signal-v1"}}],"nextCursor":"$olderId"}""")
                }
                method == "GET" && path == "/api/v1/conversations/$conversationId/messages?limit=30&cursor=$olderId" -> {
                    historyPaths += path
                    JSONObject("""{"data":[{"id":"$olderId","conversationId":"$conversationId","senderId":"22222222-2222-4222-8222-222222222222","createdAt":"2026-10-01T11:00:00.000Z","kind":"text","text":"also hidden","encryption":{"ciphertext":"opaque-old","protocol":"signal-v1"}}],"nextCursor":null}""")
                }
                method == "POST" && path == "/api/v1/conversations/$conversationId/read" -> JSONObject()
                else -> error("Unexpected thread request: $method $path")
            }
        }
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = FakeTransport(),
            threadTransport = threadTransport,
        )

        compose.setContent { MaterialTheme { MessagesScreen(repository, Executor { it.run() }) } }
        compose.onNodeWithText("Ari Oyinlola").performClick()
        compose.waitForIdle()

        compose.onAllNodesWithText("Encrypted message. Secure decryption is not available in this Android build yet")
            .assertCountEquals(2)
        compose.onNodeWithText("Load older messages").assertDoesNotExist()
        compose.onNodeWithText("must stay hidden").assertDoesNotExist()
        compose.onNodeWithText("also hidden").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals(
                listOf(
                    "/api/v1/conversations/$conversationId/messages?limit=30",
                    "/api/v1/conversations/$conversationId/messages?limit=30&cursor=$olderId",
                ),
                historyPaths,
            )
        }
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

    private class QueuedExecutor : Executor {
        private val tasks = mutableListOf<Runnable>()

        override fun execute(command: Runnable) {
            tasks += command
        }

        fun runAt(index: Int) {
            tasks[index].run()
        }
    }

    companion object {
        private fun signedInSession() = AccountSession(
            "inbox-access", "refresh", AccountUser("22222222-2222-4222-8222-222222222222", "Ari", "ari", null, null, emptyList()),
        )
    }
}
