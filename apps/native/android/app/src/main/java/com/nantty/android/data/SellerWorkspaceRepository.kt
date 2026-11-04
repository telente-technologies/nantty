package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Currency
import java.util.Locale

internal enum class SellerDashboardPeriod(val apiValue: String, val label: String) {
    LIVE("live", "Live"), TODAY("today", "Today"), YESTERDAY("yesterday", "Yesterday"),
    WEEK("week", "Week"), MONTH("month", "Month"), ALL("all", "All time"),
}

internal data class SellerAccess(
    val storeId: String?,
    val storeName: String?,
    val role: String?,
    val permissions: Set<String>,
)

internal data class SellerApplicationStatus(
    val status: String,
    val storeName: String,
    val categoryName: String,
    val submittedAt: String,
    val rejectionReason: String?,
)

internal data class SellerWorkspaceOrder(
    val id: String,
    val orderNumber: String,
    val customerName: String,
    val itemsCount: Int,
    val status: String,
    val amountMinor: Long,
    val currency: String,
)

internal data class SellerWorkspaceDashboard(
    val period: String,
    val totalSalesMinor: Long,
    val currency: String,
    val orders: Int,
    val totalProducts: Int,
    val activeProducts: Int,
    val draftProducts: Int,
    val recentOrders: List<SellerWorkspaceOrder>,
)

internal data class SellerWorkspace(
    val access: SellerAccess,
    val application: SellerApplicationStatus?,
    val dashboard: SellerWorkspaceDashboard?,
)

internal sealed interface SellerWorkspaceResult {
    data class Success(val workspace: SellerWorkspace) : SellerWorkspaceResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SellerWorkspaceResult
}

internal class SellerWorkspaceHttpException(val statusCode: Int) : Exception()

internal fun interface SellerWorkspaceTransport {
    fun get(path: String, accessToken: String, headers: Map<String, String>): String
}

/** Reads only server-owned seller access, application status and dashboard data. */
internal class SellerWorkspaceRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: SellerWorkspaceTransport = JdkSellerWorkspaceTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun load(period: SellerDashboardPeriod = SellerDashboardPeriod.TODAY): SellerWorkspaceResult = try {
        val session = sessionProvider() ?: return SellerWorkspaceResult.Failure("Sign in to access your seller workspace.", true)
        val token = session.accessToken.takeIf(String::isNotBlank)
            ?: return SellerWorkspaceResult.Failure("Sign in to access your seller workspace.", true)
        val access = parseAccess(transport.get(SELLER_ACCESS_PATH, token, emptyMap()))
        val application = parseApplication(transport.get(SELLER_APPLICATION_PATH, token, emptyMap()))
        val dashboard = access.storeId?.let { storeId ->
            parseDashboard(transport.get(dashboardPath(period), token, mapOf(SELLER_STORE_HEADER to storeId)))
        }
        SellerWorkspaceResult.Success(SellerWorkspace(access, application, dashboard))
    } catch (error: Exception) {
        val httpError = error as? SellerWorkspaceHttpException
        val authenticationRequired = httpError?.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED ||
            httpError?.statusCode == HttpURLConnection.HTTP_FORBIDDEN
        SellerWorkspaceResult.Failure(
            when {
                authenticationRequired -> "Your session has expired. Sign in again to access your seller workspace."
                httpError != null -> "Seller workspace request failed (HTTP ${httpError.statusCode}). Please try again."
                error is IllegalArgumentException -> error.message ?: "Nantty returned seller data that could not be read."
                else -> "Could not reach Nantty. Check your connection and try again."
            },
            authenticationRequired,
        )
    }

    internal fun parseAccess(payload: String): SellerAccess {
        val json = JSONObject(payload)
        val storeId = json.optNullableString("storeId")?.also {
            require(isSafeSellerId(it)) { "Nantty returned an invalid seller store." }
        }
        val permissions = json.optJSONArray("permissions").stringValues()
        return SellerAccess(
            storeId = storeId,
            storeName = json.optNullableString("storeName"),
            role = json.optNullableString("role"),
            permissions = permissions.toSet(),
        )
    }

    internal fun parseApplication(payload: String): SellerApplicationStatus? {
        val value = JSONTokener(payload).nextValue()
        if (value == JSONObject.NULL) return null
        val json = value as? JSONObject ?: error("Nantty returned an invalid seller application response.")
        val id = json.optString("id")
        require(isSafeSellerId(id)) { "Nantty returned an invalid seller application." }
        return SellerApplicationStatus(
            status = json.optString("status").takeIf(String::isNotBlank)
                ?: error("Nantty returned an incomplete seller application."),
            storeName = json.optString("storeName"),
            categoryName = json.optString("categoryName"),
            submittedAt = json.optString("submittedAt"),
            rejectionReason = json.optNullableString("rejectionReason"),
        )
    }

    internal fun parseDashboard(payload: String): SellerWorkspaceDashboard {
        val json = JSONObject(payload)
        val sales = json.optJSONObject("totalSales") ?: error("Nantty returned an incomplete seller dashboard.")
        val currency = sales.optString("currency")
        require(currency.matches(Regex("[A-Z]{3}"))) { "Nantty returned an invalid dashboard currency." }
        val recentOrders = json.optJSONArray("recentOrders").objects().mapNotNull { row ->
            val id = row.optString("id")
            val total = row.optJSONObject("total") ?: return@mapNotNull null
            val orderCurrency = total.optString("currency")
            if (!isSafeSellerId(id) || !orderCurrency.matches(Regex("[A-Z]{3}"))) return@mapNotNull null
            SellerWorkspaceOrder(
                id = id,
                orderNumber = row.optString("orderNumber").ifBlank { id.take(8) },
                customerName = row.optString("customerName").ifBlank { "Customer" },
                itemsCount = row.optInt("itemsCount").coerceAtLeast(0),
                status = row.optString("status").ifBlank { "unknown" },
                amountMinor = total.optLong("amountMinor"),
                currency = orderCurrency,
            )
        }
        val catalog = json.optJSONObject("catalog")
        return SellerWorkspaceDashboard(
            period = json.optString("period"),
            totalSalesMinor = sales.optLong("amountMinor"),
            currency = currency,
            orders = json.optInt("orders").coerceAtLeast(0),
            totalProducts = catalog?.optInt("totalProducts")?.coerceAtLeast(0) ?: 0,
            activeProducts = catalog?.optInt("activeProducts")?.coerceAtLeast(0) ?: 0,
            draftProducts = catalog?.optInt("draftProducts")?.coerceAtLeast(0) ?: 0,
            recentOrders = recentOrders,
        )
    }

    internal fun dashboardPath(period: SellerDashboardPeriod): String = "$SELLER_DASHBOARD_PATH?period=${period.apiValue}"

    private companion object {
        const val SELLER_ACCESS_PATH = "/api/v1/seller/access"
        const val SELLER_APPLICATION_PATH = "/api/v1/seller/applications/me"
        const val SELLER_DASHBOARD_PATH = "/api/v1/seller/dashboard"
        const val SELLER_STORE_HEADER = "X-Seller-Store"
    }
}

private class JdkSellerWorkspaceTransport(private val baseUrl: String) : SellerWorkspaceTransport {
    override fun get(path: String, accessToken: String, headers: Map<String, String>): String {
        require(path.startsWith("/api/v1/seller/") && !path.contains("..")) { "Unsupported seller request." }
        require(accessToken.isNotBlank()) { "Sign in to access your seller workspace." }
        val origin = URL(baseUrl)
        require(origin.protocol == "https" || BuildConfig.DEBUG && origin.protocol == "http") {
            "Configure a secure Nantty API URL to access your seller workspace."
        }
        val connection = (URL(origin, path).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            headers.forEach { (name, value) ->
                require(name == "X-Seller-Store" && isSafeSellerId(value)) { "Invalid seller store context." }
                setRequestProperty(name, value)
            }
        }
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw SellerWorkspaceHttpException(status)
            val input = connection.inputStream
            val output = ByteArrayOutputStream()
            input.use { stream ->
                val buffer = ByteArray(4_096)
                while (true) {
                    val count = stream.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large seller response." }
                    output.write(buffer, 0, count)
                }
            }
            return output.toString(Charsets.UTF_8.name())
        } finally {
            connection.disconnect()
        }
    }

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}

private fun JSONArray?.objects(): List<JSONObject> = buildList {
    if (this@objects == null) return@buildList
    for (index in 0 until length()) optJSONObject(index)?.let(::add)
}

private fun JSONArray?.stringValues(): List<String> = buildList {
    if (this@stringValues == null) return@buildList
    for (index in 0 until length()) optString(index).takeIf(String::isNotBlank)?.let(::add)
}

private fun JSONObject.optNullableString(key: String): String? = opt(key)
    ?.takeUnless { it == JSONObject.NULL }
    ?.toString()
    ?.takeIf(String::isNotBlank)

internal fun formatSellerMoney(amountMinor: Long, currencyCode: String): String = runCatching {
    val currency = Currency.getInstance(currencyCode)
    val fractionDigits = currency.defaultFractionDigits.coerceAtLeast(0)
    val divisor = Math.pow(10.0, fractionDigits.toDouble())
    java.text.NumberFormat.getCurrencyInstance(Locale.getDefault()).apply {
        this.currency = currency
        maximumFractionDigits = fractionDigits
        minimumFractionDigits = fractionDigits
    }.format(amountMinor / divisor)
}.getOrElse { "$currencyCode ${amountMinor}" }

private fun isSafeSellerId(value: String): Boolean = value.matches(
    Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"),
)
