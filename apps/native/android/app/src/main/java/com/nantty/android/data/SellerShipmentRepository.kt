package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.UUID

internal data class SellerShipmentLocation(
    val id: String,
    val active: Boolean,
    val isDefault: Boolean,
)

internal data class SellerShipmentInput(
    val courierName: String,
    val trackingNumber: String,
    val trackingUrl: String? = null,
)

internal sealed interface SellerShipmentResult {
    data class Success(val order: SellerOrder) : SellerShipmentResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SellerShipmentResult
}

internal fun interface SellerShipmentTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject
}

/** Ships a seller order using the authenticated seller API and returns its canonical refreshed record. */
internal class SellerShipmentRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: SellerShipmentTransport = JdkSellerShipmentTransport(baseUrl),
) {
    fun markAsShipped(orderId: String, input: SellerShipmentInput, idempotencyKey: String): SellerShipmentResult {
        if (!isShipmentUuid(orderId)) return SellerShipmentResult.Failure("That seller order could not be found.")
        if (!isValidShipmentInput(input)) return SellerShipmentResult.Failure("Check the courier and tracking details, then try again.")
        if (!idempotencyKey.matches(IDEMPOTENCY_PATTERN)) {
            return SellerShipmentResult.Failure("This shipment request is invalid. Please try again.")
        }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return SellerShipmentResult.Failure("Sign in to ship this order.", authenticationRequired = true)

        return try {
            val locations = parseSellerShipmentLocations(
                transport.request("GET", LOCATIONS_PATH, session.accessToken, null, null),
            )
            val origin = locations.firstOrNull { it.active && it.isDefault }
                ?: locations.firstOrNull(SellerShipmentLocation::active)
                ?: error("Add an active store location in your seller dashboard before shipping.")
            val body = JSONObject()
                .put("courier", input.courierName.trim())
                .put("trackingNumber", input.trackingNumber)
                .put("fromLocationId", origin.id)
            input.trackingUrl?.trim()?.takeIf(String::isNotEmpty)?.let { body.put("trackingUrl", it) }
            transport.request(
                "POST",
                buildShipmentFulfilmentPath(orderId),
                session.accessToken,
                body,
                idempotencyKey,
            )
            val canonicalOrderRepository = SellerOrdersRepository(
                baseUrl = baseUrl,
                sessionProvider = { session },
                transport = SellerOrdersTransport { path, token ->
                    try {
                        transport.request("GET", path, token, null, null)
                    } catch (httpError: SellerShipmentHttpException) {
                        throw SellerOrdersHttpException(httpError.statusCode)
                    }
                },
            )
            when (val detail = canonicalOrderRepository.loadDetail(orderId)) {
                is SellerOrdersResult.Success -> SellerShipmentResult.Success(detail.value)
                is SellerOrdersResult.Failure -> SellerShipmentResult.Failure(detail.message, detail.authenticationRequired)
            }
        } catch (error: Exception) {
            val httpError = error as? SellerShipmentHttpException
            val authRequired = httpError?.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED ||
                httpError?.statusCode == HttpURLConnection.HTTP_FORBIDDEN
            SellerShipmentResult.Failure(
                when {
                    authRequired -> "Your session has expired. Sign in again to ship this order."
                    httpError?.statusCode == HttpURLConnection.HTTP_NOT_FOUND -> "That seller order or store location could not be found."
                    else -> error.message ?: "Couldn't ship this order. Check your connection and try again."
                },
                authenticationRequired = authRequired,
            )
        }
    }

    companion object {
        const val LOCATIONS_PATH = "/api/v1/seller/locations"
    }
}

internal fun parseSellerShipmentLocations(payload: JSONObject): List<SellerShipmentLocation> {
    val rows: JSONArray = payload.optJSONArray("data")
        ?: error("Nantty returned an incomplete store locations response.")
    return buildList {
        for (index in 0 until rows.length()) {
            val location = rows.optJSONObject(index) ?: continue
            val id = location.optString("id")
            if (!isShipmentUuid(id)) continue
            add(SellerShipmentLocation(id, location.optBoolean("active"), location.optBoolean("isDefault")))
        }
    }
}

internal fun buildShipmentFulfilmentPath(orderId: String): String {
    require(isShipmentUuid(orderId)) { "That seller order could not be found." }
    return "/api/v1/seller/orders/$orderId/fulfilment"
}

internal fun buildShipmentOrderPath(orderId: String): String {
    require(isShipmentUuid(orderId)) { "That seller order could not be found." }
    return "/api/v1/seller/orders/$orderId"
}

private fun isValidShipmentInput(input: SellerShipmentInput): Boolean {
    val courier = input.courierName.trim()
    if (courier.length !in 2..60 || courier.any(Char::isISOControl)) return false
    if (!input.trackingNumber.matches(TRACKING_NUMBER_PATTERN)) return false
    val trackingUrl = input.trackingUrl?.trim()?.takeIf(String::isNotEmpty) ?: return true
    if (trackingUrl.length > 300 || trackingUrl.any(Char::isWhitespace)) return false
    val uri = runCatching { URI(trackingUrl) }.getOrNull() ?: return false
    return uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.rawUserInfo == null
}

private fun isShipmentUuid(value: String): Boolean = runCatching { UUID.fromString(value).toString() == value.lowercase() }.getOrDefault(false)

private val TRACKING_NUMBER_PATTERN = Regex("^[A-Za-z0-9-]{4,40}$")
private const val MAX_IDEMPOTENCY_KEY_LENGTH = 128
private val IDEMPOTENCY_PATTERN = Regex("^[A-Za-z0-9_-]{8,$MAX_IDEMPOTENCY_KEY_LENGTH}$")

internal class SellerShipmentHttpException(val statusCode: Int) : Exception("Seller shipment request failed (HTTP $statusCode).")

private class JdkSellerShipmentTransport(baseUrl: String) : SellerShipmentTransport {
    private val origin = trustedApiOrigin(baseUrl)

    override fun request(method: String, path: String, accessToken: String, body: JSONObject?, idempotencyKey: String?): JSONObject {
        require(path == SellerShipmentRepository.LOCATIONS_PATH ||
            path.matches(Regex("^/api/v1/seller/orders/[0-9a-fA-F-]{36}(/fulfilment)?$"))) {
            "Unsupported seller shipment request."
        }
        require(method == "GET" || (method == "POST" && body != null && idempotencyKey != null)) {
            "Unsupported seller shipment operation."
        }
        val apiOrigin = origin ?: error("Configure an HTTPS Nantty API URL before shipping orders.")
        val connection = (URL(apiOrigin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Idempotency-Key", idempotencyKey)
            }
        }
        try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { reader ->
                val text = reader.readText()
                require(text.toByteArray(Charsets.UTF_8).size <= MAX_RESPONSE_BYTES) { "Nantty returned an oversized seller shipment response." }
                text
            }.orEmpty()
            if (status !in 200..299) throw SellerShipmentHttpException(status)
            if (status == HttpURLConnection.HTTP_NO_CONTENT || response.isBlank()) return JSONObject()
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }
}

private const val MAX_RESPONSE_BYTES = 1_048_576
