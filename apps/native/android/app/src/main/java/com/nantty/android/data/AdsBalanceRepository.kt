package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

fun interface AdsBalanceTransport {
    fun request(method: String, path: String, accessToken: String?, body: JSONObject?, headers: Map<String, String>): JSONObject
}

/** Client for the server-authoritative ad-balance ledger and hosted top-up checkout. */
internal class AdsBalanceRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: AdsBalanceTransport = JdkAdsBalanceTransport(baseUrl),
    internal val stepUpRepository: PayoutAccountsRepository = PayoutAccountsRepository(
        baseUrl = baseUrl,
        sessionProvider = sessionProvider,
        refreshSessionProvider = refreshSessionProvider,
    ),
) {
    fun loadBalance(): AdsBalanceResult<AdsBalanceSummary> = result("load your ad balance") { token ->
        parseBalance(transport.request("GET", BALANCE_PATH, token, null, emptyMap()))
    }

    fun loadTransactions(cursor: String? = null): AdsBalanceResult<AdsBalanceTransactionPage> = result("load ad-balance history") { token ->
        require(cursor == null || ADS_BALANCE_CURSOR.matches(cursor)) { "This history page is invalid. Refresh and try again." }
        val path = cursor?.let { "$TRANSACTIONS_PATH?cursor=${encodeAdsBalanceQuery(it)}" } ?: TRANSACTIONS_PATH
        parseTransactions(transport.request("GET", path, token, null, emptyMap()))
    }

    fun startTopUp(amount: AdsWorkspaceMoney, idempotencyKey: String): AdsBalanceResult<AdsBalanceTopUpCheckout> = result("start your ad-balance top-up") { token ->
        requireValidAmount(amount)
        require(ADS_BALANCE_IDEMPOTENCY.matches(idempotencyKey)) { "This top-up request is invalid. Try again." }
        val body = JSONObject().put("amount", amount.toJson())
        val payload = transport.request("POST", TOP_UPS_PATH, token, body, mapOf(IDEMPOTENCY_HEADER to idempotencyKey))
        val data = payload.dataObject()
        val checkoutUrl = data.requiredString("checkoutUrl")
        require(isSafeAdsCheckoutUrl(checkoutUrl)) { "Nantty returned an invalid checkout link." }
        AdsBalanceTopUpCheckout(
            topUpId = data.requiredString("topUpId"),
            reference = data.requiredString("reference"),
            checkoutUrl = checkoutUrl,
        )
    }

    fun quoteWithdrawal(amount: AdsWorkspaceMoney): AdsBalanceResult<AdsBalanceWithdrawalQuote> = result("quote your ad-balance withdrawal") { token ->
        requireValidAmount(amount)
        val payload = transport.request("POST", WITHDRAWAL_QUOTE_PATH, token, JSONObject().put("amount", amount.toJson()), emptyMap())
        val data = payload.dataObject()
        AdsBalanceWithdrawalQuote(
            amount = data.requiredMoney("amount"),
            fee = data.requiredMoney("fee"),
            net = data.requiredMoney("net"),
            destination = data.requiredString("destination"),
            withdrawable = data.requiredMoney("withdrawable"),
        )
    }

    fun withdraw(amount: AdsWorkspaceMoney, idempotencyKey: String, stepUpToken: String): AdsBalanceResult<AdsBalanceWithdrawal> = result("withdraw your ad balance") { token ->
        requireValidAmount(amount)
        require(ADS_BALANCE_IDEMPOTENCY.matches(idempotencyKey)) { "This withdrawal request is invalid. Try again." }
        require(stepUpToken.isNotBlank()) { "Confirm it's you to continue." }
        val headers = mapOf(IDEMPOTENCY_HEADER to idempotencyKey, STEP_UP_HEADER to stepUpToken)
        val payload = transport.request(
            "POST", WITHDRAWALS_PATH, token, JSONObject().put("amount", amount.toJson()), headers,
        )
        val data = payload.dataObject()
        AdsBalanceWithdrawal(
            id = data.requiredString("id"),
            status = data.requiredString("status"),
            amount = data.requiredMoney("amount"),
            fee = data.requiredMoney("fee"),
            net = data.requiredMoney("net"),
            destination = data.requiredString("destination"),
            createdAt = data.requiredString("createdAt"),
        )
    }

    internal fun parseBalance(payload: JSONObject): AdsBalanceSummary {
        val data = payload.dataObject()
        val topUp = data.optJSONObject("topUp") ?: error("Nantty returned incomplete top-up options.")
        val withdrawal = data.optJSONObject("withdrawal") ?: error("Nantty returned incomplete withdrawal options.")
        val cashback = data.optJSONObject("cashback") ?: error("Nantty returned incomplete cashback details.")
        val creditLots = data.optJSONArray("creditLots") ?: JSONArray()
        return AdsBalanceSummary(
            accountId = data.optNullableString("accountId"),
            balance = data.requiredMoney("balance"),
            credit = data.requiredMoney("credit"),
            committed = data.requiredMoney("committed"),
            spendable = data.requiredMoney("spendable"),
            withdrawable = data.requiredMoney("withdrawable"),
            pendingSettlement = data.requiredMoney("pendingSettlement"),
            creditLots = buildList {
                for (index in 0 until creditLots.length()) {
                    val row = creditLots.optJSONObject(index) ?: error("Nantty returned an invalid ad-credit lot.")
                    add(AdsBalanceCreditLot(
                        id = row.requiredString("id"),
                        source = row.requiredString("source"),
                        remaining = row.requiredMoney("remaining"),
                        expiresAt = row.optNullableString("expiresAt"),
                        reason = row.optNullableString("reason"),
                        createdAt = row.requiredString("createdAt"),
                    ))
                }
            },
            cashbackEnabled = cashback.optBoolean("enabled"),
            cashbackPercent = cashback.optInt("percent").coerceAtLeast(0),
            topUpAvailable = topUp.optBoolean("available"),
            topUpReasonCode = topUp.optNullableString("reasonCode"),
            topUpReason = topUp.optNullableString("reason"),
            topUpMinimum = topUp.requiredMoney("minimum"),
            topUpMaximum = topUp.requiredMoney("maximum"),
            suggestedTopUps = topUp.optJSONArray("suggested").moneyList(),
            withdrawal = AdsBalanceAvailability(
                available = withdrawal.optBoolean("available"),
                reasonCode = withdrawal.optNullableString("reasonCode"),
                reason = withdrawal.optNullableString("reason"),
                minimum = withdrawal.requiredMoney("minimum"),
            ),
        )
    }

    internal fun parseTransactions(payload: JSONObject): AdsBalanceTransactionPage {
        val data = payload.optJSONObject("data")?.takeIf { it.has("data") || it.has("items") || it.has("nextCursor") } ?: payload
        val rows = data.optJSONArray("data") ?: data.optJSONArray("items") ?: error("Nantty returned incomplete ad-balance history.")
        val nextCursor = data.optNullableString("nextCursor")?.also {
            require(ADS_BALANCE_CURSOR.matches(it)) { "Nantty returned an invalid history cursor." }
        }
        return AdsBalanceTransactionPage(
            items = buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: error("Nantty returned an invalid ad-balance transaction.")
                    add(AdsBalanceTransaction(
                        id = row.requiredString("id"),
                        pot = row.requiredString("pot"),
                        kind = row.requiredString("kind"),
                        amount = row.requiredMoney("amount", allowNegative = true),
                        description = row.optNullableString("description").orEmpty(),
                        createdAt = row.requiredString("createdAt"),
                    ))
                }
            },
            nextCursor = nextCursor,
        )
    }

    private fun <T> result(action: String, block: (String) -> T): AdsBalanceResult<T> = try {
        val accessToken = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw AdsBalanceHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to $action.")
        val value = try {
            block(accessToken)
        } catch (failure: AdsBalanceHttpException) {
            if (failure.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw failure
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw AdsBalanceHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in again to $action.")
            block(refreshed)
        }
        AdsBalanceResult.Success(value)
    } catch (error: Exception) {
        val apiError = error as? AdsBalanceHttpException
        AdsBalanceResult.Failure(
            message = error.message?.takeIf(String::isNotBlank) ?: "Could not $action. Check your connection and try again.",
            authenticationRequired = apiError?.statusCode in setOf(401, 403),
            code = apiError?.code,
        )
    }

    private fun requireValidAmount(amount: AdsWorkspaceMoney) {
        require(amount.amountMinor > 0 && amount.currency.matches(Regex("^[A-Z]{3}$"))) { "Enter a valid amount." }
    }

    companion object {
        const val BALANCE_PATH = "/api/v1/ads/boosts/balance"
        const val TRANSACTIONS_PATH = "$BALANCE_PATH/transactions"
        const val TOP_UPS_PATH = "$BALANCE_PATH/top-ups"
        const val WITHDRAWAL_QUOTE_PATH = "$BALANCE_PATH/withdrawals/quote"
        const val WITHDRAWALS_PATH = "$BALANCE_PATH/withdrawals"
        const val IDEMPOTENCY_HEADER = "Idempotency-Key"
        const val STEP_UP_HEADER = "X-Step-Up-Token"
    }
}

private class JdkAdsBalanceTransport(private val baseUrl: String) : AdsBalanceTransport {
    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, headers: Map<String, String>): JSONObject {
        val allowed = path == AdsBalanceRepository.BALANCE_PATH || path == AdsBalanceRepository.TRANSACTIONS_PATH ||
            path.startsWith("${AdsBalanceRepository.TRANSACTIONS_PATH}?cursor=") ||
            path in setOf(AdsBalanceRepository.TOP_UPS_PATH, AdsBalanceRepository.WITHDRAWAL_QUOTE_PATH, AdsBalanceRepository.WITHDRAWALS_PATH)
        require(allowed) { "Unsupported ad-balance request." }
        val expectedMethod = when {
            path == AdsBalanceRepository.BALANCE_PATH || path.startsWith("${AdsBalanceRepository.TRANSACTIONS_PATH}") -> "GET"
            else -> "POST"
        }
        require(method == expectedMethod) { "Unsupported ad-balance operation." }
        if (method == "POST") require(body != null) { "Ad-balance request body is required." }
        require(!accessToken.isNullOrBlank()) { "Sign in to manage your ad balance." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage ad balance.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            headers.forEach { (key, value) -> setRequestProperty(key, value) }
            body?.let { doOutput = true; setRequestProperty("Content-Type", "application/json") }
        }
        try {
            body?.let { connection.outputStream.use { output -> output.write(it.toString().toByteArray(StandardCharsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readAdsBalanceResponse).orEmpty()
            if (status !in 200..299) {
                val json = runCatching { JSONObject(response) }.getOrNull()
                val error = json?.optJSONObject("error") ?: json?.optJSONObject("data") ?: json
                throw AdsBalanceHttpException(
                    status,
                    error?.optString("message")?.takeIf(String::isNotBlank) ?: "Ad-balance request failed (HTTP $status). Try again.",
                    error?.optString("code")?.takeIf(String::isNotBlank),
                )
            }
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }
}

internal class AdsBalanceHttpException(val statusCode: Int, message: String, val code: String? = null) : IllegalStateException(message)

private fun readAdsBalanceResponse(input: java.io.InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        require(output.size() + read <= ADS_BALANCE_MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large ad-balance response." }
        output.write(buffer, 0, read)
    }
    return output.toString(StandardCharsets.UTF_8.name())
}

private fun JSONObject.requiredString(key: String): String = optString(key).takeIf { it.isNotBlank() && it != "null" }
    ?: error("Nantty returned incomplete ad-balance data.")

private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun JSONObject.requiredMoney(key: String, allowNegative: Boolean = false): AdsWorkspaceMoney {
    val money = optJSONObject(key) ?: error("Nantty returned incomplete ad-balance money data.")
    return money.toAdsBalanceMoney(allowNegative)
}

private fun JSONObject.toAdsBalanceMoney(allowNegative: Boolean = false): AdsWorkspaceMoney {
    val amount = opt("amountMinor")
    val minor = when (amount) {
        is Number -> amount.toLong()
        is String -> amount.toLongOrNull()
        else -> null
    }?.takeIf { allowNegative || it >= 0 } ?: error("Nantty returned an invalid ad-balance amount.")
    val currency = optString("currency").takeIf { it.matches(Regex("^[A-Z]{3}$")) }
        ?: error("Nantty returned an invalid ad-balance currency.")
    return AdsWorkspaceMoney(minor, currency)
}

private fun JSONArray?.moneyList(): List<AdsWorkspaceMoney> = this?.let { rows ->
    buildList {
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: error("Nantty returned an invalid top-up suggestion.")
            add(row.toAdsBalanceMoney())
        }
    }
}.orEmpty()

private fun AdsWorkspaceMoney.toJson(): JSONObject = JSONObject().put("amountMinor", amountMinor).put("currency", currency)

private fun encodeAdsBalanceQuery(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20")

private const val ADS_BALANCE_MAX_RESPONSE_BYTES = 1_048_576
private val ADS_BALANCE_IDEMPOTENCY = Regex("^[A-Za-z0-9_-]{8,128}$")
private val ADS_BALANCE_CURSOR = Regex("^[A-Za-z0-9_-]{1,256}$")
