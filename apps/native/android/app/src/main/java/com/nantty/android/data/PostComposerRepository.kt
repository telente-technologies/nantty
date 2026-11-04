package com.nantty.android.data

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

enum class PostComposerAudience(val wireValue: String, val label: String) {
    EVERYONE("everyone", "Everyone"),
    FOLLOWERS("followers", "Followers"),
}

fun interface PostPublishTransport {
    fun publish(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject
}

class PostComposerRepository(
    private val baseUrl: String = com.nantty.android.BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: PostPublishTransport = JdkPostPublishTransport(baseUrl),
) {
    fun publishTextPost(
        text: String,
        idempotencyKey: String = UUID.randomUUID().toString(),
        audience: PostComposerAudience = PostComposerAudience.EVERYONE,
    ): Result<String> = runCatching {
        val session = sessionProvider() ?: error("Sign in to publish a post.")
        val cleanText = text.trim()
        require(cleanText.isNotEmpty() && cleanText.length <= MAX_POST_LENGTH) {
            "Posts must contain 1–$MAX_POST_LENGTH characters."
        }
        require(idempotencyKey.matches(Regex("^[A-Za-z0-9_-]{8,128}$"))) { "Could not safely prepare this post. Please try again." }
        val response = transport.publish(
            path = "/api/v1/posts",
            accessToken = session.accessToken,
            idempotencyKey = idempotencyKey,
            body = JSONObject().put("text", cleanText).put("mediaIds", org.json.JSONArray()).put("audience", audience.wireValue).put("kind", "post"),
        )
        val post = response.optJSONObject("data") ?: response
        post.optString("id").takeIf(String::isNotBlank) ?: error("Nantty published the post but returned no post ID. Refresh your feed to check its status.")
    }

    companion object {
        const val MAX_POST_LENGTH = 2_200
    }
}

private class JdkPostPublishTransport(private val baseUrl: String) : PostPublishTransport {
    override fun publish(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL before publishing.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Idempotency-Key", idempotencyKey)
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedBody).orEmpty()
            if (status !in 200..299) error("Post request failed (HTTP $status). Please try again.")
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBoundedBody(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    companion object { private const val MAX_RESPONSE_BYTES = 1_048_576 }
}
