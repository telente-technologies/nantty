package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/** Sends the Explore/Mart interaction events only when the account's live privacy choices allow them. */
internal class ProductInteractionRepository(
    baseUrl: String,
    private val accessTokenProvider: () -> String?,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
    private val nowMillis: () -> Long = System::currentTimeMillis,
) {
    private val origin = trustedApiOrigin(baseUrl)
    private var consentToken: String? = null
    private var consentLoadedAt = 0L
    private var canPersonalize = false

    fun recordCategoryViewed(categoryId: String): Boolean = record("category.viewed", "categoryId", categoryId)

    fun recordProductClicked(productId: String): Boolean = record("product.clicked", "productId", productId)

    @Synchronized
    private fun record(event: String, idField: String, id: String): Boolean {
        val token = accessTokenProvider()?.takeIf(String::isNotBlank) ?: return false
        if (!isSafeMartIdentifier(id)) return false
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
                    .put("payload", JSONObject().put(idField, id))
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
    }
}

private fun consentUrl(origin: String): URL = URL("${origin.trimEnd('/')}/api/v1/users/me/consents")

private fun interactionEventsUrl(origin: String): URL = URL("${origin.trimEnd('/')}/api/v1/analytics/product-interactions")

private inline fun <T> HttpURLConnection.useInteractionConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
