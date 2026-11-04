package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

internal data class CheckoutAddress(
    val id: String,
    val label: String,
    val fullName: String,
    val phone: String,
    val line1: String,
    val line2: String,
    val city: String,
    val state: String,
    val country: String,
    val isDefault: Boolean,
)

internal data class CheckoutGeoCountry(
    val id: String,
    val name: String,
    val levels: Set<String>,
    val stateLabel: String,
    val lgaLabel: String,
)

internal data class CheckoutGeoArea(val id: String, val name: String)

internal data class CheckoutAddressInput(
    val fullName: String,
    val phone: String,
    val line1: String,
    val postalCode: String,
    val details: String,
    val countryId: String,
    val stateId: String?,
    val lgaId: String?,
    val cityId: String?,
    val state: String,
    val city: String,
)

internal data class CheckoutReceipt(
    val checkoutId: String,
    val payableOrderId: String,
    val total: WalletMoney,
    val orderCount: Int,
)

internal data class HostedPayment(val orderId: String, val checkoutUrl: String)

internal sealed interface CheckoutAddressesResult {
    data class Success(val addresses: List<CheckoutAddress>) : CheckoutAddressesResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CheckoutAddressesResult
}

internal sealed interface CheckoutCartResult {
    data class Success(val cart: CartSnapshot) : CheckoutCartResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CheckoutCartResult
}

internal sealed interface PlaceCheckoutResult {
    data class Success(val receipt: CheckoutReceipt) : PlaceCheckoutResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : PlaceCheckoutResult
}

internal sealed interface HostedPaymentResult {
    data class Success(val payment: HostedPayment) : HostedPaymentResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : HostedPaymentResult
}

internal sealed interface PaymentVerificationResult {
    data object Paid : PaymentVerificationResult
    data object Pending : PaymentVerificationResult
    data object Failed : PaymentVerificationResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : PaymentVerificationResult
}

internal interface CheckoutTransport {
    fun get(path: String, accessToken: String): JSONObject
    fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String? = null): JSONObject
}

internal class CheckoutRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: CheckoutTransport = JdkCheckoutTransport(baseUrl),
) {
    fun loadAddresses(): CheckoutAddressesResult = runCatching {
        val token = requireToken("Sign in to choose a delivery address.")
        parseAddresses(transport.get("/api/v1/users/me/addresses", token))
    }.fold(
        onSuccess = CheckoutAddressesResult::Success,
        onFailure = { CheckoutAddressesResult.Failure(checkoutErrorMessage(it, "load your addresses"), it.isCheckoutAuthFailure()) },
    )

    fun loadGeoCountries(): List<CheckoutGeoCountry> {
        val token = requireToken("Sign in to add a delivery address.")
        val rows = unwrapCheckoutArray(transport.get("/api/v1/geo/countries", token))
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id")
                val name = row.optString("name").checkoutText(100)
                if (!isSafeAddressId(id) || name.isBlank()) continue
                val levels = row.optJSONArray("levels")?.let { values ->
                    buildSet { for (level in 0 until values.length()) add(values.optString(level).lowercase()) }
                }.orEmpty()
                add(CheckoutGeoCountry(id, name, levels, row.optString("stateLabel").checkoutText(60), row.optString("lgaLabel").checkoutText(60)))
            }
        }
    }

    fun loadGeoAreas(path: String): List<CheckoutGeoArea> {
        require(path.matches(Regex("/api/v1/geo/(countries/[A-Fa-f0-9-]{36}/regions|regions/[A-Fa-f0-9-]{36}/(admin-areas|cities)|admin-areas/[A-Fa-f0-9-]{36}/cities)")))
        val token = requireToken("Sign in to add a delivery address.")
        val rows = unwrapCheckoutArray(transport.get(path, token))
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id")
                val name = row.optString("name").checkoutText(100)
                if (isSafeAddressId(id) && name.isNotBlank()) add(CheckoutGeoArea(id, name))
            }
        }
    }

    fun createAddress(input: CheckoutAddressInput): CheckoutAddress {
        require(input.fullName.trim().length in 2..80) { "Enter the recipient's full name." }
        val phone = input.phone.trim().filterNot { it in " -()." }
        require(phone.matches(Regex("\\+[1-9][0-9]{7,14}"))) { "Enter a phone number with country code, such as +2348012345678." }
        require(input.line1.trim().length in 3..160) { "Enter a valid street address." }
        require(isSafeAddressId(input.countryId)) { "Choose a valid country." }
        val token = requireToken("Sign in to add a delivery address.")
        val body = JSONObject()
            .put("fullName", input.fullName.trim())
            .put("phone", phone)
            .put("line1", input.line1.trim())
            .put("postalCode", input.postalCode.trim())
            .put("details", input.details.trim())
            .put("isDefault", false)
            .put("countryId", input.countryId)
            .put("city", input.city.trim())
            .put("state", input.state.trim())
        input.stateId?.let { body.put("stateId", it) }
        input.lgaId?.let { body.put("lgaId", it) }
        input.cityId?.let { body.put("cityId", it) }
        val response = transport.post("/api/v1/users/me/addresses", token, body)
        return parseAddress(unwrapCheckoutObject(response))
    }

    fun quoteCart(addressId: String): CheckoutCartResult = runCatching {
        require(isSafeAddressId(addressId)) { "Choose a valid delivery address." }
        val token = requireToken("Sign in to review checkout.")
        val response = transport.post("/api/v1/cart/shipping-quote", token, JSONObject().put("addressId", addressId))
        CheckoutCartResult.Success(parseCartPayload(response))
    }.fold(
        onSuccess = { it as CheckoutCartResult.Success },
        onFailure = { CheckoutCartResult.Failure(checkoutErrorMessage(it, "calculate delivery"), it.isCheckoutAuthFailure()) },
    )

    fun placeOrder(addressId: String, idempotencyKey: String): PlaceCheckoutResult = runCatching {
        require(isSafeAddressId(addressId)) { "Choose a valid delivery address." }
        require(idempotencyKey.matches(Regex("[A-Za-z0-9_-]{16,128}"))) { "Refresh checkout and try again." }
        val token = requireToken("Sign in to place your order.")
        val payload = JSONObject()
            .put("addressId", addressId)
            .put("useStoreCredit", true)
            .put("promoCodes", JSONArray())
            // Escrow is the safe Android default. Direct payment stays unavailable until the
            // native flow has the same seller-trust disclosure and explicit buyer confirmation as RN.
            .put("paymentModes", JSONArray())
            .put("directPaymentAccepted", false)
        val response = transport.post("/api/v1/orders/checkout", token, payload, idempotencyKey)
        PlaceCheckoutResult.Success(parseCheckoutReceipt(response))
    }.fold(
        onSuccess = { it as PlaceCheckoutResult.Success },
        onFailure = { PlaceCheckoutResult.Failure(checkoutErrorMessage(it, "place your order"), it.isCheckoutAuthFailure()) },
    )

    fun initializePayment(orderId: String, idempotencyKey: String): HostedPaymentResult = runCatching {
        require(isSafeAddressId(orderId)) { "This order could not be paid. Return to your orders and try again." }
        require(idempotencyKey.matches(Regex("[A-Za-z0-9_-]{16,128}"))) { "Refresh payment and try again." }
        val token = requireToken("Sign in to continue payment.")
        val response = transport.post(
            "/api/v1/payments/initialize",
            token,
            JSONObject().put("orderId", orderId),
            idempotencyKey,
        )
        HostedPaymentResult.Success(parseHostedPayment(response, orderId))
    }.fold(
        onSuccess = { it as HostedPaymentResult.Success },
        onFailure = { HostedPaymentResult.Failure(checkoutErrorMessage(it, "start secure payment"), it.isCheckoutAuthFailure()) },
    )

    fun verifyPayment(orderId: String): PaymentVerificationResult = runCatching {
        require(isSafeAddressId(orderId)) { "This payment could not be verified." }
        val token = requireToken("Sign in to verify payment.")
        val response = transport.post("/api/v1/payments/orders/$orderId/verify", token, JSONObject())
        when (unwrapCheckoutObject(response).optString("status").lowercase()) {
            "paid", "succeeded", "completed" -> PaymentVerificationResult.Paid
            "pending", "processing", "requires_action" -> PaymentVerificationResult.Pending
            "failed", "cancelled", "canceled" -> PaymentVerificationResult.Failed
            else -> error("Nantty returned an unknown payment status.")
        }
    }.fold(
        onSuccess = { it },
        onFailure = { PaymentVerificationResult.Failure(checkoutErrorMessage(it, "verify payment"), it.isCheckoutAuthFailure()) },
    )

    private fun requireToken(message: String): String =
        sessionProvider()?.accessToken?.takeIf(String::isNotBlank) ?: error(message)

    internal fun parseAddresses(payload: JSONObject): List<CheckoutAddress> {
        val data = payload.opt("data")
        val rows = when (data) {
            is JSONArray -> data
            is JSONObject -> data.optJSONArray("data") ?: data.optJSONArray("items")
            else -> payload.optJSONArray("items")
        } ?: error("Nantty returned an incomplete address list.")
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id")
                val fullName = row.optString("fullName").checkoutText(100)
                val line1 = row.optString("line1").checkoutText(180)
                if (!isSafeAddressId(id) || fullName.isBlank() || line1.isBlank()) continue
                runCatching { parseAddress(row) }.getOrNull()?.let(::add)
            }
        }
    }

    internal fun parseAddress(row: JSONObject): CheckoutAddress {
        val id = row.optString("id")
        val fullName = row.optString("fullName").checkoutText(100)
        val line1 = row.optString("line1").checkoutText(180)
        require(isSafeAddressId(id) && fullName.isNotBlank() && line1.isNotBlank()) { "Nantty returned an incomplete address." }
        return CheckoutAddress(
            id = id,
            label = row.optString("label").checkoutText(60),
            fullName = fullName,
            phone = row.optString("phone").checkoutText(40),
            line1 = line1,
            line2 = row.optString("line2").checkoutText(180),
            city = row.optString("city").checkoutText(100),
            state = row.optString("state").checkoutText(100),
            country = row.optString("country").checkoutText(100),
            isDefault = row.optBoolean("isDefault"),
        )
    }

    internal fun parseCheckoutReceipt(payload: JSONObject): CheckoutReceipt {
        val data = unwrapCheckoutObject(payload)
        val checkoutId = data.optString("checkoutId").takeIf(::isSafeAddressId)
            ?: error("Nantty returned an incomplete checkout confirmation.")
        val payableOrderId = data.optString("payableOrderId").takeIf(::isSafeAddressId)
            ?: error("Nantty returned an incomplete checkout confirmation.")
        val total = data.optJSONObject("total")?.toWalletMoney()
            ?: error("Nantty returned an incomplete checkout total.")
        val orders = data.optJSONArray("orders")?.takeIf { it.length() > 0 }
            ?: data.optJSONArray("orderGroups")?.takeIf { it.length() > 0 }
            ?: error("Nantty returned no orders for checkout.")
        val orderCount = orders.length()
        return CheckoutReceipt(checkoutId, payableOrderId, total, orderCount)
    }

    internal fun parseHostedPayment(payload: JSONObject, fallbackOrderId: String): HostedPayment {
        val data = unwrapCheckoutObject(payload)
        val orderId = data.optString("orderId").takeIf(::isSafeAddressId) ?: fallbackOrderId
        val candidate = data.optString("checkoutUrl").takeIf(String::isNotBlank)
            ?: data.optString("authorizationUrl").takeIf(String::isNotBlank)
            ?: data.optJSONObject("payment")?.optString("checkoutUrl")?.takeIf(String::isNotBlank)
            ?: error("Nantty did not provide a secure payment page.")
        val url = URL(candidate)
        require(url.protocol == "https" && url.host.isNotBlank() && url.userInfo == null && url.query?.contains("\n") != true) {
            "Nantty did not provide a secure payment page."
        }
        return HostedPayment(orderId, url.toString())
    }
}

internal fun isSafeAddressId(value: String): Boolean =
    value.matches(Regex("[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-8][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}")) ||
        value.matches(Regex("[A-Za-z0-9_-]{1,128}"))

private fun unwrapCheckoutObject(payload: JSONObject): JSONObject = payload.optJSONObject("data") ?: payload

private fun JSONObject.toWalletMoney(): WalletMoney {
    val currency = optString("currency")
    require(currency.matches(Regex("[A-Z]{3}")) && has("amountMinor")) { "Nantty returned an invalid amount." }
    return WalletMoney(optLong("amountMinor"), currency)
}

private fun String.checkoutText(maxLength: Int): String = filterNot(Char::isISOControl).trim().take(maxLength)

private fun Throwable.isCheckoutAuthFailure(): Boolean =
    (this is CheckoutHttpException && statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)) ||
        message?.startsWith("Sign in") == true

private fun checkoutErrorMessage(error: Throwable, action: String): String = when {
    error is CheckoutHttpException && error.statusCode in setOf(401, 403) -> "Your session has expired. Sign in again to continue."
    error is CheckoutHttpException && error.statusCode == 404 -> "This checkout information is no longer available. Refresh and try again."
    error is CheckoutHttpException && error.statusCode in setOf(409, 422) -> "Your cart or delivery details changed. Review them and try again."
    error.message?.startsWith("Sign in") == true -> error.message ?: "Sign in to continue."
    error is CheckoutHttpException -> "Nantty couldn't $action (HTTP ${error.statusCode}). Please try again."
    else -> "Couldn't $action. Check your connection and try again."
}

internal class CheckoutHttpException(val statusCode: Int) : Exception()

internal class JdkCheckoutTransport(private val baseUrl: String) : CheckoutTransport {
    override fun get(path: String, accessToken: String): JSONObject = JSONObject(request(path, accessToken, "GET"))

    override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject =
        JSONObject(request(path, accessToken, "POST", body, idempotencyKey))

    private fun request(path: String, accessToken: String, method: String, body: JSONObject? = null, idempotencyKey: String? = null): String {
        require(path.startsWith("/api/v1/") && !path.contains(".."))
        val origin = URL(baseUrl.trim().trimEnd('/'))
        require((origin.protocol == "https" || (origin.protocol == "http" && origin.host == "10.0.2.2")) && origin.userInfo == null)
        val connection = (URL("${origin.toString().trimEnd('/')}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 20_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = body != null
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Authorization", "Bearer $accessToken")
            idempotencyKey?.let { setRequestProperty("Idempotency-Key", it) }
        }
        return try {
            body?.let { request -> connection.outputStream.use { it.write(request.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.use { it.readBoundedCheckoutResponse() }.orEmpty()
            if (status !in 200..299) throw CheckoutHttpException(status)
            response
        } finally {
            connection.disconnect()
        }
    }
}

private fun unwrapCheckoutArray(payload: JSONObject): JSONArray {
    val data = payload.opt("data")
    return when (data) {
        is JSONArray -> data
        is JSONObject -> data.optJSONArray("data") ?: data.optJSONArray("items")
        else -> payload.optJSONArray("items")
    } ?: error("Nantty returned an incomplete location list.")
}

private fun java.io.InputStream.readBoundedCheckoutResponse(): String {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    var total = 0
    while (true) {
        val count = read(buffer)
        if (count < 0) break
        total += count
        if (total > 1_000_000) error("Nantty returned an oversized response.")
        output.write(buffer, 0, count)
    }
    return output.toString(Charsets.UTF_8.name())
}
