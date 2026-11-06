package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class LiveCoinTipReceipt(
    val tipId: String,
    val liveId: String,
    val coins: Long,
    val coinBalance: Long,
)

sealed interface LiveCoinTipResult {
    data class Success(val receipt: LiveCoinTipReceipt) : LiveCoinTipResult
    data class Failure(
        val message: String,
        val statusCode: Int? = null,
        val authenticationRequired: Boolean = false,
        val retryable: Boolean = false,
    ) : LiveCoinTipResult
}

fun interface LiveCoinTipTransport {
    fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject
}

/** Sends coin-only support to an active live through the shared, ledger-backed creator tips API. */
class LiveCoinTipRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: LiveCoinTipTransport = JdkLiveCoinTipTransport(baseUrl),
) {
    fun donate(
        liveId: String,
        coins: Long,
        idempotencyKey: String,
    ): LiveCoinTipResult {
        if (!SAFE_ID.matches(liveId) || coins !in 1..MAX_TIP_COINS || !SAFE_KEY.matches(idempotencyKey)) {
            return LiveCoinTipResult.Failure("This live coin donation is invalid.")
        }
        val initialSession = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return LiveCoinTipResult.Failure("Sign in to donate coins.", HttpURLConnection.HTTP_UNAUTHORIZED, authenticationRequired = true)

        return try {
            val receipt = send(initialSession, liveId, coins, idempotencyKey)
            LiveCoinTipResult.Success(receipt)
        } catch (error: LiveCoinTipHttpException) {
            if (error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED) {
                val refreshed = runCatching { refreshSessionProvider() }.getOrNull()?.takeIf { it.accessToken.isNotBlank() }
                    ?: return LiveCoinTipResult.Failure("Your session has expired. Sign in again to donate.", error.statusCode, authenticationRequired = true)
                try {
                    LiveCoinTipResult.Success(send(refreshed, liveId, coins, idempotencyKey))
                } catch (retryError: LiveCoinTipHttpException) {
                    failure(retryError)
                } catch (_: Exception) {
                    LiveCoinTipResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true)
                }
            } else {
                failure(error)
            }
        } catch (_: Exception) {
            LiveCoinTipResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true)
        }
    }

    private fun send(session: AccountSession, liveId: String, coins: Long, key: String): LiveCoinTipReceipt {
        val payload = transport.post(
            path = TIPS_PATH,
            accessToken = session.accessToken.trim(),
            idempotencyKey = key,
            body = JSONObject().put("targetType", "live").put("targetId", liveId).put("coins", coins),
        )
        val row = payload.optJSONObject("data") ?: payload
        val tipId = row.optString("tipId").takeIf(::isSafeId)
            ?: error("Nantty returned an invalid coin donation receipt.")
        val receiptCoins = row.optLong("coins", -1L)
        val balance = row.optLong("coinBalance", row.optLong("balance", -1L))
        require(receiptCoins == coins && balance >= 0L) { "Nantty returned an incomplete coin donation receipt." }
        return LiveCoinTipReceipt(tipId, liveId, receiptCoins, balance)
    }

    private fun failure(error: LiveCoinTipHttpException) = LiveCoinTipResult.Failure(
        message = when (error.statusCode) {
            HttpURLConnection.HTTP_UNAUTHORIZED -> "Your session has expired. Sign in again to donate."
            404 -> "This live is no longer available."
            409 -> "This donation could not be confirmed. Refresh and check your balance before trying again."
            422 -> "This host can't receive coin support right now, or your balance is too low."
            429 -> "Too many donation attempts. Wait a moment and try again."
            else -> "Couldn't send the coin donation. Please try again."
        },
        statusCode = error.statusCode,
        authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED,
        retryable = error.statusCode == 408 || error.statusCode == 429 || error.statusCode >= 500,
    )

    private companion object {
        const val TIPS_PATH = "/api/v1/tips"
        const val MAX_TIP_COINS = 100_000L
        val SAFE_ID = Regex("^[A-Za-z0-9_-]{1,80}$")
        val SAFE_KEY = Regex("^[A-Za-z0-9_-]{8,128}$")
    }
}

private class JdkLiveCoinTipTransport(private val baseUrl: String) : LiveCoinTipTransport {
    override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
        require(path == "/api/v1/tips")
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL before donating coins.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Idempotency-Key", idempotencyKey)
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val payload = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedTipResponse).orEmpty()
            if (status !in 200..299) throw LiveCoinTipHttpException(status)
            require(payload.isNotBlank()) { "Nantty returned an empty coin donation response." }
            return JSONObject(payload)
        } finally {
            connection.disconnect()
        }
    }
}

private fun readBoundedTipResponse(input: java.io.InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        require(output.size() + read <= 256 * 1024) { "Nantty returned an unexpectedly large donation response." }
        output.write(buffer, 0, read)
    }
    return output.toString(Charsets.UTF_8.name())
}

internal class LiveCoinTipHttpException(val statusCode: Int) : Exception()

private fun isSafeId(value: String) = Regex("^[A-Za-z0-9_-]{1,80}$").matches(value)
