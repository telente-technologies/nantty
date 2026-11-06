package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.AccountNotificationSettingsTransport
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.MarketingConsentTransport
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class MarketingConsentPreferencesTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun marketingConsentIsOptInAndFrequencyChoiceUpdatesConsent() {
        val marketing = FakeMarketingConsentTransport()
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = FakeAccountNotificationSettingsTransport(),
            marketingConsentTransport = marketing,
        )

        compose.setContent {
            MaterialTheme {
                MarketingConsentPreferences(repository, Executor { it.run() }, onReauthenticate = {})
            }
        }

        compose.onNodeWithText("Marketing messages").assertIsDisplayed()
        compose.onNodeWithContentDescription("Marketing messages").assertIsOff()
        compose.onNodeWithText("How often should we email you?").assertIsDisplayed()
        compose.onNodeWithText("Only important").performClick()

        compose.runOnIdle {
            assertEquals("important_only", marketing.frequency)
            assertEquals(true, marketing.consentGranted)
            assertEquals(
                listOf(
                    "GET /api/v1/users/me/consents",
                    "GET /api/v1/users/me/marketing-preferences",
                    "PUT /api/v1/users/me/marketing-preferences",
                    "PUT /api/v1/users/me/consents",
                    "GET /api/v1/users/me/consents",
                    "GET /api/v1/users/me/marketing-preferences",
                ),
                marketing.calls,
            )
        }
    }

    private class FakeAccountNotificationSettingsTransport : AccountNotificationSettingsTransport {
        override fun getSettings(accessToken: String) = JSONObject().put("pushNotificationsEnabled", true)
        override fun updateSettings(accessToken: String, fields: JSONObject) =
            JSONObject().put("pushNotificationsEnabled", fields.getBoolean("pushNotificationsEnabled"))
    }

    private class FakeMarketingConsentTransport : MarketingConsentTransport {
        val calls = mutableListOf<String>()
        var consentGranted = false
        var frequency = "weekly"

        override fun request(method: String, path: String, accessToken: String, fields: JSONObject?): JSONObject {
            calls += "$method $path"
            if (method == "PUT") {
                if (path.endsWith("/consents")) consentGranted = fields!!.getJSONObject("consents").getBoolean("marketing")
                else frequency = fields!!.getString("frequency")
            }
            return if (path.endsWith("/consents")) {
                val rows = JSONArray()
                if (consentGranted) rows.put(JSONObject().put("consentType", "marketing").put("status", "granted"))
                JSONObject().put("data", rows)
            } else {
                JSONObject().put("data", JSONObject().put("frequency", frequency))
            }
        }
    }

    private fun signedInSession() = AccountSession(
        "notifications-access",
        "refresh",
        AccountUser("user-1", "Ari", "ari", null, null, emptyList()),
    )
}
