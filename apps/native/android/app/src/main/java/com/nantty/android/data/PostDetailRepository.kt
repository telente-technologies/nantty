package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

data class PostDetail(
    val id: String,
    val authorName: String,
    val username: String,
    val avatarUrl: String?,
    val text: String,
    val media: List<FeedMedia>,
    val createdAt: String,
    val likes: Int,
    val comments: Int,
    val reposts: Int,
    val liked: Boolean,
    val reposted: Boolean,
    val bookmarked: Boolean,
)

internal fun extractSafePostLinks(text: String): List<String> = Regex("https?://[^\\s<>]+", RegexOption.IGNORE_CASE)
    .findAll(text)
    .mapNotNull { match ->
        val candidate = match.value.trimEnd('.', ',', '!', '?', ';', ':', ')', ']', '}')
        if (candidate.length > 2048) return@mapNotNull null
        val parsed = runCatching { URI(candidate) }.getOrNull() ?: return@mapNotNull null
        candidate.takeIf {
            parsed.scheme.equals("https", ignoreCase = true)
                && !parsed.host.isNullOrBlank()
                && parsed.rawUserInfo == null
        }
    }
    .distinct()
    .toList()

data class ThreadComment(
    val id: String,
    val authorName: String,
    val username: String,
    val avatarUrl: String?,
    val text: String,
    val createdAt: String,
    val likes: Int,
    val replyCount: Int,
    val depth: Int,
    val media: List<FeedMedia>,
    val replies: List<ThreadComment>,
    val liked: Boolean = false,
)

internal fun updateThreadCommentLike(
    comments: List<ThreadComment>,
    commentId: String,
    liked: Boolean,
): List<ThreadComment> = comments.map { comment ->
    if (comment.id == commentId) {
        val change = if (comment.liked == liked) 0 else if (liked) 1 else -1
        comment.copy(liked = liked, likes = (comment.likes + change).coerceAtLeast(0))
    } else {
        comment.copy(replies = updateThreadCommentLike(comment.replies, commentId, liked))
    }
}

internal fun appendUniqueThreadComments(existing: List<ThreadComment>, incoming: List<ThreadComment>): List<ThreadComment> {
    val seen = existing.mapTo(mutableSetOf(), ThreadComment::id)
    return existing + incoming.filter { seen.add(it.id) }
}

internal fun isRepeatedThreadCursor(requested: String, returned: String?, previouslyUsed: Set<String>): Boolean =
    returned != null && (returned == requested || returned in previouslyUsed)

data class CommentActingProfile(
    val id: String,
    val kind: String,
    val name: String,
    val handle: String,
    val avatarUrl: String?,
)

sealed interface PostDetailResult {
    data class Success(val post: PostDetail, val comments: List<ThreadComment>, val nextCursor: String?) : PostDetailResult
    data class Failure(val message: String) : PostDetailResult
}

fun interface PostDetailTransport {
    fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject
}

class PostDetailRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: PostDetailTransport = JdkPostDetailTransport(baseUrl),
) {
    fun listCommentProfiles(expectedAccountId: String): Result<List<CommentActingProfile>> = runCatching {
        val session = sessionProvider() ?: error("Sign in to choose a profile for your comment.")
        require(session.user.id == expectedAccountId) { "Your account changed. Reload before commenting." }
        val root = transport.request("GET", "/api/v1/users/me/profiles", session.accessToken, null)
        val rows = root.optJSONArray("data") ?: error("Nantty returned an invalid profile list.")
        buildList {
            for (index in 0 until rows.length()) {
                val profile = rows.optJSONObject(index) ?: continue
                val kind = profile.optString("kind")
                if (kind !in COMMENT_PROFILE_KINDS) continue
                val holdValue = profile.opt("onHold")
                require(holdValue is Boolean) { "Nantty returned an invalid profile status." }
                if (holdValue) continue
                val id = profile.optString("id").takeIf(String::isNotBlank)
                    ?: error("Nantty returned an invalid profile.")
                val name = profile.optString("name").takeIf(String::isNotBlank)
                    ?: error("Nantty returned an invalid profile.")
                val handle = profile.optString("handle").takeIf(String::isNotBlank)
                    ?: error("Nantty returned an invalid profile.")
                add(CommentActingProfile(
                    id = id,
                    kind = kind,
                    name = name,
                    handle = handle,
                    avatarUrl = safeMediaUrl(profile.optNullableString("avatarUrl")),
                ))
            }
        }
    }

    fun load(postId: String, cursor: String? = null): PostDetailResult = try {
        val session = sessionProvider()
        val postRoot = transport.request("GET", "/api/v1/posts/${pathSegment(postId)}", session?.accessToken, null)
        val threadPath = buildString {
            append("/api/v1/posts/${pathSegment(postId)}/thread?sort=relevant")
            cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${queryValue(it)}") }
        }
        val threadRoot = transport.request("GET", threadPath, session?.accessToken, null)
        PostDetailResult.Success(parsePost(postRoot), parseThread(threadRoot), nextCursor(threadRoot))
    } catch (error: Exception) {
        PostDetailResult.Failure(error.message ?: "Could not load this post. Check your connection and try again.")
    }

    fun reply(
        postId: String,
        text: String,
        parentCommentId: String? = null,
        asProfileId: String? = null,
        expectedAccountId: String? = null,
    ): Result<Unit> = runCatching {
        val session = sessionProvider() ?: error("Sign in to reply to this post.")
        expectedAccountId?.let { require(session.user.id == it) { "Your account changed. Reload before commenting." } }
        val cleanText = text.trim()
        require(cleanText.isNotEmpty() && cleanText.length <= 1500) { "Replies must be between 1 and 1,500 characters." }
        val body = JSONObject().put("text", cleanText).apply {
            parentCommentId?.takeIf(String::isNotBlank)?.let { put("parentCommentId", it) }
            asProfileId?.takeIf(String::isNotBlank)?.let { put("asProfileId", it) }
        }
        transport.request("POST", "/api/v1/posts/${pathSegment(postId)}/comments", session.accessToken, body)
        Unit
    }

    fun setLiked(postId: String, liked: Boolean): Result<Unit> = authenticatedWrite(postId, if (liked) "POST" else "DELETE", "like")

    fun setCommentLiked(commentId: String, liked: Boolean, expectedAccountId: String): Result<Unit> = runCatching {
        require(commentId.isNotBlank()) { "A comment ID is required." }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to like comments.")
        require(session.user.id == expectedAccountId) { "Your account changed. Reload before liking comments." }
        val method = if (liked) "POST" else "DELETE"
        transport.request(method, "/api/v1/comments/${pathSegment(commentId)}/like", session.accessToken, null)
        Unit
    }

    fun setReposted(postId: String, reposted: Boolean): Result<Unit> = runCatching {
        val session = sessionProvider() ?: error("Sign in to repost.")
        val method = if (reposted) "POST" else "DELETE"
        val body = if (reposted) JSONObject() else null
        transport.request(method, "/api/v1/posts/${pathSegment(postId)}/repost", session.accessToken, body)
        Unit
    }

    fun setSaved(postId: String, saved: Boolean): Result<Unit> = runCatching {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() } ?: error("Sign in to save posts.")
        val path = if (saved) "/api/v1/saves" else "/api/v1/saves?type=post&targetId=${queryValue(postId)}"
        val body = if (saved) JSONObject().put("type", "post").put("targetId", postId) else null
        transport.request(if (saved) "POST" else "DELETE", path, session.accessToken, body)
        Unit
    }

    fun recordPostShare(postId: String): Result<Unit> = runCatching {
        require(postId.isNotBlank()) { "A post ID is required to record a share." }
        val accessToken = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
        transport.request("POST", "/api/v1/posts/${pathSegment(postId)}/share", accessToken, JSONObject())
        Unit
    }

    fun recordPostLinkClick(postId: String, expectedAccountId: String): Result<Unit> = runCatching {
        require(postId.isNotBlank()) { "A post ID is required to record a link click." }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to record link clicks.")
        require(session.user.id == expectedAccountId) { "Your account changed. Reload before opening this link." }
        val event = JSONObject()
            .put("postId", postId)
            .put("kind", "link_click")
            .put("surface", "post_detail")
        val body = JSONObject().put("events", JSONArray().put(event))
        transport.request("POST", "/api/v1/feeds/interactions/batch", session.accessToken, body)
        Unit
    }

    private fun authenticatedWrite(postId: String, method: String, action: String): Result<Unit> = runCatching {
        val session = sessionProvider() ?: error("Sign in to $action this post.")
        transport.request(method, "/api/v1/posts/${pathSegment(postId)}/$action", session.accessToken, null)
        Unit
    }

    internal fun parsePost(payload: JSONObject): PostDetail {
        val post = payload.optJSONObject("data") ?: payload
        val author = post.optJSONObject("author") ?: JSONObject()
        val rows = post.optJSONArray("media") ?: JSONArray()
        return PostDetail(
            id = post.optString("id"),
            authorName = author.optString("name", "Nantty member"),
            username = author.optString("username"),
            avatarUrl = safeMediaUrl(author.optNullableString("avatarUrl")),
            text = post.optString("text"),
            media = parseMedia(rows),
            createdAt = post.optString("createdAt"),
            likes = post.optInt("likes"),
            comments = post.optInt("comments"),
            reposts = post.optInt("reposts"),
            liked = post.optBoolean("liked"),
            reposted = post.optBoolean("reposted"),
            bookmarked = post.optBoolean("bookmarked", post.optBoolean("isSaved")),
        )
    }

    internal fun parseThread(payload: JSONObject): List<ThreadComment> {
        val page = payload.optJSONObject("data") ?: payload
        val rows = page.optJSONArray("data") ?: payload.optJSONArray("data") ?: JSONArray()
        return buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                // Quote entries are valid conversation rows but are not comments; this focused slice renders comments.
                if (item.optString("type", "comment") == "quote") continue
                add(parseComment(item))
            }
        }
    }

    internal fun nextCursor(payload: JSONObject): String? {
        val page = payload.optJSONObject("data") ?: payload
        return page.optNullableString("nextCursor")?.takeIf(String::isNotBlank)
    }

    private fun parseComment(item: JSONObject): ThreadComment {
        val author = item.optJSONObject("author") ?: JSONObject()
        val nested = item.optJSONArray("inlineReplies") ?: JSONArray()
        return ThreadComment(
            id = item.optString("id"),
            authorName = author.optString("name", "Nantty member"),
            username = author.optString("username"),
            avatarUrl = safeMediaUrl(author.optNullableString("avatarUrl")),
            text = item.optString("text"),
            createdAt = item.optString("createdAt"),
            likes = item.optInt("likes"),
            liked = item.optBoolean("liked"),
            replyCount = item.optInt("replyCount"),
            depth = item.optJSONObject("connector")?.optInt("depth") ?: item.optInt("depth"),
            media = parseMedia(item.optJSONArray("media") ?: JSONArray()) + parseVideoReplies(item.optJSONArray("videoReplies") ?: JSONArray()),
            replies = buildList {
                for (index in 0 until nested.length()) nested.optJSONObject(index)?.let { add(parseComment(it)) }
            },
        )
    }

    private fun parseMedia(rows: JSONArray): List<FeedMedia> = buildList {
        for (index in 0 until rows.length()) {
            val media = rows.optJSONObject(index) ?: continue
            if (media.optString("status", "ready") != "ready") continue
            val url = safeMediaUrl(media.optNullableString("url")) ?: continue
            add(FeedMedia(
                id = media.optString("id", "media-$index"),
                type = media.optString("type", "image"),
                url = url,
                posterUrl = safeMediaUrl(media.optNullableString("posterUrl")),
                width = media.optInt("width").takeIf { it > 0 },
                height = media.optInt("height").takeIf { it > 0 },
            ))
        }
    }

    private fun parseVideoReplies(rows: JSONArray): List<FeedMedia> = buildList {
        for (index in 0 until rows.length()) {
            val reply = rows.optJSONObject(index) ?: continue
            val thumbnail = safeMediaUrl(reply.optNullableString("thumbnailUrl")) ?: continue
            add(FeedMedia(
                id = reply.optString("clipId", "video-reply-$index"),
                type = "video",
                url = thumbnail,
                posterUrl = thumbnail,
                width = null,
                height = null,
            ))
        }
    }

    private fun pathSegment(value: String): String = queryValue(value)
    private fun queryValue(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
}

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private class JdkPostDetailTransport(private val baseUrl: String) : PostDetailTransport {
    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to load post details.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            body?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedBody).orEmpty()
            if (status !in 200..299) error("Post request failed (HTTP $status). Please try again.")
            if (status == HttpURLConnection.HTTP_NO_CONTENT || response.isBlank()) return JSONObject()
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBoundedBody(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    companion object { private const val MAX_RESPONSE_BYTES = 1_048_576 }
}

private val COMMENT_PROFILE_KINDS = setOf("business", "brand", "store")
