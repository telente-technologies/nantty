package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

enum class SearchType(val apiValue: String, val label: String) {
    TOP("top", "Top"), PEOPLE("people", "People"), POSTS("posts", "Posts"), CLIPS("clips", "Clips"),
    PRODUCTS("products", "Products"), STORES("stores", "Stores"), BRANDS("brands", "Brands"), HASHTAGS("hashtags", "Hashtags"),
}

data class SearchPost(
    val id: String,
    val caption: String,
    val thumbnailUrl: String?,
    val likes: Int,
    val views: Int,
    val authorId: String? = null,
    val kind: String = "post",
)

data class SearchUser(val id: String, val name: String, val username: String, val avatarUrl: String?, val verified: Boolean)
data class SearchProduct(val id: String, val name: String, val amountMinor: Long, val currency: String, val imageUrl: String?, val stock: Int)
data class SearchOther(
    val kind: String,
    val id: String,
    val title: String,
    val subtitle: String = "",
    val imageUrl: String? = null,
    val count: Int? = null,
    val associatedStoreId: String? = null,
)
data class SearchPage(
    val posts: List<SearchPost>,
    val users: List<SearchUser>,
    val nextCursor: String?,
    val products: List<SearchProduct> = emptyList(),
    val otherResults: List<SearchOther> = emptyList(),
)
data class SearchRecent(val id: String, val query: String, val scope: String, val searchedAt: String)

sealed interface SearchResult {
    data class Success(val page: SearchPage) : SearchResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SearchResult
}

fun interface SearchTransport {
    fun request(path: String, accessToken: String?): JSONObject

    fun request(path: String, accessToken: String?, method: String, body: JSONObject?): JSONObject {
        require(method == "GET" && body == null) { "This search transport does not support $method requests." }
        return request(path, accessToken)
    }
}

class SearchRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: SearchTransport = JdkSearchTransport(baseUrl),
    private val productInteractionRepository: ProductInteractionRepository? = null,
) {
    fun hasAuthenticatedViewer(): Boolean = sessionProvider()?.accessToken?.isNotBlank() == true

    fun recordSearchInteraction(query: String, resultCount: Int): Boolean =
        productInteractionRepository?.recordSearchPerformed(query, resultCount) ?: false

    fun recordSearchProductClick(productId: String, query: String, resultCount: Int): Boolean =
        productInteractionRepository?.recordSearchProductClicked(productId, query, resultCount) ?: false

    fun search(query: String, type: SearchType, cursor: String? = null, scope: String = GLOBAL_SCOPE): SearchResult = try {
        val cleanQuery = query.trim()
        require(cleanQuery.isNotEmpty() && cleanQuery.length <= MAX_QUERY_LENGTH) {
            "Search terms must be between 1 and $MAX_QUERY_LENGTH characters."
        }
        require(cursor == null || cursor.length <= MAX_CURSOR_LENGTH) { "This search page cursor is invalid. Start a new search." }
        require(isSafeSearchScope(scope)) { "This search scope is invalid." }
        val session = sessionProvider()
        SearchResult.Success(parsePage(transport.request(buildSearchPath(cleanQuery, type, cursor, scope), session?.accessToken), type))
    } catch (error: Exception) {
        SearchResult.Failure(
            error.message ?: "Could not search Nantty. Check your connection and try again.",
            authenticationRequired = error is SearchHttpException && error.statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN),
        )
    }

    fun listRecentSearches(scope: String = GLOBAL_SCOPE): RecentSearchResult {
        if (!isSafeSearchScope(scope)) return RecentSearchResult.Failure("This search scope is invalid.")
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return RecentSearchResult.Success(emptyList())
        return try {
            val payload = transport.request("/api/v1/search/recent?scope=${encodeSearchValue(scope)}", session.accessToken)
            val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete recent-search response.")
            val entries = buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    val id = row.optString("id").takeIf(::isUuid) ?: continue
                    val query = row.optNullableString("query")?.takeIf { it.length <= MAX_QUERY_LENGTH } ?: continue
                    val entryScope = row.optNullableString("scope") ?: continue
                    if (entryScope != scope) continue
                    val searchedAt = row.optNullableString("searchedAt") ?: continue
                    add(SearchRecent(id, query, entryScope, searchedAt))
                }
            }
            RecentSearchResult.Success(entries)
        } catch (error: Exception) {
            RecentSearchResult.Failure(error.message ?: "Could not load recent searches.")
        }
    }

    fun recordRecentSearch(query: String, scope: String = GLOBAL_SCOPE): RecentSearchResult {
        val cleanQuery = query.trim()
        if (cleanQuery.isEmpty() || cleanQuery.length > MAX_QUERY_LENGTH) {
            return RecentSearchResult.Failure("Search terms must be between 1 and $MAX_QUERY_LENGTH characters.")
        }
        if (!isSafeSearchScope(scope)) return RecentSearchResult.Failure("This search scope is invalid.")
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return RecentSearchResult.Failure("Sign in to save recent searches.", authenticationRequired = true)
        return try {
            transport.request(
                "/api/v1/search/recent",
                session.accessToken,
                "POST",
                JSONObject().put("q", cleanQuery).put("scope", scope),
            )
            RecentSearchResult.Success(emptyList())
        } catch (error: Exception) {
            RecentSearchResult.Failure(error.message ?: "Could not save this recent search.")
        }
    }

    fun removeRecentSearch(id: String): RecentSearchResult {
        if (!isUuid(id)) return RecentSearchResult.Failure("This recent search is invalid.")
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return RecentSearchResult.Failure("Sign in to manage recent searches.", authenticationRequired = true)
        return try {
            transport.request("/api/v1/search/recent/$id", session.accessToken, "DELETE", null)
            RecentSearchResult.Success(emptyList())
        } catch (error: Exception) {
            RecentSearchResult.Failure(error.message ?: "Could not remove this recent search.")
        }
    }

    fun clearRecentSearches(scope: String = GLOBAL_SCOPE): RecentSearchResult {
        if (!isSafeSearchScope(scope)) return RecentSearchResult.Failure("This search scope is invalid.")
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return RecentSearchResult.Failure("Sign in to manage recent searches.", authenticationRequired = true)
        return try {
            transport.request("/api/v1/search/recent?scope=${encodeSearchValue(scope)}", session.accessToken, "DELETE", null)
            RecentSearchResult.Success(emptyList())
        } catch (error: Exception) {
            RecentSearchResult.Failure(error.message ?: "Could not clear recent searches.")
        }
    }

    internal fun parsePage(payload: JSONObject, type: SearchType): SearchPage {
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete search response.")
        val posts = buildList {
            if (type == SearchType.PEOPLE || type == SearchType.PRODUCTS || type == SearchType.STORES || type == SearchType.BRANDS || type == SearchType.HASHTAGS) return@buildList
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val rowKind = row.optString("type")
                if (type == SearchType.CLIPS) {
                    if (rowKind != "clip") continue
                } else if (rowKind != "post") {
                    continue
                }
                val id = row.optString("id").takeIf(::isSafePostId) ?: continue
                add(SearchPost(
                    id = id,
                    caption = row.optNullableString("caption").orEmpty(),
                    thumbnailUrl = safeMediaUrl(row.optNullableString("thumbnailUrl")),
                    likes = row.optInt("likes").coerceAtLeast(0),
                    views = row.optInt("views").coerceAtLeast(0),
                    authorId = row.optNullableString("authorId")?.takeIf(::isSafePostId),
                    kind = rowKind,
                ))
            }
        }
        val users = buildList {
            if (type in setOf(SearchType.POSTS, SearchType.CLIPS, SearchType.PRODUCTS, SearchType.STORES, SearchType.BRANDS, SearchType.HASHTAGS)) return@buildList
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
        val products = buildList {
            if (type != SearchType.PRODUCTS && type != SearchType.TOP) return@buildList
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                if (row.optString("type") != "product") continue
                val id = row.optString("id").takeIf(::isSafePostId) ?: continue
                val name = row.optNullableString("name")?.trim()?.takeIf(String::isNotEmpty) ?: continue
                val price = row.optJSONObject("price") ?: continue
                val amountMinor = price.optLong("amountMinor", -1)
                val currency = price.optString("currency")
                if (amountMinor < 0 || !currency.matches(Regex("[A-Z]{3}"))) continue
                add(SearchProduct(
                    id = id,
                    name = name.filterNot(Char::isISOControl).take(120),
                    amountMinor = amountMinor,
                    currency = currency,
                    imageUrl = safeMediaUrl(row.optNullableString("imageUrl")),
                    stock = row.optInt("stock").coerceAtLeast(0),
                ))
            }
        }
        val otherResults = buildList {
            val includedKinds = when (type) {
                SearchType.TOP -> setOf("store", "brand", "hashtag", "category")
                SearchType.STORES -> setOf("store")
                SearchType.BRANDS -> setOf("brand")
                SearchType.HASHTAGS -> setOf("hashtag")
                else -> emptySet()
            }
            if (includedKinds.isEmpty()) return@buildList
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val kind = row.optString("type")
                if (kind !in includedKinds) continue
                val id = row.optString("id").takeIf(::isSafePostId) ?: continue
                val title = when (kind) {
                    "hashtag" -> row.optNullableString("tag")?.let { "#$it" }
                    else -> row.optNullableString("name")
                }?.filterNot(Char::isISOControl)?.take(120)?.takeIf(String::isNotBlank) ?: continue
                val subtitle = when (kind) {
                    "hashtag" -> "${row.optInt("postCount").coerceAtLeast(0)} posts"
                    "store" -> listOfNotNull(row.optNullableString("username")?.let { "@$it" }, row.optNullableString("location")).joinToString(" · ")
                    "category" -> "Shop this category in Mart"
                    else -> row.optNullableString("username")?.let { "@$it" }.orEmpty()
                }
                add(SearchOther(
                    kind = kind,
                    id = id,
                    title = title,
                    subtitle = subtitle,
                    imageUrl = safeMediaUrl(row.optNullableString("logoUrl")),
                    count = row.optInt("postCount").takeIf { kind == "hashtag" }?.coerceAtLeast(0),
                    associatedStoreId = row.optNullableString("officialStoreId")?.takeIf(::isSafePostId),
                ))
            }
        }
        val cursor = payload.optNullableString("nextCursor")
        require(cursor == null || cursor.length <= MAX_CURSOR_LENGTH) { "Nantty returned an invalid search page cursor." }
        return SearchPage(posts, users, cursor, products, otherResults)
    }

    companion object {
        const val GLOBAL_SCOPE = "global"
        const val MAX_QUERY_LENGTH = 100
        const val MAX_CURSOR_LENGTH = 300
        const val PAGE_SIZE = 10

        private fun isSafeSearchScope(scope: String): Boolean = when {
            scope == GLOBAL_SCOPE || scope == "mart" -> true
            scope.startsWith("store:") || scope.startsWith("profile:") -> {
                val id = scope.substringAfter(':')
                runCatching { UUID.fromString(id).toString().equals(id, ignoreCase = true) && id.length == 36 }.getOrDefault(false)
            }
            else -> false
        }
    }
}

sealed interface RecentSearchResult {
    data class Success(val entries: List<SearchRecent>) : RecentSearchResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : RecentSearchResult
}

private fun isUuid(value: String): Boolean = try {
    UUID.fromString(value).toString().equals(value, ignoreCase = true) && value.length == 36
} catch (_: IllegalArgumentException) {
    false
}

internal fun buildSearchPath(query: String, type: SearchType, cursor: String? = null, scope: String = SearchRepository.GLOBAL_SCOPE): String = buildString {
    append("/api/v1/search?q=${encodeSearchValue(query)}&scope=${encodeSearchValue(scope)}&type=${type.apiValue}&limit=${SearchRepository.PAGE_SIZE}")
    cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${encodeSearchValue(it)}") }
}


private fun encodeSearchValue(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

private fun isSafePostId(value: String): Boolean = value.length in 1..200 && value.all {
    it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '_' || it == '-'
}

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private class JdkSearchTransport(private val baseUrl: String) : SearchTransport {
    override fun request(path: String, accessToken: String?): JSONObject = request(path, accessToken, "GET", null)

    override fun request(path: String, accessToken: String?, method: String, body: JSONObject?): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use search.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.let { setRequestProperty("Authorization", "Bearer $it") }
            body?.let {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            body?.let { connection.outputStream.use { output -> output.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val responseBody = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) {
                if (status in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)) throw SearchHttpException(status)
                error("Search request failed (HTTP $status). Please try again.")
            }
            if (responseBody.isBlank()) {
                if (method != "GET") return JSONObject()
                error("Nantty returned an empty search response.")
            }
            return JSONObject(responseBody)
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
