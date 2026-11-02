package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

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
)

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
}

class FeedRepository(private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL) {
    fun loadForYou(): FeedResult {
        val origin = baseUrl.trim().trimEnd('/')
        if (origin.isBlank()) return FeedResult.Failure("Feed unavailable: configure NANTTY_API_BASE_URL to connect to Nantty.")
        val parsed = runCatching { URL(origin) }.getOrElse {
            return FeedResult.Failure("Feed unavailable: the configured API address is invalid.")
        }
        if (parsed.protocol != "https" && !(parsed.protocol == "http" && parsed.host == "10.0.2.2")) {
            return FeedResult.Failure("Feed unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2).")
        }

        return try {
            val connection = (URL(origin + "/api/v1/feeds/for-you?limit=10").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
                // This optional-auth endpoint is called anonymously. No credential exists in this app yet.
            }
            connection.useConnection {
                val status = connection.responseCode
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (status !in 200..299) return@useConnection FeedResult.Failure("Feed request failed (HTTP $status). Please try again later.")
                parsePage(body)
            }
        } catch (_: Exception) {
            FeedResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

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
                ))
            }
        }
        FeedResult.Success(posts, root.optString("nextCursor").takeUnless { it == "" || it == "null" })
    }.getOrElse { FeedResult.Failure("Nantty returned a feed we could not read. Please try again later.") }
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
