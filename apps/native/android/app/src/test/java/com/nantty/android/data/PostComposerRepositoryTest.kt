package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PostComposerRepositoryTest {
    @Test
    fun publishUsesAuthenticatedPostContractAndStableIdempotencyKey() {
        val session = AccountSession("access-secret", "refresh-secret", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport(JSONObject("""{"data":{"id":"post-1"}}"""))
        val repository = PostComposerRepository("https://api.nantty.com", { session }, transport)

        val result = repository.publishTextPost("  Hello from Nantty  ", "retry-key-0001")

        assertTrue(result.isSuccess)
        assertEquals("post-1", result.getOrThrow())
        val call = transport.call!!
        assertEquals("/api/v1/posts", call.path)
        assertEquals("access-secret", call.accessToken)
        assertEquals("retry-key-0001", call.idempotencyKey)
        assertEquals("Hello from Nantty", call.body.getString("text"))
        assertEquals("everyone", call.body.getString("audience"))
        assertEquals("post", call.body.getString("kind"))
        assertEquals(0, call.body.getJSONArray("mediaIds").length())
    }

    @Test
    fun publishingRequiresSessionAndValidNonemptyTextWithinBackendLimit() {
        val transport = RecordingTransport(JSONObject("""{"id":"post-1"}"""))
        val signedOut = PostComposerRepository("https://api.nantty.com", { null }, transport)
        assertTrue(signedOut.publishTextPost("Hello world").exceptionOrNull()?.message.orEmpty().contains("Sign in"))
        assertFalse(transport.called)

        val session = AccountSession("a", "r", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val repository = PostComposerRepository("https://api.nantty.com", { session }, transport)
        assertTrue(repository.publishTextPost("  ").isFailure)
        assertTrue(repository.publishTextPost("x".repeat(PostComposerRepository.MAX_POST_LENGTH + 1)).isFailure)
        assertFalse(transport.called)
    }

    @Test
    fun invalidIdempotencyKeyIsRejectedBeforeTransport() {
        val session = AccountSession("a", "r", AccountUser("u1", "Ari", "ari", null, null, emptyList()))
        val transport = RecordingTransport(JSONObject("""{"id":"post-1"}"""))
        val result = PostComposerRepository("https://api.nantty.com", { session }, transport).publishTextPost("Hello", "bad key")

        assertTrue(result.isFailure)
        assertFalse(transport.called)
    }

    private class RecordingTransport(private val response: JSONObject) : PostPublishTransport {
        data class Call(val path: String, val accessToken: String, val idempotencyKey: String, val body: JSONObject)
        var called = false
        var call: Call? = null

        override fun publish(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
            called = true
            call = Call(path, accessToken, idempotencyKey, body)
            return response
        }
    }
}
