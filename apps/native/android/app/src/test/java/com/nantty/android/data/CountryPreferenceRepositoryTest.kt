package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CountryPreferenceRepositoryTest {
    @Test
    fun loadsSupportedCountriesAndAuthoritativeViewerLocale() {
        val transport = RecordingCountryPreferenceTransport()
        val repository = CountryPreferenceRepository(
            sessionProvider = ::countryPreferenceSession,
            transport = transport,
        )

        val result = repository.load() as CountryPreferenceResult.Success

        assertEquals(listOf("NG", "GH"), result.countries.map(SupportedCountry::countryCode))
        assertEquals("NG", result.current.countryCode)
        assertEquals("NGN", result.current.currency)
        assertTrue(result.current.isCountrySupported)
        assertEquals(listOf("/api/v1/locale/countries", "/api/v1/locale"), transport.getPaths)
        assertEquals(listOf("country-access", "country-access"), transport.readTokens)
    }

    @Test
    fun updatesOnlyAValidServerSupportedCountryUsingAuthenticatedPreferenceContract() {
        val transport = RecordingCountryPreferenceTransport()
        val repository = CountryPreferenceRepository(
            sessionProvider = ::countryPreferenceSession,
            transport = transport,
        )

        assertTrue(repository.updateCountryPreference(" gh ") is CountryPreferenceUpdateResult.Success)
        assertEquals("GH", transport.updatedCountry)
        assertEquals("country-access", transport.updateToken)
        assertEquals(listOf("/api/v1/locale/countries"), transport.getPaths)
    }

    @Test
    fun invalidOrUnsupportedCountryDoesNotReachMutationEndpoint() {
        val transport = RecordingCountryPreferenceTransport()
        val repository = CountryPreferenceRepository(
            sessionProvider = ::countryPreferenceSession,
            transport = transport,
        )

        assertTrue(repository.updateCountryPreference("NGN") is CountryPreferenceUpdateResult.Failure)
        assertTrue(repository.updateCountryPreference("ZZ") is CountryPreferenceUpdateResult.Failure)
        assertEquals(null, transport.updatedCountry)
    }

    @Test
    fun missingSessionAndUnauthorizedMutationAreReportedAsAuthenticationFailures() {
        val guestTransport = RecordingCountryPreferenceTransport()
        val guest = CountryPreferenceRepository("https://api.nantty.com", { null }, transport = guestTransport)
        val guestResult = guest.updateCountryPreference("NG") as CountryPreferenceUpdateResult.Failure
        assertTrue(guestResult.authenticationRequired)
        assertTrue(guestTransport.getPaths.isEmpty())

        val unauthorizedTransport = RecordingCountryPreferenceTransport().apply { updateError = CountryPreferenceHttpException(401, "expired") }
        val unauthorized = CountryPreferenceRepository(
            sessionProvider = ::countryPreferenceSession,
            transport = unauthorizedTransport,
        ).updateCountryPreference("NG") as CountryPreferenceUpdateResult.Failure
        assertTrue(unauthorized.authenticationRequired)
        assertFalse(unauthorized.message.isBlank())
    }

    private fun countryPreferenceSession() = AccountSession(
        "country-access",
        "country-refresh",
        AccountUser("country-user", "Ari", "ari", null, null, emptyList()),
    )
}

private class RecordingCountryPreferenceTransport : CountryPreferenceTransport {
    val getPaths = mutableListOf<String>()
    val readTokens = mutableListOf<String>()
    var updatedCountry: String? = null
    var updateToken: String? = null
    var updateError: Exception? = null

    override fun get(path: String, accessToken: String): JSONObject {
        getPaths += path
        readTokens += accessToken
        return when (path) {
            "/api/v1/locale/countries" -> JSONObject(
                """{"data":[{"countryCode":"NG","countryName":"Nigeria","currency":"NGN","currencyName":"Nigerian Naira"},{"countryCode":"GH","countryName":"Ghana","currency":"GHS","currencyName":"Ghanaian Cedi"}]}""",
            )
            "/api/v1/locale" -> JSONObject("""{"countryCode":"NG","currency":"NGN","isCountrySupported":true,"source":"account"}""")
            else -> error("Unexpected path $path")
        }
    }

    override fun updateCountry(accessToken: String, countryCode: String) {
        updateError?.let { throw it }
        updateToken = accessToken
        updatedCountry = countryCode
    }
}
