package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant

data class ExploreCategory(val id: String, val label: String)

data class ExploreTrend(
    val hashtag: String,
    val label: String,
    val category: String,
    val categoryLabel: String,
    val postCount: Int,
    val authorCount: Int,
    val rank: Int,
    val scope: String,
    val context: String,
)

data class ExploreHeadline(
    val id: String,
    val title: String,
    val summary: String,
    val category: String,
    val categoryLabel: String,
    val postIds: List<String>,
    val postCount: Int,
    val authorCount: Int,
    val hashtags: List<String>,
    val coverImageUrl: String?,
    val sourceLabel: String,
)

data class ExploreUserSummary(
    val id: String,
    val name: String,
    val username: String,
    val avatarUrl: String?,
    val verified: Boolean,
    val verificationColor: String? = null,
)

data class ExploreSuggestion(
    val user: ExploreUserSummary,
    val reasonCode: String,
    val reasonLabel: String,
    val isOfficial: Boolean,
    val checkmarkTier: String,
    val isPrivate: Boolean?,
)

data class ExploreRankingExplanation(val code: String, val label: String, val detail: String?)
data class ExploreRankedPost(val post: FeedPost, val explanations: List<ExploreRankingExplanation>, val boostMultiplier: Double?)
data class ExplorePostsPage(val posts: List<ExploreRankedPost>, val nextCursor: String?)

sealed interface ExploreResult<out T> {
    data class Success<T>(val value: T) : ExploreResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ExploreResult<Nothing>
}

fun interface ExploreTransport {
    fun get(path: String, accessToken: String?): JSONObject
}

class ExploreRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession? = { null },
    private val transport: ExploreTransport = JdkExploreTransport(baseUrl),
) {
    fun loadCategories(): ExploreResult<List<ExploreCategory>> = request("/api/v1/explore/categories", ::parseCategories)

    fun loadTrends(category: String = "for_you", limit: Int = DEFAULT_TRENDS_LIMIT): ExploreResult<ExploreTrendPage> {
        if (category !in CATEGORY_IDS || limit !in 1..30) return ExploreResult.Failure("Explore trend filters are invalid.")
        val path = buildString {
            append("/api/v1/explore/trends")
            categoryParameter(category)?.let { appendQuery("category", it) }
            appendQuery("limit", limit.toString())
        }
        return request(path) { payload ->
            val rows = payload.optJSONArray("items") ?: error("Nantty returned an incomplete Explore trends response.")
            val scope = payload.optNullableString("scope").orEmpty()
            val items = buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    val hashtag = row.optNullableString("hashtag") ?: continue
                    val rowCategory = row.optNullableString("category") ?: continue
                    val categoryLabel = row.optNullableString("categoryLabel") ?: continue
                    add(ExploreTrend(
                        hashtag = hashtag,
                        label = row.optNullableString("label") ?: "#$hashtag",
                        category = rowCategory,
                        categoryLabel = categoryLabel,
                        postCount = row.optInt("postCount").coerceAtLeast(0),
                        authorCount = row.optInt("authorCount").coerceAtLeast(0),
                        rank = row.optInt("rank").takeIf { it > 0 } ?: (size + 1),
                        scope = row.optNullableString("scope") ?: scope,
                        context = row.optNullableString("context").orEmpty(),
                    ))
                }
            }
            ExploreTrendPage(scope, items)
        }
    }

    fun loadHeadlines(category: String = "for_you"): ExploreResult<ExploreHeadlinePage> {
        if (category !in CATEGORY_IDS) return ExploreResult.Failure("Explore headline category is invalid.")
        val path = buildString {
            append("/api/v1/explore/headlines")
            categoryParameter(category)?.let { appendQuery("category", it) }
        }
        return request(path) { payload ->
            val rows = payload.optJSONArray("items") ?: error("Nantty returned an incomplete Explore headlines response.")
            val scope = payload.optNullableString("scope").orEmpty()
            val items = buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    val id = row.optNullableString("id") ?: continue
                    val title = row.optNullableString("title") ?: continue
                    val rowCategory = row.optNullableString("category") ?: continue
                    val categoryLabel = row.optNullableString("categoryLabel") ?: continue
                    add(ExploreHeadline(
                        id = id,
                        title = title,
                        summary = row.optNullableString("summary").orEmpty(),
                        category = rowCategory,
                        categoryLabel = categoryLabel,
                        postIds = row.optStringList("postIds"),
                        postCount = row.optInt("postCount").coerceAtLeast(0),
                        authorCount = row.optInt("authorCount").coerceAtLeast(0),
                        hashtags = row.optStringList("hashtags"),
                        coverImageUrl = safeMediaUrl(row.optNullableString("coverImageUrl")),
                        sourceLabel = row.optNullableString("sourceLabel") ?: "Summarised from posts",
                    ))
                }
            }
            ExploreHeadlinePage(scope, items)
        }
    }

    fun loadWhoToFollow(
        limit: Int = DEFAULT_FOLLOW_LIMIT,
        includePrivate: Boolean = false,
    ): ExploreResult<List<ExploreSuggestion>> {
        if (limit !in 1..30) return ExploreResult.Failure("Explore follow-suggestion limit is invalid.")
        val includePrivateParameter = if (includePrivate) "&includePrivate=true" else ""
        return request("/api/v1/explore/who-to-follow?limit=$limit$includePrivateParameter") { payload ->
            val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete follow-suggestions response.")
            buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    val user = row.optJSONObject("user") ?: continue
                    val userId = user.optNullableString("id") ?: continue
                    val username = user.optNullableString("username") ?: continue
                    val reason = row.optJSONObject("reason")
                    val verification = user.optJSONObject("verification")
                    val verificationColor = verification?.let(::visibleExploreVerificationColor)
                    add(ExploreSuggestion(
                        user = ExploreUserSummary(
                            id = userId,
                            name = user.optNullableString("name") ?: username,
                            username = username,
                            avatarUrl = safeMediaUrl(user.optNullableString("avatarUrl")),
                            verified = verificationColor != null || (verification == null && user.optBoolean("verified")),
                            verificationColor = verificationColor,
                        ),
                        reasonCode = reason?.optNullableString("code").orEmpty(),
                        reasonLabel = reason?.optNullableString("label").orEmpty(),
                        isOfficial = row.optBoolean("isOfficial"),
                        checkmarkTier = row.optNullableString("checkmarkTier") ?: "none",
                        isPrivate = row.opt("isPrivate")?.takeUnless { it == JSONObject.NULL }?.let { row.optBoolean("isPrivate") },
                    ))
                }
            }
        }
    }

    fun loadPosts(category: String = "for_you", cursor: String? = null): ExploreResult<ExplorePostsPage> {
        if (category !in CATEGORY_IDS) return ExploreResult.Failure("Explore post category is invalid.")
        if (cursor != null && cursor.length > MAX_CURSOR_LENGTH) return ExploreResult.Failure("This Explore page cursor is invalid. Start a new page.")
        val path = buildString {
            append("/api/v1/explore/posts-for-you")
            appendQuery("category", category)
            cursor?.takeIf(String::isNotBlank)?.let { appendQuery("cursor", it) }
        }
        return request(path) { payload ->
            val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete Explore posts response.")
            val posts = buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    val postId = row.optNullableString("id") ?: continue
                    val singlePostPayload = JSONObject().put("data", JSONArray().put(row)).toString()
                    val parsed = FeedRepository().parsePage(singlePostPayload) as? FeedResult.Success ?: continue
                    val post = parsed.posts.firstOrNull()?.takeIf { it.id == postId } ?: continue
                    val ranking = row.optJSONObject("ranking")
                    val explanations = ranking?.optJSONArray("explanations")?.let { explanationRows ->
                        buildList {
                            for (explanationIndex in 0 until explanationRows.length()) {
                                val explanation = explanationRows.optJSONObject(explanationIndex) ?: continue
                                val code = explanation.optNullableString("code") ?: continue
                                val label = explanation.optNullableString("label") ?: continue
                                add(ExploreRankingExplanation(code, label, explanation.optNullableString("detail")))
                            }
                        }
                    }.orEmpty()
                    add(ExploreRankedPost(post, explanations, ranking?.optDouble("boostMultiplier")?.takeIf { it.isFinite() && it >= 0 }))
                }
            }
            val nextCursor = payload.optNullableString("nextCursor")
            require(nextCursor == null || nextCursor.length <= MAX_CURSOR_LENGTH) { "Nantty returned an invalid Explore page cursor." }
            ExplorePostsPage(posts, nextCursor)
        }
    }

    internal fun parseCategories(payload: JSONObject): List<ExploreCategory> {
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete Explore categories response.")
        return buildList {
            val seen = mutableSetOf<String>()
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optNullableString("id") ?: continue
                val label = row.optNullableString("label") ?: continue
                if (seen.add(id)) add(ExploreCategory(id, label))
            }
        }
    }

    private inline fun <T> request(path: String, parse: (JSONObject) -> T): ExploreResult<T> = try {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
        ExploreResult.Success(parse(transport.get(path, token)))
    } catch (error: Exception) {
        ExploreResult.Failure(
            error.message ?: "Could not load Explore. Check your connection and try again.",
            authenticationRequired = error is ExploreHttpException && error.statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN),
        )
    }

    companion object {
        const val DEFAULT_TRENDS_LIMIT = 10
        const val DEFAULT_FOLLOW_LIMIT = 3
        const val MAX_CURSOR_LENGTH = 200
        private val CATEGORY_IDS = setOf("for_you", "trending", "news", "sports", "entertainment", "music", "tech", "business", "fashion", "gaming", "comedy", "religion", "food", "politics", "lifestyle")

        internal fun categoryParameter(category: String): String? = category.takeUnless { it == "for_you" || it == "trending" }
    }
}

private fun visibleExploreVerificationColor(verification: JSONObject): String? {
    val color = verification.optString("color")
    val expectedColor = when (verification.optString("type")) {
        "personal" -> "blue"
        "business" -> "gold"
        "government" -> "black"
        else -> return null
    }
    if (color != expectedColor || !verification.optBoolean("badgeVisible") || verification.optString("tier") == "ESSENTIAL") return null
    val status = verification.optString("status")
    if (status == "active") return color
    if (status != "expired" || color != "black") return null
    val graceEnd = runCatching { Instant.parse(verification.optString("graceEndsAt")).toEpochMilli() }.getOrNull()
    return color.takeIf { graceEnd != null && graceEnd > System.currentTimeMillis() }
}

data class ExploreTrendPage(val scope: String, val items: List<ExploreTrend>)
data class ExploreHeadlinePage(val scope: String, val items: List<ExploreHeadline>)

internal fun buildExplorePostsPath(category: String, cursor: String? = null): String = buildString {
    append("/api/v1/explore/posts-for-you?category=${encodeExploreValue(category)}")
    cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${encodeExploreValue(it)}") }
}

private fun StringBuilder.appendQuery(key: String, value: String) {
    append(if (contains('?')) '&' else '?')
    append(key).append('=').append(encodeExploreValue(value))
}

private fun encodeExploreValue(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun JSONObject.optStringList(key: String): List<String> = optJSONArray(key)?.let { rows ->
    buildList { for (index in 0 until rows.length()) rows.optString(index).takeIf { it.isNotBlank() && it != "null" }?.let(::add) }
}.orEmpty()

private class JdkExploreTransport(private val baseUrl: String) : ExploreTransport {
    override fun get(path: String, accessToken: String?): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use Explore.")
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
            if (status !in 200..299) throw ExploreHttpException(status)
            if (body.isBlank()) error("Nantty returned an empty Explore response.")
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
            require(output.size() + read <= 1_048_576) { "Nantty returned an unexpectedly large Explore response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

internal class ExploreHttpException(val statusCode: Int) : Exception(
    if (statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)) "Sign in again to continue loading Explore."
    else "Explore request failed (HTTP $statusCode). Please try again.",
)
