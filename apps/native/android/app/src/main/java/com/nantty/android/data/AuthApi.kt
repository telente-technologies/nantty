package com.nantty.android.data

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

interface AuthSessionApi {
    fun login(identifier: String, password: String): AccountSession
    fun refresh(refreshToken: String): SessionTokens
    fun logout(accessToken: String)
}

class AuthApi(private val baseUrl: String) : AuthSessionApi {
    override fun login(identifier: String, password: String): AccountSession {
        require(identifier.isNotBlank() && password.isNotEmpty()) { "Enter your email or username and password." }
        val payload = request("POST", "/api/v1/auth/login", body = JSONObject().put("identifier", identifier.trim()).put("password", password))
        return parseAccountSession(payload.toMap()) ?: throw AuthApiException("Nantty returned an incomplete sign-in response.")
    }

    override fun refresh(refreshToken: String): SessionTokens {
        val payload = request("POST", "/api/v1/auth/refresh", body = JSONObject().put("refreshToken", refreshToken))
        val data = payload.optJSONObject("data") ?: payload
        val accessToken = data.optString("accessToken").takeIf(String::isNotBlank)
        val nextRefreshToken = data.optString("refreshToken").takeIf(String::isNotBlank)
        return SessionTokens(
            accessToken ?: throw AuthApiException("Nantty returned an incomplete session."),
            nextRefreshToken ?: throw AuthApiException("Nantty returned an incomplete session."),
        )
    }

    override fun logout(accessToken: String) {
        request("POST", "/api/v1/auth/logout", bearerToken = accessToken)
    }

    private fun request(method: String, path: String, body: JSONObject? = null, bearerToken: String? = null): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: throw AuthApiException("Configure an HTTPS Nantty API URL to sign in.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            bearerToken?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        try {
            body?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            if (status == HttpURLConnection.HTTP_NO_CONTENT) return JSONObject()
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readResponseBody).orEmpty()
            val json = runCatching { JSONObject(response) }.getOrNull()
            if (status !in 200..299) {
                val payload = json?.optJSONObject("data") ?: json
                val safeMessage = payload?.optString("message")?.takeIf { it.isNotBlank() && it != "null" }
                throw AuthApiException(safeMessage ?: "Sign-in request failed (HTTP $status). Please try again.", status)
            }
            return json ?: throw AuthApiException("Nantty returned an unreadable response.")
        } catch (error: AuthApiException) {
            throw error
        } catch (_: Exception) {
            throw AuthNetworkException("Could not connect to Nantty. Check your connection and try again.")
        } finally {
            connection.disconnect()
        }
    }

    private fun JSONObject.toMap(): Map<String, Any?> = keys().asSequence().associateWith { key ->
        when (val value = opt(key)) {
            JSONObject.NULL -> null
            is JSONObject -> value.toMap()
            is org.json.JSONArray -> (0 until value.length()).map { index ->
                when (val item = value.opt(index)) {
                    is JSONObject -> item.toMap()
                    JSONObject.NULL -> null
                    else -> item
                }
            }
            else -> value
        }
    }

    private fun readResponseBody(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            if (output.size() + read > MAX_RESPONSE_BYTES) throw AuthApiException("Nantty returned an unexpectedly large response.")
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    companion object {
        const val CONNECT_TIMEOUT_MS = 10_000
        const val READ_TIMEOUT_MS = 15_000
        private const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

class AuthApiException(message: String, val statusCode: Int? = null) : Exception(message)
class AuthNetworkException(message: String) : Exception(message)

fun trustedApiOrigin(raw: String): String? = runCatching {
    val uri = URI(raw.trim().trimEnd('/'))
    val scheme = uri.scheme?.lowercase()
    val host = uri.host?.lowercase()
    if (!uri.isAbsolute || host.isNullOrBlank() || uri.userInfo != null || uri.query != null || uri.fragment != null || uri.path !in listOf("", "/")) return@runCatching null
    if (scheme == "https" || (scheme == "http" && host in setOf("10.0.2.2", "localhost", "127.0.0.1"))) uri.toASCIIString().trimEnd('/') else null
}.getOrNull()
