package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

internal data class SavedCardSetup(
    val reference: String,
    val checkoutUrl: String,
)

internal data class SavedCardSummary(
    val savedCardId: String,
    val brand: String,
    val last4: String,
    val expiryMonth: Int,
    val expiryYear: Int,
)

internal enum class SavedCardChargeStatus {
    PAID,
    PENDING,
    PROCESSING,
    FAILED,
    REQUIRES_AUTHENTICATION,
    REQUIRES_CHECKOUT,
}

internal data class SavedCardCharge(
    val status: SavedCardChargeStatus,
    val actionUrl: String? = null,
)

internal sealed interface SavedCardResult<out T> {
    data class Success<T>(val value: T) : SavedCardResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SavedCardResult<Nothing>
}

/** Uses only the public saved-card API fields; card PANs and provider authorization codes are never read. */
internal class SavedCardRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: CheckoutTransport = JdkCheckoutTransport(baseUrl),
) {
    fun startSetup(idempotencyKey: String): SavedCardResult<SavedCardSetup> = runCatching {
        require(isValidIdempotencyKey(idempotencyKey))
        val token = requireToken()
        val payload = transport.post(SETUPS_PATH, token, JSONObject(), idempotencyKey)
        val data = payload.savedCardData()
        SavedCardSetup(
            reference = data.requiredReference("reference"),
            checkoutUrl = data.requiredHttpsUrl("checkoutUrl"),
        )
    }.fold(
        onSuccess = { SavedCardResult.Success(it) },
        onFailure = { SavedCardResult.Failure(safeFailure(it), it.requiresAuthentication()) },
    )

    fun completeSetup(reference: String): SavedCardResult<SavedCardSummary> = runCatching {
        require(isValidReference(reference))
        val token = requireToken()
        val payload = transport.post("$SETUPS_PATH/$reference/complete", token, JSONObject())
        val data = payload.savedCardData()
        val id = data.optString("savedCardId")
        require(isValidUuid(id))
        val brand = data.optString("brand").filterNot(Char::isISOControl).trim().take(MAX_BRAND_LENGTH)
        val last4 = data.optString("last4")
        val expiryMonth = data.optInt("expiryMonth", INVALID_NUMBER)
        val expiryYear = data.optInt("expiryYear", INVALID_NUMBER)
        require(brand.isNotBlank() && last4.matches(LAST4_PATTERN) && expiryMonth in 1..12 && expiryYear in MIN_EXPIRY_YEAR..MAX_EXPIRY_YEAR)
        SavedCardSummary(id, brand, last4, expiryMonth, expiryYear)
    }.fold(
        onSuccess = { SavedCardResult.Success(it) },
        onFailure = { SavedCardResult.Failure(safeFailure(it), it.requiresAuthentication()) },
    )

    fun charge(
        paymentReference: String,
        savedCardId: String,
        idempotencyKey: String,
    ): SavedCardResult<SavedCardCharge> = runCatching {
        require(isValidReference(paymentReference) && isValidUuid(savedCardId) && isValidIdempotencyKey(idempotencyKey))
        val token = requireToken()
        val payload = transport.post(
            CHARGES_PATH,
            token,
            JSONObject().put("paymentReference", paymentReference).put("savedCardId", savedCardId),
            idempotencyKey,
        )
        val data = payload.savedCardData()
        val status = when (data.optString("status").lowercase()) {
            "succeeded", "paid" -> SavedCardChargeStatus.PAID
            "pending" -> SavedCardChargeStatus.PENDING
            "processing" -> SavedCardChargeStatus.PROCESSING
            "failed" -> SavedCardChargeStatus.FAILED
            "requires_authentication" -> SavedCardChargeStatus.REQUIRES_AUTHENTICATION
            "requires_checkout" -> SavedCardChargeStatus.REQUIRES_CHECKOUT
            else -> error("Unknown saved-card charge status")
        }
        val actionUrl = when (status) {
            SavedCardChargeStatus.REQUIRES_AUTHENTICATION -> data.optionalHttpsUrl("authorizationUrl")
                ?: data.optionalHttpsUrl("checkoutUrl")
            SavedCardChargeStatus.REQUIRES_CHECKOUT -> data.optionalHttpsUrl("checkoutUrl")
            else -> null
        }
        SavedCardCharge(status, actionUrl)
    }.fold(
        onSuccess = { SavedCardResult.Success(it) },
        onFailure = { SavedCardResult.Failure(safeFailure(it), it.requiresAuthentication()) },
    )

    private fun requireToken(): String =
        sessionProvider()?.accessToken?.takeIf(String::isNotBlank) ?: throw MissingSavedCardSessionException

    private fun Throwable.requiresAuthentication(): Boolean =
        this === MissingSavedCardSessionException || this is CheckoutHttpException && statusCode in AUTH_FAILURE_STATUSES

    private fun safeFailure(error: Throwable): String = when {
        error.requiresAuthentication() -> AUTH_FAILURE_MESSAGE
        else -> GENERIC_FAILURE_MESSAGE
    }

    private fun isValidReference(value: String): Boolean =
        value.length <= MAX_REFERENCE_LENGTH && REFERENCE_PATTERN.matches(value) && !value.contains("..")

    private fun isValidUuid(value: String): Boolean = UUID_PATTERN.matches(value)

    private fun isValidIdempotencyKey(value: String): Boolean = IDEMPOTENCY_KEY_PATTERN.matches(value)

    private companion object {
        const val SETUPS_PATH = "/api/v1/payments/saved-cards/setups"
        const val CHARGES_PATH = "/api/v1/payments/saved-cards/charges"
        const val MAX_REFERENCE_LENGTH = 80
        const val MAX_BRAND_LENGTH = 40
        const val MIN_EXPIRY_YEAR = 2000
        const val MAX_EXPIRY_YEAR = 2200
        const val INVALID_NUMBER = -1
        const val AUTH_FAILURE_MESSAGE = "Your session has expired. Sign in again to continue."
        const val GENERIC_FAILURE_MESSAGE = "Couldn't complete this saved-card request. Check your connection and try again."
        val AUTH_FAILURE_STATUSES = setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)
        val REFERENCE_PATTERN = Regex("[A-Za-z0-9_.=-]{1,80}")
        val IDEMPOTENCY_KEY_PATTERN = Regex("[A-Za-z0-9_-]{8,128}")
        val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}")
        val LAST4_PATTERN = Regex("[0-9]{4}")
    }
}

private fun JSONObject.savedCardData(): JSONObject = optJSONObject("data") ?: this

private fun JSONObject.requiredReference(name: String): String = optString(name).also {
    require(it.length <= 80 && it.matches(Regex("[A-Za-z0-9_.=-]{1,80}")) && !it.contains(".."))
}

private fun JSONObject.requiredHttpsUrl(name: String): String =
    optionalHttpsUrl(name) ?: error("Missing secure saved-card checkout URL")

private fun JSONObject.optionalHttpsUrl(name: String): String? = optString(name).takeIf(String::isNotBlank)?.let { value ->
    val url = URL(value)
    require(url.protocol == "https" && url.host.isNotBlank() && url.userInfo == null)
    url.toString()
}

private object MissingSavedCardSessionException : Exception()
