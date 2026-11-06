package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class ClipSoundSummary(
    val id: String,
    val title: String,
    val audioUrl: String?,
    val coverUrl: String?,
)

data class ClipFeedItem(
    val post: FeedPost,
    val durationSeconds: Int,
    val viewerHasAccess: Boolean,
    val isFollowingAuthor: Boolean,
    val sound: ClipSoundSummary?,
)

data class ClipsPage(val items: List<ClipFeedItem>, val nextCursor: String?)

enum class ClipsFeedTab(val apiValue: String) {
    FOR_YOU("forYou"),
    FOLLOWING("following"),
}

sealed interface ClipsResult {
    data class Success(val page: ClipsPage) : ClipsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ClipsResult
}

fun interface ClipsTransport {
    fun get(path: String, accessToken: String?): JSONObject
}

class ClipsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession? = { null },
    private val transport: ClipsTransport = JdkClipsTransport(baseUrl),
) {
    fun load(tab: ClipsFeedTab, cursor: String? = null): ClipsResult {
        if (cursor != null && (cursor.isBlank() || cursor.length > MAX_CURSOR_LENGTH)) {
            return ClipsResult.Failure("This clip page cursor is invalid. Refresh to continue.")
        }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
        if (tab == ClipsFeedTab.FOLLOWING && session == null) {
            return ClipsResult.Failure("Sign in to see clips from people you follow.", authenticationRequired = true)
        }
        return try {
            val payload = transport.get(buildClipsPath(tab, cursor), session?.accessToken)
            ClipsResult.Success(parsePage(payload))
        } catch (error: ClipsHttpException) {
            ClipsResult.Failure(
                error.message ?: "Could not load clips. Check your connection and try again.",
                authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN,
            )
        } catch (error: Exception) {
            ClipsResult.Failure(error.message ?: "Could not load clips. Check your connection and try again.")
        }
    }

    internal fun parsePage(payload: JSONObject): ClipsPage {
        val root = payload.optJSONObject("data") ?: payload
        val rows = root.optJSONArray("data") ?: payload.optJSONArray("data")
            ?: error("Nantty returned an incomplete Clips response.")
        val parsedPosts = FeedRepository().parsePage(JSONObject().put("data", rows).put("nextCursor", root.opt("nextCursor")).toString())
        val postsById = (parsedPosts as? FeedResult.Success)?.posts?.associateBy(FeedPost::id)
            ?: error("Nantty returned clips we could not read.")
        val items = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val post = postsById[row.optString("id")] ?: continue
                if (post.kind != "clip") continue
                add(
                    ClipFeedItem(
                        post = post,
                        durationSeconds = row.optInt("durationSeconds").coerceAtLeast(0),
                        viewerHasAccess = row.optBoolean("viewerHasAccess", true),
                        isFollowingAuthor = row.optBoolean("isFollowingAuthor"),
                        sound = row.optJSONObject("sound")?.toClipSoundSummary(),
                    ),
                )
            }
        }
        val nextCursor = root.optNullableString("nextCursor")
            ?: payload.optNullableString("nextCursor")
        require(nextCursor == null || nextCursor.length <= MAX_CURSOR_LENGTH) { "Nantty returned an invalid Clips cursor." }
        return ClipsPage(items, nextCursor)
    }

    private fun JSONObject.toClipSoundSummary(): ClipSoundSummary? {
        val id = optString("id").takeIf(String::isNotBlank) ?: return null
        val title = optString("title").takeIf { it.isNotBlank() && it != "null" } ?: return null
        return ClipSoundSummary(
            id = id,
            title = title,
            audioUrl = safeMediaUrl(optString("audioUrl").takeUnless { it.isBlank() || it == "null" }),
            coverUrl = safeMediaUrl(optString("coverUrl").takeUnless { it.isBlank() || it == "null" }),
        )
    }

    private companion object {
        const val MAX_CURSOR_LENGTH = 200
    }
}

internal fun buildClipsPath(tab: ClipsFeedTab, cursor: String?): String = buildString {
    append("/api/v1/clips?tab=")
    append(tab.apiValue)
    append("&limit=10")
    cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=").append(URLEncoder.encode(it, Charsets.UTF_8.name())) }
}

private class JdkClipsTransport(private val baseUrl: String) : ClipsTransport {
    override fun get(path: String, accessToken: String?): JSONObject {
        require(path.startsWith("/api/v1/clips?")) { "Unsupported Clips request." }
        val origin = baseUrl.trim().trimEnd('/')
        val parsed = runCatching { URL(origin) }.getOrElse { error("Clips unavailable: the configured API address is invalid.") }
        require(origin.isNotBlank() && (parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2"))) {
            "Clips unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2)."
        }
        val connection = URL("$origin$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw ClipsHttpException(status, "Clips request failed (HTTP $status). Please try again.")
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }
}

private class ClipsHttpException(val statusCode: Int, message: String) : Exception(message)

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeUnless { it.isBlank() || it == "null" }
