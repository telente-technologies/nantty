package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class FollowRequester(val id: String, val name: String, val username: String, val avatarUrl: String?)
data class FollowRequest(val id: String, val requester: FollowRequester, val createdAt: String)
data class FollowRequestsPage(val requests: List<FollowRequest>, val nextCursor: String?)

sealed interface FollowRequestsResult {
    data class Success(val page: FollowRequestsPage) : FollowRequestsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : FollowRequestsResult
}

interface FollowRequestsTransport {
    fun request(method: String, path: String, accessToken: String): JSONObject
}

class FollowRequestsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val transport: FollowRequestsTransport = JdkFollowRequestsTransport(baseUrl),
    private val sessionProvider: () -> AccountSession? = { null },
) {
    fun load(cursor: String? = null): FollowRequestsResult = execute { session ->
        parsePage(transport.request("GET", buildFollowRequestsPath(cursor), session.accessToken))
    }

    fun settle(requestId: String, accept: Boolean): Result<Unit> = runCatching {
        require(isSafeId(requestId)) { "This follow request is invalid. Refresh and try again." }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to manage follow requests.")
        transport.request(
            "POST",
            "/api/v1/follow-requests/${encode(requestId)}/${if (accept) "accept" else "reject"}",
            session.accessToken,
        )
    }

    private inline fun execute(action: (AccountSession) -> FollowRequestsPage): FollowRequestsResult = try {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to view follow requests.")
        FollowRequestsResult.Success(action(session))
    } catch (error: Exception) {
        FollowRequestsResult.Failure(
            error.message ?: "Could not load follow requests. Check your connection and try again.",
            authenticationRequired = error is FollowRequestsHttpException && error.statusCode in setOf(401, 403),
        )
    }

    internal fun parsePage(payload: JSONObject): FollowRequestsPage {
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete follow-requests response.")
        val requests = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(::isSafeId) ?: continue
                val user = row.optJSONObject("requester") ?: continue
                val userId = user.optString("id").takeIf(::isSafeId) ?: continue
                val username = user.optString("username").takeIf(String::isNotBlank) ?: continue
                val name = user.optString("name").takeIf(String::isNotBlank) ?: username
                add(FollowRequest(id, FollowRequester(userId, name, username, safeMediaUrl(user.optString("avatarUrl").takeIf(String::isNotBlank))), row.optString("createdAt")))
            }
        }
        return FollowRequestsPage(requests, payload.optString("nextCursor").takeIf { it.isNotBlank() && it != "null" })
    }

    companion object {
        const val PAGE_SIZE = 20
    }
}

private const val MAX_RESPONSE_BYTES = 1_048_576

internal fun buildFollowRequestsPath(cursor: String? = null): String = buildString {
    append("/api/v1/users/me/follow-requests?limit=${FollowRequestsRepository.PAGE_SIZE}")
    cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${encode(it)}") }
}

private fun isSafeId(value: String): Boolean = value.length in 1..200 && value.all {
    it.isLetterOrDigit() || it == '_' || it == '-'
}

private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

private class JdkFollowRequestsTransport(private val baseUrl: String) : FollowRequestsTransport {
    override fun request(method: String, path: String, accessToken: String): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to manage follow requests." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage follow requests.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (method == "POST") {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            if (method == "POST") connection.outputStream.use { it.write("{}".toByteArray()) }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8_192)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large follow-requests response." }
                    output.write(buffer, 0, read)
                }
                output.toString(Charsets.UTF_8.name())
            }.orEmpty()
            if (status !in 200..299) throw FollowRequestsHttpException(status)
            return if (body.isBlank()) JSONObject() else JSONObject(body)
        } finally { connection.disconnect() }
    }

}

internal class FollowRequestsHttpException(val statusCode: Int) : Exception("Follow request failed (HTTP $statusCode). Please try again.")
