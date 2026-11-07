package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/** Sends the Explore/Mart interaction events only when the account's live privacy choices allow them. */
class ProductInteractionRepository(
    baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String?,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
    private val nowMillis: () -> Long = System::currentTimeMillis,
) {
    private val origin = trustedApiOrigin(baseUrl)
    private var consentToken: String? = null
    private var consentLoadedAt = 0L
    private var canPersonalize = false

    fun recordCategoryViewed(categoryId: String): Boolean = record("category.viewed", JSONObject().put("categoryId", categoryId))

    fun recordProductClicked(productId: String, surface: String? = null): Boolean {
        if (surface != null && !SAFE_INTERACTION_SURFACE.matches(surface)) return false
        val payload = JSONObject().put("productId", productId)
        surface?.let { payload.put("surface", it) }
        return record("product.clicked", payload)
    }

    fun recordSearchPerformed(query: String, resultCount: Int): Boolean {
        val cleanQuery = query.trim().takeIf(String::isNotEmpty) ?: return false
        if (cleanQuery.length > MAX_SEARCH_QUERY_LENGTH || resultCount < 0) return false
        return record("search.performed", JSONObject().put("query", cleanQuery).put("resultCount", resultCount))
    }

    fun recordSearchProductClicked(productId: String, query: String, resultCount: Int): Boolean {
        val cleanQuery = query.trim().takeIf(String::isNotEmpty) ?: return false
        if (!isSafeMartIdentifier(productId) || cleanQuery.length > MAX_SEARCH_QUERY_LENGTH || resultCount < 0) return false
        return record(
            "product.clicked",
            JSONObject().put("productId", productId).put("surface", "search").put("query", cleanQuery).put("resultCount", resultCount),
        )
    }

    @Synchronized
    private fun record(event: String, payload: JSONObject): Boolean {
        val token = accessTokenProvider()?.takeIf(String::isNotBlank) ?: return false
        if (payload.has("productId") && !isSafeMartIdentifier(payload.optString("productId"))) return false
        if (payload.has("categoryId") && !isSafeMartIdentifier(payload.optString("categoryId"))) return false
        if (!hasRequiredConsent(token)) return false
        return try {
            val connection = openConnection(interactionEventsUrl(origin ?: error("Configure the Nantty API URL."))).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                doOutput = true
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }
            connection.useInteractionConnection {
                val record = JSONObject()
                    .put("event", event)
                    .put("payload", payload)
                    .put("occurredAt", Instant.now().toString())
                connection.outputStream.use { it.write(JSONObject().put("events", JSONArray().put(record)).toString().toByteArray(Charsets.UTF_8)) }
                connection.responseCode in 200..299
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun hasRequiredConsent(token: String): Boolean {
        val currentTime = nowMillis()
        if (consentToken == token && currentTime - consentLoadedAt < CONSENT_CACHE_TTL_MS) return canPersonalize
        val allowed = try {
            val connection = openConnection(consentUrl(origin ?: error("Configure the Nantty API URL."))).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                useCaches = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }
            connection.useInteractionConnection {
                if (connection.responseCode !in 200..299) return@useInteractionConnection false
                val body = connection.inputStream.use(::readInteractionResponse)
                val rows = JSONObject(body).optJSONArray("data") ?: return@useInteractionConnection false
                var analyticsGranted = false
                var personalizationGranted = false
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    if (row.optString("status") != "granted") continue
                    when (row.optString("consentType")) {
                        "analytics" -> analyticsGranted = true
                        "personalization" -> personalizationGranted = true
                    }
                }
                analyticsGranted && personalizationGranted
            }
        } catch (_: Exception) {
            false
        }
        consentToken = token
        consentLoadedAt = currentTime
        canPersonalize = allowed
        return allowed
    }

    private fun readInteractionResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        var total = 0
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            require(total <= MAX_CONSENT_RESPONSE_BYTES) { "Consent response is too large." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    companion object {
        private const val CONSENT_CACHE_TTL_MS = 60_000L
        private const val MAX_CONSENT_RESPONSE_BYTES = 256 * 1024
        private const val MAX_SEARCH_QUERY_LENGTH = 200
    }
}

private val SAFE_INTERACTION_SURFACE = Regex("^[A-Za-z0-9_.:-]{1,40}$")

private fun consentUrl(origin: String): URL = URL("${origin.trimEnd('/')}/api/v1/users/me/consents")

private fun interactionEventsUrl(origin: String): URL = URL("${origin.trimEnd('/')}/api/v1/analytics/product-interactions")

private inline fun <T> HttpURLConnection.useInteractionConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
