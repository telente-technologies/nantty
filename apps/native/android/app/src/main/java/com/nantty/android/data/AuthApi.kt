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

interface AuthFlowApi {
    fun signInWithGoogle(idToken: String, nonce: String, birthday: String? = null): AccountSession
    fun sendOtp(destination: String, purpose: String): Int
    fun verifyOtp(destination: String, code: String, purpose: String): String
    fun register(email: String, birthday: String, password: String, username: String?, otpToken: String): AccountSession
    fun usernameSuggestion(seed: String): String
    fun usernameAvailability(username: String): UsernameAvailability
    fun topics(accessToken: String): List<AuthTopic>
    fun saveTopics(accessToken: String, topicIds: List<String>)
    fun resetPassword(otpToken: String, password: String)
}

data class UsernameAvailability(val available: Boolean, val reason: String?, val message: String?, val suggestions: List<String>)
data class AuthTopic(val id: String, val name: String)

class AuthApi(private val baseUrl: String) : AuthSessionApi, AuthFlowApi {
    override fun signInWithGoogle(idToken: String, nonce: String, birthday: String?): AccountSession {
        require(idToken.length in 20..4096 && nonce.length in 16..256) { "Google returned an invalid sign-in response." }
        val body = JSONObject().put("idToken", idToken).put("nonce", nonce)
        birthday?.takeIf(String::isNotBlank)?.let { body.put("birthday", it) }
        val payload = request("POST", "/api/v1/auth/google", body = body)
        return parseAccountSession(payload.toMap()) ?: throw AuthApiException("Nantty returned an incomplete sign-in response.")
    }

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

    override fun sendOtp(destination: String, purpose: String): Int {
        require(destination.isNotBlank() && purpose in AUTH_OTP_PURPOSES) { "Enter a valid email address." }
        val payload = request("POST", "/api/v1/auth/otp/send", body = JSONObject().put("destination", destination.trim()).put("purpose", purpose))
        val data = payload.optJSONObject("data") ?: payload
        return data.optInt("expiresIn").coerceAtLeast(0)
    }

    override fun verifyOtp(destination: String, code: String, purpose: String): String {
        require(destination.isNotBlank() && AuthValidation.isValidOtp(code) && purpose in AUTH_OTP_PURPOSES) {
            "Enter the 6-digit code we sent you."
        }
        val payload = request("POST", "/api/v1/auth/otp/verify", body = JSONObject().put("destination", destination.trim()).put("code", code).put("purpose", purpose))
        val data = payload.optJSONObject("data") ?: payload
        return data.optString("otpToken").takeIf { it.isNotBlank() && it != "null" }
            ?: throw AuthApiException("Nantty returned an incomplete verification response.")
    }

    override fun register(email: String, birthday: String, password: String, username: String?, otpToken: String): AccountSession {
        require(email.isNotBlank() && birthday.isNotBlank() && password.isNotEmpty() && otpToken.isNotBlank()) {
            "Complete each step before creating your account."
        }
        val body = JSONObject()
            .put("email", email.trim())
            .put("birthday", birthday)
            .put("password", password)
            .put("otpToken", otpToken)
        username?.trim()?.takeIf(String::isNotEmpty)?.let { body.put("username", it) }
        val payload = request("POST", "/api/v1/auth/register", body = body)
        return parseAccountSession(payload.toMap()) ?: throw AuthApiException("Nantty returned an incomplete registration response.")
    }

    override fun usernameAvailability(username: String): UsernameAvailability {
        require(username.isNotBlank()) { "Enter a username." }
        val payload = request("GET", "/api/v1/auth/username-available", query = mapOf("username" to username.trim()))
        val data = payload.optJSONObject("data") ?: payload
        val suggestions = data.optJSONArray("suggestions")?.let { values ->
            (0 until values.length()).mapNotNull { index -> values.optString(index).takeIf(String::isNotBlank) }
        }.orEmpty()
        return UsernameAvailability(
            available = data.optBoolean("available"),
            reason = data.optString("reason").takeIf { it.isNotBlank() && it != "null" },
            message = data.optString("message").takeIf { it.isNotBlank() && it != "null" },
            suggestions = suggestions,
        )
    }

    override fun usernameSuggestion(seed: String): String {
        require(seed.isNotBlank()) { "Enter a name or email to suggest a username." }
        val payload = request("GET", "/api/v1/auth/username-suggestion", query = mapOf("seed" to seed.trim()))
        val data = payload.optJSONObject("data") ?: payload
        return data.optString("username").takeIf { it.isNotBlank() && it != "null" }
            ?: throw AuthApiException("Nantty couldn't suggest a username. Enter one to continue.")
    }

    override fun topics(accessToken: String): List<AuthTopic> {
        require(accessToken.isNotBlank()) { "Sign in to load your topics." }
        val payload = request("GET", "/api/v1/topics", bearerToken = accessToken)
        val items = payload.optJSONArray("data")
            ?: payload.optJSONObject("data")?.optJSONArray("items")
            ?: payload.optJSONArray("items")
            ?: return emptyList()
        return (0 until items.length()).mapNotNull { index ->
            val item = items.optJSONObject(index) ?: return@mapNotNull null
            val id = item.optString("id").takeIf(String::isNotBlank) ?: return@mapNotNull null
            val name = item.optString("name").takeIf(String::isNotBlank) ?: return@mapNotNull null
            AuthTopic(id, name)
        }
    }

    override fun saveTopics(accessToken: String, topicIds: List<String>) {
        request("PUT", "/api/v1/users/me/topics", body = JSONObject().put("topicIds", org.json.JSONArray(topicIds.distinct())), bearerToken = accessToken)
    }

    override fun resetPassword(otpToken: String, password: String) {
        require(otpToken.isNotBlank() && password.isNotEmpty()) { "Enter a new password." }
        request("POST", "/api/v1/auth/password/reset", body = JSONObject().put("otpToken", otpToken).put("password", password))
    }

    private fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        bearerToken: String? = null,
        query: Map<String, String> = emptyMap(),
    ): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: throw AuthApiException("Configure an HTTPS Nantty API URL to sign in.")
        val queryString = query.entries.joinToString("&") { (key, value) ->
            "${java.net.URLEncoder.encode(key, Charsets.UTF_8.name())}=${java.net.URLEncoder.encode(value, Charsets.UTF_8.name())}"
        }
        val requestUrl = origin + path + queryString.takeIf(String::isNotEmpty)?.let { "?$it" }.orEmpty()
        val connection = (URL(requestUrl).openConnection() as HttpURLConnection).apply {
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
                val code = payload?.optString("code")?.takeIf { it.isNotBlank() && it != "null" }
                throw AuthApiException(safeMessage ?: "Sign-in request failed (HTTP $status). Please try again.", status, code)
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
        private val AUTH_OTP_PURPOSES = setOf("signup", "reset", "login")
        const val CONNECT_TIMEOUT_MS = 10_000
        const val READ_TIMEOUT_MS = 15_000
        private const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

class AuthApiException(message: String, val statusCode: Int? = null, val code: String? = null) : Exception(message)
class AuthNetworkException(message: String) : Exception(message)

fun trustedApiOrigin(raw: String): String? = runCatching {
    val uri = URI(raw.trim().trimEnd('/'))
    val scheme = uri.scheme?.lowercase()
    val host = uri.host?.lowercase()
    if (!uri.isAbsolute || host.isNullOrBlank() || uri.userInfo != null || uri.query != null || uri.fragment != null || uri.path !in listOf("", "/")) return@runCatching null
    if (scheme == "https" || (scheme == "http" && host in setOf("10.0.2.2", "localhost", "127.0.0.1"))) uri.toASCIIString().trimEnd('/') else null
}.getOrNull()
