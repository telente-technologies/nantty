package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

internal enum class ProductReportReason(val apiValue: String) {
    SPAM("spam"),
    SCAM_OR_FRAUD("scam_or_fraud"),
    COUNTERFEIT_PRODUCT("counterfeit_product"),
    NUDITY_OR_SEXUAL_CONTENT("nudity_or_sexual_content"),
    HATE_OR_HARASSMENT("hate_or_harassment"),
    VIOLENCE("violence"),
    INTELLECTUAL_PROPERTY("intellectual_property"),
    SOMETHING_ELSE("something_else"),
}

internal sealed interface ProductReportResult {
    data class Success(val reportId: String) : ProductReportResult
    data class Failure(
        val message: String,
        val authenticationRequired: Boolean = false,
        val retryable: Boolean = true,
        val rotateIdempotencyKeyOnRetry: Boolean = false,
    ) : ProductReportResult
}

internal fun interface ProductReportTransport {
    fun submit(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject
}

internal class ProductReportRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String?,
    private val transport: ProductReportTransport = JdkProductReportTransport(baseUrl),
) {
    fun currentAccessToken(): String? = accessTokenProvider()?.takeIf(String::isNotBlank)

    fun submit(
        productId: String,
        reason: ProductReportReason,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): ProductReportResult = submitTarget("product", productId, reason, idempotencyKey, targetLabel = "product")

    fun submitSpace(
        spaceId: String,
        reason: ProductReportReason,
        details: String,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): ProductReportResult = submitTarget("space", spaceId, reason, idempotencyKey, details, targetLabel = "Space")

    /** Reports the person who authored a story; this targets their account, not the story itself. */
    fun submitUser(
        authorId: String,
        reason: ProductReportReason,
        details: String,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): ProductReportResult = submitTarget("user", authorId, reason, idempotencyKey, details, targetLabel = "account")

    private fun submitTarget(
        targetType: String,
        targetId: String,
        reason: ProductReportReason,
        idempotencyKey: String,
        details: String = "",
        targetLabel: String,
    ): ProductReportResult {
        if (!isSafeMartIdentifier(targetId)) return ProductReportResult.Failure("This $targetLabel link is invalid.")
        if (!idempotencyKey.matches(Regex("[A-Za-z0-9_-]{8,128}"))) {
            return ProductReportResult.Failure("Could not safely prepare this report. Please try again.")
        }
        if (details.toByteArray(Charsets.UTF_8).size > 500) return ProductReportResult.Failure("Report details must be 500 characters or fewer.")
        val token = currentAccessToken()
            ?: return ProductReportResult.Failure("Sign in to report this $targetLabel.", authenticationRequired = true)
        return try {
            val response = transport.submit(
                path = "/api/v1/reports",
                accessToken = token,
                idempotencyKey = idempotencyKey,
                body = JSONObject()
                    .put("targetType", targetType)
                    .put("targetId", targetId)
                    .apply { if (targetType == "user") put("reportedUserId", targetId) }
                    .put("reason", reason.apiValue)
                    .put("details", details.trim()),
            )
            val data = response.optJSONObject("data") ?: response
            val reportId = data.optString("id")
            require(reportId.isNotBlank() && data.optString("status") == "received") {
                "Nantty returned an incomplete report confirmation."
            }
            ProductReportResult.Success(reportId)
        } catch (error: ProductReportHttpException) {
            ProductReportResult.Failure(
                message = when (error.statusCode) {
                    HttpURLConnection.HTTP_UNAUTHORIZED -> {
                        val expiredTargetLabel = if (targetType == "user") targetLabel else "product"
                        "Your session has expired. Sign in again to report this $expiredTargetLabel."
                    }
                    429 -> "You've sent too many reports. Try again later."
                    HttpURLConnection.HTTP_NOT_FOUND -> "This $targetLabel can no longer be reported."
                    else -> "Couldn't submit your report. Please try again."
                },
                authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED,
                retryable = error.statusCode == 408 || error.statusCode == 429 || error.statusCode >= 500,
                rotateIdempotencyKeyOnRetry = error.statusCode == 429,
            )
        } catch (_: Exception) {
            ProductReportResult.Failure("Couldn't reach Nantty. Check your connection and try again.")
        }
    }
}

private class JdkProductReportTransport(private val baseUrl: String) : ProductReportTransport {
    override fun submit(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
        require(path == "/api/v1/reports")
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL before reporting content.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Idempotency-Key", idempotencyKey)
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val payload = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedReportResponse).orEmpty()
            if (status !in 200..299) throw ProductReportHttpException(status)
            require(payload.isNotBlank()) { "Nantty returned an empty report response." }
            return JSONObject(payload)
        } finally {
            connection.disconnect()
        }
    }
}

private fun readBoundedReportResponse(input: java.io.InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        require(output.size() + read <= 256 * 1024) { "Nantty returned an unexpectedly large report response." }
        output.write(buffer, 0, read)
    }
    return output.toString(Charsets.UTF_8.name())
}

internal class ProductReportHttpException(val statusCode: Int) : Exception()
