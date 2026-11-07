package com.nantty.android.data

import com.nantty.android.BuildConfig
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

data class ContentPreferences(
    val showSensitiveWithoutWarning: Boolean,
    val canChangeSensitiveContentSetting: Boolean,
    val ageBracket: ContentAgeBracket,
)

enum class ContentAgeBracket { ADULT, MINOR, UNKNOWN }

sealed interface ContentPreferencesResult {
    data class Success(val preferences: ContentPreferences) : ContentPreferencesResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ContentPreferencesResult
}

fun interface ContentPreferencesTransport {
    fun request(method: String, accessToken: String, body: JSONObject?): JSONObject
}

class ContentPreferencesRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: ContentPreferencesTransport = JdkContentPreferencesTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun load(): ContentPreferencesResult = execute { token ->
        parse(withRefresh(token) { transport.request("GET", it, null) })
    }

    fun update(showSensitiveWithoutWarning: Boolean): ContentPreferencesResult = execute { token ->
        parse(withRefresh(token) {
            transport.request("PUT", it, JSONObject().put("showSensitiveWithoutWarning", showSensitiveWithoutWarning))
        })
    }

    private inline fun execute(action: (String) -> ContentPreferences): ContentPreferencesResult = try {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw ContentPreferencesHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to manage content preferences.")
        ContentPreferencesResult.Success(action(token))
    } catch (error: Exception) {
        ContentPreferencesResult.Failure(
            error.message ?: "Could not load content preferences. Try again.",
            error is ContentPreferencesHttpException && error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED,
        )
    }

    private inline fun <T> withRefresh(token: String, request: (String) -> T): T = try {
        request(token)
    } catch (error: ContentPreferencesHttpException) {
        if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
        val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw ContentPreferencesHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
        request(refreshed)
    }

    private fun parse(payload: JSONObject): ContentPreferences {
        val row = payload.optJSONObject("data") ?: payload
        require(row.has("showSensitiveWithoutWarning") && row.has("canChangeSensitiveContentSetting")) {
            "Nantty returned incomplete content preferences."
        }
        val ageBracket = when (row.optString("ageBracket")) {
            "adult" -> ContentAgeBracket.ADULT
            "minor" -> ContentAgeBracket.MINOR
            "unknown" -> ContentAgeBracket.UNKNOWN
            else -> error("Nantty returned an unsupported content preference age bracket.")
        }
        val canChange = row.getBoolean("canChangeSensitiveContentSetting")
        val showWithoutWarning = row.getBoolean("showSensitiveWithoutWarning")
        require(canChange == (ageBracket == ContentAgeBracket.ADULT)) {
            "Nantty returned inconsistent content preference eligibility."
        }
        require(canChange || !showWithoutWarning) {
            "Nantty returned an unsafe sensitive-content preference."
        }
        return ContentPreferences(showWithoutWarning, canChange, ageBracket)
    }

    private companion object {
        const val PATH = "/api/v1/me/content-preferences"
    }
}

private class JdkContentPreferencesTransport(private val baseUrl: String) : ContentPreferencesTransport {
    override fun request(method: String, accessToken: String, body: JSONObject?): JSONObject {
        require(method == "GET" || method == "PUT")
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage content preferences.")
        val connection = (URL(origin + CONTENT_PREFERENCES_PATH).openConnection() as HttpURLConnection).apply {
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
            body?.let { data -> connection.outputStream.use { it.write(data.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.use(::readBounded).orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(response).optString("message").takeIf(String::isNotBlank) }.getOrNull()
                    ?: "Content preference request failed (HTTP $status). Try again."
                throw ContentPreferencesHttpException(status, message)
            }
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large content preferences response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val CONTENT_PREFERENCES_PATH = "/api/v1/me/content-preferences"
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

class ContentPreferencesHttpException(val statusCode: Int, message: String) : IllegalStateException(message)
