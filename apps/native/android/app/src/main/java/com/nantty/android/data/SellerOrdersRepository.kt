package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal data class SellerOrderMoney(val amountMinor: Long, val currency: String)
internal data class SellerOrderBuyer(val id: String, val name: String, val username: String, val phone: String?)
internal data class SellerOrderAddress(
    val recipientName: String,
    val phone: String,
    val line1: String,
    val city: String,
    val state: String,
    val country: String,
)
internal data class SellerOrderLine(
    val id: String,
    val productId: String,
    val variantId: String,
    val name: String,
    val variantTitle: String,
    val sku: String,
    val imageUrl: String?,
    val quantity: Int,
    val unitPrice: SellerOrderMoney,
    val lineTotal: SellerOrderMoney,
)
internal data class SellerOrderFulfilment(
    val courier: String,
    val trackingNumber: String,
    val trackingUrl: String?,
    val shippedAt: String,
    val fromLocationId: String,
)
internal data class SellerOrderDelivery(
    val status: String,
    val riderName: String?,
    val riderPhone: String?,
    val estimatedDeliveryAt: String?,
    val attempts: Int,
    val lastAttemptNote: String?,
)
internal data class SellerOrderTimelineEvent(
    val id: String,
    val kind: String,
    val summary: String,
    val actorName: String?,
    val createdAt: String,
)
internal data class SellerOrderNote(val id: String, val body: String, val authorName: String, val createdAt: String)
internal data class SellerOrderRefund(val id: String, val amount: SellerOrderMoney, val reason: String, val createdAt: String)
internal data class SellerOrderAttributedCreator(val id: String, val username: String)

internal data class SellerOrder(
    val id: String,
    val orderNumber: String,
    val invoiceNumber: String,
    val buyer: SellerOrderBuyer,
    val shippingAddress: SellerOrderAddress,
    val lines: List<SellerOrderLine>,
    val subtotal: SellerOrderMoney,
    val discount: SellerOrderMoney,
    val storeCredit: SellerOrderMoney,
    val shippingFee: SellerOrderMoney,
    val total: SellerOrderMoney,
    val sellerPayout: SellerOrderMoney,
    val status: String,
    val escrowStatus: String,
    val escrowReleaseAt: String?,
    val fulfilment: SellerOrderFulfilment?,
    val attributedCreator: SellerOrderAttributedCreator?,
    val createdAt: String,
    val deliveredAt: String?,
    val paymentStatus: String,
    val paymentMode: String,
    val paymentProvider: String,
    val paymentReference: String,
    val paidAt: String?,
    val refundedAmount: SellerOrderMoney,
    val refunds: List<SellerOrderRefund>,
    val delivery: SellerOrderDelivery,
    val timeline: List<SellerOrderTimelineEvent>,
    val notes: List<SellerOrderNote>,
    val conversationId: String?,
)

internal data class SellerOrdersPage(
    val orders: List<SellerOrder>,
    val nextCursor: String?,
    val countsByStatus: Map<String, Int>,
)

internal sealed interface SellerOrdersResult<out T> {
    data class Success<T>(val value: T) : SellerOrdersResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SellerOrdersResult<Nothing>
}

internal fun interface SellerOrdersTransport {
    fun get(path: String, accessToken: String): JSONObject
}

/** Authenticated read-only seller-order access matching the React Native seller service. */
internal class SellerOrdersRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: SellerOrdersTransport = JdkSellerOrdersTransport(baseUrl),
) {
    fun load(): SellerOrdersResult<SellerOrdersPage> = request(SELLER_ORDERS_PATH, "view seller orders") { payload ->
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete seller order list.")
        val countsObject = payload.optJSONObject("countsByStatus") ?: error("Nantty returned incomplete seller order counts.")
        val counts = buildMap {
            val keys = countsObject.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val value = countsObject.opt(key)
                require(value is Number && value.toLong() in 0..Int.MAX_VALUE.toLong()) {
                    "Nantty returned invalid seller order counts."
                }
                put(key, value.toInt())
            }
        }
        SellerOrdersPage(
            orders = rows.parseSellerOrders(),
            nextCursor = payload.optNullableSellerString("nextCursor"),
            countsByStatus = counts,
        )
    }

    fun loadDetail(orderId: String): SellerOrdersResult<SellerOrder> {
        if (orderId.isBlank() || orderId.length > MAX_ORDER_ID_LENGTH || orderId.any(Char::isISOControl)) {
            return SellerOrdersResult.Failure("That order could not be found.")
        }
        return request(buildSellerOrderDetailPath(orderId), "view this seller order") { payload ->
            val value = payload.optJSONObject("data") ?: payload
            parseSellerOrder(value).also { require(it.id == orderId) { "Nantty returned a different seller order." } }
        }
    }

    private inline fun <T> request(path: String, action: String, parse: (JSONObject) -> T): SellerOrdersResult<T> {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return SellerOrdersResult.Failure("Sign in to $action.", authenticationRequired = true)
        return try {
            SellerOrdersResult.Success(parse(transport.get(path, token)))
        } catch (error: Exception) {
            val httpError = error as? SellerOrdersHttpException
            val authRequired = httpError?.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED ||
                httpError?.statusCode == HttpURLConnection.HTTP_FORBIDDEN
            SellerOrdersResult.Failure(
                when {
                    authRequired -> "Your session has expired. Sign in again to $action."
                    httpError?.statusCode == HttpURLConnection.HTTP_NOT_FOUND -> "That seller order could not be found."
                    httpError != null -> "Couldn't $action. Please try again."
                    else -> error.message ?: "Couldn't $action. Check your connection and try again."
                },
                authenticationRequired = authRequired,
            )
        }
    }

    internal fun parseSellerOrder(payload: JSONObject): SellerOrder = parseSellerOrderRecord(payload)

    companion object { const val SELLER_ORDERS_PATH = "/api/v1/seller/orders" }
}

internal fun buildSellerOrderDetailPath(orderId: String): String {
    require(orderId.isNotBlank() && orderId.length <= MAX_ORDER_ID_LENGTH && orderId.none(Char::isISOControl)) {
        "That order could not be found."
    }
    return "${SellerOrdersRepository.SELLER_ORDERS_PATH}/${URLEncoder.encode(orderId, Charsets.UTF_8.name()).replace("+", "%20")}"
}

private const val MAX_ORDER_ID_LENGTH = 128
private const val SELLER_ORDERS_PATH = SellerOrdersRepository.SELLER_ORDERS_PATH

internal class SellerOrdersHttpException(val statusCode: Int) : Exception("Seller orders request failed (HTTP $statusCode).")

private class JdkSellerOrdersTransport(baseUrl: String) : SellerOrdersTransport {
    private val origin = trustedApiOrigin(baseUrl)

    override fun get(path: String, accessToken: String): JSONObject {
        require(path == SELLER_ORDERS_PATH || path.startsWith("$SELLER_ORDERS_PATH/")) {
            "Unsupported seller orders request."
        }
        val apiOrigin = origin ?: error("Configure an HTTPS Nantty API URL to view seller orders.")
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
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { reader ->
                val text = reader.readText()
                require(text.toByteArray(Charsets.UTF_8).size <= MAX_RESPONSE_BYTES) { "Nantty returned an oversized seller orders response." }
                text
            }.orEmpty()
            if (status !in 200..299) throw SellerOrdersHttpException(status)
            require(body.isNotBlank()) { "Nantty returned an empty seller orders response." }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }
}

private const val MAX_RESPONSE_BYTES = 2_097_152

private fun parseSellerOrderRecord(payload: JSONObject): SellerOrder {
    val buyer = payload.requiredSellerObject("buyer")
    val address = payload.requiredSellerObject("shippingAddress")
    val delivery = payload.requiredSellerObject("delivery")
    val attributedCreator = payload.optJSONObject("attributedCreator")?.let {
        SellerOrderAttributedCreator(it.requiredSellerString("id"), it.requiredSellerString("username"))
    }
    return SellerOrder(
            id = payload.requiredSellerString("id"),
            orderNumber = payload.requiredSellerString("orderNumber"),
            invoiceNumber = payload.requiredSellerString("invoiceNumber"),
            buyer = SellerOrderBuyer(
                buyer.requiredSellerString("id"), buyer.requiredSellerString("name"),
                buyer.requiredSellerString("username"), buyer.optNullableSellerString("phone"),
            ),
            shippingAddress = SellerOrderAddress(
                address.requiredSellerString("recipientName"), address.requiredSellerString("phone"),
                address.requiredSellerString("line1"), address.requiredSellerString("city"),
                address.requiredSellerString("state"), address.requiredSellerString("country"),
            ),
            lines = payload.requiredSellerArray("lines").parseSellerLines(),
            subtotal = payload.requiredSellerMoney("subtotal"),
            discount = payload.requiredSellerMoney("discount"),
            storeCredit = payload.requiredSellerMoney("storeCredit"),
            shippingFee = payload.requiredSellerMoney("shippingFee"),
            total = payload.requiredSellerMoney("total"),
            sellerPayout = payload.requiredSellerMoney("sellerPayout"),
            status = payload.requiredSellerString("status"),
            escrowStatus = payload.requiredSellerString("escrowStatus"),
            escrowReleaseAt = payload.optNullableSellerString("escrowReleaseAt"),
            fulfilment = payload.optJSONObject("fulfilment")?.let(::parseSellerFulfilment),
            attributedCreator = attributedCreator,
            createdAt = payload.requiredSellerString("createdAt"),
            deliveredAt = payload.optNullableSellerString("deliveredAt"),
            paymentStatus = payload.requiredSellerString("paymentStatus"),
            paymentMode = payload.requiredSellerString("paymentMode"),
            paymentProvider = payload.requiredSellerString("paymentProvider"),
            paymentReference = payload.requiredSellerString("paymentReference"),
            paidAt = payload.optNullableSellerString("paidAt"),
            refundedAmount = payload.requiredSellerMoney("refundedAmount"),
            refunds = payload.requiredSellerArray("refunds").parseSellerRefunds(),
            delivery = SellerOrderDelivery(
                delivery.requiredSellerString("status"), delivery.optNullableSellerString("riderName"),
                delivery.optNullableSellerString("riderPhone"), delivery.optNullableSellerString("estimatedDeliveryAt"),
                delivery.requiredSellerInt("attempts"), delivery.optNullableSellerString("lastAttemptNote"),
            ),
            timeline = payload.requiredSellerArray("timeline").parseSellerTimeline(),
            notes = payload.requiredSellerArray("notes").parseSellerNotes(),
            conversationId = payload.optNullableSellerString("conversationId"),
    )
}

private fun JSONArray.parseSellerOrders(): List<SellerOrder> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: error("Nantty returned an invalid seller order.")
        add(parseSellerOrderRecord(row))
    }
}

private fun JSONArray.parseSellerLines(): List<SellerOrderLine> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: error("Nantty returned an invalid seller order line.")
        add(SellerOrderLine(
            row.requiredSellerString("id"), row.requiredSellerString("productId"), row.requiredSellerString("variantId"),
            row.requiredSellerString("name"), row.requiredSellerString("variantTitle"), row.requiredSellerString("sku"),
            row.optNullableSellerString("imageUrl"), row.requiredSellerInt("quantity"),
            row.requiredSellerMoney("unitPrice"), row.requiredSellerMoney("lineTotal"),
        ))
    }
}

private fun JSONArray.parseSellerRefunds(): List<SellerOrderRefund> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: error("Nantty returned an invalid seller refund.")
        add(SellerOrderRefund(row.requiredSellerString("id"), row.requiredSellerMoney("amount"), row.requiredSellerString("reason"), row.requiredSellerString("createdAt")))
    }
}

private fun JSONArray.parseSellerTimeline(): List<SellerOrderTimelineEvent> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: error("Nantty returned an invalid seller order timeline event.")
        add(SellerOrderTimelineEvent(row.requiredSellerString("id"), row.requiredSellerString("kind"), row.requiredSellerString("summary"), row.optNullableSellerString("actorName"), row.requiredSellerString("createdAt")))
    }
}

private fun JSONArray.parseSellerNotes(): List<SellerOrderNote> = buildList {
    for (index in 0 until length()) {
        val row = optJSONObject(index) ?: error("Nantty returned an invalid seller order note.")
        add(SellerOrderNote(row.requiredSellerString("id"), row.requiredSellerString("body"), row.requiredSellerString("authorName"), row.requiredSellerString("createdAt")))
    }
}

private fun parseSellerFulfilment(value: JSONObject) = SellerOrderFulfilment(
    value.requiredSellerString("courier"), value.requiredSellerString("trackingNumber"),
    value.optNullableSellerString("trackingUrl"), value.requiredSellerString("shippedAt"), value.requiredSellerString("fromLocationId"),
)

private fun JSONObject.requiredSellerMoney(key: String): SellerOrderMoney {
    val value = optJSONObject(key) ?: error("Nantty returned incomplete seller order amounts.")
    val amount = value.opt("amountMinor")
    require(amount is Number) { "Nantty returned invalid seller order amounts." }
    val minor = runCatching { BigDecimal(amount.toString()).longValueExact() }
        .getOrElse { error("Nantty returned invalid seller order amounts.") }
    return SellerOrderMoney(minor, value.requiredSellerString("currency"))
}

private fun JSONObject.requiredSellerObject(key: String): JSONObject = optJSONObject(key)
    ?: error("Nantty returned an incomplete seller order.")
private fun JSONObject.requiredSellerArray(key: String): JSONArray = optJSONArray(key)
    ?: error("Nantty returned an incomplete seller order.")
private fun JSONObject.requiredSellerString(key: String): String = optString(key).takeIf(String::isNotBlank)
    ?: error("Nantty returned incomplete seller order details.")
private fun JSONObject.optNullableSellerString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
private fun JSONObject.requiredSellerInt(key: String): Int {
    val value = opt(key)
    require(value is Number && value.toLong() in 0..Int.MAX_VALUE.toLong() && value.toDouble() == value.toLong().toDouble()) {
        "Nantty returned invalid seller order details."
    }
    return value.toInt()
}
