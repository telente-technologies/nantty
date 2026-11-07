package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import java.util.Locale

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
    val views: Int = 0,
    val quotedPost: FeedQuotedPost? = null,
    val quotedPostUnavailable: Boolean = false,
    val isQuote: Boolean = false,
    val isFollowingAuthor: Boolean = false,
    val viewerNotificationsMuted: Boolean = false,
    val products: List<FeedTaggedProduct> = emptyList(),
    val linkPreview: FeedLinkPreview? = null,
    val isSponsored: Boolean = false,
)

data class FeedLinkPreview(
    val url: String,
    val domain: String,
    val title: String,
    val description: String?,
    val imageUrl: String?,
    val siteName: String?,
)

data class FeedTaggedProduct(
    val id: String,
    val name: String,
    val amountMinor: Long,
    val currency: String,
    val imageUrl: String?,
    val stock: Int,
)

data class FeedQuotedPost(
    val id: String,
    val kind: String,
    val authorName: String,
    val username: String,
    val avatarUrl: String?,
    val verified: Boolean,
    val verificationColor: String?,
    val text: String,
    val thumbnailUrl: String?,
)

data class FeedTopic(val id: String, val name: String)

sealed interface FeedTopicsResult {
    data class Success(val topics: List<FeedTopic>) : FeedTopicsResult
    data class Failure(val message: String) : FeedTopicsResult
    data object AuthenticationRequired : FeedTopicsResult
}

enum class FeedFeedbackKind(val apiValue: String) {
    NOT_INTERESTED("not_interested"),
    HIDE("hide"),
}

sealed interface FeedFeedbackResult {
    data object Success : FeedFeedbackResult
    data object AuthenticationRequired : FeedFeedbackResult
    data class Failure(val message: String) : FeedFeedbackResult
}

sealed interface PostNotificationMuteResult {
    data class Success(val muted: Boolean) : PostNotificationMuteResult
    data object AuthenticationRequired : PostNotificationMuteResult
    data class Failure(val message: String) : PostNotificationMuteResult
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

    fun recordFeedback(postId: String, kind: FeedFeedbackKind, accessToken: String?): FeedFeedbackResult {
        if (accessToken.isNullOrBlank()) return FeedFeedbackResult.AuthenticationRequired
        if (!isSafeFeedPostId(postId)) return FeedFeedbackResult.Failure("This post is unavailable.")
        val origin = baseUrl.trim().trimEnd('/')
        val parsed = runCatching { URL(origin) }.getOrNull()
            ?: return FeedFeedbackResult.Failure("Feed feedback is unavailable: the configured API address is invalid.")
        if (parsed.protocol != "https" && !(parsed.protocol == "http" && parsed.host == "10.0.2.2")) {
            return FeedFeedbackResult.Failure("Feed feedback is unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2).")
        }
        return try {
            val connection = openConnection(URL("$origin/api/v1/feeds/feedback"))
            connection.apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Authorization", "Bearer $accessToken")
            }
            connection.useConnection {
                connection.outputStream.use { it.write(JSONObject().put("postId", postId).put("type", kind.apiValue).toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                if (status == HttpURLConnection.HTTP_UNAUTHORIZED) return@useConnection FeedFeedbackResult.AuthenticationRequired
                if (status !in 200..299) return@useConnection FeedFeedbackResult.Failure("Could not update your feed preferences. Please try again.")
                FeedFeedbackResult.Success
            }
        } catch (_: Exception) {
            FeedFeedbackResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    fun setPostNotificationsMuted(postId: String, muted: Boolean, accessToken: String?): PostNotificationMuteResult {
        if (accessToken.isNullOrBlank()) return PostNotificationMuteResult.AuthenticationRequired
        if (!isSafeFeedPostId(postId)) return PostNotificationMuteResult.Failure("This post is unavailable.")
        val origin = baseUrl.trim().trimEnd('/')
        val parsed = runCatching { URL(origin) }.getOrNull()
            ?: return PostNotificationMuteResult.Failure("Post notifications are unavailable: the configured API address is invalid.")
        if (parsed.protocol != "https" && !(parsed.protocol == "http" && parsed.host == "10.0.2.2")) {
            return PostNotificationMuteResult.Failure("Post notifications are unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2).")
        }
        return try {
            val method = if (muted) "PUT" else "DELETE"
            val connection = openConnection(URL("$origin/api/v1/posts/$postId/notifications-mute"))
            connection.apply {
                requestMethod = method
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $accessToken")
            }
            connection.useConnection {
                val status = connection.responseCode
                if (status == HttpURLConnection.HTTP_UNAUTHORIZED || status == HttpURLConnection.HTTP_FORBIDDEN) {
                    return@useConnection PostNotificationMuteResult.AuthenticationRequired
                }
                if (status !in 200..299) {
                    return@useConnection PostNotificationMuteResult.Failure("Could not update post notifications. Please try again.")
                }
                PostNotificationMuteResult.Success(muted)
            }
        } catch (_: Exception) {
            PostNotificationMuteResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

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
                val quotedPostPayload = item.optJSONObject("resharedFrom")
                val quotedPost = quotedPostPayload?.let(::parseQuotedPost)?.takeIf { it.id.isNotBlank() }
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
                    views = item.optInt("views").coerceAtLeast(0),
                    quotedPost = quotedPost,
                    quotedPostUnavailable = item.optBoolean("resharedFromUnavailable") || (quotedPostPayload != null && quotedPost == null),
                    isQuote = item.optBoolean("isQuote"),
                    isFollowingAuthor = item.optBoolean("isFollowingAuthor"),
                    viewerNotificationsMuted = item.optBoolean("viewerNotificationsMuted"),
                    products = item.optJSONArray("products")?.let { productRows ->
                        buildList {
                            for (productIndex in 0 until productRows.length()) {
                                val product = productRows.optJSONObject(productIndex) ?: continue
                                val id = product.optString("id").takeIf(String::isNotBlank) ?: continue
                                val name = product.optString("name").takeIf(String::isNotBlank) ?: continue
                                val price = product.optJSONObject("price") ?: continue
                                val currency = price.optString("currency").uppercase(Locale.ROOT).takeIf { it.length == 3 } ?: continue
                                add(FeedTaggedProduct(
                                    id = id,
                                    name = name,
                                    amountMinor = price.optLong("amountMinor").coerceAtLeast(0),
                                    currency = currency,
                                    imageUrl = safeMediaUrl(product.optString("imageUrl").takeUnless { it.isBlank() || it == "null" }),
                                    stock = product.optInt("stock").coerceAtLeast(0),
                                ))
                            }
                        }
                    }.orEmpty(),
                    linkPreview = parseFeedLinkPreview(item.optJSONObject("linkPreview")),
                    isSponsored = item.optJSONObject("sponsored") != null,
                ))
            }
        }
        FeedResult.Success(posts, root.optString("nextCursor").takeUnless { it == "" || it == "null" })
    }.getOrElse { FeedResult.Failure("Nantty returned a feed we could not read. Please try again later.") }
}

internal fun parseFeedLinkPreview(payload: JSONObject?): FeedLinkPreview? {
    payload ?: return null
    val url = payload.optString("url").trim()
    val parsedUrl = runCatching { URI(url) }.getOrNull() ?: return null
    if (!parsedUrl.scheme.equals("https", ignoreCase = true) || parsedUrl.host.isNullOrBlank() || parsedUrl.rawUserInfo != null || url.length > 2_048) return null
    val title = payload.optString("title").trim().takeIf(String::isNotEmpty) ?: return null
    val domain = payload.optString("domain").trim().ifEmpty { parsedUrl.host.orEmpty() }
    return FeedLinkPreview(
        url = parsedUrl.toASCIIString(),
        domain = domain,
        title = title,
        description = payload.optNullableString("description")?.trim()?.takeIf(String::isNotEmpty),
        imageUrl = safeMediaUrl(payload.optNullableString("imageUrl")),
        siteName = payload.optNullableString("siteName")?.trim()?.takeIf(String::isNotEmpty),
    )
}

private fun parseQuotedPost(payload: JSONObject): FeedQuotedPost {
    val author = payload.optJSONObject("author") ?: JSONObject()
    val verification = author.optJSONObject("verification")
    val verificationColor = verification?.optString("color")?.takeIf {
        verification.optBoolean("badgeVisible") && verification.optString("status") == "active" && it in setOf("blue", "gold", "black")
    }
    val firstReadyMedia = payload.optJSONArray("media")?.let { media ->
        (0 until media.length()).asSequence()
            .mapNotNull(media::optJSONObject)
            .firstOrNull { it.optString("status") == "ready" }
    }
    val rawThumbnail = firstReadyMedia?.let { media ->
        if (media.optString("type") == "video") media.optString("posterUrl").takeIf(String::isNotBlank)
            ?: media.optString("url") else media.optString("url")
    }
    return FeedQuotedPost(
        id = payload.optString("id"),
        kind = payload.optString("kind", "post"),
        authorName = author.optString("name", "Nantty member"),
        username = author.optString("username"),
        avatarUrl = safeMediaUrl(author.optString("avatarUrl").takeUnless { it.isBlank() || it == "null" }),
        verified = verificationColor != null || (verification == null && author.optBoolean("verified")),
        verificationColor = verificationColor,
        text = payload.optString("text"),
        thumbnailUrl = safeMediaUrl(rawThumbnail),
    )
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

private fun isSafeFeedPostId(value: String): Boolean = value.length in 1..200 && value.all {
    it.isLetterOrDigit() || it == '_' || it == '-'
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

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeUnless { it.isBlank() || it == "null" }

private inline fun <T> HttpURLConnection.useConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
