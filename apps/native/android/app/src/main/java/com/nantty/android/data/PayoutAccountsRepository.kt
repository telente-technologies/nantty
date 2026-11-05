package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale

data class WalletPayoutAccount(
    val id: String,
    val bankCode: String,
    val bankName: String,
    val accountNumberMasked: String,
    val accountName: String,
    val countryCode: String,
    val isDefault: Boolean,
)

data class PayoutBank(val code: String, val name: String, val countryCode: String)

sealed interface PayoutAccountsResult {
    data class Success(val accounts: List<WalletPayoutAccount>) : PayoutAccountsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : PayoutAccountsResult
}

sealed interface PayoutBanksResult {
    data class Success(val banks: List<PayoutBank>) : PayoutBanksResult
    data class Failure(val message: String) : PayoutBanksResult
}

sealed interface PayoutMutationResult {
    data object Success : PayoutMutationResult
    data class Failure(val message: String, val stepUpRequired: Boolean = false, val authenticationRequired: Boolean = false) : PayoutMutationResult
}

data class StepUpGrant(val token: String, val expiresInSeconds: Int)

interface PayoutAccountsTransport {
    fun request(method: String, path: String, accessToken: String?, body: JSONObject? = null, headers: Map<String, String> = emptyMap()): JSONObject
}

/** User-owned payout destinations; step-up grants are returned to the caller and never persisted. */
class PayoutAccountsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: PayoutAccountsTransport = JdkPayoutAccountsTransport(baseUrl),
) {
    fun list(): PayoutAccountsResult = try {
        val payload = authenticated { token -> transport.request("GET", PAYOUT_ACCOUNTS_PATH, token) }
        val rows = payload.optJSONArray("data") ?: payload.optJSONObject("data")?.optJSONArray("items")
            ?: error("Nantty returned an incomplete payout account list.")
        PayoutAccountsResult.Success(rows.toPayoutAccounts())
    } catch (error: Exception) {
        PayoutAccountsResult.Failure(error.message ?: "Could not load payout accounts. Try again.", error.isAuthenticationFailure())
    }

    fun currentEmail(): String? = sessionProvider()?.user?.email

    fun listBanks(countryCode: String): PayoutBanksResult = try {
        val country = countryCode.trim().uppercase(Locale.ROOT)
        require(country.matches(Regex("^[A-Z]{2}$"))) { "Choose a valid country to load banks." }
        val path = "$BANKS_PATH?country=${URLEncoder.encode(country, Charsets.UTF_8.name())}"
        val payload = authenticated { token -> transport.request("GET", path, token) }
        val rows = payload.optJSONArray("data") ?: payload.optJSONObject("data")?.optJSONArray("items")
            ?: error("Nantty returned an incomplete bank list.")
        val banks = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val code = row.optString("code").takeIf(String::isNotBlank) ?: continue
                val name = row.optString("name").takeIf(String::isNotBlank) ?: continue
                add(PayoutBank(code, name, row.optString("countryCode").ifBlank { country }))
            }
        }
        PayoutBanksResult.Success(banks)
    } catch (error: Exception) {
        PayoutBanksResult.Failure(error.message ?: "Could not load banks. Try again.")
    }

    fun grantWithPassword(password: String): Result<StepUpGrant> = runCatching {
        require(password.isNotEmpty()) { "Enter your password." }
        grantStepUp(JSONObject().put("password", password))
    }

    fun sendEmailCode(email: String): Result<Unit> = runCatching {
        require(email.isNotBlank()) { "An email address is not available for this account." }
        transport.request(
            "POST", OTP_SEND_PATH, null,
            JSONObject().put("destination", email.trim()).put("purpose", "login"),
        )
        Unit
    }

    fun grantWithEmailCode(email: String, code: String): Result<StepUpGrant> = runCatching {
        require(email.isNotBlank() && code.matches(Regex("^\\d{6}$"))) { "Enter the 6-digit code sent to your email." }
        val verified = transport.request(
            "POST", OTP_VERIFY_PATH, null,
            JSONObject().put("destination", email.trim()).put("code", code).put("purpose", "login"),
        )
        val verifiedData = verified.optJSONObject("data") ?: verified
        val otpToken = verifiedData.optString("otpToken").takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete code verification response.")
        grantStepUp(JSONObject().put("otpToken", otpToken))
    }

    fun add(bankCode: String, accountNumber: String, stepUpToken: String): PayoutMutationResult = mutate {
        // Match RN's form and payload. Country is omitted; the API's payout route defaults to NG.
        require(bankCode.isNotBlank() && accountNumber.matches(Regex("^\\d{10}$"))) { "Enter a valid bank account number." }
        require(stepUpToken.isNotBlank()) { "Confirm it's you to continue." }
        // This route has no Idempotency-Key contract. The server deduplicates by the user's
        // bank/account fingerprint; step-up is single-use and is sent only in this header.
        authenticated { token ->
            transport.request(
                "POST", PAYOUT_ACCOUNTS_PATH, token,
                JSONObject().put("bankCode", bankCode).put("accountNumber", accountNumber),
                mapOf(STEP_UP_HEADER to stepUpToken),
            )
        }
    }

    fun remove(accountId: String, stepUpToken: String): PayoutMutationResult = mutate {
        require(accountId.matches(Regex("^[0-9a-fA-F-]{36}$"))) { "Choose a valid payout account." }
        require(stepUpToken.isNotBlank()) { "Confirm it's you to continue." }
        authenticated { token ->
            transport.request(
                "DELETE", "$PAYOUT_ACCOUNTS_PATH/$accountId", token, headers = mapOf(STEP_UP_HEADER to stepUpToken),
            )
        }
    }

    private fun grantStepUp(body: JSONObject): StepUpGrant {
        val payload = authenticated { token -> transport.request("POST", STEP_UP_PATH, token, body) }
        val data = payload.optJSONObject("data") ?: payload
        return StepUpGrant(
            token = data.optString("stepUpToken").takeIf(String::isNotBlank)
                ?: error("Nantty returned an incomplete identity confirmation."),
            expiresInSeconds = data.optInt("expiresIn").coerceAtLeast(0),
        )
    }

    private fun <T> authenticated(call: (String) -> T): T {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to manage payout accounts.")
        return try {
            call(session.accessToken)
        } catch (failure: PayoutHttpException) {
            if (failure.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw failure
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw PayoutHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
            call(refreshed)
        }
    }

    private fun mutate(action: () -> Unit): PayoutMutationResult = try {
        action()
        PayoutMutationResult.Success
    } catch (error: Exception) {
        val apiError = error as? PayoutHttpException
        PayoutMutationResult.Failure(
            error.message ?: "The payout account could not be changed. Try again.",
            stepUpRequired = apiError?.code in setOf("STEP_UP_REQUIRED", "STEP_UP_REUSED"),
            authenticationRequired = error.isAuthenticationFailure(),
        )
    }

    private fun Exception.isAuthenticationFailure(): Boolean = this is PayoutHttpException && statusCode in setOf(401, 403)

    private fun JSONArray.toPayoutAccounts(): List<WalletPayoutAccount> = buildList {
        for (index in 0 until length()) {
            val row = optJSONObject(index) ?: error("Nantty returned an invalid payout account.")
            add(
                WalletPayoutAccount(
                    id = row.requiredString("id"),
                    bankCode = row.requiredString("bankCode"),
                    bankName = row.requiredString("bankName"),
                    accountNumberMasked = row.requiredString("accountNumberMasked"),
                    accountName = row.requiredString("accountName"),
                    countryCode = row.requiredString("countryCode"),
                    isDefault = row.optBoolean("isDefault"),
                ),
            )
        }
    }

    private fun JSONObject.requiredString(key: String): String = optString(key).takeIf { it.isNotBlank() && it != "null" }
        ?: error("Nantty returned an incomplete payout account.")

    companion object {
        const val PAYOUT_ACCOUNTS_PATH = "/api/v1/wallets/me/payout-accounts"
        const val BANKS_PATH = "/api/v1/banks"
        const val STEP_UP_HEADER = "X-Step-Up-Token"
        const val STEP_UP_PATH = "/api/v1/auth/step-up"
        const val OTP_SEND_PATH = "/api/v1/auth/otp/send"
        const val OTP_VERIFY_PATH = "/api/v1/auth/otp/verify"
    }
}

internal class PayoutHttpException(
    val statusCode: Int,
    message: String,
    val code: String? = null,
) : IllegalStateException(message)

private class JdkPayoutAccountsTransport(private val baseUrl: String) : PayoutAccountsTransport {
    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, headers: Map<String, String>): JSONObject {
        require(path.startsWith(PayoutAccountsRepository.PAYOUT_ACCOUNTS_PATH) || path.startsWith(PayoutAccountsRepository.BANKS_PATH) ||
            path in setOf(PayoutAccountsRepository.STEP_UP_PATH, PayoutAccountsRepository.OTP_SEND_PATH, PayoutAccountsRepository.OTP_VERIFY_PATH)) {
            "Unsupported payout-account request."
        }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage payout accounts.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
            headers.forEach { (key, value) -> setRequestProperty(key, value) }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            body?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) {
                val failure = runCatching { JSONObject(response) }.getOrNull()
                val errorObject = failure?.optJSONObject("error") ?: failure?.optJSONObject("data") ?: failure
                throw PayoutHttpException(
                    status,
                    errorObject?.optString("message")?.takeIf(String::isNotBlank) ?: "Payout account request failed (HTTP $status). Try again.",
                    errorObject?.optString("code")?.takeIf(String::isNotBlank),
                )
            }
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}
