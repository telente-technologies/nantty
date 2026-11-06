package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PostDetailTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class PostDetailRefreshScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun pullingPostConversationRefreshesPostAndThreadFromRepository() {
        val transport = RefreshTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { null }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { null }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }
        compose.onNodeWithTag("post-detail-pull-to-refresh").assertIsDisplayed()
        compose.waitForIdle()
        compose.runOnIdle {
            assertEquals(1, transport.postLoads)
            assertEquals(1, transport.threadLoads)
        }

        compose.onNodeWithTag("post-detail-pull-to-refresh").performTouchInput {
            swipeDown(startY = height * 0.2f, endY = height * 0.9f)
        }
        compose.waitForIdle()

        compose.runOnIdle {
            assertEquals(2, transport.postLoads)
            assertEquals(2, transport.threadLoads)
        }
    }

    private class RefreshTransport : PostDetailTransport {
        var postLoads = 0
        var threadLoads = 0

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject = when {
            path == "/api/v1/posts/post-1" -> {
                postLoads += 1
                JSONObject("""{"data":{"id":"post-1","text":"Refresh test","author":{"name":"Ari","username":"ari"},"media":[]}}""")
            }
            path.startsWith("/api/v1/posts/post-1/thread") -> {
                threadLoads += 1
                JSONObject("""{"data":[],"nextCursor":null}""")
            }
            else -> error("Unexpected request $method $path")
        }
    }
}
