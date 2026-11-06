package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

data class SupportedCountry(
    val countryCode: String,
    val countryName: String,
    val currency: String,
    val currencyName: String,
)

data class ViewerLocalePreference(
    val countryCode: String?,
    val currency: String,
    val isCountrySupported: Boolean,
)

sealed interface CountryPreferenceResult {
    data class Success(val countries: List<SupportedCountry>, val current: ViewerLocalePreference) : CountryPreferenceResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CountryPreferenceResult
}

sealed interface CountryPreferenceUpdateResult {
    data object Success : CountryPreferenceUpdateResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CountryPreferenceUpdateResult
}

interface CountryPreferenceTransport {
    fun get(path: String, accessToken: String): JSONObject
    fun updateCountry(accessToken: String, countryCode: String)
}

class CountryPreferenceRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: CountryPreferenceTransport = JdkCountryPreferenceTransport(baseUrl),
) {
    fun load(): CountryPreferenceResult = try {
        val token = currentToken()
        val countriesResponse = withRefresh(token) { transport.get(COUNTRIES_PATH, it) }
        val localeResponse = withRefresh(token) { transport.get(VIEWER_LOCALE_PATH, it) }
        val countries = parseCountries(countriesResponse)
        require(countries.isNotEmpty()) { "Nantty did not return any supported countries." }
        CountryPreferenceResult.Success(countries, parseViewerLocale(localeResponse))
    } catch (error: Exception) {
        CountryPreferenceResult.Failure(error.message ?: "Could not load country and currency settings.", error.isAuthenticationFailure())
    }

    fun updateCountryPreference(countryCode: String): CountryPreferenceUpdateResult = try {
        val normalized = countryCode.trim().uppercase(Locale.ROOT)
        require(COUNTRY_CODE_PATTERN.matches(normalized)) { "Choose a valid country." }
        val token = currentToken()
        val countries = withRefresh(token) { transport.get(COUNTRIES_PATH, it) }
        require(parseCountries(countries).any { it.countryCode == normalized }) { "Choose a country supported by Nantty." }
        withRefresh(token) { refreshedToken -> transport.updateCountry(refreshedToken, normalized) }
        CountryPreferenceUpdateResult.Success
    } catch (error: Exception) {
        CountryPreferenceUpdateResult.Failure(error.message ?: "Could not update your country preference. Try again.", error.isAuthenticationFailure())
    }

    private fun currentToken(): String = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
        ?: throw CountryPreferenceHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to change your country and currency preference.")

    private inline fun <T> withRefresh(token: String, request: (String) -> T): T = try {
        request(token)
    } catch (error: CountryPreferenceHttpException) {
        if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
        val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw CountryPreferenceHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
        request(refreshed)
    }

    private fun parseCountries(payload: JSONObject): List<SupportedCountry> {
        val rows = payload.optJSONArray("data") ?: payload.optJSONArray("items") ?: JSONArray()
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val code = row.optString("countryCode").trim().uppercase(Locale.ROOT)
                val name = row.optString("countryName").trim()
                val currency = row.optString("currency").trim().uppercase(Locale.ROOT)
                val currencyName = row.optString("currencyName").trim()
                if (COUNTRY_CODE_PATTERN.matches(code) && name.isNotBlank() && currency.isNotBlank() && currencyName.isNotBlank()) {
                    add(SupportedCountry(code, name, currency, currencyName))
                }
            }
        }
    }

    private fun parseViewerLocale(payload: JSONObject): ViewerLocalePreference {
        val code = payload.optString("countryCode").trim().uppercase(Locale.ROOT)
            .takeIf { COUNTRY_CODE_PATTERN.matches(it) }
        val currency = payload.optString("currency").trim().uppercase(Locale.ROOT)
        require(currency.isNotBlank()) { "Nantty returned an invalid currency preference." }
        return ViewerLocalePreference(code, currency, payload.optBoolean("isCountrySupported"))
    }

    private fun Exception.isAuthenticationFailure(): Boolean =
        this is CountryPreferenceHttpException && statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)

    private companion object {
        const val COUNTRIES_PATH = "/api/v1/locale/countries"
        const val VIEWER_LOCALE_PATH = "/api/v1/locale"
        const val UPDATE_PREFERENCE_PATH = "/api/v1/users/me/preferences"
        const val MAX_RESPONSE_BYTES = 1_048_576
        val COUNTRY_CODE_PATTERN = Regex("^[A-Z]{2}$")
    }
}

private class JdkCountryPreferenceTransport(private val baseUrl: String) : CountryPreferenceTransport {
    override fun get(path: String, accessToken: String): JSONObject = request(path, "GET", accessToken)

    override fun updateCountry(accessToken: String, countryCode: String) {
        request(UPDATE_PREFERENCE_PATH, "PATCH", accessToken, JSONObject().put("countryCode", countryCode))
    }

    private fun request(path: String, method: String, accessToken: String, body: JSONObject? = null): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to manage country preferences.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw CountryPreferenceHttpException(status, "Country preference request failed (HTTP $status). Try again.")
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
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large settings response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val UPDATE_PREFERENCE_PATH = "/api/v1/users/me/preferences"
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

class CountryPreferenceHttpException(val statusCode: Int, message: String) : IllegalStateException(message)
