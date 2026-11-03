package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

enum class SearchType(val apiValue: String, val label: String) {
    TOP("top", "Top"), POSTS("posts", "Posts"), PEOPLE("people", "People"),
}

data class SearchPost(
    val id: String,
    val caption: String,
    val thumbnailUrl: String?,
    val likes: Int,
    val views: Int,
    val authorId: String? = null,
)

data class SearchUser(val id: String, val name: String, val username: String, val avatarUrl: String?, val verified: Boolean)
data class SearchPage(val posts: List<SearchPost>, val users: List<SearchUser>, val nextCursor: String?)

sealed interface SearchResult {
    data class Success(val page: SearchPage) : SearchResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SearchResult
}

fun interface SearchTransport {
    fun request(path: String, accessToken: String?): JSONObject
}

class SearchRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: SearchTransport = JdkSearchTransport(baseUrl),
) {
    fun search(query: String, type: SearchType, cursor: String? = null): SearchResult = try {
        val cleanQuery = query.trim()
        require(cleanQuery.isNotEmpty() && cleanQuery.length <= MAX_QUERY_LENGTH) {
            "Search terms must be between 1 and $MAX_QUERY_LENGTH characters."
        }
        require(cursor == null || cursor.length <= MAX_CURSOR_LENGTH) { "This search page cursor is invalid. Start a new search." }
        val session = sessionProvider()
        SearchResult.Success(parsePage(transport.request(buildSearchPath(cleanQuery, type, cursor), session?.accessToken), type))
    } catch (error: Exception) {
        SearchResult.Failure(
            error.message ?: "Could not search Nantty. Check your connection and try again.",
            authenticationRequired = error is SearchHttpException && error.statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN),
        )
    }

    internal fun parsePage(payload: JSONObject, type: SearchType): SearchPage {
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete search response.")
        val posts = buildList {
            if (type == SearchType.PEOPLE) return@buildList
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                if (row.optString("type") != "post") continue
                val id = row.optString("id").takeIf(::isSafePostId) ?: continue
                add(SearchPost(
                    id = id,
                    caption = row.optNullableString("caption").orEmpty(),
                    thumbnailUrl = safeMediaUrl(row.optNullableString("thumbnailUrl")),
                    likes = row.optInt("likes").coerceAtLeast(0),
                    views = row.optInt("views").coerceAtLeast(0),
                    authorId = row.optNullableString("authorId")?.takeIf(::isSafePostId),
                ))
            }
        }
        val users = buildList {
            if (type == SearchType.POSTS) return@buildList
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                if (row.optString("type") != "user") continue
                val id = row.optString("id").takeIf(::isSafePostId) ?: continue
                val username = row.optNullableString("username") ?: continue
                add(SearchUser(
                    id = id,
                    name = row.optNullableString("name")?.takeIf(String::isNotBlank) ?: username,
                    username = username,
                    avatarUrl = safeMediaUrl(row.optNullableString("avatarUrl")),
                    verified = row.optBoolean("verified"),
                ))
            }
        }
        val cursor = payload.optNullableString("nextCursor")
        require(cursor == null || cursor.length <= MAX_CURSOR_LENGTH) { "Nantty returned an invalid search page cursor." }
        return SearchPage(posts, users, cursor)
    }

    companion object {
        const val MAX_QUERY_LENGTH = 100
        const val MAX_CURSOR_LENGTH = 300
        const val PAGE_SIZE = 10
    }
}

internal fun buildSearchPath(query: String, type: SearchType, cursor: String? = null): String = buildString {
    append("/api/v1/search?q=${encodeSearchValue(query)}&scope=global&type=${type.apiValue}&limit=${SearchRepository.PAGE_SIZE}")
    cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${encodeSearchValue(it)}") }
}

private fun encodeSearchValue(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

private fun isSafePostId(value: String): Boolean = value.length in 1..200 && value.all {
    it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '_' || it == '-'
}

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private class JdkSearchTransport(private val baseUrl: String) : SearchTransport {
    override fun request(path: String, accessToken: String?): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use search.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        try {
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) {
                if (status in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)) throw SearchHttpException(status)
                error("Search request failed (HTTP $status). Please try again.")
            }
            if (body.isBlank()) error("Nantty returned an empty search response.")
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
            require(output.size() + read <= 1_048_576) { "Nantty returned an unexpectedly large search response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

internal class SearchHttpException(val statusCode: Int) : Exception("Your session has expired. Sign in again to search.")
