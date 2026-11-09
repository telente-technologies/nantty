package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class SavedPost(val saveId: String, val post: FeedPost, val savedAt: String)
data class SavedProductItem(val saveId: String, val product: MartProduct, val savedAt: String)
data class SavedPostsPage(
    val posts: List<SavedPost>,
    val nextCursor: String?,
    val products: List<SavedProductItem> = emptyList(),
)
enum class SavedPostType(val apiValue: String) { POSTS("post"), VIDEOS("video"), PRODUCTS("product") }

sealed interface SavedPostsResult {
    data class Success(val page: SavedPostsPage) : SavedPostsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SavedPostsResult
}

fun interface SavedPostsTransport {
    fun get(path: String, accessToken: String): JSONObject
}

class SavedPostsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: SavedPostsTransport = JdkSavedPostsTransport(baseUrl),
) {
    fun load(cursor: String? = null, type: SavedPostType = SavedPostType.POSTS): SavedPostsResult = try {
        val session = sessionProvider() ?: error("Sign in to view saved posts.")
        val token = session.accessToken.takeIf(String::isNotBlank) ?: error("Sign in to view saved posts.")
        require(cursor == null || isUuid(cursor)) { "This saved-posts page cursor is invalid. Start again." }
        val path = buildSavedPostsPath(cursor, type)
        SavedPostsResult.Success(parsePage(transport.get(path, token), type))
    } catch (error: Exception) {
        SavedPostsResult.Failure(
            error.message ?: "Could not load saved posts. Check your connection and try again.",
            authenticationRequired = error is SavedPostsHttpException && error.statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN),
        )
    }

    internal fun parsePage(payload: JSONObject, type: SavedPostType = SavedPostType.POSTS): SavedPostsPage {
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete saved-posts response.")
        val posts = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                if (row.optString("type") != type.apiValue) continue
                val id = row.optString("id").takeIf(::isUuid) ?: continue
                val targetId = row.optString("targetId").takeIf(::isUuid) ?: continue
                if (type == SavedPostType.PRODUCTS) continue
                val postJson = row.optJSONObject("post") ?: continue
                if (postJson.optString("id") != targetId) continue
                val post = parseSavedPost(targetId, postJson) ?: continue
                add(SavedPost(id, post, row.optString("savedAt")))
            }
        }
        val products = if (type != SavedPostType.PRODUCTS) emptyList() else buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                if (row.optString("type") != SavedPostType.PRODUCTS.apiValue) continue
                val saveId = row.optString("id").takeIf(::isUuid) ?: continue
                val targetId = row.optString("targetId").takeIf(::isUuid) ?: continue
                val productJson = row.optJSONObject("product") ?: continue
                if (productJson.optString("id") != targetId) continue
                val name = productJson.optString("name").trim().takeIf(String::isNotEmpty) ?: continue
                val price = productJson.optJSONObject("price") ?: continue
                val amountMinor = readSavedProductMinorUnits(price) ?: continue
                val currency = readSavedProductCurrency(price) ?: continue
                val imageUrl = safeMediaUrl(productJson.optNullableString("imageUrl"))
                add(
                    SavedProductItem(
                        saveId = saveId,
                        product = MartProduct(
                            id = targetId,
                            name = name,
                            amountMinor = amountMinor,
                            currency = currency,
                            imageUrl = imageUrl,
                            stock = productJson.optInt("stock").coerceAtLeast(0),
                        ),
                        savedAt = row.optString("savedAt"),
                    ),
                )
            }
        }
        val cursor = payload.optString("nextCursor").takeIf { it.isNotBlank() && it != "null" }
        require(cursor == null || isUuid(cursor)) { "Nantty returned an invalid saved-posts page cursor." }
        return SavedPostsPage(posts, cursor, products)
    }

    companion object {
        const val PAGE_SIZE = 12
    }
}

internal fun buildSavedPostsPath(cursor: String? = null, type: SavedPostType = SavedPostType.POSTS): String = buildString {
    append("/api/v1/saves?type=${type.apiValue}")
    cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name()).replace("+", "%20")}") }
}

internal fun appendUniqueSavedPosts(current: List<SavedPost>, incoming: List<SavedPost>): List<SavedPost> {
    val seen = current.mapTo(mutableSetOf(), SavedPost::saveId)
    return current + incoming.filter { seen.add(it.saveId) }
}

internal fun appendUniqueSavedProducts(current: List<SavedProductItem>, incoming: List<SavedProductItem>): List<SavedProductItem> {
    val seen = current.mapTo(mutableSetOf(), SavedProductItem::saveId)
    return current + incoming.filter { seen.add(it.saveId) }
}

private fun parseSavedPost(id: String, item: JSONObject): FeedPost? {
    val author = item.optJSONObject("author") ?: return null
    val authorId = author.optString("id").takeIf(String::isNotBlank) ?: return null
    val verification = author.optJSONObject("verification")
    val verificationColor = verification?.optString("color")?.takeIf {
        verification.optBoolean("badgeVisible") && verification.optString("status") == "active" && it in setOf("blue", "gold", "black")
    }
    val mediaRows = item.optJSONArray("media") ?: JSONArray()
    val media = buildList {
        for (index in 0 until mediaRows.length()) {
            val row = mediaRows.optJSONObject(index) ?: continue
            if (row.optString("status") != "ready") continue
            val url = safeMediaUrl(row.optNullableString("url")) ?: continue
            add(FeedMedia(
                id = row.optString("id").takeIf(String::isNotBlank) ?: "media-$index",
                type = row.optString("type").takeIf(String::isNotBlank) ?: "image",
                url = url,
                posterUrl = safeMediaUrl(row.optNullableString("posterUrl")),
                width = row.optInt("width").takeIf { it > 0 },
                height = row.optInt("height").takeIf { it > 0 },
            ))
        }
    }
    return FeedPost(
        id = id,
        authorName = author.optNullableString("name") ?: "Nantty member",
        username = author.optNullableString("username").orEmpty(),
        avatarUrl = safeMediaUrl(author.optNullableString("avatarUrl")),
        verified = verificationColor != null || (verification == null && author.optBoolean("verified")),
        verificationColor = verificationColor,
        postedAsName = item.optJSONObject("postedAs")?.optNullableString("name"),
        postedAsHandle = item.optJSONObject("postedAs")?.optNullableString("handle"),
        postedAsAvatarUrl = safeMediaUrl(item.optJSONObject("postedAs")?.optNullableString("avatarUrl")),
        kind = item.optString("kind").takeIf(String::isNotBlank) ?: "post",
        text = item.optString("text"),
        media = media,
        likes = item.optInt("likes").coerceAtLeast(0),
        comments = item.optInt("comments").coerceAtLeast(0),
        reposts = item.optInt("reposts").coerceAtLeast(0),
        shares = item.optInt("shares").coerceAtLeast(0),
        createdAt = item.optString("createdAt"),
        liked = item.optBoolean("liked"),
        reposted = item.optBoolean("reposted"),
        authorId = authorId,
        bookmarked = true,
        isFollowingAuthor = item.optBoolean("isFollowingAuthor"),
        linkPreview = parseFeedLinkPreview(item.optJSONObject("linkPreview")),
    )
}

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun readSavedProductMinorUnits(price: JSONObject): Long? {
    val raw = price.opt("amountMinor") as? Number ?: return null
    val amount = raw.toLong()
    return amount.takeIf { it >= 0 && raw.toDouble() == it.toDouble() }
}

private fun readSavedProductCurrency(price: JSONObject): String? {
    val code = price.optString("currency")
    if (!code.matches(Regex("[A-Z]{3}"))) return null
    return code.takeIf { runCatching { java.util.Currency.getInstance(it) }.isSuccess }
}

private fun isUuid(value: String): Boolean = UUID_PATTERN.matches(value)

private val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

private class JdkSavedPostsTransport(private val baseUrl: String) : SavedPostsTransport {
    override fun get(path: String, accessToken: String): JSONObject {
        val supportedPaths = SavedPostType.entries.map { type -> buildSavedPostsPath(type = type) }
        require(supportedPaths.any { prefix -> path == prefix || path.startsWith("$prefix&cursor=") }) { "Unsupported saved-items request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view saved posts.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw SavedPostsHttpException(status)
            if (body.isBlank()) error("Nantty returned an empty saved-posts response.")
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
            require(output.size() + read <= 1_048_576) { "Nantty returned an unexpectedly large saved-posts response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

internal class SavedPostsHttpException(val statusCode: Int) : Exception(
    if (statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)) "Your session has expired. Sign in again to view saved posts."
    else "Saved posts could not load (HTTP $statusCode). Please try again.",
)
