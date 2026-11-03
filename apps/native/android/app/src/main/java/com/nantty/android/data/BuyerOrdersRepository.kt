package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal enum class BuyerOrderFilter(val apiValue: String?, val label: String) {
    ALL(null, "All"),
    PENDING("pending", "Pending"),
    PAID("paid", "In progress"),
    SHIPPED("shipped", "Shipped"),
    DELIVERED("delivered", "Delivered"),
    COMPLETED("completed", "Completed"),
    CANCELLED("cancelled", "Cancelled"),
    DISPUTED("disputed", "Disputed"),
}

internal data class BuyerOrder(
    val id: String,
    val reference: String,
    val status: String,
    val paymentStatus: String,
    val storeName: String,
    val itemSummary: String,
    val totalMinor: Long,
    val currency: String,
    val createdAt: String,
)

internal data class BuyerOrdersPage(val orders: List<BuyerOrder>, val nextCursor: String?)

internal data class BuyerOrderItem(
    val name: String,
    val quantity: Int,
    val variant: String?,
)

internal data class BuyerOrderDetail(
    val id: String,
    val reference: String,
    val status: String,
    val fulfilmentStatus: String,
    val paymentStatus: String,
    val paymentMode: String,
    val storeName: String,
    val items: List<BuyerOrderItem>,
    val subtotalMinor: Long,
    val discountMinor: Long,
    val storeCreditMinor: Long,
    val shippingMinor: Long,
    val totalMinor: Long,
    val currency: String,
    val createdAt: String,
    val escrowReleaseAt: String?,
    val shipment: BuyerOrderShipment?,
    val delivery: BuyerOrderDelivery?,
    val promotionIssue: String?,
)

internal data class BuyerOrderShipment(
    val courierName: String,
    val trackingNumber: String,
    val trackingUrl: String?,
    val shippedAt: String,
    val estimatedDeliveryAt: String?,
)

internal data class BuyerOrderDelivery(
    val status: String,
    val riderName: String?,
    val riderPhone: String?,
    val estimatedDeliveryAt: String?,
    val attempts: Int,
    val lastAttemptNote: String?,
)

internal sealed interface BuyerOrdersResult {
    data class Success(val page: BuyerOrdersPage) : BuyerOrdersResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : BuyerOrdersResult
}

internal sealed interface BuyerOrderDetailResult {
    data class Success(val order: BuyerOrderDetail) : BuyerOrderDetailResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : BuyerOrderDetailResult
}

internal fun interface BuyerOrdersTransport {
    fun get(path: String, accessToken: String): JSONObject
}

internal class BuyerOrdersRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: BuyerOrdersTransport = JdkBuyerOrdersTransport(baseUrl),
) {
    fun load(filter: BuyerOrderFilter = BuyerOrderFilter.ALL, cursor: String? = null): BuyerOrdersResult = try {
        val session = sessionProvider() ?: error("Sign in to view your orders.")
        val token = session.accessToken.takeIf(String::isNotBlank) ?: error("Sign in to view your orders.")
        BuyerOrdersResult.Success(parsePage(transport.get(buildBuyerOrdersPath(filter, cursor), token)))
    } catch (error: Exception) {
        BuyerOrdersResult.Failure(
            when (error) {
                is BuyerOrdersHttpException -> if (error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN) {
                    "Your session has expired. Sign in again to view your orders."
                } else "Orders request failed (HTTP ${error.statusCode}). Please try again."
                else -> error.message ?: "Could not load your orders. Check your connection and try again."
            },
            authenticationRequired = error is BuyerOrdersHttpException && error.statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN),
        )
    }

    fun loadDetail(orderId: String): BuyerOrderDetailResult {
        if (!orderId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) {
            return BuyerOrderDetailResult.Failure("That order could not be found.")
        }
        return try {
        val session = sessionProvider() ?: error("Sign in to view this order.")
        val token = session.accessToken.takeIf(String::isNotBlank) ?: error("Sign in to view this order.")
        BuyerOrderDetailResult.Success(parseDetail(transport.get(buildBuyerOrderDetailPath(orderId), token)))
    } catch (error: Exception) {
        val httpError = error as? BuyerOrdersHttpException
        val authenticationRequired = httpError?.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || httpError?.statusCode == HttpURLConnection.HTTP_FORBIDDEN
        BuyerOrderDetailResult.Failure(
            when {
                authenticationRequired -> "Your session has expired. Sign in again to view this order."
                httpError?.statusCode == HttpURLConnection.HTTP_NOT_FOUND -> "That order could not be found."
                httpError != null -> "Couldn't load this order. Please try again."
                error.message?.startsWith("Sign in") == true -> error.message!!
                else -> "Couldn't load this order. Check your connection and try again."
            },
            authenticationRequired,
        )
        }
    }

    internal fun parsePage(payload: JSONObject): BuyerOrdersPage {
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete orders response.")
        val orders = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(String::isNotBlank) ?: continue
                val total = row.optJSONObject("total") ?: continue
                val currency = total.optString("currency").takeIf(String::isNotBlank) ?: continue
                val itemNames = row.optJSONArray("items").orderItemNames()
                add(
                    BuyerOrder(
                        id = id,
                        reference = row.optString("reference").takeIf(String::isNotBlank) ?: id.take(8),
                        status = row.optString("status").takeIf(String::isNotBlank) ?: "unknown",
                        paymentStatus = row.optString("paymentStatus").takeIf(String::isNotBlank) ?: "unknown",
                        storeName = row.optJSONObject("store")?.optString("name")?.takeIf(String::isNotBlank) ?: "Nantty store",
                        itemSummary = itemNames.ifEmpty { listOf("Order details") }.joinToString(", ").take(120),
                        totalMinor = total.optLong("amountMinor"),
                        currency = currency,
                        createdAt = row.optString("createdAt").takeIf(String::isNotBlank).orEmpty(),
                    ),
                )
            }
        }
        return BuyerOrdersPage(orders, payload.optString("nextCursor").takeIf { it.isNotBlank() && it != "null" })
    }

    internal fun parseDetail(payload: JSONObject): BuyerOrderDetail {
        val total = payload.optJSONObject("total") ?: error("Nantty returned an incomplete order response.")
        val currency = total.optString("currency").takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete order response.")
        val id = payload.optString("id").takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete order response.")
        val store = payload.optJSONObject("store") ?: error("Nantty returned an incomplete order response.")
        val items = payload.optJSONArray("items") ?: error("Nantty returned an incomplete order response.")
        return BuyerOrderDetail(
            id = id,
            reference = payload.optString("reference").takeIf(String::isNotBlank) ?: id.take(8),
            status = payload.optString("status").ifBlank { "unknown" },
            fulfilmentStatus = payload.optString("fulfilmentStatus").ifBlank { "unknown" },
            paymentStatus = payload.optString("paymentStatus").ifBlank { "unknown" },
            paymentMode = payload.optString("paymentMode").ifBlank { "escrow" },
            storeName = store.optString("name").takeIf(String::isNotBlank) ?: "Nantty store",
            items = buildList {
                for (index in 0 until items.length()) {
                    val row = items.optJSONObject(index) ?: continue
                    val product = row.optJSONObject("product")
                    val name = product?.optString("name")?.takeIf(String::isNotBlank) ?: continue
                    add(
                        BuyerOrderItem(
                            name = name.filterNot(Char::isISOControl).take(120),
                            quantity = row.optInt("quantity").coerceAtLeast(0),
                            variant = row.optString("variant").takeIf(String::isNotBlank),
                        ),
                    )
                }
            },
            subtotalMinor = payload.optJSONObject("subtotal")?.optLong("amountMinor") ?: 0L,
            discountMinor = payload.optJSONObject("discount")?.optLong("amountMinor") ?: 0L,
            storeCreditMinor = payload.optJSONObject("storeCredit")?.optLong("amountMinor") ?: 0L,
            shippingMinor = payload.optJSONObject("shipping")?.optLong("amountMinor") ?: 0L,
            totalMinor = total.optLong("amountMinor"),
            currency = currency,
            createdAt = payload.optString("createdAt").takeIf(String::isNotBlank).orEmpty(),
            escrowReleaseAt = payload.optString("escrowReleaseAt").takeIf(String::isNotBlank),
            shipment = payload.optJSONObject("shipment")?.let { shipment ->
                BuyerOrderShipment(
                    courierName = shipment.optString("courierName"),
                    trackingNumber = shipment.optString("trackingNumber"),
                    trackingUrl = safeTrackingUrl(shipment.optString("trackingUrl").takeIf(String::isNotBlank)),
                    shippedAt = shipment.optString("shippedAt"),
                    estimatedDeliveryAt = shipment.optString("estimatedDeliveryAt").takeIf(String::isNotBlank),
                )
            },
            delivery = payload.optJSONObject("delivery")?.let { delivery ->
                BuyerOrderDelivery(
                    status = delivery.optString("status").ifBlank { "unknown" },
                    riderName = delivery.optString("riderName").takeIf(String::isNotBlank),
                    riderPhone = delivery.optString("riderPhone").takeIf(String::isNotBlank),
                    estimatedDeliveryAt = delivery.optString("estimatedDeliveryAt").takeIf(String::isNotBlank),
                    attempts = delivery.optInt("attempts").coerceAtLeast(0),
                    lastAttemptNote = delivery.optString("lastAttemptNote").takeIf(String::isNotBlank),
                )
            },
            promotionIssue = payload.optJSONObject("promotionIssue")?.optString("message")?.takeIf(String::isNotBlank),
        )
    }

    companion object {
        const val PAGE_SIZE = 20
    }
}

private fun safeTrackingUrl(value: String?): String? = value?.let { candidate ->
    runCatching {
        val parsed = java.net.URI(candidate)
        candidate.takeIf { parsed.scheme.equals("https", ignoreCase = true) && !parsed.host.isNullOrBlank() && parsed.rawUserInfo == null }
    }.getOrNull()
}

internal fun buildBuyerOrdersPath(filter: BuyerOrderFilter, cursor: String? = null): String = buildString {
    append("/api/v1/orders?limit=${BuyerOrdersRepository.PAGE_SIZE}")
    filter.apiValue?.let { append("&status=$it") }
    cursor?.takeIf(String::isNotBlank)?.let {
        append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name()).replace("+", "%20")}")
    }
}

internal fun buildBuyerOrderDetailPath(orderId: String): String {
    require(orderId.matches(Regex("[A-Za-z0-9_-]{1,128}"))) { "That order could not be found." }
    return "/api/v1/orders/$orderId"
}

internal fun appendUniqueBuyerOrders(current: List<BuyerOrder>, incoming: List<BuyerOrder>): List<BuyerOrder> {
    val existingIds = current.asSequence().map(BuyerOrder::id).toHashSet()
    return current + incoming.filter { existingIds.add(it.id) }
}

private fun JSONArray?.orderItemNames(): List<String> {
    if (this == null) return emptyList()
    return buildList {
        for (index in 0 until length()) {
            val item = optJSONObject(index) ?: continue
            val name = item.optJSONObject("product")?.optString("name")
                ?.takeIf(String::isNotBlank)
                ?: item.optString("name").takeIf(String::isNotBlank)
                ?: continue
            add(name.filterNot(Char::isISOControl).take(48))
            if (size == 2) break
        }
    }
}

private class JdkBuyerOrdersTransport(baseUrl: String) : BuyerOrdersTransport {
    private val origin = trustedApiOrigin(baseUrl)

    override fun get(path: String, accessToken: String): JSONObject {
        require(
            path.startsWith("/api/v1/orders?limit=${BuyerOrdersRepository.PAGE_SIZE}") ||
                path.matches(Regex("/api/v1/orders/[A-Za-z0-9_-]{1,128}")),
        ) { "Unsupported buyer orders request." }
        val apiOrigin = origin ?: error("Configure an HTTPS Nantty API URL to view your orders.")
        val connection = (URL(apiOrigin + path).openConnection() as HttpURLConnection).apply {
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
            if (status !in 200..299) throw BuyerOrdersHttpException(status)
            val body = connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(4_096)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large orders response." }
                    output.write(buffer, 0, count)
                }
                output.toString(Charsets.UTF_8.name())
            }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

internal class BuyerOrdersHttpException(val statusCode: Int) : Exception()
