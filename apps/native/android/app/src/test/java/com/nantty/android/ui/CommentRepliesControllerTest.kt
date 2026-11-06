package com.nantty.android.ui

import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PostDetailTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.ArrayDeque
import java.util.concurrent.Executor

class CommentRepliesControllerTest {
    @Test
    fun expandsAndPagesNestedRepliesWithoutDuplicates() {
        val transport = RepliesTransport().apply {
            responses += JSONObject("""{"data":[{"id":"reply-1","text":"First"}],"nextCursor":"page-2"}""")
            responses += JSONObject("""{"data":[{"id":"reply-1","text":"Duplicate"},{"id":"reply-2","text":"Second"}],"nextCursor":null}""")
        }
        val repository = PostDetailRepository("https://api.nantty.com", { null }, transport)
        val controller = CommentRepliesController(repository, Executor(Runnable::run))

        controller.expand("comment-1")
        assertTrue(controller.state("comment-1").expanded)
        assertTrue(controller.state("comment-1").loaded)
        assertEquals(listOf("reply-1"), controller.state("comment-1").comments.map { it.id })
        assertEquals("Show more replies", commentRepliesActionLabel(controller.state("comment-1"), 0))

        controller.loadMore("comment-1")

        assertEquals(listOf("reply-1", "reply-2"), controller.state("comment-1").comments.map { it.id })
        assertEquals(null, controller.state("comment-1").nextCursor)
        assertFalse(controller.state("comment-1").loadingMore)
        assertEquals(
            listOf(
                "/api/v1/comments/comment-1/thread",
                "/api/v1/comments/comment-1/thread?cursor=page-2",
            ),
            transport.paths,
        )
    }

    private class RepliesTransport : PostDetailTransport {
        val responses = ArrayDeque<JSONObject>()
        val paths = mutableListOf<String>()

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject {
            assertEquals("GET", method)
            paths += path
            return responses.removeFirst()
        }
    }
}
