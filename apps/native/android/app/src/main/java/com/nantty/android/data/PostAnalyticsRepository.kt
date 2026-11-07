package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class PostAnalyticsDaily(val day: String, val impressions: Int)
data class PostVideoAnalytics(
    val views: Int,
    val watchTimeSeconds: Int,
    val averageWatchSeconds: Double?,
    val completedViews: Int?,
    val completionRate: Double?,
)
data class PostAnalyticsAudience(val label: String, val share: Int)
data class PostAnalytics(
    val postId: String,
    val kind: String,
    val hasLink: Boolean,
    val authorName: String,
    val postedAt: String,
    val impressions: Int,
    val uniqueViewers: Int,
    val reach: Int,
    val likes: Int,
    val comments: Int,
    val reposts: Int,
    val shares: Int,
    val saves: Int,
    val profileVisits: Int,
    val linkClicks: Int,
    val newFollows: Int,
    val engagements: Int,
    val engagementRate: Double,
    val video: PostVideoAnalytics?,
    val audience: List<PostAnalyticsAudience>,
    val daily: List<PostAnalyticsDaily>,
)

sealed interface PostAnalyticsResult {
    data class Success(val analytics: PostAnalytics) : PostAnalyticsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : PostAnalyticsResult
}

fun interface PostAnalyticsTransport {
    fun get(path: String, accessToken: String): JSONObject
}

class PostAnalyticsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession? = { null },
    private val transport: PostAnalyticsTransport = JdkPostAnalyticsTransport(baseUrl),
) {
    fun load(postId: String): PostAnalyticsResult {
        if (!isSafeAnalyticsId(postId)) return PostAnalyticsResult.Failure("This post link is invalid.")
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return PostAnalyticsResult.Failure("Sign in to view post analytics.", authenticationRequired = true)
        return try {
            val root = transport.get(buildPostAnalyticsPath(postId), token)
            val payload = root.optJSONObject("data") ?: root
            PostAnalyticsResult.Success(parsePostAnalytics(payload, postId))
        } catch (error: PostAnalyticsHttpException) {
            when (error.statusCode) {
                HttpURLConnection.HTTP_UNAUTHORIZED -> PostAnalyticsResult.Failure("Sign in to view post analytics.", authenticationRequired = true)
                HttpURLConnection.HTTP_FORBIDDEN -> PostAnalyticsResult.Failure("These analytics are private. Only the author can see them.")
                HttpURLConnection.HTTP_NOT_FOUND -> PostAnalyticsResult.Failure("This post isn't available. It may have been deleted.")
                else -> PostAnalyticsResult.Failure("Could not load post analytics. Check your connection and try again.")
            }
        } catch (error: Exception) {
            PostAnalyticsResult.Failure(error.message ?: "Could not load post analytics. Check your connection and try again.")
        }
    }
}

internal fun parsePostAnalytics(payload: JSONObject, expectedPostId: String): PostAnalytics {
    val id = payload.optString("postId").takeIf(String::isNotBlank)
        ?: error("Nantty returned incomplete analytics for this post.")
    require(id == expectedPostId) { "Nantty returned analytics for a different post." }
    val kind = payload.optString("kind", "post").takeIf { it in setOf("post", "clip", "story") }
        ?: error("Nantty returned an unsupported analytics type.")
    val author = payload.optJSONObject("author") ?: JSONObject()
    val daily = payload.optJSONArray("daily") ?: JSONArray()
    val audience = payload.optJSONArray("audience") ?: JSONArray()
    val videoPayload = payload.optJSONObject("video")
    return PostAnalytics(
        postId = id,
        kind = kind,
        hasLink = payload.optBoolean("hasLink"),
        authorName = author.optString("name"),
        postedAt = payload.optString("postedAt"),
        impressions = payload.nonNegativeInt("impressions"),
        uniqueViewers = payload.nonNegativeInt("uniqueViewers"),
        reach = payload.nonNegativeInt("reach").takeIf { payload.has("reach") } ?: payload.nonNegativeInt("uniqueViewers"),
        likes = payload.nonNegativeInt("likes"),
        comments = payload.nonNegativeInt("comments"),
        reposts = payload.nonNegativeInt("reposts"),
        shares = payload.nonNegativeInt("shares"),
        saves = payload.nonNegativeInt("saves"),
        profileVisits = payload.nonNegativeInt("profileVisits"),
        linkClicks = payload.nonNegativeInt("linkClicks"),
        newFollows = payload.nonNegativeInt("newFollows"),
        engagements = payload.nonNegativeInt("engagements"),
        engagementRate = payload.optDouble("engagementRate").takeIf(Double::isFinite)?.coerceAtLeast(0.0) ?: 0.0,
        video = videoPayload?.let { video ->
            PostVideoAnalytics(
                views = video.nonNegativeInt("views"),
                watchTimeSeconds = video.nonNegativeInt("watchTimeSeconds"),
                averageWatchSeconds = video.optNullableFiniteDouble("averageWatchSeconds"),
                completedViews = video.optNullableNonNegativeInt("completedViews"),
                completionRate = video.optNullableFiniteDouble("completionRate")?.coerceIn(0.0, 1.0),
            )
        },
        audience = buildList {
            for (index in 0 until audience.length()) {
                val row = audience.optJSONObject(index) ?: continue
                val label = row.optString("label").trim()
                if (label.isNotEmpty()) add(PostAnalyticsAudience(label, row.nonNegativeInt("share").coerceAtMost(100)))
            }
        },
        daily = buildList {
            for (index in 0 until daily.length()) {
                val row = daily.optJSONObject(index) ?: continue
                val day = row.optString("day").takeIf { it.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) } ?: continue
                add(PostAnalyticsDaily(day, row.nonNegativeInt("impressions")))
            }
        }.takeLast(7),
    )
}

internal fun buildPostAnalyticsPath(postId: String): String = "/api/v1/posts/${URLEncoder.encode(postId, Charsets.UTF_8.name()).replace("+", "%20")}/analytics"
private fun isSafeAnalyticsId(value: String) = value.matches(Regex("^[A-Za-z0-9_-]{1,128}$"))
private fun JSONObject.nonNegativeInt(key: String) = optInt(key).coerceAtLeast(0)
private fun JSONObject.optNullableNonNegativeInt(key: String): Int? = if (isNull(key) || !has(key)) null else nonNegativeInt(key)
private fun JSONObject.optNullableFiniteDouble(key: String): Double? = if (isNull(key) || !has(key)) null else optDouble(key).takeIf(Double::isFinite)?.coerceAtLeast(0.0)

private class JdkPostAnalyticsTransport(private val baseUrl: String) : PostAnalyticsTransport {
    override fun get(path: String, accessToken: String): JSONObject {
        require(path.matches(Regex("^/api/v1/posts/[A-Za-z0-9_%~-]{1,384}/analytics$"))) { "Unsupported post analytics request." }
        val origin = baseUrl.trim().trimEnd('/')
        val parsed = runCatching { URL(origin) }.getOrElse { error("Analytics unavailable: the configured API address is invalid.") }
        require(origin.isNotBlank() && (parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2"))) {
            "Analytics unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2)."
        }
        val connection = URL("$origin$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.instanceFollowRedirects = false
            connection.useCaches = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $accessToken")
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { reader -> reader.readBounded(MAX_RESPONSE_CHARS) }.orEmpty()
            if (status !in 200..299) throw PostAnalyticsHttpException(status)
            require(body.isNotBlank()) { "Nantty returned an empty analytics response." }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        const val MAX_RESPONSE_CHARS = 1_048_576
    }
}

private fun java.io.Reader.readBounded(maxChars: Int): String = buildString {
    val buffer = CharArray(4_096)
    while (true) {
        val read = read(buffer, 0, minOf(buffer.size, maxChars - length + 1))
        if (read < 0) break
        require(length + read <= maxChars) { "Nantty returned an unexpectedly large analytics response." }
        append(buffer, 0, read)
    }
}

class PostAnalyticsHttpException(val statusCode: Int) : Exception("Post analytics request failed (HTTP $statusCode). Please try again.")
