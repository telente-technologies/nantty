package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.text.NumberFormat
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

data class WalletMoney(val amountMinor: Long, val currency: String)
data class WalletLine(val key: String, val label: String, val description: String, val amount: WalletMoney)
data class WalletCoins(val spendable: Long, val earned: Long)
data class WalletVerification(val withdrawalsUnlocked: Boolean, val message: String?)
data class WalletTransaction(
    val id: String,
    val kind: String,
    val amount: WalletMoney,
    val description: String,
    val createdAt: String,
    val status: String,
)
data class WalletTransactionPage(val items: List<WalletTransaction>, val nextCursor: String?)
data class WalletSummary(
    val available: WalletMoney,
    val pending: WalletMoney,
    val lines: List<WalletLine>,
    val coins: WalletCoins,
    val verification: WalletVerification,
)

sealed interface WalletResult {
    data class Success(val wallet: WalletSummary) : WalletResult
    data class Failure(val message: String) : WalletResult
}

sealed interface WalletTransactionsResult {
    data class Success(val page: WalletTransactionPage) : WalletTransactionsResult
    data class Failure(val message: String) : WalletTransactionsResult
}

fun interface WalletTransport {
    fun get(path: String, accessToken: String?): JSONObject
}

class WalletRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: WalletTransport = JdkWalletTransport(baseUrl),
) {
    fun load(): WalletResult = try {
        val session = sessionProvider() ?: error("Sign in to view your wallet.")
        val payload = transport.get("/api/v1/wallets/me", session.accessToken)
        WalletResult.Success(parse(payload.optJSONObject("data") ?: payload))
    } catch (error: Exception) {
        WalletResult.Failure(error.message ?: "Could not load your wallet. Check your connection and try again.")
    }

    fun loadRecentTransactions(cursor: String? = null): WalletTransactionsResult = try {
        val session = sessionProvider() ?: error("Sign in to view your wallet transactions.")
        val accessToken = session.accessToken.takeIf(String::isNotBlank) ?: error("Sign in to view your wallet transactions.")
        val path = buildString {
            append("/api/v1/wallets/me/transactions?limit=20")
            cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${encodeWalletQuery(it)}") }
        }
        val payload = transport.get(path, accessToken)
        val data = payload.optJSONObject("data") ?: payload
        val rows = data.optJSONArray("data")
            ?: error("Nantty returned an incomplete transaction history.")
        val transactions = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(String::isNotBlank) ?: continue
                val amount = row.optJSONObject("amount")?.toWalletMoney() ?: continue
                val kind = row.optString("kind").takeIf { it == "credit" || it == "debit" } ?: continue
                val status = row.optString("status").takeIf { it in setOf("pending", "completed", "failed") } ?: "unknown"
                add(
                    WalletTransaction(
                        id = id,
                        kind = kind,
                        amount = amount,
                        description = row.optString("description").takeIf { it.isNotBlank() && it != "null" } ?: "Wallet transaction",
                        createdAt = row.optString("createdAt"),
                        status = status,
                    ),
                )
            }
        }
        val nextCursor = data.optString("nextCursor").takeIf { it.isNotBlank() && it != "null" }
        WalletTransactionsResult.Success(WalletTransactionPage(transactions, nextCursor))
    } catch (error: Exception) {
        WalletTransactionsResult.Failure(error.message ?: "Could not load wallet transactions. Check your connection and try again.")
    }

    internal fun parse(payload: JSONObject): WalletSummary {
        val available = payload.optJSONObject("available")?.toWalletMoney() ?: error("Nantty returned an incomplete wallet.")
        val pending = payload.optJSONObject("pending")?.toWalletMoney() ?: error("Nantty returned an incomplete wallet.")
        val linesJson = payload.optJSONArray("lines") ?: JSONArray()
        val lines = buildList {
            for (index in 0 until linesJson.length()) {
                val row = linesJson.optJSONObject(index) ?: continue
                val amount = row.optJSONObject("amount")?.toWalletMoney() ?: continue
                val label = row.optString("label").takeIf(String::isNotBlank) ?: continue
                add(WalletLine(row.optString("key"), label, row.optString("description"), amount))
            }
        }.ifEmpty {
            listOf(
                WalletLine("available", "Available to withdraw", "Sales and creator earnings available after amounts owed.", available),
                WalletLine("pending", "Pending (escrow)", "Order money held until the buyer confirms delivery.", pending),
            )
        }
        val coins = payload.optJSONObject("coins")
        val verification = payload.optJSONObject("verification")
        return WalletSummary(
            available = available,
            pending = pending,
            lines = lines,
            coins = WalletCoins(coins?.optLong("spendable")?.coerceAtLeast(0) ?: 0, coins?.optLong("earned")?.coerceAtLeast(0) ?: 0),
            verification = WalletVerification(
                withdrawalsUnlocked = verification?.optBoolean("withdrawalsUnlocked") ?: false,
                message = verification?.optNullableString("message"),
            ),
        )
    }
}

internal fun formatWalletAmount(money: WalletMoney, locale: Locale = Locale.getDefault()): String {
    if (money.currency == "COIN") return "${NumberFormat.getIntegerInstance(locale).format(money.amountMinor.coerceAtLeast(0))} ${if (money.amountMinor == 1L) "coin" else "coins"}"
    val currency = runCatching { java.util.Currency.getInstance(money.currency) }.getOrNull()
    val fractionDigits = currency?.defaultFractionDigits?.takeIf { it >= 0 } ?: 2
    val formatter = NumberFormat.getCurrencyInstance(locale).apply {
        if (currency != null) this.currency = currency
        minimumFractionDigits = fractionDigits
        maximumFractionDigits = fractionDigits
    }
    return formatter.format(BigDecimal.valueOf(money.amountMinor, fractionDigits))
}

private fun JSONObject.toWalletMoney() = WalletMoney(optLong("amountMinor"), optString("currency").ifBlank { "NGN" })
private fun JSONObject.optNullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
private fun encodeWalletQuery(value: String) = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

private class JdkWalletTransport(baseUrl: String) : WalletTransport {
    private val baseUrl = baseUrl

    override fun get(path: String, accessToken: String?): JSONObject {
        require(isAllowedWalletReadPath(path)) { "Unsupported wallet request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view your wallet.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
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
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) error("Wallet request failed (HTTP $status). Please try again.")
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= 1_048_576) { "Nantty returned an unexpectedly large wallet response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

private fun isAllowedWalletReadPath(path: String): Boolean {
    if (path == "/api/v1/wallets/me") return true
    val transactionPrefix = "/api/v1/wallets/me/transactions?"
    if (!path.startsWith(transactionPrefix)) return false
    val query = path.removePrefix(transactionPrefix).split('&')
    return query.firstOrNull() == "limit=20" && query.size in 1..2 &&
        (query.size == 1 || query[1].startsWith("cursor=") && query[1].removePrefix("cursor=").isNotBlank())
}
