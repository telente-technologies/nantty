package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class CurrentProfile(
    val accountId: String,
    val name: String,
    val username: String,
    val bio: String,
    val avatarUrl: String?,
    val bannerUrl: String?,
    val isPrivate: Boolean,
    val isVerified: Boolean,
    val isCreator: Boolean,
    val followers: Int,
    val following: Int,
    val posts: Int,
)

data class CurrentProfileUpdate(
    val name: String,
    val bio: String,
    val isPrivate: Boolean,
    val avatarMediaId: String? = null,
    val bannerMediaId: String? = null,
)

sealed interface CurrentProfileResult {
    data class Success(val profile: CurrentProfile) : CurrentProfileResult
    data class Failure(val message: String) : CurrentProfileResult
}

interface CurrentProfileTransport {
    fun getMe(accessToken: String): JSONObject
    fun patchMe(accessToken: String, fields: JSONObject): JSONObject
}

class CurrentProfileRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val transport: CurrentProfileTransport = JdkCurrentProfileTransport(baseUrl),
    private val sessionProvider: () -> AccountSession? = { null },
) {
    fun load(): CurrentProfileResult = executeWithSession { session ->
        parseAndVerify(transport.getMe(session.accessToken), session.user.id)
    }

    fun update(update: CurrentProfileUpdate): CurrentProfileResult = executeWithSession { session ->
        require(update.name.trim().isNotEmpty()) { "Add your name before saving your profile." }
        require(update.name.trim().length <= MAX_NAME_LENGTH) { "Your name can be at most $MAX_NAME_LENGTH characters." }
        require(update.bio.length <= MAX_BIO_LENGTH) { "Your bio can be at most $MAX_BIO_LENGTH characters." }
        val fields = JSONObject()
            .put("name", update.name.trim())
            .put("bio", update.bio.trim())
            .put("isPrivate", update.isPrivate)
        update.avatarMediaId?.let { fields.put("avatarMediaId", it) }
        update.bannerMediaId?.let { fields.put("bannerMediaId", it) }
        parseAndVerify(transport.patchMe(session.accessToken, fields), session.user.id)
    }

    private inline fun executeWithSession(action: (AccountSession) -> CurrentProfile): CurrentProfileResult = try {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to view your profile.")
        CurrentProfileResult.Success(action(session))
    } catch (error: Exception) {
        CurrentProfileResult.Failure(error.message ?: "Your profile could not be loaded. Check your connection and try again.")
    }

    internal fun parseAndVerify(payload: JSONObject, sessionAccountId: String): CurrentProfile {
        val user = payload.optJSONObject("data") ?: payload
        val accountId = user.optString("id").takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete profile.")
        require(accountId == sessionAccountId) { "Nantty returned a profile that does not match this signed-in account." }
        val username = user.optString("username").takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete profile.")
        return CurrentProfile(
            accountId = accountId,
            name = user.optString("name").takeIf(String::isNotBlank) ?: username,
            username = username,
            bio = user.optString("bio").take(MAX_BIO_LENGTH),
            avatarUrl = safeMediaUrl(user.optNullableString("avatarUrl")),
            bannerUrl = safeMediaUrl(user.optNullableString("bannerUrl")),
            isPrivate = user.optBoolean("isPrivate"),
            isVerified = user.optBoolean("verified"),
            isCreator = user.optBoolean("isCreator"),
            followers = user.optInt("followers").coerceAtLeast(0),
            following = user.optInt("following").coerceAtLeast(0),
            posts = user.optInt("posts").coerceAtLeast(0),
        )
    }

    companion object {
        const val MAX_NAME_LENGTH = 50
        const val MAX_BIO_LENGTH = 160
    }
}

private fun JSONObject.optNullableString(key: String): String? = optString(key)
    .takeIf { it.isNotBlank() && it != "null" }

private class JdkCurrentProfileTransport(
    private val baseUrl: String,
) : CurrentProfileTransport {
    override fun getMe(accessToken: String): JSONObject = request("GET", null, accessToken)

    override fun patchMe(accessToken: String, fields: JSONObject): JSONObject = request("PATCH", fields, accessToken)

    private fun request(method: String, fields: JSONObject?, accessToken: String): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to view your profile." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view your profile.")
        val connection = (URL("$origin/api/v1/users/me").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            fields?.let {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            fields?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) error("Profile request failed (HTTP $status). Please try again.")
            if (body.isBlank()) error("Nantty returned an empty profile response.")
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large profile response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}
