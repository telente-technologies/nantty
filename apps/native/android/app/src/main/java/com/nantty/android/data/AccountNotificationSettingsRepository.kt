package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class AccountNotificationSettings(val pushNotificationsEnabled: Boolean)

data class NotificationPreference(
    val category: String,
    val push: Boolean,
    val email: Boolean,
    val locked: Boolean,
)

enum class MarketingFrequency(val apiValue: String) {
    WEEKLY("weekly"),
    IMPORTANT_ONLY("important_only"),
    OFF("off"),
}

data class AccountMarketingSettings(
    val consentGranted: Boolean,
    val frequency: MarketingFrequency,
)

sealed interface AccountMarketingSettingsResult {
    data class Success(val settings: AccountMarketingSettings) : AccountMarketingSettingsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : AccountMarketingSettingsResult
}

sealed interface NotificationPreferencesResult {
    data class Success(val preferences: List<NotificationPreference>) : NotificationPreferencesResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : NotificationPreferencesResult
}

sealed interface AccountNotificationSettingsResult {
    data class Success(val settings: AccountNotificationSettings) : AccountNotificationSettingsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : AccountNotificationSettingsResult
}

interface AccountNotificationSettingsTransport {
    fun getSettings(accessToken: String): JSONObject
    fun updateSettings(accessToken: String, fields: JSONObject): JSONObject
}

interface NotificationPreferencesTransport {
    fun getPreferences(accessToken: String): JSONObject
    fun updatePreference(accessToken: String, fields: JSONObject): JSONObject
}

interface MarketingConsentTransport {
    fun request(method: String, path: String, accessToken: String, fields: JSONObject? = null): JSONObject
}

class AccountNotificationSettingsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: AccountNotificationSettingsTransport = JdkAccountNotificationSettingsTransport(baseUrl),
    private val preferencesTransport: NotificationPreferencesTransport = JdkNotificationPreferencesTransport(baseUrl),
    private val marketingConsentTransport: MarketingConsentTransport = JdkMarketingConsentTransport(baseUrl),
) {
    fun load(): AccountNotificationSettingsResult = execute { session ->
        parse(transport.getSettings(session.accessToken))
    }

    fun updatePushNotifications(enabled: Boolean): AccountNotificationSettingsResult = execute { session ->
        parse(transport.updateSettings(session.accessToken, JSONObject().put("pushNotificationsEnabled", enabled)))
    }

    fun loadCategoryPreferences(): NotificationPreferencesResult = executePreferences { session ->
        parsePreferences(preferencesTransport.getPreferences(session.accessToken))
    }

    fun updateCategoryPreference(category: String, push: Boolean? = null, email: Boolean? = null): NotificationPreferencesResult = executePreferences { session ->
        require(category.matches(CATEGORY_PATTERN)) { "This notification category is invalid." }
        require(push != null || email != null) { "Choose a notification preference to update." }
        val fields = JSONObject().put("category", category).apply {
            push?.let { put("push", it) }
            email?.let { put("email", it) }
        }
        parsePreference(preferencesTransport.updatePreference(session.accessToken, fields))
            .let { updated ->
                require(updated.category == category) { "Nantty returned a different notification category." }
                listOf(updated)
            }
    }

    fun loadMarketingSettings(): AccountMarketingSettingsResult = executeMarketing(::loadMarketingSettings)

    fun updateMarketingConsent(enabled: Boolean): AccountMarketingSettingsResult = executeMarketing { session ->
        if (!enabled) {
            marketingConsentTransport.request(
                "PUT",
                CONSENTS_PATH,
                session.accessToken,
                JSONObject().put("consents", JSONObject().put("marketing", false)),
            )
        } else {
            val frequency = marketingFrequency(marketingConsentTransport.request("GET", MARKETING_PREFERENCES_PATH, session.accessToken))
            if (frequency == MarketingFrequency.OFF) {
                marketingConsentTransport.request(
                    "PUT",
                    MARKETING_PREFERENCES_PATH,
                    session.accessToken,
                    JSONObject().put("frequency", MarketingFrequency.WEEKLY.apiValue),
                )
            }
            marketingConsentTransport.request(
                "PUT",
                CONSENTS_PATH,
                session.accessToken,
                JSONObject().put("consents", JSONObject().put("marketing", true)),
            )
        }
        loadMarketingSettings(session)
    }

    fun updateMarketingFrequency(frequency: MarketingFrequency): AccountMarketingSettingsResult = executeMarketing { session ->
        if (frequency == MarketingFrequency.OFF) {
            // Revoke consent first so an interrupted preference write cannot leave pushes eligible.
            marketingConsentTransport.request(
                "PUT",
                CONSENTS_PATH,
                session.accessToken,
                JSONObject().put("consents", JSONObject().put("marketing", false)),
            )
        }
        marketingConsentTransport.request(
            "PUT",
            MARKETING_PREFERENCES_PATH,
            session.accessToken,
            JSONObject().put("frequency", frequency.apiValue),
        )
        if (frequency != MarketingFrequency.OFF) {
            marketingConsentTransport.request(
                "PUT",
                CONSENTS_PATH,
                session.accessToken,
                JSONObject().put("consents", JSONObject().put("marketing", true)),
            )
        }
        loadMarketingSettings(session)
    }

    private inline fun execute(action: (AccountSession) -> AccountNotificationSettings): AccountNotificationSettingsResult = try {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to manage notification settings.")
        AccountNotificationSettingsResult.Success(action(session))
    } catch (error: Exception) {
        AccountNotificationSettingsResult.Failure(
            error.message ?: "Could not update notification settings. Try again.",
            error is AccountNotificationSettingsHttpException && error.statusCode in setOf(401, 403),
        )
    }

    private inline fun executePreferences(action: (AccountSession) -> List<NotificationPreference>): NotificationPreferencesResult = try {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to manage notification preferences.")
        NotificationPreferencesResult.Success(action(session))
    } catch (error: Exception) {
        NotificationPreferencesResult.Failure(
            error.message ?: "Could not update notification preferences. Try again.",
            error is AccountNotificationSettingsHttpException && error.statusCode in setOf(401, 403),
        )
    }

    private inline fun executeMarketing(action: (AccountSession) -> AccountMarketingSettings): AccountMarketingSettingsResult = try {
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to manage marketing preferences.")
        AccountMarketingSettingsResult.Success(action(session))
    } catch (error: Exception) {
        AccountMarketingSettingsResult.Failure(
            error.message ?: "Could not update marketing preferences. Try again.",
            error is AccountNotificationSettingsHttpException && error.statusCode in setOf(401, 403),
        )
    }

    private fun loadMarketingSettings(session: AccountSession): AccountMarketingSettings {
        val consents = marketingConsentTransport.request("GET", CONSENTS_PATH, session.accessToken)
        val preferences = marketingConsentTransport.request("GET", MARKETING_PREFERENCES_PATH, session.accessToken)
        return AccountMarketingSettings(
            consentGranted = marketingConsentGranted(consents),
            frequency = marketingFrequency(preferences),
        )
    }

    private fun marketingConsentGranted(payload: JSONObject): Boolean {
        val rows = payload.optJSONArray("data") ?: payload.optJSONObject("data")?.optJSONArray("items")
            ?: error("Nantty returned incomplete marketing consent settings.")
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            if (row.optString("consentType") == "marketing") return row.optString("status") == "granted"
        }
        // Missing consent is opt-out, never inferred as permission.
        return false
    }

    private fun marketingFrequency(payload: JSONObject): MarketingFrequency {
        val data = payload.optJSONObject("data") ?: payload
        return MarketingFrequency.entries.firstOrNull { it.apiValue == data.optString("frequency") }
            ?: error("Nantty returned an unsupported marketing frequency.")
    }

    private fun parse(payload: JSONObject): AccountNotificationSettings {
        val settings = payload.optJSONObject("data") ?: payload
        require(settings.has("pushNotificationsEnabled")) { "Nantty returned incomplete notification settings." }
        return AccountNotificationSettings(settings.getBoolean("pushNotificationsEnabled"))
    }

    private fun parsePreferences(payload: JSONObject): List<NotificationPreference> {
        val rows = payload.optJSONArray("data")
            ?: payload.optJSONObject("data")?.optJSONArray("items")
            ?: error("Nantty returned incomplete notification preferences.")
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val category = row.optString("category")
                if (!category.matches(CATEGORY_PATTERN)) continue
                add(parsePreference(row))
            }
        }
    }

    private fun parsePreference(payload: JSONObject): NotificationPreference {
        val row = payload.optJSONObject("data") ?: payload
        require(row.has("category") && row.has("push") && row.has("email") && row.has("locked")) {
            "Nantty returned an incomplete notification preference."
        }
        val category = row.getString("category")
        require(category.matches(CATEGORY_PATTERN)) { "Nantty returned an invalid notification category." }
        return NotificationPreference(category, row.getBoolean("push"), row.getBoolean("email"), row.getBoolean("locked"))
    }

    companion object {
        private const val CONSENTS_PATH = "/api/v1/users/me/consents"
        private const val MARKETING_PREFERENCES_PATH = "/api/v1/users/me/marketing-preferences"
        private val CATEGORY_PATTERN = Regex("[a-z][a-zA-Z0-9_-]{0,63}")
    }
}

private class JdkAccountNotificationSettingsTransport(private val baseUrl: String) : AccountNotificationSettingsTransport {
    override fun getSettings(accessToken: String) = request("GET", null, accessToken)

    override fun updateSettings(accessToken: String, fields: JSONObject) = request("PATCH", fields, accessToken)

    private fun request(method: String, fields: JSONObject?, accessToken: String): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to manage notification settings." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage notification settings.")
        val connection = (URL("$origin/api/v1/users/me/settings").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            fields?.let {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            fields?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw AccountNotificationSettingsHttpException(status)
            require(body.isNotBlank()) { "Nantty returned empty notification settings." }
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
            require(output.size() + read <= 1_048_576) { "Nantty returned unexpectedly large notification settings." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

private class JdkNotificationPreferencesTransport(private val baseUrl: String) : NotificationPreferencesTransport {
    override fun getPreferences(accessToken: String): JSONObject = request("GET", accessToken)

    override fun updatePreference(accessToken: String, fields: JSONObject): JSONObject = request("PATCH", accessToken, fields)

    private fun request(method: String, accessToken: String, fields: JSONObject? = null): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to manage notification preferences." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage notification preferences.")
        val connection = (URL("$origin/api/v1/notifications/preferences").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            fields?.let {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            fields?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw AccountNotificationSettingsHttpException(status)
            require(body.isNotBlank()) { "Nantty returned an empty notification preference response." }
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
            require(output.size() + read <= 1_048_576) { "Nantty returned unexpectedly large notification preferences." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

private class JdkMarketingConsentTransport(private val baseUrl: String) : MarketingConsentTransport {
    override fun request(method: String, path: String, accessToken: String, fields: JSONObject?): JSONObject {
        require(method in setOf("GET", "PUT"))
        require(path in setOf("/api/v1/users/me/consents", "/api/v1/users/me/marketing-preferences"))
        require(accessToken.isNotBlank()) { "Sign in to manage marketing preferences." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage marketing preferences.")
        val connection = (URL("$origin$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            fields?.let {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            fields?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readMarketingResponse).orEmpty()
            if (status !in 200..299) throw AccountNotificationSettingsHttpException(status)
            require(body.isNotBlank()) { "Nantty returned an empty marketing preference response." }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun readMarketingResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= 1_048_576) { "Nantty returned unexpectedly large marketing preferences." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

private class AccountNotificationSettingsHttpException(val statusCode: Int) :
    Exception("Notification settings request failed (HTTP $statusCode). Try again.")
