package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class SharedContentReference(val kind: String, val id: String)

data class SharedContentCard(
    val reference: SharedContentReference,
    val availability: String,
    val title: String?,
    val subtitle: String?,
    val imageUrl: String?,
    val priceLabel: String?,
    val stock: Int?,
    val isLive: Boolean,
    val viewerCount: Int?,
    val followsAuthor: Boolean?,
    val profileUserId: String?,
)

sealed interface SharedContentResult {
    data class Success(val card: SharedContentCard) : SharedContentResult
    data object AuthenticationRequired : SharedContentResult
    data class Failure(val message: String) : SharedContentResult
}

class SharedContentRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) {
    fun resolve(reference: SharedContentReference, accessToken: String?): SharedContentResult {
        if (accessToken.isNullOrBlank()) return SharedContentResult.AuthenticationRequired
        if (reference.kind !in setOf("post", "clip", "product", "live", "space", "store", "profile", "order") ||
            reference.id.isBlank() || reference.id.length > 200 || reference.id.any(Char::isISOControl)
        ) return SharedContentResult.Failure("This shared link is unavailable.")
        val origin = baseUrl.trim().trimEnd('/')
        val parsed = runCatching { URL(origin) }.getOrNull()
            ?: return SharedContentResult.Failure("Shared content is unavailable: the configured API address is invalid.")
        if (parsed.protocol != "https" && !(parsed.protocol == "http" && parsed.host == "10.0.2.2")) {
            return SharedContentResult.Failure("Shared content is unavailable: the API address must use HTTPS.")
        }
        return try {
            val query = "kind=${java.net.URLEncoder.encode(reference.kind, Charsets.UTF_8.name())}&id=${java.net.URLEncoder.encode(reference.id, Charsets.UTF_8.name())}"
            val connection = openConnection(URL("$origin/api/v1/chat/content?$query"))
            connection.apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $accessToken")
            }
            connection.useSharedContentConnection {
                val status = connection.responseCode
                if (status == HttpURLConnection.HTTP_UNAUTHORIZED || status == HttpURLConnection.HTTP_FORBIDDEN) {
                    return@useSharedContentConnection SharedContentResult.AuthenticationRequired
                }
                val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (status !in 200..299) return@useSharedContentConnection SharedContentResult.Failure("This shared content could not be loaded.")
                val root = runCatching { JSONObject(body) }.getOrNull()
                    ?: return@useSharedContentConnection SharedContentResult.Failure("This shared content could not be loaded.")
                val nested = root.optJSONObject("data") ?: root
                val cardReference = nested.optJSONObject("reference")
                SharedContentResult.Success(
                    SharedContentCard(
                        reference = SharedContentReference(
                            kind = cardReference?.optString("kind")?.takeIf(String::isNotBlank) ?: reference.kind,
                            id = cardReference?.optString("id")?.takeIf(String::isNotBlank) ?: reference.id,
                        ),
                        availability = nested.optString("availability", "unavailable"),
                        title = nested.sharedNullableString("title"),
                        subtitle = nested.sharedNullableString("subtitle"),
                        imageUrl = safeMediaUrl(nested.sharedNullableString("imageUrl")),
                        priceLabel = nested.sharedNullableString("priceLabel"),
                        stock = if (nested.has("stock") && !nested.isNull("stock")) nested.optInt("stock").coerceAtLeast(0) else null,
                        isLive = nested.optBoolean("isLive"),
                        viewerCount = if (nested.has("viewerCount") && !nested.isNull("viewerCount")) nested.optInt("viewerCount").coerceAtLeast(0) else null,
                        followsAuthor = if (nested.has("followsAuthor") && !nested.isNull("followsAuthor")) nested.optBoolean("followsAuthor") else null,
                        profileUserId = nested.sharedNullableString("profileUserId"),
                    ),
                )
            }
        } catch (_: Exception) {
            SharedContentResult.Failure("Could not reach Nantty. Check your connection and try again.")
        }
    }
}

private fun JSONObject.sharedNullableString(key: String): String? = optString(key).takeUnless { it.isBlank() || it == "null" }

private inline fun <T> HttpURLConnection.useSharedContentConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
