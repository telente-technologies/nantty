package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection

internal data class CheckoutProviderWallet(
    val status: String,
    val currency: String,
    val availableMinor: Long,
    val depositHoldMinor: Long,
    val debtMinor: Long,
) {
    val spendableMinor: Long
        get() = (availableMinor + depositHoldMinor - debtMinor).coerceAtLeast(0L)
}

internal sealed interface ProviderWalletLoadResult {
    data class Success(val wallet: CheckoutProviderWallet?) : ProviderWalletLoadResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ProviderWalletLoadResult
}

internal sealed interface ProviderWalletPaymentResult {
    data object Success : ProviderWalletPaymentResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ProviderWalletPaymentResult
}

internal class ProviderWalletPaymentRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: CheckoutTransport = JdkCheckoutTransport(baseUrl),
) {
    fun loadWallet(): ProviderWalletLoadResult = runCatching {
        val token = requireToken()
        parseWallet(transport.get(WALLET_PATH, token))
    }.fold(
        onSuccess = { ProviderWalletLoadResult.Success(it) },
        onFailure = { ProviderWalletLoadResult.Failure(loadFailureMessage(it), it.requiresAuthentication()) },
    )

    fun payFromWallet(reference: String, idempotencyKey: String): ProviderWalletPaymentResult = runCatching {
        require(isValidPaymentReference(reference))
        require(isValidIdempotencyKey(idempotencyKey))
        val token = requireToken()
        val response = transport.post(
            path = "$WALLET_PAYMENT_PATH_PREFIX$reference",
            accessToken = token,
            body = JSONObject(),
            idempotencyKey = idempotencyKey,
        )
        val status = response.optJSONObject("data")?.optString("status") ?: response.optString("status")
        require(status.equals("succeeded", ignoreCase = true) || status.equals("paid", ignoreCase = true))
    }.fold(
        onSuccess = { ProviderWalletPaymentResult.Success },
        onFailure = { ProviderWalletPaymentResult.Failure(paymentFailureMessage(it), it.requiresAuthentication()) },
    )

    private fun requireToken(): String =
        sessionProvider()?.accessToken?.takeIf(String::isNotBlank) ?: throw MissingCheckoutSessionException

    private fun parseWallet(payload: JSONObject): CheckoutProviderWallet? {
        val response = payload.optJSONObject("data") ?: payload
        val wallet = response.optJSONObject("wallet")
        if (wallet == null) {
            require(response.optString("status").equals("not_ready", ignoreCase = true))
            return null
        }

        val status = wallet.optString("status").takeIf(String::isNotBlank) ?: error("Invalid wallet response")
        val walletCurrency = wallet.optString("currency")
        val balances = response.optJSONObject("balances") ?: error("Invalid wallet response")
        val balancesCurrency = balances.optString("currency")
        require(isCurrency(walletCurrency) && walletCurrency == balancesCurrency)

        return CheckoutProviderWallet(
            status = status,
            currency = balancesCurrency,
            availableMinor = balances.requiredLong("availableMinor"),
            depositHoldMinor = balances.requiredLong("depositHoldMinor"),
            debtMinor = balances.requiredLong("debtMinor"),
        )
    }

    private fun JSONObject.requiredLong(name: String): Long {
        val value = opt(name)
        require(value is Number)
        return value.toLong().also { require(value.toDouble() == it.toDouble()) }
    }

    private fun isCurrency(value: String): Boolean = value.matches(CURRENCY_PATTERN)

    private fun isValidPaymentReference(value: String): Boolean =
        value.length <= MAX_PAYMENT_REFERENCE_LENGTH && value.matches(PAYMENT_REFERENCE_PATTERN) && !value.contains("..")

    private fun isValidIdempotencyKey(value: String): Boolean = value.matches(IDEMPOTENCY_KEY_PATTERN)

    private fun Throwable.requiresAuthentication(): Boolean =
        this is CheckoutHttpException && statusCode in AUTH_FAILURE_STATUSES || this === MissingCheckoutSessionException

    private fun loadFailureMessage(error: Throwable): String = when {
        error.requiresAuthentication() -> AUTH_FAILURE_MESSAGE
        else -> "Couldn't load your payment wallet. Check your connection and try again."
    }

    private fun paymentFailureMessage(error: Throwable): String = when {
        error.requiresAuthentication() -> AUTH_FAILURE_MESSAGE
        else -> "Couldn't pay from your wallet. Review your balance or choose another payment method."
    }

    private companion object {
        const val WALLET_PATH = "/api/v1/payments/wallet/me"
        const val WALLET_PAYMENT_PATH_PREFIX = "/api/v1/payments/wallet-payments/"
        const val MAX_PAYMENT_REFERENCE_LENGTH = 80
        const val AUTH_FAILURE_MESSAGE = "Your session has expired. Sign in again to continue."
        val AUTH_FAILURE_STATUSES = setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)
        val CURRENCY_PATTERN = Regex("[A-Z]{3}")

        // Mirrors the backend payment-reference route character set, with its stricter checkout path limit.
        val PAYMENT_REFERENCE_PATTERN = Regex("[A-Za-z0-9_.=-]{1,80}")
        val IDEMPOTENCY_KEY_PATTERN = Regex("[A-Za-z0-9_-]{8,128}")
    }
}

private object MissingCheckoutSessionException : Exception()
