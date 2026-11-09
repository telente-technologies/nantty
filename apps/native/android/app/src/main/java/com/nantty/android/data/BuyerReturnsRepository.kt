package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal data class BuyerReturnLineRequest(val orderItemId: String, val quantity: Int)

internal data class BuyerReturnReceipt(
    val id: String,
    val orderId: String,
    val status: String,
    val reason: String,
    val createdAt: String?,
)

internal sealed interface BuyerReturnStatusResult {
    data class Success(val request: BuyerReturnReceipt?) : BuyerReturnStatusResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : BuyerReturnStatusResult
}

internal sealed interface BuyerOrderReturnRequestResult {
    data class Success(val receipt: BuyerReturnReceipt) : BuyerOrderReturnRequestResult
    data class Failure(
        val message: String,
        val authenticationRequired: Boolean = false,
        val conflict: Boolean = false,
    ) : BuyerOrderReturnRequestResult
}

internal interface BuyerReturnsTransport {
    fun get(path: String, accessToken: String): JSONObject
    fun post(path: String, accessToken: String, body: JSONObject): JSONObject
}

internal class BuyerReturnsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: BuyerReturnsTransport = JdkBuyerReturnsTransport(baseUrl),
) {
    fun loadForOrder(orderId: String): BuyerReturnStatusResult {
        if (!isSafeOrderId(orderId)) return BuyerReturnStatusResult.Failure("That order could not be found.")
        val token = accessToken() ?: return BuyerReturnStatusResult.Failure(
            "Sign in to check return requests.", authenticationRequired = true,
        )
        return try {
            var cursor: String? = null
            var pages = 0
            var latestForOrder: BuyerReturnReceipt? = null
            do {
                val page = transport.get(buildBuyerReturnsPath(cursor), token)
                val rows = page.optJSONArray("data") ?: error("Nantty returned an incomplete returns response.")
                val matching = rows.parseBuyerReturns().filter { it.orderId == orderId }
                matching.firstOrNull { it.status in ACTIVE_RETURN_STATUSES }?.let {
                    return BuyerReturnStatusResult.Success(it)
                }
                if (latestForOrder == null) latestForOrder = matching.firstOrNull()
                cursor = page.optString("nextCursor").takeUnless { it.isBlank() || it == "null" }
                pages += 1
            } while (cursor != null && pages < MAX_RETURN_PAGES)

            if (cursor != null) BuyerReturnStatusResult.Failure("Couldn't verify existing return requests. Try again.")
            else BuyerReturnStatusResult.Success(latestForOrder)
        } catch (error: Exception) {
            BuyerReturnStatusResult.Failure(error.friendlyReturnError("check return requests"), error.isAuthenticationError())
        }
    }

    fun requestReturn(orderId: String, lines: List<BuyerReturnLineRequest>, reason: String): BuyerOrderReturnRequestResult {
        val normalizedReason = reason.trim()
        if (!isSafeOrderId(orderId) || normalizedReason.length !in MIN_RETURN_REASON_LENGTH..MAX_RETURN_REASON_LENGTH ||
            lines.size !in 1..MAX_RETURN_LINES ||
            lines.any { !BUYER_RETURN_UUID_PATTERN.matches(it.orderItemId) || it.quantity !in 1..MAX_RETURN_QUANTITY } ||
            lines.map(BuyerReturnLineRequest::orderItemId).distinct().size != lines.size
        ) return BuyerOrderReturnRequestResult.Failure("Check the selected items and return reason, then try again.")

        val token = accessToken() ?: return BuyerOrderReturnRequestResult.Failure(
            "Sign in to request a return.", authenticationRequired = true,
        )
        return try {
            val body = JSONObject()
                .put("reason", normalizedReason)
                .put("lines", JSONArray().apply {
                    lines.forEach { line -> put(JSONObject().put("orderItemId", line.orderItemId).put("quantity", line.quantity)) }
                })
            BuyerOrderReturnRequestResult.Success(
                parseBuyerReturnReceipt(transport.post(buildBuyerOrderReturnPath(orderId), token, body), orderId),
            )
        } catch (error: Exception) {
            val status = (error as? BuyerOrdersHttpException)?.statusCode
            BuyerOrderReturnRequestResult.Failure(
                message = when (status) {
                    401, 403 -> "Your session has expired. Sign in again to request a return."
                    404 -> "That order could not be found."
                    409 -> "This order is no longer eligible for a return, or it already has an active return request. Refresh the order and try again."
                    422 -> "The selected items or quantities are no longer valid. Refresh the order and try again."
                    null -> "Couldn't submit the return request. Check your connection and try again."
                    else -> "Couldn't submit the return request. Please try again."
                },
                authenticationRequired = status == 401 || status == 403,
                conflict = status == 409,
            )
        }
    }

    private fun accessToken(): String? = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)

    companion object {
        const val MIN_RETURN_REASON_LENGTH = 5
        const val MAX_RETURN_REASON_LENGTH = 500
        const val MAX_RETURN_LINES = 50
        const val MAX_RETURN_QUANTITY = 99
        const val PAGE_SIZE = 100
        private const val MAX_RETURN_PAGES = 25
    }
}

internal fun buildBuyerOrderReturnPath(orderId: String): String {
    require(isSafeOrderId(orderId)) { "That order could not be found." }
    return "/api/v1/orders/$orderId/returns"
}

internal fun buildBuyerReturnsPath(cursor: String? = null): String = buildString {
    append("/api/v1/returns?limit=${BuyerReturnsRepository.PAGE_SIZE}")
    cursor?.takeIf(String::isNotBlank)?.let {
        append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name()).replace("+", "%20")}")
    }
}

internal fun buyerCanRequestReturn(status: String): Boolean = status == "delivered" || status == "completed"

private val BUYER_RETURN_UUID_PATTERN = Regex("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
private val ACTIVE_RETURN_STATUSES = setOf("requested", "approved")

private fun isSafeOrderId(value: String): Boolean = value.matches(Regex("[A-Za-z0-9_-]{1,128}"))

private fun JSONArray.parseBuyerReturns(): List<BuyerReturnReceipt> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: continue
        val id = row.optString("id").takeIf(BUYER_RETURN_UUID_PATTERN::matches) ?: continue
        val orderId = row.optString("orderId").takeIf(::isSafeOrderId) ?: continue
        val status = row.optString("status").takeIf(String::isNotBlank) ?: continue
        add(
            BuyerReturnReceipt(
                id = id,
                orderId = orderId,
                status = status,
                reason = row.optString("reason").takeIf(String::isNotBlank).orEmpty(),
                createdAt = row.optString("createdAt").takeIf { it.isNotBlank() && it != "null" },
            ),
        )
    }
}

private fun parseBuyerReturnReceipt(payload: JSONObject, expectedOrderId: String): BuyerReturnReceipt {
    val id = payload.optString("id").takeIf(BUYER_RETURN_UUID_PATTERN::matches)
        ?: error("Nantty returned an invalid return request.")
    val orderId = payload.optString("orderId").takeIf(::isSafeOrderId)
        ?: error("Nantty returned an incomplete return request.")
    require(orderId == expectedOrderId) { "Nantty returned a request for a different order." }
    val status = payload.optString("status").takeIf { it == "requested" }
        ?: error("Nantty could not confirm the return request.")
    return BuyerReturnReceipt(
        id = id,
        orderId = orderId,
        status = status,
        reason = payload.optString("reason").takeIf(String::isNotBlank).orEmpty(),
        createdAt = payload.optString("createdAt").takeIf { it.isNotBlank() && it != "null" },
    )
}

private fun Exception.isAuthenticationError(): Boolean =
    this is BuyerOrdersHttpException && statusCode in setOf(401, 403)

private fun Exception.friendlyReturnError(action: String): String = when (this) {
    is BuyerOrdersHttpException -> when (statusCode) {
        401, 403 -> "Your session has expired. Sign in again to $action."
        else -> "Couldn't $action. Please try again."
    }
    else -> "Couldn't $action. Check your connection and try again."
}

private class JdkBuyerReturnsTransport(baseUrl: String) : BuyerReturnsTransport {
    private val origin = trustedApiOrigin(baseUrl)

    override fun get(path: String, accessToken: String): JSONObject {
        require(path.matches(Regex("/api/v1/returns\\?limit=100(?:&cursor=[A-Za-z0-9%._~-]+)?"))) {
            "Unsupported buyer returns request."
        }
        return request("GET", path, accessToken, null)
    }

    override fun post(path: String, accessToken: String, body: JSONObject): JSONObject {
        require(path.matches(Regex("/api/v1/orders/[A-Za-z0-9_-]{1,128}/returns"))) {
            "Unsupported buyer return request."
        }
        return request("POST", path, accessToken, body)
    }

    private fun request(method: String, path: String, token: String, body: JSONObject?): JSONObject {
        val apiOrigin = origin ?: error("Configure an HTTPS Nantty API URL to manage return requests.")
        val connection = (URL(apiOrigin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            body?.let { connection.outputStream.use { output -> output.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            if (status !in 200..299) throw BuyerOrdersHttpException(status)
            val response = connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(4_096)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large returns response." }
                    output.write(buffer, 0, count)
                }
                output.toString(Charsets.UTF_8.name())
            }
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val MAX_RESPONSE_BYTES = 1_048_576
    }
}
