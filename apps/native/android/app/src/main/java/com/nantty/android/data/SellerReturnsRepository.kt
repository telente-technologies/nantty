package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

internal data class SellerReturnReceiptInput(val restock: Boolean, val locationId: String?)

internal fun interface SellerReturnsTransport {
    fun request(
        method: String,
        path: String,
        accessToken: String,
        storeId: String,
        body: JSONObject?,
    ): JSONObject
}

/** Store-scoped seller return operations. The Go StoreMember middleware remains authoritative. */
internal class SellerReturnsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: SellerReturnsTransport = JdkSellerReturnsTransport(baseUrl),
) {
    fun load(
        storeId: String,
        status: SellerReturnStatus = SellerReturnStatus.ALL,
        cursor: String? = null,
        limit: Int = PAGE_SIZE,
    ): SellerReturnsResult<SellerReturnsPage> {
        if (!isSellerReturnsUuid(storeId)) return SellerReturnsResult.Failure("Seller return requests could not be loaded.")
        val path = runCatching { buildSellerReturnsPagePath(status, cursor, limit) }.getOrElse {
            return SellerReturnsResult.Failure("Seller return requests could not be loaded.")
        }
        val token = accessToken() ?: return SellerReturnsResult.Failure(
            "Sign in to view seller return requests.", authenticationRequired = true,
        )
        return try {
            val payload = transport.request("GET", path, token, storeId, null)
            val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete seller returns page.")
            val nextCursor = payload.optNullableSellerReturnsString("nextCursor")
            SellerReturnsResult.Success(SellerReturnsPage(rows.parseSellerReturns(), nextCursor))
        } catch (error: Exception) {
            error.toSellerReturnsFailure("load seller return requests")
        }
    }

    fun loadLocations(storeId: String): SellerReturnsResult<List<SellerReturnLocation>> {
        if (!isSellerReturnsUuid(storeId)) return SellerReturnsResult.Failure("Store locations could not be loaded.")
        val token = accessToken() ?: return SellerReturnsResult.Failure(
            "Sign in to load store locations.", authenticationRequired = true,
        )
        return try {
            val rows = transport.request("GET", LOCATIONS_PATH, token, storeId, null)
                .optJSONArray("data") ?: error("Nantty returned an incomplete store locations response.")
            SellerReturnsResult.Success(rows.parseSellerReturnLocations().filter(SellerReturnLocation::active))
        } catch (error: Exception) {
            error.toSellerReturnsFailure("load store locations")
        }
    }

    fun approve(storeId: String, returnId: String): SellerReturnsResult<SellerReturnRequest> = mutate(
        storeId, returnId, "approve", null,
    )

    fun decline(storeId: String, returnId: String, note: String): SellerReturnsResult<SellerReturnRequest> {
        val normalized = note.trim()
        if (!isValidSellerReturnDeclineNote(normalized)) {
            return SellerReturnsResult.Failure("Enter a decline note between 5 and 500 characters.")
        }
        return mutate(storeId, returnId, "decline", JSONObject().put("note", normalized))
    }

    fun receive(storeId: String, returnId: String, input: SellerReturnReceiptInput): SellerReturnsResult<SellerReturnRequest> {
        if (input.restock && input.locationId?.let(::isSellerReturnsUuid) != true) {
            return SellerReturnsResult.Failure("Choose an active store location to restock returned items.")
        }
        if (!input.restock && input.locationId != null) {
            return SellerReturnsResult.Failure("A restock location can only be sent when restocking is enabled.")
        }
        val body = JSONObject().put("restock", input.restock)
            .put("locationId", input.locationId ?: JSONObject.NULL)
        return mutate(storeId, returnId, "receive", body)
    }

    private fun mutate(
        storeId: String,
        returnId: String,
        action: String,
        body: JSONObject?,
    ): SellerReturnsResult<SellerReturnRequest> {
        if (!isSellerReturnsUuid(storeId) || !isSellerReturnsUuid(returnId)) {
            return SellerReturnsResult.Failure("That return request could not be found.")
        }
        val token = accessToken() ?: return SellerReturnsResult.Failure(
            "Sign in to manage seller return requests.", authenticationRequired = true,
        )
        return try {
            val payload = transport.request("POST", "$RETURNS_PATH/$returnId/$action", token, storeId, body)
            val value = payload.optJSONObject("data") ?: payload
            val updated = parseSellerReturn(value)
            require(updated.id == returnId) { "Nantty returned a different return request." }
            SellerReturnsResult.Success(updated)
        } catch (error: Exception) {
            error.toSellerReturnsFailure("$action this return request")
        }
    }

    private fun accessToken(): String? = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)

    companion object {
        const val RETURNS_PATH = "/api/v1/seller/returns"
        const val LOCATIONS_PATH = "/api/v1/seller/locations"
        const val PAGE_SIZE = 25
        const val MAX_PAGE_SIZE = 100
        const val MIN_NOTE_LENGTH = 5
        const val MAX_NOTE_LENGTH = 500
        const val MIN_REASON_LENGTH = 5
        const val MAX_REASON_LENGTH = 500
        const val MAX_CURSOR_LENGTH = 512
    }
}

internal fun buildSellerReturnsPagePath(
    status: SellerReturnStatus = SellerReturnStatus.ALL,
    cursor: String? = null,
    limit: Int = SellerReturnsRepository.PAGE_SIZE,
): String {
    require(limit in 1..SellerReturnsRepository.MAX_PAGE_SIZE)
    require(cursor == null || (cursor.isNotBlank() && cursor.length <= SellerReturnsRepository.MAX_CURSOR_LENGTH && cursor.none(Char::isISOControl)))
    return buildString {
        append(SellerReturnsRepository.RETURNS_PATH).append("?limit=").append(limit)
        status.apiValue?.let { append("&status=").append(URLEncoder.encode(it, Charsets.UTF_8.name())) }
        cursor?.let { append("&cursor=").append(URLEncoder.encode(it, Charsets.UTF_8.name()).replace("+", "%20")) }
    }
}

internal fun parseSellerReturn(payload: JSONObject): SellerReturnRequest {
    val lines = payload.optJSONArray("lines") ?: error("Nantty returned incomplete return lines.")
    val money = payload.optJSONObject("refundAmount") ?: error("Nantty returned an incomplete refund amount.")
    val amount = money.opt("amountMinor")
    require(amount is Number && amount.toLong() >= 0) { "Nantty returned an invalid refund amount." }
    val currency = money.optString("currency")
    require(currency.matches(Regex("^[A-Z]{3}$"))) { "Nantty returned an invalid refund currency." }
    val status = payload.requiredSellerReturnsString("status")
    require(status in SELLER_RETURN_STATUSES) { "Nantty returned an unknown return status." }
    val reason = payload.requiredSellerReturnsString("reason")
    require(sellerReturnUtf8Length(reason.trim()) in SellerReturnsRepository.MIN_REASON_LENGTH..SellerReturnsRepository.MAX_REASON_LENGTH) {
        "Nantty returned an invalid return reason."
    }
    return SellerReturnRequest(
        id = payload.requiredSellerReturnsUuid("id"),
        orderId = payload.requiredSellerReturnsUuid("orderId"),
        orderNumber = payload.requiredSellerReturnsString("orderNumber"),
        buyerName = payload.requiredSellerReturnsString("buyerName"),
        lines = lines.parseSellerReturnLines(),
        reason = reason,
        status = status,
        declineNote = payload.optNullableSellerReturnsString("declineNote"),
        refundAmount = SellerReturnMoney(amount.toLong(), currency),
        createdAt = payload.requiredSellerReturnsString("createdAt"),
    )
}

private fun JSONArray.parseSellerReturns(): List<SellerReturnRequest> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: error("Nantty returned an invalid seller return request.")
        add(parseSellerReturn(row))
    }
}

private fun JSONArray.parseSellerReturnLines(): List<SellerReturnLine> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: error("Nantty returned an invalid returned item.")
        val quantity = row.opt("quantity")
        require(quantity is Number && quantity.toInt() in 1..99 && quantity.toDouble() == quantity.toInt().toDouble()) {
            "Nantty returned an invalid returned item quantity."
        }
        add(SellerReturnLine(
            orderLineId = row.requiredSellerReturnsUuid("orderLineId"),
            name = row.optString("name").ifBlank { "Item" },
            quantity = quantity.toInt(),
        ))
    }
    require(isNotEmpty()) { "Nantty returned a seller return request without items." }
}

private fun JSONArray.parseSellerReturnLocations(): List<SellerReturnLocation> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: error("Nantty returned an invalid store location.")
        add(SellerReturnLocation(
            id = row.requiredSellerReturnsUuid("id"),
            name = row.requiredSellerReturnsString("name"),
            city = row.optString("city"),
            state = row.optString("state"),
            active = row.optBoolean("active"),
            isDefault = row.optBoolean("isDefault"),
        ))
    }
}

private fun JSONObject.requiredSellerReturnsString(key: String): String = optString(key).takeIf(String::isNotBlank)
    ?: error("Nantty returned an incomplete seller return request.")

private fun JSONObject.requiredSellerReturnsUuid(key: String): String = requiredSellerReturnsString(key).also {
    require(isSellerReturnsUuid(it)) { "Nantty returned an invalid seller return identifier." }
}

private fun JSONObject.optNullableSellerReturnsString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun isSellerReturnsUuid(value: String): Boolean = runCatching {
    UUID.fromString(value).toString() == value.lowercase()
}.getOrDefault(false)

internal fun sellerReturnUtf8Length(value: String): Int = value.toByteArray(Charsets.UTF_8).size

internal fun isValidSellerReturnDeclineNote(value: String): Boolean =
    sellerReturnUtf8Length(value.trim()) in SellerReturnsRepository.MIN_NOTE_LENGTH..SellerReturnsRepository.MAX_NOTE_LENGTH

private fun Exception.toSellerReturnsFailure(action: String): SellerReturnsResult.Failure {
    val status = (this as? SellerReturnsHttpException)?.statusCode
    return SellerReturnsResult.Failure(
        message = when (status) {
            401 -> "Your session has expired. Sign in again to $action."
            403 -> "Your store access does not allow you to $action."
            404 -> "That return request or store location could not be found. Refresh and try again."
            409 -> "The return request has changed and this action is no longer available. Refresh the list."
            422 -> "The return details are no longer valid. Refresh and try again."
            null -> "Couldn't $action. Check your connection and try again."
            else -> "Couldn't $action. Please try again."
        },
        authenticationRequired = status == HttpURLConnection.HTTP_UNAUTHORIZED,
        permissionDenied = status == HttpURLConnection.HTTP_FORBIDDEN,
        conflict = status == HttpURLConnection.HTTP_CONFLICT,
    )
}

internal class SellerReturnsHttpException(val statusCode: Int) : Exception("Seller returns request failed (HTTP $statusCode).")

private class JdkSellerReturnsTransport(baseUrl: String) : SellerReturnsTransport {
    private val origin = trustedApiOrigin(baseUrl)

    override fun request(method: String, path: String, accessToken: String, storeId: String, body: JSONObject?): JSONObject {
        require(isSellerReturnsUuid(storeId)) { "Invalid seller store context." }
        require(method == "GET" || method == "POST") { "Unsupported seller returns operation." }
        require(path == SellerReturnsRepository.LOCATIONS_PATH || path.matches(RETURNS_PATH_PATTERN)) {
            "Unsupported seller returns request."
        }
        val pagePath = path.matches(Regex("^/api/v1/seller/returns(?:\\?[^#]*)?$"))
        val actionPath = path.matches(Regex("^/api/v1/seller/returns/[0-9a-fA-F-]{36}/(?:approve|decline|receive)$"))
        require((method == "GET" && body == null && (pagePath || path == SellerReturnsRepository.LOCATIONS_PATH)) ||
            (method == "POST" && actionPath)) {
            "Unsupported seller returns operation."
        }
        val apiOrigin = origin ?: error("Configure an HTTPS Nantty API URL to manage returns.")
        val connection = (URL(apiOrigin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("X-Seller-Store", storeId)
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            body?.let { request -> connection.outputStream.use { it.write(request.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val output = ByteArrayOutputStream()
            stream?.use { input ->
                val buffer = ByteArray(4_096)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an oversized seller returns response." }
                    output.write(buffer, 0, count)
                }
            }
            if (status !in 200..299) throw SellerReturnsHttpException(status)
            val response = output.toString(Charsets.UTF_8.name())
            require(response.isNotBlank()) { "Nantty returned an empty seller returns response." }
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        val RETURNS_PATH_PATTERN = Regex("^/api/v1/seller/returns(?:\\?[^#]*)?(?:/[0-9a-fA-F-]{36}/(?:approve|decline|receive))?$")
        const val MAX_RESPONSE_BYTES = 2_097_152
    }
}

private val SELLER_RETURN_STATUSES = setOf("requested", "approved", "declined", "refunded")
