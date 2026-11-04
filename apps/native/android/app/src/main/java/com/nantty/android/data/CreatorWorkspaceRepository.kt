package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

enum class CreatorDashboardPeriod(val apiValue: String, val label: String) {
    WEEK("week", "This week"), MONTH("month", "This month"), ALL("all", "All time"),
}

data class CreatorEligibilityRequirement(
    val key: String,
    val label: String,
    val currentValue: Int,
    val requiredValue: Int,
    val met: Boolean,
)

data class CreatorEligibility(
    val eligible: Boolean,
    val decision: String,
    val decisionNote: String,
    val requirements: List<CreatorEligibilityRequirement>,
)

data class CreatorApplication(
    val id: String,
    val status: String,
    val contentCategories: List<String>,
    val submittedAt: String,
    val reviewedAt: String?,
    val rejectionReason: String?,
    val reapplyAvailableAt: String?,
)

data class CreatorMoneyAmount(val amountMinor: Long, val currency: String)

data class CreatorDashboardEarnings(
    val gifts: CreatorMoneyAmount,
    val tips: CreatorMoneyAmount,
    val affiliateCommissions: CreatorMoneyAmount,
    val subscriptions: CreatorMoneyAmount,
    val adRevenue: CreatorMoneyAmount,
    val bonuses: CreatorMoneyAmount,
    val total: CreatorMoneyAmount,
)

data class CreatorTopContent(
    val id: String,
    val kind: String,
    val title: String,
    val thumbnailUrl: String?,
    val views: Long,
    val earnings: CreatorMoneyAmount,
)

data class CreatorDashboard(
    val period: CreatorDashboardPeriod,
    val earnings: CreatorDashboardEarnings,
    val pendingBalance: CreatorMoneyAmount,
    val availableBalance: CreatorMoneyAmount,
    val followersGained: Long,
    val topContent: List<CreatorTopContent>,
)

sealed interface CreatorWorkspaceResult<out T> {
    data class Success<T>(val value: T) : CreatorWorkspaceResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CreatorWorkspaceResult<Nothing>
}

fun interface CreatorWorkspaceTransport {
    fun get(path: String, accessToken: String): JSONObject
}

/** Read-only creator workspace access. Applications are never submitted from this repository. */
class CreatorWorkspaceRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: CreatorWorkspaceTransport = JdkCreatorWorkspaceTransport(baseUrl),
) {
    fun loadEligibility(): CreatorWorkspaceResult<CreatorEligibility> = request(ELIGIBILITY_PATH, ::parseCreatorEligibility)

    fun loadApplication(): CreatorWorkspaceResult<CreatorApplication?> = request(APPLICATION_PATH, ::parseCreatorApplication)

    fun loadDashboard(period: CreatorDashboardPeriod): CreatorWorkspaceResult<CreatorDashboard> =
        request("$DASHBOARD_PATH?period=${period.apiValue}") { parseCreatorDashboard(it, period) }

    private fun <T> request(path: String, parse: (JSONObject) -> T): CreatorWorkspaceResult<T> {
        return try {
            val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
                ?: return CreatorWorkspaceResult.Failure("Sign in to open Creator Studio.", authenticationRequired = true)
            val payload = try {
                transport.get(path, session.accessToken)
            } catch (error: CreatorWorkspaceHttpException) {
                if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
                val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                    ?: return CreatorWorkspaceResult.Failure("Your session has expired. Sign in again.", authenticationRequired = true)
                transport.get(path, refreshed)
            }
            CreatorWorkspaceResult.Success(parse(payload))
        } catch (error: Exception) {
            CreatorWorkspaceResult.Failure(
                error.message ?: "Creator Studio could not load. Check your connection and try again.",
                authenticationRequired = error is CreatorWorkspaceHttpException && error.statusCode in setOf(401, 403),
            )
        }
    }

    companion object {
        const val ELIGIBILITY_PATH = "/api/v1/creators/eligibility"
        const val APPLICATION_PATH = "/api/v1/creators/applications/me"
        const val DASHBOARD_PATH = "/api/v1/creators/dashboard"
    }
}

internal fun parseCreatorEligibility(payload: JSONObject): CreatorEligibility {
    val body = payload.creatorData()
    val rows = body.optJSONArray("requirements") ?: error("Nantty returned an incomplete creator eligibility response.")
    val requirements = buildList {
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val key = row.creatorRequiredString("key")
            val label = row.creatorRequiredString("label")
            add(CreatorEligibilityRequirement(
                key = key,
                label = label,
                currentValue = row.optInt("currentValue"),
                requiredValue = row.optInt("requiredValue"),
                met = row.optBoolean("met"),
            ))
        }
    }
    val decision = body.creatorRequiredString("decision")
    require(decision in setOf("auto_approve", "manual_review", "not_eligible")) { "Nantty returned an unknown creator eligibility decision." }
    return CreatorEligibility(body.optBoolean("eligible"), decision, body.creatorRequiredString("decisionNote"), requirements)
}

internal fun parseCreatorApplication(payload: JSONObject): CreatorApplication? {
    val value = if (payload.has("data")) payload.opt("data") else payload
    if (value == JSONObject.NULL || value == null) return null
    val body = value as? JSONObject ?: error("Nantty returned an incomplete creator application response.")
    val status = body.creatorRequiredString("status")
    require(status in setOf("pending", "approved", "rejected")) { "Nantty returned an unknown creator application status." }
    val categories = body.optJSONArray("contentCategories")?.stringValues().orEmpty()
    return CreatorApplication(
        id = body.creatorRequiredString("id"),
        status = status,
        contentCategories = categories,
        submittedAt = body.creatorRequiredString("submittedAt"),
        reviewedAt = body.creatorNullableString("reviewedAt"),
        rejectionReason = body.creatorNullableString("rejectionReason"),
        reapplyAvailableAt = body.creatorNullableString("reapplyAvailableAt"),
    )
}

internal fun parseCreatorDashboard(payload: JSONObject, requestedPeriod: CreatorDashboardPeriod): CreatorDashboard {
    val body = payload.creatorData()
    val returnedPeriod = CreatorDashboardPeriod.entries.firstOrNull { it.apiValue == body.creatorRequiredString("period") }
        ?: error("Nantty returned an unsupported creator dashboard period.")
    require(returnedPeriod == requestedPeriod) { "Nantty returned dashboard data for a different period." }
    val earnings = body.optJSONObject("earnings") ?: error("Nantty returned an incomplete creator earnings response.")
    val content = body.optJSONArray("topContent") ?: error("Nantty returned an incomplete creator content response.")
    return CreatorDashboard(
        period = returnedPeriod,
        earnings = CreatorDashboardEarnings(
            gifts = earnings.creatorMoney("gifts"),
            tips = earnings.creatorMoney("tips"),
            affiliateCommissions = earnings.creatorMoney("affiliateCommissions"),
            subscriptions = earnings.creatorMoney("subscriptions"),
            adRevenue = earnings.creatorMoney("adRevenue"),
            bonuses = earnings.creatorMoney("bonuses"),
            total = earnings.creatorMoney("total"),
        ),
        pendingBalance = body.creatorMoney("pendingBalance"),
        availableBalance = body.creatorMoney("availableBalance"),
        followersGained = body.optLong("followersGained").coerceAtLeast(0),
        topContent = buildList {
            for (index in 0 until content.length()) {
                val row = content.optJSONObject(index) ?: continue
                add(CreatorTopContent(
                    id = row.creatorRequiredString("id"),
                    kind = row.creatorRequiredString("kind"),
                    title = row.creatorRequiredString("title"),
                    thumbnailUrl = safeMediaUrl(row.creatorNullableString("thumbnailUrl")),
                    views = row.optLong("views").coerceAtLeast(0),
                    earnings = row.creatorMoney("earnings"),
                ))
            }
        },
    )
}

private fun JSONObject.creatorData(): JSONObject = optJSONObject("data") ?: this

private fun JSONObject.creatorRequiredString(key: String): String =
    optString(key).takeIf { it.isNotBlank() && it != "null" } ?: error("Nantty returned an incomplete creator response.")

private fun JSONObject.creatorNullableString(key: String): String? = optString(key)
    .takeIf { it.isNotBlank() && it != "null" }

private fun JSONObject.creatorMoney(key: String): CreatorMoneyAmount {
    val value = optJSONObject(key) ?: error("Nantty returned an incomplete creator amount.")
    val currency = value.creatorRequiredString("currency").uppercase()
    require(currency.matches(Regex("[A-Z]{3}"))) { "Nantty returned an invalid currency." }
    return CreatorMoneyAmount(value.optLong("amountMinor"), currency)
}

private fun JSONArray.stringValues(): List<String> = buildList {
    for (index in 0 until length()) optString(index).takeIf(String::isNotBlank)?.let(::add)
}

internal class CreatorWorkspaceHttpException(val statusCode: Int) : Exception(
    if (statusCode == 401 || statusCode == 403) "You don't have access to this Creator Studio information."
    else "Creator Studio request failed (HTTP $statusCode). Please try again.",
)

private class JdkCreatorWorkspaceTransport(private val baseUrl: String) : CreatorWorkspaceTransport {
    override fun get(path: String, accessToken: String): JSONObject {
        require(path == CreatorWorkspaceRepository.ELIGIBILITY_PATH ||
            path == CreatorWorkspaceRepository.APPLICATION_PATH ||
            CreatorDashboardPeriod.entries.any { path == "${CreatorWorkspaceRepository.DASHBOARD_PATH}?period=${it.apiValue}" }) {
            "Unsupported Creator Studio request."
        }
        require(accessToken.isNotBlank()) { "Sign in to open Creator Studio." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to open Creator Studio.")
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
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw CreatorWorkspaceHttpException(status)
            if (body.isBlank()) error("Nantty returned an empty Creator Studio response.")
            if (body.trim() == "null" && path == CreatorWorkspaceRepository.APPLICATION_PATH) {
                return JSONObject().put("data", JSONObject.NULL)
            }
            return JSONObject(body)
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
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large Creator Studio response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}
