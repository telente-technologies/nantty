package com.nantty.android.data

import com.nantty.android.BuildConfig
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID
import org.json.JSONObject

internal data class ProductReviewAuthor(val id: String, val name: String, val username: String, val avatarUrl: String?)
internal data class ProductReviewReply(val body: String, val authorName: String, val createdAt: String)
internal data class ProductReview(
    val id: String,
    val author: ProductReviewAuthor,
    val rating: Int,
    val text: String,
    val title: String?,
    val verifiedPurchase: Boolean,
    val reply: ProductReviewReply?,
    val createdAt: String,
)
internal data class ProductReviewPage(
    val average: Double,
    val count: Int,
    val reviews: List<ProductReview>,
    val nextCursor: String?,
)
internal data class ProductRatingSummary(val average: Double, val count: Int, val distribution: Map<Int, Int>)

internal sealed interface ProductReviewsResult {
    data class Success(val value: ProductReviewPage) : ProductReviewsResult
    data class Failure(val message: String) : ProductReviewsResult
}

internal sealed interface ProductRatingSummaryResult {
    data class Success(val value: ProductRatingSummary) : ProductRatingSummaryResult
    data class Failure(val message: String) : ProductRatingSummaryResult
}

internal sealed interface ProductReviewDeleteResult {
    data object Success : ProductReviewDeleteResult
    data class Failure(val message: String) : ProductReviewDeleteResult
}

internal sealed interface ProductReviewSubmitResult {
    data object Success : ProductReviewSubmitResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ProductReviewSubmitResult
}

internal class ProductReviewsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String? = { null },
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) {
    fun loadPage(productId: String, cursor: String? = null, limit: Int = DEFAULT_REVIEW_PAGE_SIZE): ProductReviewsResult {
        if (!isSafeMartIdentifier(productId) || (cursor != null && cursor.length > MAX_REVIEW_CURSOR_LENGTH) || limit !in 1..MAX_REVIEW_PAGE_SIZE) {
            return ProductReviewsResult.Failure("This review link is invalid. Refresh the product and try again.")
        }
        return request(buildProductReviewsUrl(baseUrl, productId, cursor, limit)) { body ->
            ProductReviewsResult.Success(parseProductReviewPage(body))
        } as ProductReviewsResult
    }

    fun loadRatingSummary(productId: String): ProductRatingSummaryResult {
        if (!isSafeMartIdentifier(productId)) return ProductRatingSummaryResult.Failure("This product link is invalid.")
        return try {
            openConnection(buildProductRatingSummaryUrl(baseUrl, productId)).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                setRequestProperty("Accept", "application/json")
                accessTokenProvider()?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
            }.useReviewConnection { connection ->
                val status = connection.responseCode
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readReviewResponse).orEmpty()
                if (status !in 200..299) ProductRatingSummaryResult.Failure("Ratings request failed (HTTP $status). Please try again.")
                else runCatching { ProductRatingSummaryResult.Success(parseProductRatingSummary(body)) }
                    .getOrElse { ProductRatingSummaryResult.Failure("Nantty returned rating details that could not be read.") }
            }
        } catch (_: Exception) {
            ProductRatingSummaryResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    /** Returns the signed-in account id from the authenticated profile contract, or null for guests/errors. */
    fun loadViewerAccountId(): String? {
        val token = accessTokenProvider()?.takeIf(String::isNotBlank) ?: return null
        return try {
            val url = URL("${validatedReviewsOrigin(baseUrl)}/api/v1/users/me")
            openConnection(url).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }.useReviewConnection { connection ->
                if (connection.responseCode !in 200..299) return@useReviewConnection null
                val body = connection.inputStream.use(::readReviewResponse)
                val root = JSONObject(body)
                val user = root.optJSONObject("data") ?: root
                user.optString("id").takeIf(::isSafeMartIdentifier)
            }
        } catch (_: Exception) {
            null
        }
    }

    fun deleteOwnReview(reviewId: String): ProductReviewDeleteResult {
        if (!isSafeMartIdentifier(reviewId)) return ProductReviewDeleteResult.Failure("This review link is invalid. Refresh and try again.")
        val token = accessTokenProvider()?.takeIf(String::isNotBlank)
            ?: return ProductReviewDeleteResult.Failure("Sign in to delete your review.")
        return try {
            val url = URL("${validatedReviewsOrigin(baseUrl)}/api/v1/reviews/$reviewId")
            openConnection(url).apply {
                requestMethod = "DELETE"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }.useReviewConnection { connection ->
                val status = connection.responseCode
                if (status in 200..299) ProductReviewDeleteResult.Success
                else ProductReviewDeleteResult.Failure("Couldn't delete your review (HTTP $status). Please try again.")
            }
        } catch (_: Exception) {
            ProductReviewDeleteResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    fun submitProductReview(
        productId: String,
        rating: Int,
        text: String,
        title: String?,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): ProductReviewSubmitResult {
        val cleanText = text.trim()
        val cleanTitle = title?.trim()?.takeIf(String::isNotEmpty)
        if (!isSafeMartIdentifier(productId) || rating !in 1..5 || cleanText.toByteArray(Charsets.UTF_8).size !in 1..MAX_REVIEW_TEXT_BYTES ||
            (cleanTitle?.toByteArray(Charsets.UTF_8)?.size ?: 0) > MAX_REVIEW_TITLE_BYTES || !isSafeReviewIdempotencyKey(idempotencyKey)
        ) return ProductReviewSubmitResult.Failure("Check your rating and review, then try again.")
        val token = accessTokenProvider()?.takeIf(String::isNotBlank)
            ?: return ProductReviewSubmitResult.Failure("Sign in to post your review.", authenticationRequired = true)
        return try {
            val url = URL("${validatedReviewsOrigin(baseUrl)}/api/v1/products/$productId/reviews")
            openConnection(url).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                doOutput = true
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Idempotency-Key", idempotencyKey)
            }.useReviewConnection { connection ->
                connection.outputStream.use { it.write(JSONObject().apply {
                    put("rating", rating)
                    put("text", cleanText)
                    put("title", cleanTitle ?: JSONObject.NULL)
                }.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readReviewResponse).orEmpty()
                when {
                    status in 200..299 -> ProductReviewSubmitResult.Success
                    status == 401 -> ProductReviewSubmitResult.Failure("Sign in to post your review.", authenticationRequired = true)
                    status == 409 -> ProductReviewSubmitResult.Failure("You've already reviewed this product.")
                    status == 403 -> ProductReviewSubmitResult.Failure("You can review this once your order for it is delivered.")
                    status == 400 || status == 422 -> ProductReviewSubmitResult.Failure("Check your rating and review, then try again.")
                    else -> ProductReviewSubmitResult.Failure("Couldn't post your review (HTTP $status). Check your connection and try again.")
                }
            }
        } catch (_: Exception) {
            ProductReviewSubmitResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }

    private fun request(url: URL, parse: (String) -> ProductReviewsResult): ProductReviewsResult = try {
        openConnection(url).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessTokenProvider()?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
        }.useReviewConnection { connection ->
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readReviewResponse).orEmpty()
            if (status !in 200..299) ProductReviewsResult.Failure("Reviews request failed (HTTP $status). Please try again.")
            else runCatching { parse(body) }.getOrElse { ProductReviewsResult.Failure("Nantty returned reviews that could not be read.") }
        }
    } catch (_: Exception) {
        ProductReviewsResult.Failure("Could not reach Nantty. Check your connection and try again.")
    }
}

internal fun buildProductReviewsUrl(origin: String, productId: String, cursor: String?, limit: Int): URL {
    require(isSafeMartIdentifier(productId))
    require(cursor == null || cursor.length <= MAX_REVIEW_CURSOR_LENGTH)
    require(limit in 1..MAX_REVIEW_PAGE_SIZE)
    val query = buildList {
        add("limit=$limit")
        cursor?.let { add("cursor=${URLEncoder.encode(it, "UTF-8")}") }
    }.joinToString("&")
    return URL("${validatedReviewsOrigin(origin)}/api/v1/products/$productId/reviews?$query")
}

internal fun buildProductRatingSummaryUrl(origin: String, productId: String): URL {
    require(isSafeMartIdentifier(productId))
    return URL("${validatedReviewsOrigin(origin)}/api/v1/products/$productId/rating-summary")
}

internal fun parseProductReviewPage(body: String): ProductReviewPage {
    val root = JSONObject(body)
    val average = root.optDouble("average", 0.0).takeIf { it.isFinite() && it in 0.0..5.0 } ?: 0.0
    val count = root.optInt("count", 0).coerceAtLeast(0)
    val rows = root.optJSONArray("reviews")
    val reviews = buildList {
        if (rows != null) for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optString("id")
            val rating = row.optInt("rating", 0)
            val author = row.optJSONObject("author") ?: continue
            val authorId = author.optString("id")
            if (!isSafeMartIdentifier(id) || !isSafeMartIdentifier(authorId) || rating !in 1..5) continue
            val text = row.optString("text").takeIf { it != "null" }.orEmpty()
            val replyJson = row.optJSONObject("reply")
            val reply = replyJson?.let {
                ProductReviewReply(
                    body = it.optString("body").takeUnless { value -> value == "null" }.orEmpty(),
                    authorName = it.optString("authorName").takeUnless { value -> value == "null" }.orEmpty(),
                    createdAt = it.optString("createdAt").takeUnless { value -> value == "null" }.orEmpty(),
                )
            }
            add(ProductReview(
                id = id,
                author = ProductReviewAuthor(
                    id = authorId,
                    name = author.optString("name").takeUnless { it == "null" }.orEmpty(),
                    username = author.optString("username").takeUnless { it == "null" }.orEmpty(),
                    avatarUrl = safeMediaUrl(author.optString("avatarUrl").takeUnless { it.isNullOrBlank() || it == "null" }),
                ),
                rating = rating,
                text = text,
                title = row.optString("title").takeUnless { it.isBlank() || it == "null" },
                verifiedPurchase = row.optBoolean("isVerifiedPurchase"),
                reply = reply,
                createdAt = row.optString("createdAt").takeUnless { it == "null" }.orEmpty(),
            ))
        }
    }
    return ProductReviewPage(
        average = average,
        count = count,
        reviews = reviews,
        nextCursor = root.optString("nextCursor").takeUnless { it.isBlank() || it == "null" },
    )
}

internal fun parseProductRatingSummary(body: String): ProductRatingSummary {
    val root = JSONObject(body)
    val distributionJson = root.optJSONObject("distribution")
    val distribution = (1..5).associateWith { star -> distributionJson?.optInt(star.toString(), 0)?.coerceAtLeast(0) ?: 0 }
    return ProductRatingSummary(
        average = root.optDouble("average", 0.0).takeIf { it.isFinite() && it in 0.0..5.0 } ?: 0.0,
        count = root.optInt("count", 0).coerceAtLeast(0),
        distribution = distribution,
    )
}

private fun validatedReviewsOrigin(origin: String): String {
    val parsed = runCatching { URL(origin.trim().trimEnd('/')) }.getOrElse { throw IllegalArgumentException("Invalid API URL", it) }
    val allowed = parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2")
    require(allowed && parsed.host.isNotBlank() && parsed.userInfo == null && parsed.query == null && parsed.ref == null)
    return parsed.toString().trimEnd('/')
}

private fun readReviewResponse(input: InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        require(output.size() + read <= MAX_REVIEW_RESPONSE_BYTES) { "Review response exceeded the size limit." }
        output.write(buffer, 0, read)
    }
    return output.toString(Charsets.UTF_8.name())
}

private inline fun <T> HttpURLConnection.useReviewConnection(block: (HttpURLConnection) -> T): T = try {
    block(this)
} finally {
    disconnect()
}

private const val DEFAULT_REVIEW_PAGE_SIZE = 20
private const val MAX_REVIEW_PAGE_SIZE = 50
private const val MAX_REVIEW_CURSOR_LENGTH = 300
private const val MAX_REVIEW_RESPONSE_BYTES = 1_000_000
private const val MAX_REVIEW_TEXT_BYTES = 2_000
private const val MAX_REVIEW_TITLE_BYTES = 120

private fun isSafeReviewIdempotencyKey(value: String): Boolean =
    value.length in 8..128 && value.all { it.isLetterOrDigit() || it == '-' || it == '_' }
