package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class StoryTrayEntry(
    val userId: String,
    val name: String,
    val username: String,
    val avatarUrl: String?,
    val hasUnseen: Boolean,
)

data class StoryItem(
    val id: String,
    val authorId: String,
    val authorName: String,
    val username: String,
    val avatarUrl: String?,
    val media: FeedMedia,
    val createdAt: String,
    val seen: Boolean,
    val sound: StorySoundSummary?,
    val look: String?,
)

data class StorySoundSummary(val id: String, val title: String, val ownerUsername: String?)
data class StoryAnalytics(
    val impressions: Int,
    val uniqueViewers: Int,
    val comments: Int,
    val shares: Int,
    val profileVisits: Int,
    val newFollows: Int,
    val postedAt: String,
)
data class StoryViewerSummary(val id: String, val name: String, val username: String, val avatarUrl: String?)
data class StoryViewersPage(val viewers: List<StoryViewerSummary>, val total: Int, val nextCursor: String?)
data class StoryRingStatus(val hasActiveStory: Boolean, val hasUnseenStory: Boolean)

sealed interface StoryTrayResult {
    data class Success(val entries: List<StoryTrayEntry>) : StoryTrayResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StoryTrayResult
}

sealed interface StoryFeedResult {
    data class Success(val stories: List<StoryItem>) : StoryFeedResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StoryFeedResult
}

sealed interface StorySeenResult {
    data object Success : StorySeenResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StorySeenResult
}
sealed interface StoryRingStatusResult {
    data class Success(val status: StoryRingStatus) : StoryRingStatusResult
    data class Failure(val message: String) : StoryRingStatusResult
}
sealed interface StoryAnalyticsResult {
    data class Success(val analytics: StoryAnalytics) : StoryAnalyticsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StoryAnalyticsResult
}
sealed interface StoryViewersResult {
    data class Success(val page: StoryViewersPage) : StoryViewersResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StoryViewersResult
}
sealed interface StoryDeleteResult {
    data object Success : StoryDeleteResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StoryDeleteResult
}
sealed interface StoryPublishResult {
    data class Success(val storyId: String) : StoryPublishResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StoryPublishResult
}

interface StoriesTransport {
    fun get(path: String, accessToken: String?): JSONObject
    fun post(path: String, accessToken: String): JSONObject
    fun post(path: String, accessToken: String, body: JSONObject): JSONObject =
        error("Story publishing is not supported by this transport.")
    fun delete(path: String, accessToken: String, idempotencyKey: String): JSONObject =
        error("Story deletion is not supported by this transport.")
}

/** Android client for the existing Social stories contract; authorization and visibility stay server-owned. */
class StoriesRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession? = { null },
    private val transport: StoriesTransport = JdkStoriesTransport(baseUrl),
) {
    fun currentAccessToken(): String? = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)

    fun publishStory(mediaId: String, soundId: String? = null, look: String? = null): StoryPublishResult {
        if (!isUuid(mediaId) || (soundId != null && !isUuid(soundId)) || (look != null && look !in STORY_LOOKS)) {
            return StoryPublishResult.Failure("This story could not be prepared. Choose valid media and try again.")
        }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return StoryPublishResult.Failure("Sign in to publish a story.", authenticationRequired = true)
        return try {
            val body = JSONObject().put("mediaId", mediaId).apply {
                soundId?.let { put("soundId", it) }
                look?.let { put("look", it) }
            }
            val response = transport.post(PUBLISH_STORY_PATH, session.accessToken, body).storyData()
            val storyId = response.optString("id").takeIf(::isUuid)
                ?: error("Nantty returned an invalid story after publishing.")
            StoryPublishResult.Success(storyId)
        } catch (error: StoriesHttpException) {
            StoryPublishResult.Failure(error.message ?: "Could not publish this story. Please try again.", error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN)
        } catch (error: Exception) {
            StoryPublishResult.Failure(error.message ?: "Could not publish this story. Check your connection and try again.")
        }
    }

    fun loadTray(): StoryTrayResult {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return StoryTrayResult.Failure("Sign in to view stories from people you follow.", authenticationRequired = true)
        return try {
            val payload = transport.get(STORY_TRAY_PATH, token)
            StoryTrayResult.Success(parseTray(payload))
        } catch (error: StoriesHttpException) {
            StoryTrayResult.Failure(error.message ?: "Could not load stories. Please try again.", error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN)
        } catch (error: Exception) {
            StoryTrayResult.Failure(error.message ?: "Could not load stories. Check your connection and try again.")
        }
    }

    fun loadUserStories(userId: String): StoryFeedResult {
        if (!isSafeStoryId(userId)) return StoryFeedResult.Failure("This story link is invalid.")
        return try {
            val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            StoryFeedResult.Success(parseStories(transport.get(buildUserStoriesPath(userId), token)))
        } catch (error: StoriesHttpException) {
            StoryFeedResult.Failure(error.message ?: "Could not load stories. Please try again.", error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN)
        } catch (error: Exception) {
            StoryFeedResult.Failure(error.message ?: "Could not load stories. Check your connection and try again.")
        }
    }

    /** Reads the server-filtered profile ring state; privacy and block rules remain server-owned. */
    fun loadStoryRingStatus(userId: String): StoryRingStatusResult {
        if (!isSafeStoryId(userId)) return StoryRingStatusResult.Failure("This profile link is invalid.")
        return try {
            val payload = transport.get(buildStoryRingStatusPath(userId), sessionProvider()?.accessToken)
            val status = payload.storyData()
            val hasActive = status.opt("hasActiveStory") as? Boolean ?: error("Nantty returned an invalid story status.")
            val hasUnseen = status.opt("hasUnseenStory") as? Boolean ?: error("Nantty returned an invalid story status.")
            StoryRingStatusResult.Success(StoryRingStatus(hasActive, hasUnseen && hasActive))
        } catch (error: StoriesHttpException) {
            StoryRingStatusResult.Failure(error.message ?: "Could not check this profile's stories.")
        } catch (error: Exception) {
            StoryRingStatusResult.Failure(error.message ?: "Could not check this profile's stories.")
        }
    }

    fun markSeen(storyId: String): StorySeenResult {
        if (!isSafeStoryId(storyId)) return StorySeenResult.Failure("This story link is invalid.")
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return StorySeenResult.Failure("Sign in to update story views.", authenticationRequired = true)
        return try {
            transport.post(buildMarkSeenPath(storyId), token)
            StorySeenResult.Success
        } catch (error: StoriesHttpException) {
            StorySeenResult.Failure(error.message ?: "Could not update this story.", error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN)
        } catch (error: Exception) {
            StorySeenResult.Failure(error.message ?: "Could not update this story. Check your connection and try again.")
        }
    }

    fun canOpenOwnerAnalytics(story: StoryItem): Boolean =
        sessionProvider()?.user?.id?.let { it == story.authorId } == true

    /** Deletes only the signed-in account's own story through the existing posts endpoint. */
    fun deleteOwnStory(storyId: String, idempotencyKey: String = java.util.UUID.randomUUID().toString()): StoryDeleteResult {
        if (!isSafeStoryId(storyId)) return StoryDeleteResult.Failure("This story link is invalid.")
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return StoryDeleteResult.Failure("Sign in to delete this story.", authenticationRequired = true)
        if (!idempotencyKey.matches(Regex("^[A-Za-z0-9_-]{8,128}$"))) {
            return StoryDeleteResult.Failure("Could not safely prepare this request. Please try again.")
        }
        return try {
            transport.delete(buildDeleteStoryPath(storyId), session.accessToken, idempotencyKey)
            StoryDeleteResult.Success
        } catch (error: StoriesHttpException) {
            if (error.statusCode == HttpURLConnection.HTTP_NOT_FOUND || error.statusCode == 410) StoryDeleteResult.Success
            else StoryDeleteResult.Failure(error.message ?: "Could not delete this story. Please try again.", error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN)
        } catch (error: Exception) {
            StoryDeleteResult.Failure(error.message ?: "Could not delete this story. Check your connection and try again.")
        }
    }

    fun loadAnalytics(storyId: String): StoryAnalyticsResult {
        if (!isSafeStoryId(storyId)) return StoryAnalyticsResult.Failure("This story link is invalid.")
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return StoryAnalyticsResult.Failure("Sign in to view story analytics.", authenticationRequired = true)
        return try {
            val payload = transport.get(buildStoryAnalyticsPath(storyId), token).storyData()
            StoryAnalyticsResult.Success(
                StoryAnalytics(
                    impressions = payload.optInt("impressions").coerceAtLeast(0),
                    uniqueViewers = payload.optInt("uniqueViewers").coerceAtLeast(0),
                    comments = payload.optInt("comments").coerceAtLeast(0),
                    shares = payload.optInt("shares").coerceAtLeast(0),
                    profileVisits = payload.optInt("profileVisits").coerceAtLeast(0),
                    newFollows = payload.optInt("newFollows").coerceAtLeast(0),
                    postedAt = payload.optNullableString("postedAt").orEmpty(),
                ),
            )
        } catch (error: StoriesHttpException) {
            StoryAnalyticsResult.Failure(error.message ?: "Could not load story analytics. Please try again.", error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED)
        } catch (error: Exception) {
            StoryAnalyticsResult.Failure(error.message ?: "Could not load story analytics. Check your connection and try again.")
        }
    }

    fun loadViewers(storyId: String, cursor: String? = null): StoryViewersResult {
        if (!isSafeStoryId(storyId)) return StoryViewersResult.Failure("This story link is invalid.")
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return StoryViewersResult.Failure("Sign in to view story viewers.", authenticationRequired = true)
        return try {
            val payload = transport.get(buildStoryViewersPath(storyId, cursor), token).storyData()
            val rows = payload.optJSONArray("viewers") ?: JSONArray()
            val seenIds = mutableSetOf<String>()
            val viewers = buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    val id = row.optNullableString("id")?.takeIf(::isSafeStoryId) ?: continue
                    val name = row.optNullableString("name")?.takeIf(String::isNotBlank) ?: continue
                    if (!seenIds.add(id)) continue
                    add(StoryViewerSummary(id, name, row.optNullableString("username").orEmpty(), safeMediaUrl(row.optNullableString("avatarUrl"))))
                }
            }
            StoryViewersResult.Success(StoryViewersPage(viewers, payload.optInt("total").coerceAtLeast(0), payload.optNullableString("nextCursor")))
        } catch (error: StoriesHttpException) {
            StoryViewersResult.Failure(error.message ?: "Could not load story viewers. Please try again.", error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED)
        } catch (error: Exception) {
            StoryViewersResult.Failure(error.message ?: "Could not load story viewers. Check your connection and try again.")
        }
    }

    internal fun parseTray(payload: JSONObject): List<StoryTrayEntry> {
        val rows = payload.optJSONArray("data") ?: payload.optJSONObject("data")?.optJSONArray("data")
            ?: error("Nantty returned an incomplete story tray.")
        val seenIds = mutableSetOf<String>()
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val user = row.optJSONObject("user") ?: continue
                val id = user.optNullableString("id")?.takeIf(::isSafeStoryId) ?: continue
                val name = user.optNullableString("name")?.takeIf(String::isNotBlank) ?: continue
                if (!seenIds.add(id)) continue
                add(
                    StoryTrayEntry(
                        userId = id,
                        name = name,
                        username = user.optNullableString("username").orEmpty(),
                        avatarUrl = safeMediaUrl(user.optNullableString("avatarUrl")),
                        hasUnseen = row.optBoolean("hasUnseen"),
                    ),
                )
            }
        }
    }

    internal fun parseStories(payload: JSONObject): List<StoryItem> {
        val rows = payload.optJSONArray("data") ?: payload.optJSONObject("data")?.optJSONArray("data")
            ?: error("Nantty returned an incomplete story response.")
        val seenIds = mutableSetOf<String>()
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val author = row.optJSONObject("author") ?: continue
                val media = row.optJSONObject("media") ?: continue
                val id = row.optNullableString("id")?.takeIf(::isSafeStoryId) ?: continue
                val authorId = author.optNullableString("id")?.takeIf(::isSafeStoryId) ?: continue
                val url = safeMediaUrl(media.optNullableString("url")) ?: safeMediaUrl(media.optNullableString("hlsUrl")) ?: continue
                val type = media.optString("type").takeIf { it == "image" || it == "video" } ?: continue
                val authorName = author.optNullableString("name")?.takeIf(String::isNotBlank) ?: "Nantty member"
                if (!seenIds.add(id)) continue
                val sound = row.optJSONObject("sound")?.let { soundRow ->
                    val soundId = soundRow.optNullableString("id") ?: return@let null
                    val title = soundRow.optNullableString("title") ?: return@let null
                    StorySoundSummary(soundId, title, soundRow.optJSONObject("owner")?.optNullableString("username"))
                }
                add(
                    StoryItem(
                        id = id,
                        authorId = authorId,
                        authorName = authorName,
                        username = author.optNullableString("username").orEmpty(),
                        avatarUrl = safeMediaUrl(author.optNullableString("avatarUrl")),
                        media = FeedMedia(
                            id = media.optNullableString("id") ?: "story-media-$index",
                            type = type,
                            url = url,
                            posterUrl = safeMediaUrl(media.optNullableString("posterUrl")),
                            width = media.optInt("width").takeIf { it > 0 },
                            height = media.optInt("height").takeIf { it > 0 },
                        ),
                        createdAt = row.optNullableString("createdAt").orEmpty(),
                        seen = row.optBoolean("seen"),
                        sound = sound,
                        look = row.optNullableString("look")?.takeIf { it in STORY_LOOKS },
                    ),
                )
            }
        }
    }

    private companion object {
        const val STORY_TRAY_PATH = "/api/v1/stories/tray"
        const val PUBLISH_STORY_PATH = "/api/v1/stories"
        val STORY_LOOKS = setOf("warm", "cool", "rose", "aqua", "sunset")
    }
}

internal fun buildUserStoriesPath(userId: String): String = "/api/v1/users/${encodeStoryPathSegment(userId)}/stories"
internal fun buildStoryRingStatusPath(userId: String): String = "/api/v1/users/${encodeStoryPathSegment(userId)}/story-status"
internal fun buildMarkSeenPath(storyId: String): String = "/api/v1/stories/${encodeStoryPathSegment(storyId)}/seen"
internal fun buildStoryAnalyticsPath(storyId: String): String = "/api/v1/posts/${encodeStoryPathSegment(storyId)}/analytics"
internal fun buildDeleteStoryPath(storyId: String): String = "/api/v1/posts/${encodeStoryPathSegment(storyId)}"
internal fun buildStoryViewersPath(storyId: String, cursor: String?): String = buildString {
    append("/api/v1/stories/${encodeStoryPathSegment(storyId)}/viewers")
    cursor?.takeIf(String::isNotBlank)?.let { append("?cursor=${encodeStoryPathSegment(it)}") }
}
private fun JSONObject.storyData(): JSONObject = optJSONObject("data") ?: this
private fun encodeStoryPathSegment(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
private fun isSafeStoryId(value: String): Boolean = value.matches(Regex("^[A-Za-z0-9_-]{1,128}$"))
private fun isUuid(value: String): Boolean = runCatching { java.util.UUID.fromString(value).toString() == value.lowercase() }.getOrDefault(false)
private fun JSONObject.optNullableString(key: String): String? = optString(key).takeUnless { it.isBlank() || it == "null" }

private class JdkStoriesTransport(private val baseUrl: String) : StoriesTransport {
    override fun get(path: String, accessToken: String?): JSONObject = request(path, accessToken, "GET")
    override fun post(path: String, accessToken: String): JSONObject = request(path, accessToken, "POST")
    override fun post(path: String, accessToken: String, body: JSONObject): JSONObject = request(path, accessToken, "POST", body = body)
    override fun delete(path: String, accessToken: String, idempotencyKey: String): JSONObject =
        request(path, accessToken, "DELETE", idempotencyKey)

    private fun request(
        path: String,
        accessToken: String?,
        method: String,
        idempotencyKey: String? = null,
        body: JSONObject? = null,
    ): JSONObject {
        val storyAnalyticsPath = Regex("^/api/v1/posts/[^/]+/analytics$").matches(path)
        val storyDeletePath = method == "DELETE" && Regex("^/api/v1/posts/[^/]+$").matches(path)
        val publishStoryPath = method == "POST" && path == "/api/v1/stories" && body != null
        require(path.startsWith("/api/v1/stories/") || path == "/api/v1/stories/tray" || path.matches(Regex("^/api/v1/users/[^/]+/(stories|story-status)$")) || storyAnalyticsPath || storyDeletePath || publishStoryPath) { "Unsupported Stories request." }
        val origin = baseUrl.trim().trimEnd('/')
        val parsed = runCatching { URL(origin) }.getOrElse { error("Stories unavailable: the configured API address is invalid.") }
        require(origin.isNotBlank() && (parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2"))) {
            "Stories unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2)."
        }
        val connection = URL("$origin$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            idempotencyKey?.let { connection.setRequestProperty("Idempotency-Key", it) }
            body?.let { payload ->
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw StoriesHttpException(status, "Stories request failed (HTTP $status). Please try again.")
            return if (body.isBlank()) JSONObject() else JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }
}

private class StoriesHttpException(val statusCode: Int, message: String) : IllegalStateException(message)
