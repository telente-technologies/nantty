package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import android.content.ContentResolver
import android.net.Uri
import java.io.File
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Currency
import java.util.Locale
import java.util.UUID

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

internal data class SellerApplicationCategory(val id: String, val name: String)
internal data class SellerApplicationBank(val code: String, val name: String)
internal data class SellerApplicationOptions(val countryCode: String?, val categories: List<SellerApplicationCategory>, val banks: List<SellerApplicationBank>)
internal data class SellerApplicationSubmission(
    val storeName: String, val categoryId: String, val description: String, val phone: String,
    val addressLine: String, val city: String, val state: String, val enableLogistics: Boolean?,
    val documentType: String, val documentNumber: String, val documentPhotoUrl: String,
    val bankCode: String, val accountNumber: String,
)

internal sealed interface SellerApplicationMutationResult {
    data class Success(val application: SellerApplicationStatus) : SellerApplicationMutationResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SellerApplicationMutationResult
}

internal sealed interface SellerApplicationOptionsResult {
    data class Success(val options: SellerApplicationOptions) : SellerApplicationOptionsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SellerApplicationOptionsResult
}

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

internal interface SellerApplicationTransport {
    fun get(path: String, accessToken: String): String
    fun post(path: String, accessToken: String, idempotencyKey: String?, body: JSONObject): String
}

/** Reads only server-owned seller access, application status and dashboard data. */
internal class SellerWorkspaceRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: SellerWorkspaceTransport = JdkSellerWorkspaceTransport(BuildConfig.NANTTY_API_BASE_URL),
    private val applicationTransport: SellerApplicationTransport = JdkSellerApplicationTransport(BuildConfig.NANTTY_API_BASE_URL),
    private val identityDocumentRepository: SellerIdentityDocumentRepository = SellerIdentityDocumentRepository(sessionProvider),
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

    fun loadApplicationOptions(): SellerApplicationOptionsResult = try {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return SellerApplicationOptionsResult.Failure("Sign in to apply to sell.", true)
        val settings = JSONObject(applicationTransport.get(ACCOUNT_SETTINGS_PATH, token)).sellerData()
        val countryCode = settings.optNullableString("countryCode")?.uppercase(Locale.ROOT)
        val categories = applicationRows(applicationTransport.get(CATEGORIES_PATH, token))
        val parsedCategories = categories.objects().mapNotNull { row ->
            val id = row.optString("id")
            val name = row.optString("name")
            if (!isSafeSellerId(id) || name.isBlank()) null else SellerApplicationCategory(id, name)
        }
        require(parsedCategories.isNotEmpty()) { "No seller categories are currently available. Try again later." }
        val banks = if (countryCode == null) JSONArray() else applicationRows(
            applicationTransport.get(BANKS_PATH + "?country=" + encodeSellerQuery(countryCode), token),
        )
        val parsedBanks = banks.objects().mapNotNull { row ->
            val code = row.optString("code")
            val name = row.optString("name")
            if (!code.matches(Regex("^[0-9A-Za-z]{2,10}$")) || name.isBlank()) null else SellerApplicationBank(code, name)
        }
        SellerApplicationOptionsResult.Success(SellerApplicationOptions(countryCode, parsedCategories, parsedBanks))
    } catch (error: SellerApplicationHttpException) {
        SellerApplicationOptionsResult.Failure("Seller application options could not be loaded (HTTP ${error.statusCode}). Try again.", error.statusCode in setOf(401, 403))
    } catch (error: Exception) {
        SellerApplicationOptionsResult.Failure(error.message ?: "Could not load seller application options. Check your connection and try again.")
    }

    fun uploadIdentityDocument(uri: Uri, resolver: ContentResolver, cacheDir: File, cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation) =
        identityDocumentRepository.upload(uri, resolver, cacheDir, cancellation)

    fun resolvePayoutAccountName(bankCode: String, accountNumber: String): String {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: error("Sign in to verify a payout account.")
        require(bankCode.matches(Regex("^[0-9A-Za-z]{2,10}$")) && accountNumber.matches(Regex("^\\d{10}$"))) {
            "Enter a valid bank and 10-digit account number."
        }
        val response = JSONObject(applicationTransport.post(
            BANK_RESOLVE_PATH, token, null,
            JSONObject().put("bankCode", bankCode).put("accountNumber", accountNumber),
        )).sellerData()
        return response.optNullableString("accountName")?.takeIf(String::isNotBlank)
            ?: error("Nantty could not verify this account name. Check the details and try again.")
    }

    fun submitApplication(submission: SellerApplicationSubmission, idempotencyKey: String): SellerApplicationMutationResult = applicationRequest { token ->
        require(idempotencyKey.matches(Regex("^[A-Za-z0-9_-]{16,128}$"))) { "Retry the application submission." }
        val logisticsChoice = submission.enableLogistics ?: error("Choose whether your store can handle order logistics.")
        require(submission.storeName.trim().length in 2..80 && submission.description.length <= 1000) { "Check your store details and try again." }
        require(isSafeSellerId(submission.categoryId)) { "Choose a valid store category." }
        require(submission.phone.isNotBlank() && submission.addressLine.isNotBlank() && submission.city.isNotBlank() && submission.state.isNotBlank()) { "Complete your contact and pickup details." }
        require(submission.documentType in IDENTITY_DOCUMENT_TYPES && submission.documentNumber.matches(Regex("^[A-Za-z0-9-]{5,40}$"))) { "Complete your identity document details." }
        require(isSafeHttpsUrl(submission.documentPhotoUrl)) { "Upload a clear photo of your identity document." }
        require(submission.bankCode.matches(Regex("^[0-9A-Za-z]{2,10}$")) && submission.accountNumber.matches(Regex("^\\d{10}$"))) { "Enter a valid payout bank and 10-digit account number." }
        val body = JSONObject()
            .put("storeName", submission.storeName.trim()).put("categoryId", submission.categoryId)
            .put("description", submission.description.trim()).put("phone", submission.phone.replace(Regex("\\s"), ""))
            .put("addressLine", submission.addressLine.trim()).put("city", submission.city.trim()).put("state", submission.state.trim())
            .put("enableLogistics", logisticsChoice)
            .put("identityDocument", JSONObject().put("documentType", submission.documentType)
                .put("documentNumber", submission.documentNumber).put("documentPhotoUrl", submission.documentPhotoUrl))
            .put("payoutAccount", JSONObject().put("bankCode", submission.bankCode).put("accountNumber", submission.accountNumber))
        val response = JSONObject(applicationTransport.post(APPLICATION_SUBMIT_PATH, token, idempotencyKey, body)).sellerData()
        val parsed = parseApplication(response.toString()) ?: error("Nantty returned an incomplete seller application.")
        SellerApplicationMutationResult.Success(parsed)
    }

    private fun <T> applicationRequest(action: (String) -> T): SellerApplicationMutationResult = try {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return SellerApplicationMutationResult.Failure("Sign in to apply to sell.", true)
        @Suppress("UNCHECKED_CAST")
        action(token) as SellerApplicationMutationResult
    } catch (error: SellerApplicationHttpException) {
        SellerApplicationMutationResult.Failure(
            when (error.statusCode) {
                401, 403 -> "Your session has expired. Sign in again to continue."
                409 -> "An application is already under review or seller access is already active. Refresh your application status."
                else -> "Seller application request failed (HTTP ${error.statusCode}). Please try again."
            }, error.statusCode in setOf(401, 403),
        )
    } catch (error: Exception) {
        SellerApplicationMutationResult.Failure(error.message ?: "Could not complete your seller application. Check your connection and try again.")
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
        const val ACCOUNT_SETTINGS_PATH = "/api/v1/users/me/settings"
        const val CATEGORIES_PATH = "/api/v1/categories"
        const val BANKS_PATH = "/api/v1/banks"
        const val BANK_RESOLVE_PATH = "/api/v1/banks/resolve-account"
        const val APPLICATION_SUBMIT_PATH = "/api/v1/seller/applications"
    }
}

private class SellerApplicationHttpException(val statusCode: Int) : Exception()

private class JdkSellerApplicationTransport(private val baseUrl: String) : SellerApplicationTransport {
    override fun get(path: String, accessToken: String): String = request(path, accessToken, "GET", null, null)
    override fun post(path: String, accessToken: String, idempotencyKey: String?, body: JSONObject): String =
        request(path, accessToken, "POST", idempotencyKey, body)

    private fun request(path: String, accessToken: String, method: String, idempotencyKey: String?, body: JSONObject?): String {
        require(path.startsWith("/api/v1/") && !path.contains("..")) { "Unsupported seller application request." }
        val origin = URL(baseUrl)
        require(origin.protocol == "https" || BuildConfig.DEBUG && origin.protocol == "http") { "Configure a secure Nantty API URL to apply to sell." }
        val connection = (URL(origin, path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 20_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                idempotencyKey?.let { setRequestProperty("Idempotency-Key", it) }
            }
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(4_096)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large seller response." }
                    output.write(buffer, 0, count)
                }
                output.toString(Charsets.UTF_8.name())
            }.orEmpty()
            if (status !in 200..299) throw SellerApplicationHttpException(status)
            require(text.isNotBlank()) { "Nantty returned an empty seller application response." }
            return text
        } finally { connection.disconnect() }
    }

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}

private fun JSONObject.sellerData(): JSONObject = optJSONObject("data") ?: this
private fun applicationRows(payload: String): JSONArray {
    val value = JSONTokener(payload).nextValue()
    if (value is JSONArray) return value
    val objectValue = value as? JSONObject ?: error("Nantty returned an invalid seller catalogue response.")
    val data = objectValue.opt("data")
    return when (data) {
        is JSONArray -> data
        is JSONObject -> data.optJSONArray("items") ?: JSONArray()
        else -> objectValue.optJSONArray("items") ?: JSONArray()
    }
}
private fun encodeSellerQuery(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name())
private fun isSafeHttpsUrl(value: String): Boolean = runCatching {
    val uri = java.net.URI(value)
    uri.isAbsolute && uri.scheme.equals("https", true) && !uri.host.isNullOrBlank() && uri.userInfo == null && value.length <= 2048
}.getOrDefault(false)

private val IDENTITY_DOCUMENT_TYPES = setOf("nin_slip", "drivers_licence", "voters_card", "international_passport")


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
