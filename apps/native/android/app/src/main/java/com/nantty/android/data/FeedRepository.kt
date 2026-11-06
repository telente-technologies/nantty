package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder

data class FeedPost(
    val id: String,
    val authorName: String,
    val username: String,
    val avatarUrl: String?,
    val verified: Boolean,
    val verificationColor: String?,
    val postedAsName: String?,
    val postedAsHandle: String?,
    val postedAsAvatarUrl: String?,
    val kind: String,
    val text: String,
    val media: List<FeedMedia>,
    val likes: Int,
    val comments: Int,
    val reposts: Int,
    val shares: Int,
    val createdAt: String,
    val liked: Boolean = false,
    val reposted: Boolean = false,
    val authorId: String = "",
    val bookmarked: Boolean = false,
    val postedAsId: String? = null,
)

data class FeedTopic(val id: String, val name: String)

sealed interface FeedTopicsResult {
    data class Success(val topics: List<FeedTopic>) : FeedTopicsResult
    data class Failure(val message: String) : FeedTopicsResult
    data object AuthenticationRequired : FeedTopicsResult
}

data class FeedMedia(
    val id: String,
    val type: String,
    val url: String,
    val posterUrl: String?,
    val width: Int?,
    val height: Int?,
)

sealed interface FeedResult {
    data class Success(val posts: List<FeedPost>, val nextCursor: String?) : FeedResult
    data class Failure(val message: String) : FeedResult
    data object AuthenticationRequired : FeedResult
}

enum class FeedType(val title: String) {
    FOR_YOU("For You"),
    FOLLOWING("Following"),
}

class FeedRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) {
    fun loadForYou(accessToken: String? = null, cursor: String? = null, topicId: String? = null): FeedResult =
        load(FeedType.FOR_YOU, accessToken, cursor, topicId)

    fun loadFollowing(accessToken: String?, cursor: String? = null): FeedResult = load(FeedType.FOLLOWING, accessToken, cursor)

    fun load(feedType: FeedType, accessToken: String? = null, cursor: String? = null, topicId: String? = null): FeedResult {
        if (feedType == FeedType.FOLLOWING && accessToken.isNullOrBlank()) return FeedResult.AuthenticationRequired
        val origin = baseUrl.trim().trimEnd('/')
        if (origin.isBlank()) return FeedResult.Failure("Feed unavailable: configure NANTTY_API_BASE_URL to connect to Nantty.")
        val parsed = runCatching { URL(origin) }.getOrElse {
            return FeedResult.Failure("Feed unavailable: the configured API address is invalid.")
        }
        if (parsed.protocol != "https" && !(parsed.protocol == "http" && parsed.host == "10.0.2.2")) {
            return FeedResult.Failure("Feed unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2).")
        }

        return try {
            val connection = openConnection(buildFeedUrl(origin, feedType, cursor, topicId))
            connection.apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
                accessToken?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
            }
            connection.useConnection {
                val status = connection.responseCode
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (feedType == FeedType.FOLLOWING && status == HttpURLConnection.HTTP_UNAUTHORIZED) return@useConnection FeedResult.AuthenticationRequired
                if (status !in 200..299) return@useConnection FeedResult.Failure("Feed request failed (HTTP $status). Please try again later.")
                parsePage(body)
            }
        } catch (_: Exception) {
            FeedResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    fun loadFollowedTopics(accessToken: String?): FeedTopicsResult {
        if (accessToken.isNullOrBlank()) return FeedTopicsResult.AuthenticationRequired
        val origin = baseUrl.trim().trimEnd('/')
        if (origin.isBlank()) return FeedTopicsResult.Failure("Topics unavailable: configure NANTTY_API_BASE_URL to connect to Nantty.")
        val parsed = runCatching { URL(origin) }.getOrElse {
            return FeedTopicsResult.Failure("Topics unavailable: the configured API address is invalid.")
        }
        if (parsed.protocol != "https" && !(parsed.protocol == "http" && parsed.host == "10.0.2.2")) {
            return FeedTopicsResult.Failure("Topics unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2).")
        }

        return try {
            val connection = openConnection(URL("${origin}/api/v1/users/me/topics"))
            connection.apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $accessToken")
            }
            connection.useConnection {
                val status = connection.responseCode
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (status == HttpURLConnection.HTTP_UNAUTHORIZED) return@useConnection FeedTopicsResult.AuthenticationRequired
                if (status !in 200..299) return@useConnection FeedTopicsResult.Failure("Topics request failed (HTTP $status). Please try again later.")
                parseTopics(body)
            }
        } catch (_: Exception) {
            FeedTopicsResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    internal fun parseTopics(body: String): FeedTopicsResult = runCatching {
        val root = JSONObject(body)
        val rows = root.optJSONArray("data") ?: JSONArray()
        val seenIds = mutableSetOf<String>()
        val topics = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id").trim()
                val name = item.optString("name").trim()
                if (id.isNotEmpty() && name.isNotEmpty() && seenIds.add(id)) add(FeedTopic(id, name))
            }
        }
        FeedTopicsResult.Success(topics)
    }.getOrElse { FeedTopicsResult.Failure("Nantty returned topics we could not read. Please try again later.") }

    internal fun parsePage(body: String): FeedResult = runCatching {
        val root = JSONObject(body)
        val rows = root.optJSONArray("data") ?: JSONArray()
        val posts = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val author = item.optJSONObject("author") ?: JSONObject()
                val verification = author.optJSONObject("verification")
                val verificationColor = verification?.optString("color")?.takeIf {
                    verification.optBoolean("badgeVisible") && verification.optString("status") == "active" && it in setOf("blue", "gold", "black")
                }
                add(FeedPost(
                    id = item.optString("id"),
                    authorName = author.optString("name", "Nantty member"),
                    username = author.optString("username", ""),
                    avatarUrl = safeMediaUrl(author.optString("avatarUrl").takeUnless { it.isBlank() || it == "null" }),
                    verified = verificationColor != null || (verification == null && author.optBoolean("verified")),
                    verificationColor = verificationColor,
                    postedAsName = item.optJSONObject("postedAs")?.optString("name")?.takeUnless { it.isBlank() || it == "null" },
                    postedAsHandle = item.optJSONObject("postedAs")?.optString("handle")?.takeUnless { it.isBlank() || it == "null" },
                    postedAsAvatarUrl = safeMediaUrl(item.optJSONObject("postedAs")?.optString("avatarUrl")?.takeUnless { it.isBlank() || it == "null" }),
                    kind = item.optString("kind", "post"),
                    text = item.optString("text", ""),
                    media = item.optJSONArray("media")?.let { mediaRows ->
                        buildList {
                            for (mediaIndex in 0 until mediaRows.length()) {
                                val media = mediaRows.optJSONObject(mediaIndex) ?: continue
                                if (media.optString("status") != "ready") continue
                                val url = safeMediaUrl(media.optString("url").takeUnless { it.isBlank() || it == "null" }) ?: continue
                                add(FeedMedia(
                                    id = media.optString("id", "media-$mediaIndex"),
                                    type = media.optString("type", "image"),
                                    url = url,
                                    posterUrl = safeMediaUrl(media.optString("posterUrl").takeUnless { it.isBlank() || it == "null" }),
                                    width = media.optInt("width").takeIf { it > 0 },
                                    height = media.optInt("height").takeIf { it > 0 },
                                ))
                            }
                        }
                    }.orEmpty(),
                    likes = item.optInt("likes"),
                    comments = item.optInt("comments"),
                    reposts = item.optInt("reposts"),
                    shares = item.optInt("shares"),
                    createdAt = item.optString("createdAt", ""),
                    liked = item.optBoolean("liked"),
                    reposted = item.optBoolean("reposted"),
                    authorId = author.optString("id"),
                    bookmarked = item.optBoolean("bookmarked", item.optBoolean("isSaved")),
                    postedAsId = item.optJSONObject("postedAs")?.optString("id")?.takeIf { it.isNotBlank() && it != "null" },
                ))
            }
        }
        FeedResult.Success(posts, root.optString("nextCursor").takeUnless { it == "" || it == "null" })
    }.getOrElse { FeedResult.Failure("Nantty returned a feed we could not read. Please try again later.") }
}

internal fun buildForYouUrl(origin: String, cursor: String?, topicId: String? = null): URL {
    return buildFeedUrl(origin, FeedType.FOR_YOU, cursor, topicId)
}

internal fun buildFollowingUrl(origin: String, cursor: String?): URL {
    return buildFeedUrl(origin, FeedType.FOLLOWING, cursor)
}

internal fun buildFeedUrl(origin: String, feedType: FeedType, cursor: String?, topicId: String? = null): URL {
    val encodedTopic = topicId?.takeIf(String::isNotBlank)?.let {
        "&topicId=${URLEncoder.encode(it, "UTF-8")}"
    }.orEmpty()
    val encodedCursor = cursor?.takeIf(String::isNotBlank)?.let {
        "&cursor=${URLEncoder.encode(it, "UTF-8")}"
    }.orEmpty()
    val route = when (feedType) {
        FeedType.FOR_YOU -> "for-you"
        FeedType.FOLLOWING -> "following"
    }
    val topicParameter = if (feedType == FeedType.FOR_YOU) encodedTopic else ""
    return URL("${origin.trimEnd('/')}/api/v1/feeds/$route?limit=10$encodedCursor$topicParameter")
}

internal fun appendUniqueFeedPosts(current: List<FeedPost>, incoming: List<FeedPost>): List<FeedPost> {
    val seenIds = current.mapTo(mutableSetOf(), FeedPost::id)
    return current + incoming.filter { seenIds.add(it.id) }
}

internal fun safeMediaUrl(raw: String?): String? = raw?.let { value ->
    runCatching {
        val uri = URI(value.trim())
        val scheme = uri.scheme?.lowercase()
        val host = uri.host?.lowercase()
        if (!uri.isAbsolute || uri.userInfo != null || host.isNullOrBlank()) return@runCatching null
        if (scheme == "https" || (scheme == "http" && host == "10.0.2.2")) uri.toASCIIString() else null
    }.getOrNull()
}

private inline fun <T> HttpURLConnection.useConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
