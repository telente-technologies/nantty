package com.nantty.android.data

import org.json.JSONObject
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

    private companion object {
        fun signedInSession() = AccountSession("notifications-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
    }
}
