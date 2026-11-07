package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class AccountHealthContent(val type: String, val id: String)
data class AccountHealthStrike(
    val id: String,
    val kind: String,
    val policy: String,
    val reason: String,
    val source: String,
    val issuedAt: String,
    val expiresAt: String?,
    val status: String,
    val appealStatus: String,
    val canAppeal: Boolean,
    val affectedContent: AccountHealthContent?,
)
data class AccountHealthNotice(
    val claimId: String,
    val state: String,
    val workTitle: String,
    val claimantName: String,
    val reason: String,
    val decidedAt: String,
    val deadlineAt: String?,
    val canCounterNotice: Boolean,
    val counterNoticeStatus: String?,
)
data class AccountHealthSummary(
    val status: String,
    val restrictions: Set<String>,
    val canMonetise: Boolean,
    val canGoLive: Boolean,
    val activeStrikeCount: Int,
    val copyrightStrikesInWindow: Int,
    val pendingTakedownCount: Int,
    val restrictionThreshold: Int,
    val strikeWindowDays: Int,
    val strikeLifetimeDays: Int,
    val takedownDeadlineHours: Int,
    val warnings: List<AccountHealthStrike>,
    val strikes: List<AccountHealthStrike>,
    val notices: List<AccountHealthNotice>,
)

sealed interface AccountHealthResult {
    data class Success(val health: AccountHealthSummary) : AccountHealthResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : AccountHealthResult
}

sealed interface AccountHealthActionResult {
    data object Success : AccountHealthActionResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : AccountHealthActionResult
}

fun interface AccountHealthTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject
}

class AccountHealthRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: AccountHealthTransport = JdkAccountHealthTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun load(): AccountHealthResult = execute {
        val response = transport.request("GET", ACCOUNT_HEALTH_PATH, it.accessToken, null)
        AccountHealthResult.Success(parseAccountHealth(response.optJSONObject("data") ?: response))
    }

    fun appeal(strikeId: String, message: String): AccountHealthActionResult = action {
        require(isSafeAccountHealthId(strikeId)) { "This appeal link is invalid." }
        require(message.trim().length in 1..2_000) { "Explain why you are appealing (up to 2,000 characters)." }
        transport.request("POST", "$ACCOUNT_HEALTH_PATH/strikes/${encodeAccountHealthPath(strikeId)}/appeal", it.accessToken, JSONObject().put("message", message.trim()))
        AccountHealthActionResult.Success
    }

    fun submitCounterNotice(claimId: String, statement: String, contactEmail: String, goodFaith: Boolean): AccountHealthActionResult = action {
        require(isSafeAccountHealthId(claimId)) { "This copyright notice link is invalid." }
        require(statement.trim().length in 20..5_000) { "Add a clear statement (20–5,000 characters)." }
        require(contactEmail.trim().matches(Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))) { "Enter a valid contact email." }
        require(goodFaith) { "Confirm the good-faith statement to continue." }
        transport.request(
            "POST",
            "/api/v1/copyright/claims/${encodeAccountHealthPath(claimId)}/counter-notices",
            it.accessToken,
            JSONObject().put("statement", statement.trim()).put("contactEmail", contactEmail.trim()).put("goodFaith", true),
        )
        AccountHealthActionResult.Success
    }

    private inline fun execute(block: (AccountSession) -> AccountHealthResult): AccountHealthResult = try {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return AccountHealthResult.Failure("Sign in to view your account status.", authenticationRequired = true)
        block(session)
    } catch (error: Exception) {
        AccountHealthResult.Failure(error.message ?: "Could not load account status. Try again.", error is AccountHealthHttpException && error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED)
    }

    private inline fun action(block: (AccountSession) -> AccountHealthActionResult): AccountHealthActionResult = try {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: return AccountHealthActionResult.Failure("Sign in to continue.", authenticationRequired = true)
        block(session)
    } catch (error: Exception) {
        AccountHealthActionResult.Failure(error.message ?: "Could not submit your request. Try again.", error is AccountHealthHttpException && error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED)
    }
}

internal fun parseAccountHealth(payload: JSONObject): AccountHealthSummary {
    val status = payload.optString("status").uppercase()
    require(status in setOf("GOOD_STANDING", "AT_RISK", "RESTRICTED")) { "Nantty returned an unsupported account status." }
    return AccountHealthSummary(
        status = status,
        restrictions = payload.optJSONArray("restrictions").readStringSet(),
        canMonetise = payload.optBoolean("canMonetise"),
        canGoLive = payload.optBoolean("canGoLive"),
        activeStrikeCount = payload.optNonNegativeInt("activeStrikeCount"),
        copyrightStrikesInWindow = payload.optNonNegativeInt("copyrightStrikesInWindow"),
        pendingTakedownCount = payload.optNonNegativeInt("pendingTakedownCount"),
        restrictionThreshold = payload.optNonNegativeInt("restrictionThreshold"),
        strikeWindowDays = payload.optNonNegativeInt("strikeWindowDays"),
        strikeLifetimeDays = payload.optNonNegativeInt("strikeLifetimeDays"),
        takedownDeadlineHours = payload.optNonNegativeInt("takedownDeadlineHours"),
        warnings = payload.optJSONArray("warnings").readStrikes(),
        strikes = payload.optJSONArray("strikes").readStrikes(),
        notices = payload.optJSONArray("notices").readNotices(),
    )
}

private fun JSONArray?.readStringSet(): Set<String> = buildSet {
    if (this@readStringSet == null) return@buildSet
    for (index in 0 until length()) optString(index).takeIf(String::isNotBlank)?.let(::add)
}

private fun JSONArray?.readStrikes(): List<AccountHealthStrike> = buildList {
    val rows = this@readStrikes ?: return@buildList
    for (index in 0 until rows.length()) {
        val row = rows.optJSONObject(index) ?: continue
        val id = row.optString("id").takeIf(::isSafeAccountHealthId) ?: continue
        val content = row.optJSONObject("affectedContent")?.let {
            val type = it.optString("type")
            val contentId = it.optString("id")
            if (type in setOf("clip", "post", "sound", "live") && isSafeAccountHealthId(contentId)) AccountHealthContent(type, contentId) else null
        }
        add(AccountHealthStrike(id, row.optString("kind"), row.optString("policy"), row.optString("reason"), row.optString("source"), row.optString("issuedAt"), row.optNullableText("expiresAt"), row.optString("status"), row.optString("appealStatus"), row.optBoolean("canAppeal"), content))
    }
}

private fun JSONArray?.readNotices(): List<AccountHealthNotice> = buildList {
    val rows = this@readNotices ?: return@buildList
    for (index in 0 until rows.length()) {
        val row = rows.optJSONObject(index) ?: continue
        val claimId = row.optString("claimId").takeIf(::isSafeAccountHealthId) ?: continue
        add(AccountHealthNotice(claimId, row.optString("state"), row.optString("workTitle"), row.optString("claimantName"), row.optString("reason"), row.optString("decidedAt"), row.optNullableText("deadlineAt"), row.optBoolean("canCounterNotice"), row.optNullableText("counterNoticeStatus")))
    }
}

private fun JSONObject.optNonNegativeInt(key: String): Int = optInt(key).coerceAtLeast(0)
private fun JSONObject.optNullableText(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
internal fun isSafeAccountHealthId(value: String): Boolean = value.length in 1..200 && value.all { it.isLetterOrDigit() || it == '_' || it == '-' }
internal fun encodeAccountHealthPath(value: String): String = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

private class AccountHealthHttpException(val statusCode: Int, message: String) : IllegalStateException(message)

private class JdkAccountHealthTransport(private val baseUrl: String) : AccountHealthTransport {
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view account status.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
        }
        try {
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val bytes = stream?.use { input -> ByteArrayOutputStream().also { output -> input.copyTo(output) }.toByteArray() } ?: ByteArray(0)
            val text = bytes.toString(Charsets.UTF_8)
            if (status !in 200..299) {
                val message = runCatching { JSONObject(text).optString("message") }.getOrNull()?.takeIf(String::isNotBlank)
                throw AccountHealthHttpException(status, message ?: "Request failed with status $status.")
            }
            return JSONObject(text.ifBlank { "{}" })
        } finally {
            connection.disconnect()
        }
    }
}

private const val ACCOUNT_HEALTH_PATH = "/api/v1/account/status"
