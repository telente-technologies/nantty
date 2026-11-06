package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class LiveCommentAuthor(val id: String, val name: String, val username: String, val avatarUrl: String?)
data class LiveComment(val id: String, val liveId: String, val author: LiveCommentAuthor, val text: String, val kind: String, val createdAt: String, val pinned: Boolean)
data class LiveCommentsPage(val comments: List<LiveComment>, val nextCursor: String?)

sealed interface LiveCommentsResult<out T> {
    data class Success<T>(val value: T) : LiveCommentsResult<T>
    data class Failure(val message: String, val statusCode: Int? = null, val authenticationRequired: Boolean = false, val retryable: Boolean = false) : LiveCommentsResult<Nothing>
}

interface LiveCommentsTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject? = null): JSONObject
}

/** Authenticated data access for ordinary Live comments. */
class LiveCommentsRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: LiveCommentsTransport = JdkLiveCommentsTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun list(liveId: String, cursor: String? = null): LiveCommentsResult<LiveCommentsPage> {
        if (!SAFE_ID.matches(liveId) || (cursor != null && (cursor.length > 512 || cursor.any(Char::isISOControl)))) return invalid()
        val query = buildList {
            add("order=newest")
            cursor?.let { add("cursor=${URLEncoder.encode(it, Charsets.UTF_8.name())}") }
        }.joinToString("&", prefix = "?")
        return authenticated { token ->
            val payload = transport.request("GET", "$PATH/${liveId}/comments$query", token)
            val root = payload.optJSONObject("data") ?: payload
            val rows = root.optJSONArray("data") ?: error("Nantty returned an incomplete Live comments page.")
            val comments = buildList { for (index in 0 until rows.length()) rows.optJSONObject(index)?.let { add(parseComment(it)) } }
            LiveCommentsPage(comments.asReversed(), nullable(root, "nextCursor") ?: nullable(payload, "nextCursor"))
        }
    }

    fun create(liveId: String, text: String): LiveCommentsResult<LiveComment> {
        if (!SAFE_ID.matches(liveId)) return invalid()
        val normalized = text.trim()
        if (normalized.isEmpty()) return LiveCommentsResult.Failure("Write a comment first.")
        if (normalized.codePointCount(0, normalized.length) > MAX_COMMENT_LENGTH) {
            return LiveCommentsResult.Failure("Comments can be at most $MAX_COMMENT_LENGTH characters.")
        }
        return authenticated { token -> parseComment(transport.request("POST", "$PATH/${liveId}/comments", token, JSONObject().put("text", normalized))) }
    }

    private fun <T> authenticated(block: (String) -> T): LiveCommentsResult<T> {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return LiveCommentsResult.Failure("Sign in to continue to Live comments.", 401, authenticationRequired = true)
        return try { LiveCommentsResult.Success(block(token)) }
        catch (error: LiveCommentsHttpException) {
            if (error.statusCode == 401) {
                val fresh = runCatching { refreshSessionProvider()?.accessToken }.getOrNull()?.takeIf(String::isNotBlank)
                    ?: return LiveCommentsResult.Failure("Your session has expired. Sign in again to continue.", 401, authenticationRequired = true)
                try { LiveCommentsResult.Success(block(fresh)) } catch (retry: LiveCommentsHttpException) { failure(retry) }
                catch (_: Exception) { LiveCommentsResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true) }
            } else failure(error)
        } catch (_: Exception) { LiveCommentsResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true) }
    }

    private fun <T> failure(error: LiveCommentsHttpException): LiveCommentsResult<T> = LiveCommentsResult.Failure(
        "Nantty couldn’t complete this Live comment request. Please try again.", error.statusCode,
        authenticationRequired = error.statusCode == 401,
        retryable = error.statusCode == 408 || error.statusCode == 429 || error.statusCode >= 500,
    )

    private fun invalid() = LiveCommentsResult.Failure("This live link or comments cursor is invalid.")

    private fun parseComment(row: JSONObject): LiveComment {
        val author = row.optJSONObject("author") ?: error("Nantty returned an incomplete Live comment.")
        return LiveComment(
            row.required("id"), row.required("liveId"),
            LiveCommentAuthor(author.required("id"), author.optString("name"), author.optString("username"), nullable(author, "avatarUrl")),
            row.required("text"), row.required("kind"), row.required("createdAt"), row.optBoolean("pinned"),
        )
    }

    private companion object {
        const val PATH = "/api/v1/lives"
        const val MAX_COMMENT_LENGTH = 200
        val SAFE_ID = Regex("^[A-Za-z0-9_-]{1,80}$")
        fun nullable(row: JSONObject, key: String) = row.optString(key).takeIf { it.isNotBlank() && it != "null" }
        fun JSONObject.required(key: String) = optString(key).takeIf(String::isNotBlank) ?: error("Nantty returned an incomplete Live comment.")
    }
}

private class JdkLiveCommentsTransport(baseUrl: String) : LiveCommentsTransport {
    private val origin = baseUrl.trim().trimEnd('/')
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        require(method == "GET" || method == "POST")
        val parsed = URL(origin)
        require(parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2"))
        val connection = URL(origin + path).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 10_000
        connection.readTimeout = 15_000
        connection.instanceFollowRedirects = false
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Authorization", "Bearer $accessToken")
        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        }
        try {
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw LiveCommentsHttpException(status)
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally { connection.disconnect() }
    }
}

class LiveCommentsHttpException(val statusCode: Int) : Exception("Live comments request failed: HTTP $statusCode")
