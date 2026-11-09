package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

enum class MentionAudience(val wireValue: String) {
    EVERYONE("everyone"),
    FOLLOWING("following"),
    NO_ONE("no_one"),
}

sealed interface MentionPrivacyResult {
    data class Success(val audience: MentionAudience) : MentionPrivacyResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : MentionPrivacyResult
}

fun interface MentionPrivacyTransport {
    fun request(method: String, accessToken: String, body: JSONObject?): JSONObject
}

class MentionPrivacyRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: MentionPrivacyTransport = JdkMentionPrivacyTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun load(): MentionPrivacyResult = execute { token -> parse(withRefresh(token) { transport.request("GET", it, null) }) }

    fun update(audience: MentionAudience): MentionPrivacyResult = execute { token ->
        parse(withRefresh(token) {
            transport.request("PUT", it, JSONObject().put("whoCanMentionMe", audience.wireValue))
        })
    }

    private inline fun execute(action: (String) -> MentionAudience): MentionPrivacyResult = try {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw MentionPrivacyHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to manage mention privacy.")
        MentionPrivacyResult.Success(action(token))
    } catch (error: Exception) {
        MentionPrivacyResult.Failure(
            error.message ?: "Could not update mention privacy. Try again.",
            authenticationRequired = error is MentionPrivacyHttpException && error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED,
        )
    }

    private inline fun <T> withRefresh(token: String, request: (String) -> T): T = try {
        request(token)
    } catch (error: MentionPrivacyHttpException) {
        if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
        val refreshedToken = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw MentionPrivacyHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
        request(refreshedToken)
    }

    private fun parse(payload: JSONObject): MentionAudience {
        val row = payload.optJSONObject("data") ?: payload
        val wireValue = row.optString("whoCanMentionMe")
        return MentionAudience.entries.firstOrNull { it.wireValue == wireValue }
            ?: error("Nantty returned an unsupported mention privacy setting.")
    }
}

class MentionPrivacyHttpException(val statusCode: Int, message: String) : IllegalStateException(message)

private class JdkMentionPrivacyTransport(private val baseUrl: String) : MentionPrivacyTransport {
    override fun request(method: String, accessToken: String, body: JSONObject?): JSONObject {
        require(method == "GET" || method == "PUT")
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage mention privacy.")
        val connection = (URL(origin + MENTION_PRIVACY_PATH).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedMentionPrivacyResponse).orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(response).optString("message").takeIf(String::isNotBlank) }.getOrNull()
                    ?: "Mention privacy request failed (HTTP $status). Try again."
                throw MentionPrivacyHttpException(status, message)
            }
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }
}

private fun readBoundedMentionPrivacyResponse(input: java.io.InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        require(output.size() + count <= 1_048_576) { "Nantty returned an unexpectedly large mention privacy response." }
        output.write(buffer, 0, count)
    }
    return output.toString(Charsets.UTF_8.name())
}

private const val MENTION_PRIVACY_PATH = "/api/v1/users/me/mention-privacy"
