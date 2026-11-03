package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

internal data class OrdersWidgetPayload(
    val activeCount: Int,
    val generatedAt: String,
    val orders: List<OrderWidgetItem>,
)

internal data class OrderWidgetItem(
    val id: String,
    val reference: String,
    val status: String,
    val statusLabel: String,
    val etaAt: String?,
    val itemTitle: String,
    val itemCount: Int,
    val imageUrl: String?,
    val storeName: String,
    val deepLink: String,
)

internal sealed interface OrdersWidgetLoadResult {
    data class Ready(val payload: OrdersWidgetPayloadSummary) : OrdersWidgetLoadResult
    data object SignedOut : OrdersWidgetLoadResult
    data class Failed(val statusCode: Int? = null) : OrdersWidgetLoadResult
}

internal fun interface OrdersWidgetTransport {
    fun get(path: String, accessToken: String): JSONObject
}

internal class OrdersWidgetRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSession: () -> AccountSession?,
    private val transport: OrdersWidgetTransport = JdkOrdersWidgetTransport(baseUrl),
) {
    fun load(): OrdersWidgetLoadResult {
        var session = sessionProvider() ?: return OrdersWidgetLoadResult.SignedOut
        return try {
            OrdersWidgetLoadResult.Ready(sanitizeOrdersWidgetPayload(parseOrdersWidgetPayload(transport.get(ORDERS_PATH, session.accessToken))))
        } catch (error: OrdersWidgetHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) {
                return OrdersWidgetLoadResult.Failed(error.statusCode)
            }
            session = runCatching { refreshSession() }.getOrElse { return OrdersWidgetLoadResult.Failed() }
                ?: return OrdersWidgetLoadResult.SignedOut
            runCatching { sanitizeOrdersWidgetPayload(parseOrdersWidgetPayload(transport.get(ORDERS_PATH, session.accessToken))) }
                .fold(
                    onSuccess = { OrdersWidgetLoadResult.Ready(it) },
                    onFailure = { failure ->
                        OrdersWidgetLoadResult.Failed((failure as? OrdersWidgetHttpException)?.statusCode)
                    },
                )
        } catch (_: Exception) {
            OrdersWidgetLoadResult.Failed()
        }
    }

    companion object {
        const val ORDERS_PATH = "/api/v1/widgets/orders"
        const val MAX_WIDGET_ITEMS = 3
    }
}

internal fun parseOrdersWidgetPayload(payload: JSONObject): OrdersWidgetPayload {
    val orders: JSONArray = payload.optJSONArray("orders") ?: error("Orders response is missing its orders list.")
    val items = buildList {
        for (index in 0 until minOf(orders.length(), OrdersWidgetRepository.MAX_WIDGET_ITEMS)) {
            val row = orders.optJSONObject(index) ?: continue
            val statusLabel = sanitizeWidgetStatus(row.optString("statusLabel"))
            if (statusLabel.isBlank()) continue
            add(
                OrderWidgetItem(
                    id = row.optString("id"),
                    reference = row.optString("reference"),
                    status = row.optString("status"),
                    statusLabel = statusLabel,
                    etaAt = row.widgetNullableString("etaAt"),
                    itemTitle = row.optString("itemTitle"),
                    itemCount = row.optInt("itemCount").coerceAtLeast(0),
                    imageUrl = row.widgetNullableString("imageUrl"),
                    storeName = row.optString("storeName"),
                    deepLink = row.optString("deepLink"),
                ),
            )
        }
    }
    return OrdersWidgetPayload(
        activeCount = payload.optInt("activeCount").coerceAtLeast(0),
        generatedAt = payload.optString("generatedAt"),
        orders = items,
    )
}

internal fun sanitizeOrdersWidgetPayload(payload: OrdersWidgetPayload): OrdersWidgetPayloadSummary = OrdersWidgetPayloadSummary(
    activeCount = payload.activeCount,
    statusLabels = payload.orders.map(OrderWidgetItem::statusLabel).take(OrdersWidgetRepository.MAX_WIDGET_ITEMS),
)

internal data class OrdersWidgetPayloadSummary(val activeCount: Int, val statusLabels: List<String>)

private fun JSONObject.widgetNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun sanitizeWidgetStatus(value: String): String = value
    .filterNot(Char::isISOControl)
    .trim()
    .take(48)

private class JdkOrdersWidgetTransport(baseUrl: String) : OrdersWidgetTransport {
    private val origin = trustedApiOrigin(baseUrl)

    override fun get(path: String, accessToken: String): JSONObject {
        require(path == OrdersWidgetRepository.ORDERS_PATH) { "Unsupported widget request." }
        val apiOrigin = origin ?: error("Configure an HTTPS Nantty API URL to refresh orders.")
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
            if (status !in 200..299) throw OrdersWidgetHttpException(status)
            val body = connection.inputStream.use(::readBounded)
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(4_096)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Orders response exceeded its size limit." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    companion object {
        private const val MAX_RESPONSE_BYTES = 256 * 1024
    }
}

internal class OrdersWidgetHttpException(val statusCode: Int) : Exception()
