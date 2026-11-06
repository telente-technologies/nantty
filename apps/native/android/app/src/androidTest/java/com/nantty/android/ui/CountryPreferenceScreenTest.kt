package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.CountryPreferenceRepository
import com.nantty.android.data.CountryPreferenceTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.Executor

class CountryPreferenceScreenTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun displaysServerCountriesAndSavesSelectedCountry() {
        val transport = TestCountryPreferenceTransport()
        val repository = CountryPreferenceRepository(
            sessionProvider = {
                AccountSession("access", "refresh", AccountUser("user", "Ari", "ari", null, null, emptyList()))
            },
            transport = transport,
        )
        var saved = false
        composeRule.setContent {
            MaterialTheme {
                CountryPreferenceScreen(repository, Executor { it.run() }, {}, {}, { saved = true })
            }
        }

        composeRule.onNodeWithText("Country & currency").assertIsDisplayed()
        composeRule.onNodeWithText("Nigeria").assertIsDisplayed()
        composeRule.onNodeWithText("Ghana").assertIsDisplayed()
        composeRule.onNodeWithText("Use").performClick()
        composeRule.runOnIdle {
            assertEquals("GH", transport.updatedCountry)
            assertTrue(saved)
        }
    }
}

private class TestCountryPreferenceTransport : CountryPreferenceTransport {
    var updatedCountry: String? = null

    override fun get(path: String, accessToken: String): JSONObject = when (path) {
        "/api/v1/locale/countries" -> JSONObject(
            """{"data":[{"countryCode":"NG","countryName":"Nigeria","currency":"NGN","currencyName":"Nigerian Naira"},{"countryCode":"GH","countryName":"Ghana","currency":"GHS","currencyName":"Ghanaian Cedi"}]}""",
        )
        "/api/v1/locale" -> JSONObject("""{"countryCode":"NG","currency":"NGN","isCountrySupported":true}""")
        else -> error("Unexpected path $path")
    }

    override fun updateCountry(accessToken: String, countryCode: String) {
        updatedCountry = countryCode
    }
}
