package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatNotificationSettingsRepositoryTest {
    @Test
    fun loadsAllReactNativeFieldsFromAuthenticatedChatSettingsRoute() {
        val transport = RecordingTransport(settings())
        val result = repository(transport).load() as ChatSettingsResult.Success

        assertEquals("GET", transport.method)
        assertEquals("/api/v1/chat/settings", transport.path)
        assertEquals("chat-access", transport.accessToken)
        assertEquals(MessageRequestAudience.FOLLOWERS, result.settings.messageRequestsFrom)
        assertTrue(result.settings.preventDirectGroupAdds)
        assertEquals(ChatNotificationSettings(true, false, true, false, true), result.settings.notifications)
    }

    @Test
    fun patchesTheCompleteNotificationsObjectAndUsesTheServerResponse() {
        val transport = RecordingTransport(settings())
        val repository = repository(transport)
        val requested = ChatNotificationSettings(false, true, false, true, false)
        transport.nextSettings = settings(requested)

        val result = repository.updateNotifications(requested) as ChatSettingsResult.Success

        assertEquals("PATCH", transport.method)
        assertEquals("/api/v1/chat/settings", transport.path)
        assertEquals("chat-access", transport.accessToken)
        assertEquals(setOf("notifications"), transport.body!!.keys().asSequence().toSet())
        val notificationFields = transport.body!!.getJSONObject("notifications")
        assertEquals(
            setOf("messages", "requests", "groups", "streakReminders", "showMessagePreview"),
            notificationFields.keys().asSequence().toSet(),
        )
        assertFalse(notificationFields.getBoolean("messages"))
        assertTrue(notificationFields.getBoolean("requests"))
        assertEquals(requested, result.settings.notifications)
    }

    @Test
    fun patchesMessageRequestAudienceAndUsesAuthoritativeServerResponse() {
        val transport = RecordingTransport(settings())
        val repository = repository(transport)
        transport.nextSettings = settings(audience = "nobody")

        val result = repository.updateMessageRequestsFrom(MessageRequestAudience.FOLLOWING) as ChatSettingsResult.Success

        assertEquals("PATCH", transport.method)
        assertEquals(setOf("messageRequestsFrom"), transport.body!!.keys().asSequence().toSet())
        assertEquals("following", transport.body!!.getString("messageRequestsFrom"))
        assertEquals(MessageRequestAudience.NOBODY, result.settings.messageRequestsFrom)
    }

    @Test
    fun patchesDirectGroupInvitationPrivacyAndUsesAuthoritativeServerResponse() {
        val transport = RecordingTransport(settings())
        val repository = repository(transport)
        transport.nextSettings = settings(preventDirectGroupAdds = false)

        val result = repository.updatePreventDirectGroupAdds(true) as ChatSettingsResult.Success

        assertEquals("PATCH", transport.method)
        assertEquals(setOf("preventDirectGroupAdds"), transport.body!!.keys().asSequence().toSet())
        assertTrue(transport.body!!.getBoolean("preventDirectGroupAdds"))
        assertEquals(false, result.settings.preventDirectGroupAdds)
    }

    @Test
    fun unauthorizedRequestRefreshesOnceAndRetriesWithRefreshedAccessToken() {
        val transport = RecordingTransport(settings()).apply { unauthorizedFirstRequest = true }
        var refreshCalls = 0
        val result = ChatNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            refreshSessionProvider = {
                refreshCalls++
                signedInSession("chat-refreshed")
            },
            transport = transport,
        ).load()

        assertTrue(result is ChatSettingsResult.Success)
        assertEquals(1, refreshCalls)
        assertEquals(listOf("chat-access", "chat-refreshed"), transport.tokens)
    }

    @Test
    fun missingSessionFailsWithoutCallingTheTransport() {
        val transport = RecordingTransport(settings())
        val result = ChatNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = transport,
        ).load() as ChatSettingsResult.Failure

        assertTrue(result.authenticationRequired)
        assertEquals(null, transport.method)
    }

    @Test
    fun incompleteServerSettingsAreRejectedInsteadOfFilledWithClientDefaults() {
        val incomplete = JSONObject()
            .put("messageRequestsFrom", "everyone")
            .put("preventDirectGroupAdds", false)
            .put("notifications", JSONObject().put("messages", true))
        val result = repository(RecordingTransport(incomplete)).load()

        assertTrue(result is ChatSettingsResult.Failure)
    }

    @Test
    fun authFailureAfterRefreshIsMarkedForReauthentication() {
        val transport = RecordingTransport(settings()).apply { alwaysUnauthorized = true }
        val result = ChatNotificationSettingsRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            refreshSessionProvider = { signedInSession("chat-refreshed") },
            transport = transport,
        ).load() as ChatSettingsResult.Failure

        assertTrue(result.authenticationRequired)
        assertEquals(2, transport.tokens.size)
    }

    private fun repository(transport: RecordingTransport) = ChatNotificationSettingsRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = ::signedInSession,
        transport = transport,
    )

    private class RecordingTransport(initialSettings: JSONObject) : ChatSettingsTransport {
        var method: String? = null
        var path: String? = null
        var accessToken: String? = null
        var body: JSONObject? = null
        var nextSettings: JSONObject = initialSettings
        var unauthorizedFirstRequest = false
        var alwaysUnauthorized = false
        val tokens = mutableListOf<String>()

        override fun getSettings(accessToken: String) = respond("GET", accessToken, null)

        override fun updateSettings(accessToken: String, fields: JSONObject) = respond("PATCH", accessToken, fields)

        private fun respond(method: String, accessToken: String, fields: JSONObject?): JSONObject {
            this.method = method
            path = "/api/v1/chat/settings"
            this.accessToken = accessToken
            body = fields
            tokens += accessToken
            if (alwaysUnauthorized || (unauthorizedFirstRequest && tokens.size == 1)) {
                throw ChatSettingsHttpException(401, "Unauthorized")
            }
            return nextSettings
        }
    }

    private companion object {
        fun signedInSession(accessToken: String = "chat-access") = AccountSession(
            accessToken,
            "chat-refresh",
            AccountUser("user-1", "Ari", "ari", null, null, emptyList()),
        )

        fun settings(
            notifications: ChatNotificationSettings = ChatNotificationSettings(true, false, true, false, true),
            audience: String = "followers",
            preventDirectGroupAdds: Boolean = true,
        ) =
            JSONObject().put("data", JSONObject()
                .put("messageRequestsFrom", audience)
                .put("preventDirectGroupAdds", preventDirectGroupAdds)
                .put("notifications", JSONObject()
                    .put("messages", notifications.messages)
                    .put("requests", notifications.requests)
                    .put("groups", notifications.groups)
                    .put("streakReminders", notifications.streakReminders)
                    .put("showMessagePreview", notifications.showMessagePreview))
                .put("timezone", "Africa/Lagos"))
    }
}
