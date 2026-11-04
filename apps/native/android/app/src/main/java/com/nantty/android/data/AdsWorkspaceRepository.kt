package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Base64

data class AdsWorkspaceMoney(val amountMinor: Long, val currency: String)

enum class AdsWorkspaceBoostStatus(val apiValue: String, val label: String) {
    PENDING_PAYMENT("pending_payment", "Waiting for payment"),
    IN_REVIEW("in_review", "In review"),
    ACTIVE("active", "Active"),
    PAUSED("paused", "Paused"),
    COMPLETED("completed", "Completed"),
    REJECTED("rejected", "Rejected"),
    CANCELLED("cancelled", "Stopped");

    companion object {
        fun parse(value: String): AdsWorkspaceBoostStatus? = entries.firstOrNull { it.apiValue == value }
    }
}

enum class AdsWorkspaceFilter(val label: String, val statuses: List<AdsWorkspaceBoostStatus>) {
    ALL("All", emptyList()),
    IN_REVIEW("In review", listOf(AdsWorkspaceBoostStatus.IN_REVIEW, AdsWorkspaceBoostStatus.PENDING_PAYMENT)),
    ACTIVE("Active", listOf(AdsWorkspaceBoostStatus.ACTIVE)),
    PAUSED("Paused", listOf(AdsWorkspaceBoostStatus.PAUSED)),
    COMPLETED("Completed", listOf(AdsWorkspaceBoostStatus.COMPLETED, AdsWorkspaceBoostStatus.CANCELLED)),
    REJECTED("Rejected", listOf(AdsWorkspaceBoostStatus.REJECTED)),
}

data class AdsWorkspaceBoost(
    val id: String,
    val status: AdsWorkspaceBoostStatus,
    val destinationType: String,
    val goal: String,
    val totalBudget: AdsWorkspaceMoney,
    val spent: AdsWorkspaceMoney,
    val keyResultLabel: String,
    val keyResultValue: Long,
    val endsAt: String?,
    val durationDays: Int,
    val rejectionReason: String?,
)

data class AdsWorkspaceBoostPage(val boosts: List<AdsWorkspaceBoost>, val nextCursor: String?)

data class AdsWorkspaceBalance(
    val spendable: AdsWorkspaceMoney,
    val balance: AdsWorkspaceMoney,
    val credit: AdsWorkspaceMoney,
    val committed: AdsWorkspaceMoney,
    val withdrawable: AdsWorkspaceMoney,
    val pendingSettlement: AdsWorkspaceMoney,
)

sealed interface AdsWorkspaceResult<out T> {
    data class Success<T>(val value: T) : AdsWorkspaceResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : AdsWorkspaceResult<Nothing>
}

fun interface AdsWorkspaceTransport {
    fun get(path: String, accessToken: String): JSONObject
}

class AdsWorkspaceRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: AdsWorkspaceTransport = JdkAdsWorkspaceTransport(baseUrl),
    private val refreshSessionProvider: () -> AccountSession? = { null },
) {
    fun loadBoosts(filter: AdsWorkspaceFilter = AdsWorkspaceFilter.ALL, cursor: String? = null): AdsWorkspaceResult<AdsWorkspaceBoostPage> = try {
        val session = requireSession("view your ads")
        require(cursor == null || isAdsWorkspaceCursor(cursor)) { "This ads page cursor is invalid. Refresh your ads and try again." }
        val path = buildAdsWorkspaceBoostsPath(filter, cursor)
        val payload = requestWithRefresh(path, session.accessToken)
        AdsWorkspaceResult.Success(parseBoostPage(payload))
    } catch (error: Exception) {
        AdsWorkspaceResult.Failure(
            error.message ?: "Could not load ads. Check your connection and try again.",
            authenticationRequired = error is AdsWorkspaceHttpException && error.statusCode in setOf(401, 403),
        )
    }

    fun loadBalance(): AdsWorkspaceResult<AdsWorkspaceBalance> = try {
        val session = requireSession("view your ad balance")
        val payload = requestWithRefresh("/api/v1/ads/boosts/balance", session.accessToken)
        AdsWorkspaceResult.Success(parseBalance(payload))
    } catch (error: Exception) {
        AdsWorkspaceResult.Failure(
            error.message ?: "Could not load your ad balance. Check your connection and try again.",
            authenticationRequired = error is AdsWorkspaceHttpException && error.statusCode in setOf(401, 403),
        )
    }

    private fun requireSession(action: String): AccountSession {
        val session = sessionProvider() ?: error("Sign in to $action.")
        require(session.accessToken.isNotBlank()) { "Sign in to $action." }
        return session
    }

    private fun requestWithRefresh(path: String, accessToken: String): JSONObject = try {
        transport.get(path, accessToken)
    } catch (error: AdsWorkspaceHttpException) {
        if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
        val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw AdsWorkspaceHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
        transport.get(path, refreshed)
    }

    internal fun parseBoostPage(payload: JSONObject): AdsWorkspaceBoostPage {
        val page = payload.optJSONObject("data")?.takeIf { it.has("nextCursor") || it.has("data") || it.has("items") } ?: payload
        val rows = page.optJSONArray("data") ?: page.optJSONArray("items")
            ?: error("Nantty returned an incomplete ads response.")
        val boosts = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: error("Nantty returned an invalid ad entry.")
                add(parseBoost(row))
            }
        }
        val cursor = page.optNullableAdsString("nextCursor")?.also {
            require(isAdsWorkspaceCursor(it)) { "Nantty returned an invalid ads page cursor." }
        }
        return AdsWorkspaceBoostPage(boosts, cursor)
    }

    internal fun parseBalance(payload: JSONObject): AdsWorkspaceBalance {
        val data = payload.optJSONObject("data") ?: payload
        return AdsWorkspaceBalance(
            spendable = data.requiredMoney("spendable"),
            balance = data.requiredMoney("balance"),
            credit = data.requiredMoney("credit"),
            committed = data.requiredMoney("committed"),
            withdrawable = data.requiredMoney("withdrawable"),
            pendingSettlement = data.requiredMoney("pendingSettlement"),
        )
    }

    private fun parseBoost(row: JSONObject): AdsWorkspaceBoost {
        val id = row.optNullableAdsString("id")?.takeIf(::isAdsWorkspaceUuid)
            ?: error("Nantty returned an ad with an invalid identity.")
        val status = AdsWorkspaceBoostStatus.parse(row.optString("status"))
            ?: error("Nantty returned an ad with an unknown status.")
        val destination = row.optNullableAdsString("destinationType")
            ?.takeIf { it in DESTINATION_TYPES } ?: error("Nantty returned an ad with an invalid destination.")
        val goal = row.optNullableAdsString("goal")
            ?.takeIf { it in BOOST_GOALS } ?: error("Nantty returned an ad with an invalid goal.")
        val results = row.optJSONObject("results") ?: error("Nantty returned an incomplete ad result.")
        val keyResult = row.optJSONObject("keyResult") ?: error("Nantty returned an incomplete ad result.")
        val keyResultLabel = keyResult.optNullableAdsString("label")
            ?: error("Nantty returned an incomplete ad result.")
        val keyResultValue = keyResult.requiredNonNegativeLong("value")
        results.requiredNonNegativeLong("impressions")
        results.requiredNonNegativeLong("reach")
        results.requiredNonNegativeLong("clicks")
        results.requiredNonNegativeLong("profileVisits")
        results.requiredNonNegativeLong("storeVisits")
        results.requiredNonNegativeLong("productVisits")
        results.requiredNonNegativeLong("messages")
        val duration = row.requiredNonNegativeInt("durationDays")
        return AdsWorkspaceBoost(
            id = id,
            status = status,
            destinationType = destination,
            goal = goal,
            totalBudget = row.requiredMoney("totalBudget"),
            spent = row.requiredMoney("spent"),
            keyResultLabel = keyResultLabel,
            keyResultValue = keyResultValue,
            endsAt = row.optNullableAdsString("endsAt"),
            durationDays = duration,
            rejectionReason = row.optNullableAdsString("rejectionReason"),
        )
    }

    companion object {
        const val PAGE_SIZE = 20
        private val DESTINATION_TYPES = setOf("post", "profile", "store", "product")
        private val BOOST_GOALS = setOf("views", "profile_visits", "messages", "store_visits", "product_visits")
    }
}

internal fun buildAdsWorkspaceBoostsPath(filter: AdsWorkspaceFilter, cursor: String? = null): String = buildString {
    append("/api/v1/ads/boosts?")
    val query = mutableListOf<String>()
    if (filter.statuses.isNotEmpty()) {
        val statuses = filter.statuses.joinToString(",") { it.apiValue }
        query += "status=${encodeAdsWorkspaceQuery(statuses)}"
    }
    cursor?.let { query += "cursor=${encodeAdsWorkspaceQuery(it)}" }
    query += "limit=${AdsWorkspaceRepository.PAGE_SIZE}"
    append(query.joinToString("&"))
}

internal fun isAdsWorkspaceUuid(value: String): Boolean = runCatching { java.util.UUID.fromString(value).toString() == value.lowercase() }.getOrDefault(false)

internal fun isAdsWorkspaceCursor(value: String): Boolean {
    if (value.isBlank() || value.length > 64 || value.any { !(it.isLetterOrDigit() || it == '-' || it == '_') }) return false
    val decoded = runCatching { Base64.getUrlDecoder().decode(value) }.getOrNull() ?: return false
    val uuid = runCatching { String(decoded, StandardCharsets.UTF_8) }.getOrNull() ?: return false
    return isAdsWorkspaceUuid(uuid)
}

private fun encodeAdsWorkspaceQuery(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20")

private fun JSONObject.requiredMoney(key: String): AdsWorkspaceMoney {
    val money = optJSONObject(key) ?: error("Nantty returned an incomplete ad balance.")
    val amountValue = money.opt("amountMinor")
    val amount = (amountValue as? Number)?.toString()?.let { runCatching { BigDecimal(it).longValueExact() }.getOrNull() }
        ?: error("Nantty returned an invalid ad balance amount.")
    val currency = money.optNullableAdsString("currency")
        ?.takeIf { it.matches(Regex("[A-Z]{3}")) } ?: error("Nantty returned an invalid ad balance currency.")
    return AdsWorkspaceMoney(amount, currency)
}

private fun JSONObject.requiredNonNegativeLong(key: String): Long {
    val value = opt(key) as? Number ?: error("Nantty returned an incomplete ad result.")
    val parsed = runCatching { BigDecimal(value.toString()).longValueExact() }.getOrNull()
        ?: error("Nantty returned an invalid ad result.")
    require(parsed >= 0) { "Nantty returned an invalid ad result." }
    return parsed
}

private fun JSONObject.requiredNonNegativeInt(key: String): Int {
    val value = requiredNonNegativeLong(key)
    require(value <= Int.MAX_VALUE) { "Nantty returned an invalid ad duration." }
    return value.toInt()
}

private fun JSONObject.optNullableAdsString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private class JdkAdsWorkspaceTransport(private val baseUrl: String) : AdsWorkspaceTransport {
    override fun get(path: String, accessToken: String): JSONObject {
        require(path.startsWith("/api/v1/ads/boosts?") || path == "/api/v1/ads/boosts/balance") { "Unsupported ads workspace request." }
        require(accessToken.isNotBlank()) { "Sign in to view ads." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view ads.")
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
            if (status !in 200..299) throw AdsWorkspaceHttpException(status)
            val response = connection.inputStream.use(::readAdsWorkspaceResponse)
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readAdsWorkspaceResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large ads response." }
            output.write(buffer, 0, read)
        }
        return output.toString(StandardCharsets.UTF_8.name())
    }

    companion object { private const val MAX_RESPONSE_BYTES = 1_048_576 }
}

internal class AdsWorkspaceHttpException(val statusCode: Int) : Exception(
    if (statusCode == 401 || statusCode == 403) "Your session has expired. Sign in again to view ads."
    else "Ads request failed (HTTP $statusCode). Please try again.",
)
