package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.AccountNotificationSettingsTransport
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.NotificationPreferencesTransport
import com.nantty.android.data.MarketingConsentTransport
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class MilestoneNotificationPreferencesTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun loadsAndPersistsMilestoneEmailPreferenceFromPreferenceEndpoint() {
        val transport = FakePreferenceTransport()
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = FakeAccountSettingsTransport(),
            preferencesTransport = transport,
            marketingConsentTransport = FakeMarketingConsentTransport(),
        )

        compose.setContent {
            MaterialTheme {
                AccountNotificationSettingsScreen(repository, Executor { it.run() }, onBack = {}, onReauthenticate = {})
            }
        }

        compose.onNodeWithContentDescription("Milestones: push").assertIsDisplayed()
        compose.onNodeWithContentDescription("Milestones: email").performClick()
        compose.runOnIdle {
            assertEquals("PATCH", transport.method)
            assertEquals("/api/v1/notifications/preferences", transport.path)
            assertEquals("notifications-access", transport.accessToken)
            assertEquals("milestones", transport.body!!.getString("category"))
            assertEquals(true, transport.body!!.getBoolean("email"))
        }
    }

    @Test
    fun serverLockedPreferenceCannotBeChangedFromTheUi() {
        val transport = FakePreferenceTransport(locked = true)
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = FakeAccountSettingsTransport(),
            preferencesTransport = transport,
            marketingConsentTransport = FakeMarketingConsentTransport(),
        )

        compose.setContent {
            MaterialTheme {
                AccountNotificationSettingsScreen(repository, Executor { it.run() }, onBack = {}, onReauthenticate = {})
            }
        }

        compose.onNodeWithContentDescription("Milestones: email").assertIsDisplayed().assertIsNotEnabled()
        compose.runOnIdle { assertEquals("GET", transport.method) }
    }

    @Test
    fun rendersApiReturnedCategoriesAndHonorsServerLock() {
        val transport = FakePreferenceTransport(
            additionalPreferences = listOf(
                JSONObject().put("category", "auth").put("push", true).put("email", true).put("locked", true),
                JSONObject().put("category", "marketing").put("push", false).put("email", true).put("locked", false),
            ),
        )
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = FakeAccountSettingsTransport(),
            preferencesTransport = transport,
            marketingConsentTransport = FakeMarketingConsentTransport(),
        )

        compose.setContent {
            MaterialTheme {
                AccountNotificationSettingsScreen(repository, Executor { it.run() }, onBack = {}, onReauthenticate = {})
            }
        }

        compose.onNodeWithContentDescription("Account security: push").assertIsDisplayed().assertIsNotEnabled()
        compose.onNodeWithContentDescription("News and offers: push").assertIsDisplayed()
    }

    private class FakeAccountSettingsTransport : AccountNotificationSettingsTransport {
        override fun getSettings(accessToken: String) = JSONObject().put("pushNotificationsEnabled", true)
        override fun updateSettings(accessToken: String, fields: JSONObject) = JSONObject().put("pushNotificationsEnabled", fields.getBoolean("pushNotificationsEnabled"))
    }

    private class FakeMarketingConsentTransport : MarketingConsentTransport {
        override fun request(method: String, path: String, accessToken: String, fields: JSONObject?): JSONObject =
            if (path.endsWith("/consents")) JSONObject().put("data", JSONArray())
            else JSONObject().put("data", JSONObject().put("frequency", "weekly"))
    }

    private class FakePreferenceTransport(
        private val locked: Boolean = false,
        private val additionalPreferences: List<JSONObject> = emptyList(),
    ) : NotificationPreferencesTransport {
        var method: String? = null
        var path: String? = null
        var accessToken: String? = null
        var body: JSONObject? = null
        private var emailEnabled = false

        override fun getPreferences(accessToken: String): JSONObject {
            record("GET", accessToken, null)
            val rows = JSONArray().put(preference())
            additionalPreferences.forEach(rows::put)
            return JSONObject().put("data", rows)
        }

        override fun updatePreference(accessToken: String, fields: JSONObject): JSONObject {
            record("PATCH", accessToken, fields)
            if (fields.has("email")) emailEnabled = fields.getBoolean("email")
            return JSONObject().put("data", preference())
        }

        private fun preference() = JSONObject()
            .put("category", "milestones")
            .put("push", true)
            .put("email", emailEnabled)
            .put("locked", locked)

        private fun record(method: String, accessToken: String, body: JSONObject?) {
            this.method = method
            path = "/api/v1/notifications/preferences"
            this.accessToken = accessToken
            this.body = body
        }
    }

    private companion object {
        fun signedInSession() = AccountSession("notifications-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
    }
}
