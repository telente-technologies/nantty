package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PostDetailTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class PostDetailQuoteScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun quoteFilterLoadsQuoteRowsAndOpensTheQuotePost() {
        val transport = QuoteThreadTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { null }, transport)
        val openedPosts = mutableListOf<String>()

        compose.setContent {
            MaterialTheme {
                PostDetailScreen(
                    postId = "post-1",
                    sessionProvider = { null },
                    executor = Executor { it.run() },
                    onBack = {},
                    onOpenPost = { openedPosts += it },
                    repository = repository,
                )
            }
        }

        compose.onNodeWithText("Quoted this post").assertIsDisplayed()
        compose.onNodeWithTag("post-thread-quotes-filter").performClick()
        compose.onNodeWithContentDescription("Quoted post by Bea: A quoted response").assertIsDisplayed().performClick()

        compose.runOnIdle {
            assertEquals("quote-post-1", openedPosts.single())
            assertTrue(transport.threadPaths.contains("/api/v1/posts/post-1/thread?sort=relevant&filter=quotes"))
        }
    }

    private class QuoteThreadTransport : PostDetailTransport {
        val threadPaths = mutableListOf<String>()

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject = when {
            path == "/api/v1/posts/post-1" -> JSONObject(
                """{"data":{"id":"post-1","text":"Original post","quotes":1,"author":{"name":"Ari","username":"ari"},"media":[]}}""",
            )
            path.startsWith("/api/v1/posts/post-1/thread") -> {
                threadPaths += path
                JSONObject(
                    """{"data":[{"type":"quote","id":"quote-post-1","postId":"post-1","quotePost":{"id":"quote-post-1","kind":"post","author":{"name":"Bea","username":"bea"},"text":"A quoted response","thumbnail":null,"createdAt":"2026-11-06T10:00:00Z"},"createdAt":"2026-11-06T10:00:00Z"}],"nextCursor":null}""",
                )
            }
            else -> error("Unexpected request $method $path")
        }
    }
}
