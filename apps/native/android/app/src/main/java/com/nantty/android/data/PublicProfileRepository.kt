package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class PublicProfile(
    val id: String,
    val name: String,
    val username: String,
    val avatarUrl: String?,
    val bannerUrl: String?,
    val bio: String,
    val followers: Int,
    val following: Int,
    val posts: Int,
    val isPrivate: Boolean,
    val canViewerSeePosts: Boolean,
    val followState: String,
    val isViewer: Boolean,
    val isSuspended: Boolean,
    val verificationColor: String?,
)

data class PublicProfilePosts(val posts: List<FeedPost>, val nextCursor: String?)

sealed interface PublicProfileResult {
    data class Success(val profile: PublicProfile) : PublicProfileResult
    data class Failure(val message: String) : PublicProfileResult
}

sealed interface PublicProfilePostsResult {
    data class Success(val page: PublicProfilePosts) : PublicProfilePostsResult
    data class Failure(val message: String) : PublicProfilePostsResult
}

sealed interface FollowActionResult {
    data class Success(val state: String) : FollowActionResult
    data class Failure(val message: String) : FollowActionResult
}

interface PublicProfileTransport {
    fun get(path: String, accessToken: String?): JSONObject
    fun post(path: String, accessToken: String): JSONObject
    fun delete(path: String, accessToken: String)
}

class PublicProfileRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val transport: PublicProfileTransport = JdkPublicProfileTransport(baseUrl),
    private val sessionProvider: () -> AccountSession? = { null },
) {
    fun loadProfile(userId: String): PublicProfileResult = try {
        require(isSafeProfileId(userId)) { "This profile link is invalid." }
        val accessToken = sessionProvider()?.accessToken
        val profile = parseProfile(transport.get("/api/v1/users/${pathSegment(userId)}", accessToken))
        val followState = accessToken?.let {
            runCatching {
                val response = transport.get("/api/v1/users/${pathSegment(userId)}/follow-status", it)
                val status = response.optJSONObject("data") ?: response
                status.optString("state").takeIf { state -> state in FOLLOW_STATES }
            }.getOrNull()
        } ?: "none"
        val isViewer = sessionProvider()?.user?.id == profile.id
        PublicProfileResult.Success(profile.copy(
            canViewerSeePosts = !profile.isPrivate || followState == "accepted" || isViewer,
            followState = followState,
            isViewer = isViewer,
        ))
    } catch (error: Exception) {
        PublicProfileResult.Failure(error.message ?: "Could not load this profile. Check your connection and try again.")
    }

    fun setFollow(userId: String, follow: Boolean): FollowActionResult = try {
        require(isSafeProfileId(userId)) { "This profile link is invalid." }
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: error("Sign in to follow accounts.")
        val path = "/api/v1/users/${pathSegment(userId)}/follow"
        val state = if (follow) {
            val response = transport.post(path, token)
            val payload = response.optJSONObject("data") ?: response
            payload.optString("state").takeIf { it in FOLLOW_STATES && it != "none" }
                ?: error("Nantty returned an invalid follow status.")
        } else {
            transport.delete(path, token)
            "none"
        }
        FollowActionResult.Success(state)
    } catch (error: Exception) {
        FollowActionResult.Failure(error.message ?: "Could not update follow status. Try again.")
    }

    fun viewerId(): String? = sessionProvider()?.user?.id

    fun loadPosts(userId: String, cursor: String? = null): PublicProfilePostsResult = try {
        require(isSafeProfileId(userId)) { "This profile link is invalid." }
        require(cursor == null || cursor.length <= MAX_CURSOR_LENGTH) { "This post page cursor is invalid. Refresh the profile and try again." }
        val path = buildString {
            append("/api/v1/users/${pathSegment(userId)}/posts?")
            cursor?.takeIf(String::isNotBlank)?.let { append("cursor=${queryValue(it)}&") }
            append("visibility=public")
        }
        val response = transport.get(path, sessionProvider()?.accessToken)
        val parsed = FeedRepository(baseUrl).parsePage(response.toString())
        when (parsed) {
            is FeedResult.Success -> PublicProfilePostsResult.Success(PublicProfilePosts(parsed.posts, parsed.nextCursor))
            is FeedResult.Failure -> PublicProfilePostsResult.Failure(parsed.message)
            FeedResult.AuthenticationRequired -> PublicProfilePostsResult.Failure("Public posts are unavailable right now.")
        }
    } catch (error: Exception) {
        PublicProfilePostsResult.Failure(error.message ?: "Could not load public posts. Check your connection and try again.")
    }

    internal fun parseProfile(payload: JSONObject): PublicProfile {
        val user = payload.optJSONObject("data") ?: payload
        val id = user.optString("id").takeIf(::isSafeProfileId) ?: error("Nantty returned an invalid profile.")
        val username = user.optString("username").takeIf(String::isNotBlank) ?: error("Nantty returned an incomplete profile.")
        val verification = user.optJSONObject("verification")
        val verificationColor = verification?.optString("color")?.takeIf {
            verification.optBoolean("badgeVisible") && verification.optString("status") == "active" && it in VERIFICATION_COLORS
        } ?: if (verification == null && user.optBoolean("verified")) "blue" else null
        return PublicProfile(
            id = id,
            name = user.optString("name").takeIf(String::isNotBlank) ?: username,
            username = username,
            avatarUrl = safeMediaUrl(user.optNullableString("avatarUrl")),
            bannerUrl = safeMediaUrl(user.optNullableString("bannerUrl")),
            bio = user.optString("bio").take(MAX_BIO_LENGTH),
            followers = user.optInt("followers").coerceAtLeast(0),
            following = user.optInt("following").coerceAtLeast(0),
            posts = user.optInt("posts").coerceAtLeast(0),
            isPrivate = user.optBoolean("isPrivate"),
            canViewerSeePosts = false,
            followState = if (user.optBoolean("isFollowing")) "accepted" else "none",
            isViewer = false,
            isSuspended = user.optJSONObject("account")?.optString("status") == "suspended",
            verificationColor = verificationColor,
        )
    }

    companion object {
        const val MAX_CURSOR_LENGTH = 300
        const val MAX_BIO_LENGTH = 500
        private val VERIFICATION_COLORS = setOf("blue", "gold", "black")
        private val FOLLOW_STATES = setOf("none", "requested", "accepted", "rejected", "blocked")
    }
}

private fun isSafeProfileId(value: String): Boolean = value.length in 1..200 && value.all {
    it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '_' || it == '-'
}

private fun pathSegment(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
private fun queryValue(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

internal class JdkPublicProfileTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : PublicProfileTransport {
    override fun get(path: String, accessToken: String?): JSONObject = request("GET", path, accessToken)

    override fun post(path: String, accessToken: String): JSONObject = request("POST", path, accessToken, "{}")

    override fun delete(path: String, accessToken: String) {
        request("DELETE", path, accessToken, allowEmptyResponse = true)
    }

    private fun request(method: String, path: String, accessToken: String?, body: String? = null, allowEmptyResponse: Boolean = false): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view profiles.")
        val connection = openConnection(URL(origin + path)).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            body?.let {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            accessToken?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) error("Profile request failed (HTTP $status). Please try again.")
            if (body.isBlank() && allowEmptyResponse) return JSONObject()
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
            require(output.size() + read <= 1_048_576) { "Nantty returned an unexpectedly large profile response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}
