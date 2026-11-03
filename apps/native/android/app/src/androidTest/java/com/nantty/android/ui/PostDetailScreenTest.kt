package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.test.espresso.Espresso
import androidx.compose.runtime.mutableStateOf
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PostDetailTransport
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class PostDetailScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun postAndCommentLinksOpenSafelyAndRecordOnlyPostClickContext() {
        val session = AccountSession("access-current", "refresh-current", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = PostLinkTrackingTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)
        val openedUrls = mutableListOf<String>()
        val uriHandler = object : UriHandler {
            override fun openUri(uri: String) { openedUrls += uri }
        }
        compose.setContent {
            CompositionLocalProvider(LocalUriHandler provides uriHandler) {
                MaterialTheme {
                    PostDetailScreen("post-1", { session }, Executor { it.run() }, onBack = {}, repository = repository)
                }
            }
        }

        compose.onNodeWithContentDescription("Open link to example.com").performClick()
        compose.onNodeWithContentDescription("Open link to reply.example").performScrollTo().performClick()

        compose.runOnIdle {
            org.junit.Assert.assertEquals(listOf("https://example.com/article", "https://reply.example/source"), openedUrls)
            val tracked = transport.calls.filter { it.path == "/api/v1/feeds/interactions/batch" }
            org.junit.Assert.assertEquals(2, tracked.size)
            tracked.forEach { call ->
                val event = call.body?.getJSONArray("events")?.getJSONObject(0)
                org.junit.Assert.assertEquals("access-current", call.accessToken)
                org.junit.Assert.assertEquals("post-1", event?.getString("postId"))
                org.junit.Assert.assertEquals("link_click", event?.getString("kind"))
                org.junit.Assert.assertEquals("post_detail", event?.getString("surface"))
                org.junit.Assert.assertFalse(call.body.toString().contains("https://"))
            }
        }
    }

    @Test
    fun rendersPostAndNestedRepliesAndKeepsComposerHiddenWithoutSession() {
        val repository = PostDetailRepository("https://api.nantty.com", { null }, SuccessfulThreadTransport())
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { null }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithText("Actual post body").assertIsDisplayed()
        compose.onAllNodesWithText("Nantty for Android").assertCountEquals(1)
        compose.onNodeWithText("Root API reply").assertIsDisplayed()
        compose.onNodeWithText("Nested API reply").assertIsDisplayed()
        compose.onNodeWithText("Sign in to reply.").assertIsDisplayed()
        compose.onAllNodesWithText("Write a reply").assertCountEquals(0)
    }

    @Test
    fun retryAfterLoadErrorShowsRealPostAndThread() {
        val repository = PostDetailRepository("https://api.nantty.com", { null }, RetryTransport())
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { null }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithText("Post unavailable").assertIsDisplayed()
        compose.onNodeWithText("Try again").performClick()
        compose.onNodeWithText("Actual post body").assertIsDisplayed()
        compose.onNodeWithText("No replies yet. Start the conversation.").assertIsDisplayed()
    }

    @Test
    fun loadsNextPageDeduplicatesRootsAndStopsWhenServerRepeatsCursor() {
        val transport = PagedThreadTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { null }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { null }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithText("First root reply").assertIsDisplayed()
        compose.onNodeWithContentDescription("Load more replies").performScrollTo().performClick()

        compose.onNodeWithText("Second root reply").performScrollTo().assertIsDisplayed()
        compose.onAllNodesWithText("First root reply").assertCountEquals(1)
        compose.onNodeWithText("Nested first-page reply").performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("End of replies").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("The server repeated a reply page. Reload the thread to continue.").assertIsDisplayed()
        compose.onAllNodesWithText("Load more replies").assertCountEquals(0)
        compose.runOnIdle {
            org.junit.Assert.assertEquals(
                listOf("/api/v1/posts/post-1/thread?sort=relevant", "/api/v1/posts/post-1/thread?sort=relevant&cursor=cursor-2"),
                transport.threadPaths,
            )
        }
    }

    @Test
    fun failedNextPagePreservesRepliesAndCanBeRetriedToEnd() {
        val transport = PagedThreadTransport(failSecondPageOnce = true)
        val repository = PostDetailRepository("https://api.nantty.com", { null }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { null }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithContentDescription("Load more replies").performScrollTo().performClick()
        compose.onNodeWithText("First root reply").assertIsDisplayed()
        compose.onNodeWithText("Temporary page failure").assertIsDisplayed()
        compose.onNodeWithContentDescription("Retry loading replies").performScrollTo().performClick()

        compose.onNodeWithText("Second root reply").performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("End of replies").performScrollTo().assertIsDisplayed()
        compose.runOnIdle { org.junit.Assert.assertEquals(3, transport.threadPaths.size) }
    }

    @Test
    fun authenticatedViewerCanReplyToNestedCommentUsingCurrentBearerSession() {
        val session = AccountSession("access-current", "refresh-current", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = SuccessfulThreadTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { session }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithTag("reply-comment-2").performClick()
        compose.onNodeWithText("Replying to @cal").assertIsDisplayed()
        compose.onNodeWithTag("post-reply-input").performTextInput("A nested response")
        compose.onNodeWithTag("post-reply-input").performImeAction()

        compose.runOnIdle {
            val reply = transport.calls.single { it.path == "/api/v1/posts/post-1/comments" }
            org.junit.Assert.assertEquals("access-current", reply.accessToken)
            org.junit.Assert.assertEquals("comment-2", reply.body?.getString("parentCommentId"))
            org.junit.Assert.assertEquals("A nested response", reply.body?.getString("text"))
        }
    }

    @Test
    fun saveStateChangesOnlyAfterAuthenticatedSaveRequestSucceeds() {
        val session = AccountSession("access-current", "refresh-current", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = SuccessfulThreadTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { session }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithContentDescription("Save post").assertIsNotSelected().performClick()
        compose.onNodeWithContentDescription("Remove post from saved").assertIsSelected()
        compose.runOnIdle {
            val save = transport.calls.single { it.path == "/api/v1/saves" }
            org.junit.Assert.assertEquals("POST", save.method)
            org.junit.Assert.assertEquals("access-current", save.accessToken)
            org.junit.Assert.assertEquals("post", save.body?.getString("type"))
            org.junit.Assert.assertEquals("post-1", save.body?.getString("targetId"))
        }
    }

    @Test
    fun failedSaveKeepsTheServerBackedUnSavedState() {
        val session = AccountSession("access-current", "refresh-current", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val repository = PostDetailRepository("https://api.nantty.com", { session }, FailedSaveTransport())
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { session }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithContentDescription("Save post").performClick()
        compose.onNodeWithContentDescription("Save post").assertIsNotSelected()
        compose.onNodeWithText("Could not update your saved posts. Try again.").assertIsDisplayed()
    }

    @Test
    fun postDetailShareActionIsAccessibleAndPassesLoadedPost() {
        var sharedPostId: String? = null
        val repository = PostDetailRepository("https://api.nantty.com", { null }, SuccessfulThreadTransport())
        compose.setContent {
            MaterialTheme {
                PostDetailScreen(
                    "post-1",
                    { null },
                    Executor { it.run() },
                    onBack = {},
                    repository = repository,
                    onSharePost = { sharedPostId = it.id },
                )
            }
        }

        compose.onNodeWithContentDescription("Share post").assertIsDisplayed().performClick()
        compose.runOnIdle { org.junit.Assert.assertEquals("post-1", sharedPostId) }
    }

    @Test
    fun authenticatedViewerCanSelectBusinessIdentityForComment() {
        val session = AccountSession("access-current", "refresh-current", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = ProfileTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { session }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithContentDescription("Commenting as You. Choose profile").performClick()
        compose.onNodeWithContentDescription("Comment as Ari Studio, brand").performClick()
        compose.onNodeWithTag("post-reply-input").performTextInput("A brand reply")
        compose.onNodeWithTag("post-reply-input").performImeAction()

        compose.runOnIdle {
            val comment = transport.calls.single { it.path == "/api/v1/posts/post-1/comments" }
            org.junit.Assert.assertEquals("access-current", comment.accessToken)
            org.junit.Assert.assertEquals("brand-1", comment.body?.getString("asProfileId"))
            org.junit.Assert.assertFalse(comment.body?.has("parentCommentId") == true)
        }
    }

    @Test
    fun changingAccountClearsInMemoryProfileSelectionBeforeNextComment() {
        val activeSession = mutableStateOf(AccountSession("access-a", "refresh-a", AccountUser("u-a", "Ari", "ari", null, null, emptyList())))
        val transport = ProfileTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { activeSession.value }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { activeSession.value }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithContentDescription("Commenting as You. Choose profile").performClick()
        compose.onNodeWithContentDescription("Comment as Ari Studio, brand").performClick()
        compose.runOnIdle {
            activeSession.value = AccountSession("access-b", "refresh-b", AccountUser("u-b", "Bo", "bo", null, null, emptyList()))
        }
        compose.waitForIdle()
        compose.onNodeWithContentDescription("Commenting as You. Choose profile").assertIsDisplayed()
        compose.onNodeWithTag("post-reply-input").performTextInput("Personal reply")
        compose.onNodeWithContentDescription("Send reply").performClick()

        compose.runOnIdle {
            val comment = transport.calls.last { it.path == "/api/v1/posts/post-1/comments" }
            org.junit.Assert.assertEquals("access-b", comment.accessToken)
            org.junit.Assert.assertFalse(comment.body?.has("asProfileId") == true)
            org.junit.Assert.assertTrue(transport.calls.filter { it.path == "/api/v1/users/me/profiles" }.any { it.accessToken == "access-a" })
            org.junit.Assert.assertTrue(transport.calls.filter { it.path == "/api/v1/users/me/profiles" }.any { it.accessToken == "access-b" })
        }
    }

    @Test
    fun authenticatedViewerCanLikeAndRepostWithCurrentBearerSession() {
        val session = AccountSession("access-current", "refresh-current", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = SuccessfulThreadTransport()
        val repository = PostDetailRepository("https://api.nantty.com", { session }, transport)
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { session }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithContentDescription("Like post, 1").assertIsNotSelected().performClick()
        compose.onNodeWithContentDescription("Repost, 0").assertIsNotSelected().performClick()
        compose.onNodeWithContentDescription("Unlike post, 2").assertIsSelected()
        compose.onNodeWithContentDescription("Undo repost, 1").assertIsSelected()
        compose.runOnIdle {
            val like = transport.calls.single { it.path.endsWith("/like") }
            val repost = transport.calls.single { it.path.endsWith("/repost") }
            org.junit.Assert.assertEquals("POST", like.method)
            org.junit.Assert.assertEquals("access-current", like.accessToken)
            org.junit.Assert.assertEquals("POST", repost.method)
            org.junit.Assert.assertEquals("access-current", repost.accessToken)
            org.junit.Assert.assertEquals(0, repost.body?.length())
        }
    }

    @Test
    fun readyPostImagesOpenAtTappedImageNavigateAndBackReturnsToPost() {
        val repository = PostDetailRepository("https://api.nantty.com", { null }, ImagePostTransport())
        compose.setContent {
            MaterialTheme {
                PostDetailScreen("post-1", { null }, Executor { it.run() }, onBack = {}, repository = repository)
            }
        }

        compose.onNodeWithContentDescription("Open image 2 of 2 full screen").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Image 2 of 2").assertIsDisplayed()
        compose.onNodeWithContentDescription("Show previous image").performClick()
        compose.onNodeWithContentDescription("Image 1 of 2").assertIsDisplayed()
        compose.onNodeWithContentDescription("Show next image").performClick()
        compose.onNodeWithContentDescription("Image 2 of 2").assertIsDisplayed()

        Espresso.pressBack()

        compose.onNodeWithContentDescription("Image 2 of 2").assertDoesNotExist()
        compose.onNodeWithText("Actual post body").assertIsDisplayed()
    }

    private class SuccessfulThreadTransport : PostDetailTransport {
        data class Call(val method: String, val path: String, val accessToken: String?, val body: JSONObject?)
        val calls = mutableListOf<Call>()
        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject {
            calls += Call(method, path, accessToken, body)
            return when {
                path == "/api/v1/posts/post-1" -> postResponse()
                path.startsWith("/api/v1/posts/post-1/thread") -> threadResponse()
                method == "GET" && path == "/api/v1/users/me/profiles" -> JSONObject("""{"data":[]}""")
                method == "POST" && path == "/api/v1/posts/post-1/comments" -> JSONObject("{}")
                path.endsWith("/like") || path.endsWith("/repost") || path == "/api/v1/saves" -> JSONObject("{}")
                else -> error("Unexpected request $method $path")
            }
        }
    }

    private class PostLinkTrackingTransport : PostDetailTransport {
        data class Call(val method: String, val path: String, val accessToken: String?, val body: JSONObject?)
        val calls = mutableListOf<Call>()
        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject {
            calls += Call(method, path, accessToken, body)
            return when {
                path == "/api/v1/posts/post-1" -> JSONObject("""{"data":{"id":"post-1","text":"Read https://example.com/article","author":{"name":"Ari","username":"ari"},"media":[]}}""")
                path.startsWith("/api/v1/posts/post-1/thread") -> JSONObject("""{"data":[{"type":"comment","id":"comment-1","postId":"post-1","text":"Source https://reply.example/source","author":{"name":"Bea","username":"bea"},"inlineReplies":[]}],"nextCursor":null}""")
                path == "/api/v1/users/me/profiles" -> JSONObject("""{"data":[]}""")
                path == "/api/v1/feeds/interactions/batch" -> JSONObject("""{"accepted":1,"skipped":0}""")
                else -> error("Unexpected request $method $path")
            }
        }
    }

    private class FailedSaveTransport : PostDetailTransport {
        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject = when {
            path == "/api/v1/posts/post-1" -> postResponse()
            path.startsWith("/api/v1/posts/post-1/thread") -> threadResponse()
            path == "/api/v1/saves" -> error("Could not update your saved posts. Try again.")
            else -> error("Unexpected request $method $path")
        }
    }

    private class ProfileTransport : PostDetailTransport {
        data class Call(val method: String, val path: String, val accessToken: String?, val body: JSONObject?)
        val calls = mutableListOf<Call>()

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject {
            calls += Call(method, path, accessToken, body)
            return when {
                path == "/api/v1/posts/post-1" -> postResponse()
                path.startsWith("/api/v1/posts/post-1/thread") -> threadResponse()
                method == "GET" && path == "/api/v1/users/me/profiles" -> profileResponse(accessToken)
                method == "POST" && path == "/api/v1/posts/post-1/comments" -> JSONObject("{}")
                else -> error("Unexpected request $method $path")
            }
        }

        private fun profileResponse(token: String?) = if (token == "access-b") {
            JSONObject("""{"data":[{"id":"business-b","kind":"business","name":"Bo Business","handle":"bobusiness","onHold":false}]}""")
        } else {
            JSONObject("""{"data":[{"id":"brand-1","kind":"brand","name":"Ari Studio","handle":"aristudio","onHold":false}]}""")
        }
    }

    private class RetryTransport : PostDetailTransport {
        private var failedOnce = false
        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject {
            if (!failedOnce) {
                failedOnce = true
                error("Temporary connection failure")
            }
            return if (path == "/api/v1/posts/post-1") postResponse()
            else if (path.startsWith("/api/v1/posts/post-1/thread")) JSONObject("""{"data":[],"nextCursor":null}""")
            else error("Unexpected request $method $path")
        }
    }

    private class ImagePostTransport : PostDetailTransport {
        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject = when {
            path == "/api/v1/posts/post-1" -> JSONObject("""{"data":{"id":"post-1","text":"Actual post body","author":{"name":"Ari","username":"ari"},"media":[{"id":"one","type":"image","url":"https://cdn.nantty.com/one.jpg","status":"ready","width":1200,"height":800},{"id":"pending","type":"image","url":"https://cdn.nantty.com/pending.jpg","status":"processing"},{"id":"two","type":"image","url":"https://cdn.nantty.com/two.jpg","status":"ready","width":800,"height":1200}]}}""")
            path.startsWith("/api/v1/posts/post-1/thread") -> JSONObject("""{"data":[],"nextCursor":null}""")
            else -> error("Unexpected request $method $path")
        }
    }

    private class PagedThreadTransport(private val failSecondPageOnce: Boolean = false) : PostDetailTransport {
        val threadPaths = mutableListOf<String>()
        private var failedSecondPage = false

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject = when {
            path == "/api/v1/posts/post-1" -> postResponse()
            path.startsWith("/api/v1/posts/post-1/thread") -> {
                threadPaths += path
                if (path.contains("cursor=cursor-2") && failSecondPageOnce && !failedSecondPage) {
                    failedSecondPage = true
                    error("Temporary page failure")
                }
                if (path.contains("cursor=cursor-2")) secondPage() else firstPage()
            }
            else -> error("Unexpected request $method $path")
        }

        private fun firstPage() = JSONObject("""{"data":[{"type":"comment","id":"comment-1","text":"First root reply","author":{"name":"Bea","username":"bea"},"replyCount":1,"connector":{"depth":0},"inlineReplies":[{"type":"comment","id":"nested-1","text":"Nested first-page reply","author":{"name":"Cal","username":"cal"},"replyCount":0,"connector":{"depth":1},"inlineReplies":[]}]}],"nextCursor":"cursor-2"}""")
        private fun secondPage() = JSONObject("""{"data":[{"type":"comment","id":"comment-1","text":"First root reply","author":{"name":"Bea","username":"bea"},"replyCount":0,"connector":{"depth":0},"inlineReplies":[]},{"type":"comment","id":"comment-2","text":"Second root reply","author":{"name":"Dee","username":"dee"},"replyCount":0,"connector":{"depth":0},"inlineReplies":[]}],"nextCursor":"cursor-2"}""")
    }

    companion object {
        private fun postResponse() = JSONObject("""{"data":{"id":"post-1","text":"Actual post body","createdAt":"2026-11-02T10:00:00Z","author":{"name":"Ari","username":"ari"},"likes":1,"comments":2,"reposts":0,"liked":false,"reposted":false,"media":[]}}""")

        private fun threadResponse() = JSONObject("""{"data":[{"type":"comment","id":"comment-1","postId":"post-1","text":"Root API reply","author":{"name":"Bea","username":"bea"},"createdAt":"2026-11-02T10:01:00Z","likes":0,"replyCount":1,"connector":{"depth":0},"inlineReplies":[{"type":"comment","id":"comment-2","postId":"post-1","text":"Nested API reply","author":{"name":"Cal","username":"cal"},"createdAt":"2026-11-02T10:02:00Z","likes":0,"replyCount":0,"connector":{"depth":1},"inlineReplies":[]}]}],"nextCursor":null}""")
    }
}
