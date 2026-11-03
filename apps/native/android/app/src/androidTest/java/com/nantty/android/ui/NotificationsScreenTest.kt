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
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.NotificationsTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class NotificationsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun showsActivityAndMarksAllReadThroughApi() {
        val transport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                NotificationsScreen(NotificationsRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Ari mentioned you").assertIsDisplayed()
        compose.onNodeWithText("Mark all read").performClick()
        compose.runOnIdle {
            assertEquals("POST", transport.lastMethod)
            assertEquals("/api/v1/notifications/read-all", transport.lastPath)
        }
        compose.onNodeWithText("Mark all read").assertDoesNotExist()
    }

    @Test
    fun marksSingleNotificationReadOnlyAfterSuccessfulRequest() {
        val transport = FakeTransport()
        var openedPost: String? = null
        compose.setContent {
            MaterialTheme {
                NotificationsScreen(NotificationsRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() }, onOpenPost = { openedPost = it })
            }
        }

        compose.onNodeWithContentDescription("Ari mentioned you Hello from Ari, unread").performClick()
        compose.runOnIdle {
            assertEquals("POST", transport.lastMethod)
            assertEquals("/api/v1/notifications/n1/read", transport.lastPath)
            assertEquals("post-1", openedPost)
        }
        compose.onNodeWithContentDescription("Ari mentioned you Hello from Ari").assertIsDisplayed()
    }

    @Test
    fun unsupportedUrlOnlyNotificationIsMarkedReadWithoutNavigation() {
        val transport = FakeTransport(includePostId = false)
        var openedPost: String? = null
        compose.setContent {
            MaterialTheme {
                NotificationsScreen(NotificationsRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() }, onOpenPost = { openedPost = it })
            }
        }

        compose.onNodeWithContentDescription("Ari mentioned you Hello from Ari, unread").performClick()
        compose.runOnIdle {
            assertEquals("POST", transport.lastMethod)
            assertEquals("/api/v1/notifications/n1/read", transport.lastPath)
            assertNull(openedPost)
        }
    }

    @Test
    fun opensActorProfileWhenNotificationHasNoPostTarget() {
        val transport = FakeTransport(includePostId = false)
        var openedProfile: String? = null
        compose.setContent {
            MaterialTheme {
                NotificationsScreen(
                    NotificationsRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() },
                    onOpenProfile = { openedProfile = it },
                )
            }
        }

        compose.onNodeWithContentDescription("Ari mentioned you Hello from Ari, unread").performClick()
        compose.runOnIdle {
            assertEquals("u1", openedProfile)
            assertEquals("/api/v1/notifications/n1/read", transport.lastPath)
        }
    }

    @Test
    fun filtersAndLoadsNextCursorPage() {
        val transport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                NotificationsScreen(NotificationsRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Mentions").performClick()
        compose.runOnIdle { assertEquals("/api/v1/notifications?filter=mentions", transport.lastPath) }
        compose.onNodeWithText("Load more").performClick()
        compose.onNodeWithText("Second notification").assertIsDisplayed()
        compose.runOnIdle { assertEquals("/api/v1/notifications?filter=mentions&cursor=next-page", transport.lastPath) }
    }

    @Test
    fun exposesRefreshAndRetriesLoadFailure() {
        val transport = FakeTransport(failFirst = true)
        compose.setContent {
            MaterialTheme {
                NotificationsScreen(NotificationsRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Try again").assertIsDisplayed().performClick()
        compose.onNodeWithText("Ari mentioned you").assertIsDisplayed()
        compose.onNodeWithContentDescription("Refresh notifications").assertIsDisplayed()
    }

    private class FakeTransport(private val failFirst: Boolean = false, private val includePostId: Boolean = true) : NotificationsTransport {
        var calls = 0
        var lastMethod: String? = null
        var lastPath: String? = null
        override fun request(method: String, path: String, accessToken: String?): JSONObject {
            calls += 1
            lastMethod = method
            lastPath = path
            if (failFirst && calls == 1) error("Offline")
            return if (path.contains("cursor=next-page")) secondPage() else firstPage()
        }

        private fun firstPage() = JSONObject("""{"data":[{"id":"n1","category":"social","title":"Ari mentioned you","body":"Hello from Ari","createdAt":"2026-10-01T12:00:00.000Z","read":false,"actor":{"id":"u1","name":"Ari"},"url":"https://evil.example/post/forged"${if (includePostId) ",\"data\":{\"postId\":\"post-1\"}" else ""}}],"nextCursor":"next-page"}""")
        private fun secondPage() = JSONObject("""{"data":[{"id":"n2","category":"social","title":"Second notification","body":"More activity","createdAt":"2026-10-01T11:00:00.000Z","read":true}],"nextCursor":null}""")
    }

    companion object {
        private fun signedInSession() = AccountSession("notifications-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
    }
}
