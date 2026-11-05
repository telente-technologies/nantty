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

data class ProfileConnection(
    val id: String,
    val name: String,
    val username: String,
    val avatarUrl: String?,
    val isFollowing: Boolean,
    val followState: String,
    val verified: Boolean,
    val followsYou: Boolean = false,
    val mutualConnections: Int = 0,
)

data class ProfileConnectionPage(val entries: List<ProfileConnection>, val nextCursor: String?)

sealed interface ProfileConnectionsResult {
    data class Success(val page: ProfileConnectionPage) : ProfileConnectionsResult
    data class Failure(val message: String, val isPrivate: Boolean = false) : ProfileConnectionsResult
}

internal class PublicProfileHttpException(val statusCode: Int) : IllegalStateException("Profile request failed (HTTP $statusCode). Please try again.")

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

sealed interface BlockActionResult {
    data object Success : BlockActionResult
    data class Failure(val message: String) : BlockActionResult
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

    fun setBlocked(userId: String, block: Boolean): BlockActionResult = try {
        require(isSafeProfileId(userId)) { "This profile link is invalid." }
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: error("Sign in to manage blocked accounts.")
        val path = "/api/v1/users/${pathSegment(userId)}/block"
        if (block) transport.post(path, token) else transport.delete(path, token)
        BlockActionResult.Success
    } catch (error: Exception) {
        BlockActionResult.Failure(error.message ?: "Could not update blocked accounts. Try again.")
    }

    fun viewerId(): String? = sessionProvider()?.user?.id

    fun loadPosts(
        userId: String,
        cursor: String? = null,
        visibility: String = PUBLIC_VISIBILITY,
    ): PublicProfilePostsResult = try {
        require(isSafeProfileId(userId)) { "This profile link is invalid." }
        require(cursor == null || cursor.length <= MAX_CURSOR_LENGTH) { "This post page cursor is invalid. Refresh the profile and try again." }
        require(visibility in POST_VISIBILITIES) { "This post visibility is not supported." }
        val path = buildString {
            append("/api/v1/users/${pathSegment(userId)}/posts?")
            cursor?.takeIf(String::isNotBlank)?.let { append("cursor=${queryValue(it)}&") }
            append("visibility=$visibility")
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

    fun loadConnections(userId: String, tab: String, query: String = "", cursor: String? = null): ProfileConnectionsResult = try {
        require(isSafeProfileId(userId)) { "This profile link is invalid." }
        require(tab in CONNECTION_TABS) { "This connection list is not supported." }
        require(query.length <= MAX_CONNECTION_QUERY_LENGTH) { "Search text is too long." }
        require(cursor == null || cursor.length <= MAX_CURSOR_LENGTH) { "This connection page cursor is invalid. Refresh and try again." }
        val path = buildString {
            when (tab) {
                "followers", "following" -> {
                    append("/api/v1/users/${pathSegment(userId)}/$tab?")
                    if (query.isNotBlank()) append("q=${queryValue(query.trim())}&")
                }
                "blocked" -> append("/api/v1/users/me/blocked?")
                else -> append("/api/v1/users/${pathSegment(userId)}/connections?tab=$tab&")
            }
            cursor?.takeIf(String::isNotBlank)?.let { append("cursor=${queryValue(it)}&") }
            append("limit=$CONNECTION_PAGE_SIZE")
        }
        val response = transport.get(path, sessionProvider()?.accessToken)
        val payload = response.optJSONObject("data")?.let { data ->
            if (data.has("data")) data else response
        } ?: response
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an invalid connections response.")
        val entries = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(::isSafeProfileId) ?: continue
                val username = row.optString("username").takeIf(String::isNotBlank) ?: continue
                val state = row.optString("followState").takeIf { it in FOLLOW_STATES }
                    ?: if (row.optBoolean("isFollowing")) "accepted" else "none"
                add(ProfileConnection(
                    id = id,
                    name = row.optString("name").takeIf(String::isNotBlank) ?: username,
                    username = username,
                    avatarUrl = safeMediaUrl(row.optNullableString("avatarUrl")),
                    isFollowing = row.optBoolean("isFollowing") || state == "accepted",
                    followState = state,
                    verified = row.optBoolean("verified"),
                    followsYou = row.optBoolean("followsYou"),
                    mutualConnections = row.optInt("mutualConnections").coerceAtLeast(0),
                ))
            }
        }
        ProfileConnectionsResult.Success(ProfileConnectionPage(
            entries = entries,
            nextCursor = payload.optString("nextCursor").takeUnless { it.isBlank() || it == "null" },
        ))
    } catch (error: Exception) {
        ProfileConnectionsResult.Failure(
            error.message ?: "Could not load this list. Check your connection and try again.",
            isPrivate = error is PublicProfileHttpException && error.statusCode == HttpURLConnection.HTTP_FORBIDDEN,
        )
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
        const val PUBLIC_VISIBILITY = "public"
        const val SUBSCRIBER_VISIBILITY = "subscribers"
        const val CONNECTION_PAGE_SIZE = 20
        const val MAX_CONNECTION_QUERY_LENGTH = 100
        private val POST_VISIBILITIES = setOf(PUBLIC_VISIBILITY, SUBSCRIBER_VISIBILITY)
        private val CONNECTION_TABS = setOf("followers", "following", "shopped", "suggested", "blocked")
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
            if (status !in 200..299) throw PublicProfileHttpException(status)
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
