package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PostDetailTransport
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class CommentRepliesExpansionTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun expandsNestedRepliesAndPagesWithoutRenderingDuplicates() {
        val transport = NestedRepliesTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { null }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { null }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithText("Root reply").assertIsDisplayed()
        compose.onNodeWithTag("thread-replies-root-1").performScrollTo().performClick()
        compose.onNodeWithText("Nested reply two").performScrollTo().assertIsDisplayed()
        compose.onAllNodesWithText("Nested reply one").assertCountEquals(1)

        compose.onNodeWithText("Show more replies").performScrollTo().performClick()
        compose.onNodeWithText("Nested reply three").performScrollTo().assertIsDisplayed()
        compose.onAllNodesWithText("Nested reply two").assertCountEquals(1)
        compose.runOnIdle {
            org.junit.Assert.assertEquals(
                listOf("/api/v1/comments/root-1/thread", "/api/v1/comments/root-1/thread?cursor=nested-page-2"),
                transport.replyPaths,
            )
        }
    }

    private class NestedRepliesTransport : PostDetailTransport {
        val replyPaths = mutableListOf<String>()

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject = when {
            path == "/api/v1/posts/post-1" -> JSONObject("""{"data":{"id":"post-1","text":"A post","author":{"name":"Ari"},"media":[]}}""")
            path.startsWith("/api/v1/posts/post-1/thread") -> JSONObject("""{"data":[{"id":"root-1","text":"Root reply","replyCount":3,"author":{"name":"Bea"},"inlineReplies":[{"id":"nested-1","text":"Nested reply one","author":{"name":"Cal"},"replyCount":0,"inlineReplies":[]}]}],"nextCursor":null}""")
            path.startsWith("/api/v1/comments/root-1/thread") -> {
                replyPaths += path
                if (path.contains("cursor=nested-page-2")) {
                    JSONObject("""{"data":[{"id":"nested-2","text":"Nested reply two","author":{"name":"Dee"},"replyCount":0},{"id":"nested-3","text":"Nested reply three","author":{"name":"Eli"},"replyCount":0}],"nextCursor":null}""")
                } else {
                    JSONObject("""{"data":[{"id":"nested-1","text":"Nested reply one","author":{"name":"Cal"},"replyCount":0},{"id":"nested-2","text":"Nested reply two","author":{"name":"Dee"},"replyCount":0}],"nextCursor":"nested-page-2"}""")
                }
            }
            else -> error("Unexpected request $method $path")
        }
    }
}
