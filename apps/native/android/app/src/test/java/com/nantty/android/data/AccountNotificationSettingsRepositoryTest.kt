package com.nantty.android.data

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountNotificationSettingsRepositoryTest {
    @Test
    fun readsAccountPreferenceUsingAuthenticatedSettingsContract() {
        val transport = RecordingTransport(enabled = true)
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = transport,
        )

        val result = repository.load() as AccountNotificationSettingsResult.Success

        assertEquals("GET", transport.method)
        assertEquals("/api/v1/users/me/settings", transport.path)
        assertEquals("notifications-access", transport.token)
        assertTrue(result.settings.pushNotificationsEnabled)
    }

    @Test
    fun updatesOnlyPushPreferenceAndUsesReturnedServerValue() {
        val transport = RecordingTransport(enabled = false)
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = transport,
        )

        val result = repository.updatePushNotifications(false) as AccountNotificationSettingsResult.Success

        assertEquals("PATCH", transport.method)
        assertEquals("/api/v1/users/me/settings", transport.path)
        assertEquals("notifications-access", transport.token)
        assertEquals(setOf("pushNotificationsEnabled"), transport.body!!.keys().asSequence().toSet())
        assertFalse(transport.body!!.getBoolean("pushNotificationsEnabled"))
        assertFalse(result.settings.pushNotificationsEnabled)
    }

    @Test
    fun missingSessionFailsWithoutCallingApi() {
        val transport = RecordingTransport(enabled = true)
        val result = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = transport,
        ).load()

        assertTrue(result is AccountNotificationSettingsResult.Failure)
        assertEquals(null, transport.method)
    }

    @Test
    fun readsAndUpdatesServerOwnedMilestoneNotificationPreferences() {
        val preferencesTransport = RecordingPreferencesTransport()
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = RecordingTransport(enabled = true),
            preferencesTransport = preferencesTransport,
        )

        val loaded = repository.loadCategoryPreferences() as NotificationPreferencesResult.Success
        assertEquals(listOf(NotificationPreference("milestones", true, false, false)), loaded.preferences)
        assertEquals("notifications-access", preferencesTransport.token)
        assertEquals("GET", preferencesTransport.method)
        assertEquals("/api/v1/notifications/preferences", preferencesTransport.path)

        val updated = repository.updateCategoryPreference("milestones", email = true) as NotificationPreferencesResult.Success
        assertEquals(listOf(NotificationPreference("milestones", true, true, false)), updated.preferences)
        assertEquals("PATCH", preferencesTransport.method)
        assertEquals(setOf("category", "email"), preferencesTransport.body!!.keys().asSequence().toSet())
        assertEquals("milestones", preferencesTransport.body!!.getString("category"))
        assertTrue(preferencesTransport.body!!.getBoolean("email"))
    }

    @Test
    fun missingSessionAndInvalidPreferenceInputDoNotCallPreferenceApi() {
        val preferencesTransport = RecordingPreferencesTransport()
        val signedInRepository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = RecordingTransport(enabled = true),
            preferencesTransport = preferencesTransport,
        )
        val signedOutRepository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = RecordingTransport(enabled = true),
            preferencesTransport = preferencesTransport,
        )

        assertTrue(signedOutRepository.loadCategoryPreferences() is NotificationPreferencesResult.Failure)
        assertTrue(signedInRepository.updateCategoryPreference("../notifications", email = false) is NotificationPreferencesResult.Failure)
        assertTrue(signedInRepository.updateCategoryPreference("milestones") is NotificationPreferencesResult.Failure)
        assertEquals(null, preferencesTransport.method)
    }

    @Test
    fun missingMarketingConsentIsOptOutAndUsesServerFrequency() {
        val marketing = RecordingMarketingTransport()
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = RecordingTransport(enabled = true),
            marketingConsentTransport = marketing,
        )

        val result = repository.loadMarketingSettings() as AccountMarketingSettingsResult.Success

        assertEquals(AccountMarketingSettings(false, MarketingFrequency.WEEKLY), result.settings)
        assertEquals(listOf("GET /api/v1/users/me/consents", "GET /api/v1/users/me/marketing-preferences"), marketing.calls)
    }

    @Test
    fun optingOutRevokesConsentBeforeSavingOffFrequency() {
        val marketing = RecordingMarketingTransport(consentGranted = true)
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = RecordingTransport(enabled = true),
            marketingConsentTransport = marketing,
        )

        val result = repository.updateMarketingFrequency(MarketingFrequency.OFF) as AccountMarketingSettingsResult.Success

        assertEquals(AccountMarketingSettings(false, MarketingFrequency.OFF), result.settings)
        assertEquals(
            listOf(
                "PUT /api/v1/users/me/consents",
                "PUT /api/v1/users/me/marketing-preferences",
                "GET /api/v1/users/me/consents",
                "GET /api/v1/users/me/marketing-preferences",
            ),
            marketing.calls,
        )
        assertEquals(false, marketing.writes[0].getJSONObject("consents").getBoolean("marketing"))
        assertEquals("off", marketing.writes[1].getString("frequency"))
    }

    @Test
    fun selectingEmailFrequencySavesPreferenceBeforeGrantingConsent() {
        val marketing = RecordingMarketingTransport()
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = RecordingTransport(enabled = true),
            marketingConsentTransport = marketing,
        )

        val result = repository.updateMarketingFrequency(MarketingFrequency.IMPORTANT_ONLY) as AccountMarketingSettingsResult.Success

        assertEquals(AccountMarketingSettings(true, MarketingFrequency.IMPORTANT_ONLY), result.settings)
        assertEquals("/api/v1/users/me/marketing-preferences", marketing.calls[0].substringAfter(' '))
        assertEquals("important_only", marketing.writes[0].getString("frequency"))
        assertEquals("/api/v1/users/me/consents", marketing.calls[1].substringAfter(' '))
        assertEquals(true, marketing.writes[1].getJSONObject("consents").getBoolean("marketing"))
    }

    @Test
    fun enablingConsentAfterOffRestoresWeeklyBeforeOptingIn() {
        val marketing = RecordingMarketingTransport(frequency = MarketingFrequency.OFF)
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = RecordingTransport(enabled = true),
            marketingConsentTransport = marketing,
        )

        val result = repository.updateMarketingConsent(true) as AccountMarketingSettingsResult.Success

        assertEquals(AccountMarketingSettings(true, MarketingFrequency.WEEKLY), result.settings)
        assertEquals(
            listOf(
                "GET /api/v1/users/me/marketing-preferences",
                "PUT /api/v1/users/me/marketing-preferences",
                "PUT /api/v1/users/me/consents",
                "GET /api/v1/users/me/consents",
                "GET /api/v1/users/me/marketing-preferences",
            ),
            marketing.calls,
        )
        assertEquals("weekly", marketing.writes[0].getString("frequency"))
        assertEquals(true, marketing.writes[1].getJSONObject("consents").getBoolean("marketing"))
    }

    @Test
    fun missingSessionDoesNotCallMarketingConsentApi() {
        val marketing = RecordingMarketingTransport()
        val repository = AccountNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = RecordingTransport(enabled = true),
            marketingConsentTransport = marketing,
        )

        assertTrue(repository.loadMarketingSettings() is AccountMarketingSettingsResult.Failure)
        assertEquals(emptyList<String>(), marketing.calls)
    }

    private class RecordingTransport(private val enabled: Boolean) : AccountNotificationSettingsTransport {
        var method: String? = null
        var path: String? = null
        var token: String? = null
        var body: JSONObject? = null

        override fun getSettings(accessToken: String): JSONObject = respond("GET", accessToken, null)

        override fun updateSettings(accessToken: String, fields: JSONObject): JSONObject = respond("PATCH", accessToken, fields)

        private fun respond(method: String, accessToken: String, body: JSONObject?): JSONObject {
            this.method = method
            this.path = "/api/v1/users/me/settings"
            this.token = accessToken
            this.body = body
            return JSONObject().put("pushNotificationsEnabled", enabled)
        }
    }

    private class RecordingPreferencesTransport : NotificationPreferencesTransport {
        var method: String? = null
        var path: String? = null
        var token: String? = null
        var body: JSONObject? = null
        private var emailEnabled = false

        override fun getPreferences(accessToken: String): JSONObject {
            record("GET", accessToken, null)
            return JSONObject().put("data", org.json.JSONArray().put(preference()))
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
            .put("locked", false)

        private fun record(method: String, accessToken: String, body: JSONObject?) {
            this.method = method
            path = "/api/v1/notifications/preferences"
            token = accessToken
            this.body = body
        }
    }

    private class RecordingMarketingTransport(
        consentGranted: Boolean = false,
        frequency: MarketingFrequency = MarketingFrequency.WEEKLY,
    ) : MarketingConsentTransport {
        val calls = mutableListOf<String>()
        val writes = mutableListOf<JSONObject>()
        private var granted = consentGranted
        private var storedFrequency = frequency

        override fun request(method: String, path: String, accessToken: String, fields: JSONObject?): JSONObject {
            calls += "$method $path"
            if (method == "PUT") {
                val body = requireNotNull(fields)
                writes += JSONObject(body.toString())
                if (path.endsWith("/consents")) granted = body.getJSONObject("consents").getBoolean("marketing")
                else storedFrequency = MarketingFrequency.entries.first { it.apiValue == body.getString("frequency") }
            }
            return if (path.endsWith("/consents")) {
                val rows = JSONArray()
                if (granted) rows.put(JSONObject().put("consentType", "marketing").put("status", "granted"))
                JSONObject().put("data", rows)
            } else {
                JSONObject().put("data", JSONObject().put("frequency", storedFrequency.apiValue))
            }
        }
    }

    private companion object {
        fun signedInSession() = AccountSession("notifications-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
    }
}
