package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class FeedPost(
    val id: String,
    val authorName: String,
    val username: String,
    val text: String,
    val likes: Int,
    val comments: Int,
    val createdAt: String,
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

    private fun parsePage(body: String): FeedResult = runCatching {
        val root = JSONObject(body)
        val rows = root.optJSONArray("data") ?: JSONArray()
        val posts = buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val author = item.optJSONObject("author") ?: JSONObject()
                add(FeedPost(
                    id = item.optString("id"),
                    authorName = author.optString("name", "Nantty member"),
                    username = author.optString("username", ""),
                    text = item.optString("text", ""),
                    likes = item.optInt("likes"),
                    comments = item.optInt("comments"),
                    createdAt = item.optString("createdAt", ""),
                ))
            }
        }
        FeedResult.Success(posts, root.optString("nextCursor").takeUnless { it == "" || it == "null" })
    }.getOrElse { FeedResult.Failure("Nantty returned a feed we could not read. Please try again later.") }
}

private inline fun <T> HttpURLConnection.useConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
