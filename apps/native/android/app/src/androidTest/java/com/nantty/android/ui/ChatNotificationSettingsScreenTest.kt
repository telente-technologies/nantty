package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.ChatNotificationSettingsRepository
import com.nantty.android.data.ChatSettingsHttpException
import com.nantty.android.data.ChatSettingsTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class ChatNotificationSettingsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun loadsSettingsAndSavesCompleteServerBackedToggleState() {
        val transport = FakeTransport()
        var settingsChanged = false
        compose.setContent {
            MaterialTheme {
                ChatNotificationSettingsScreen(repository(transport), Executor { it.run() }, onBack = {}, onReauthenticate = {}, onSettingsChanged = { settingsChanged = true })
            }
        }

        compose.onNodeWithContentDescription("Messages").assertIsDisplayed().assertIsOn().performClick()
        compose.onNodeWithContentDescription("Messages").assertIsOff()
        compose.runOnIdle {
            assertEquals(listOf("GET", "PATCH"), transport.methods)
            assertEquals("PATCH", transport.lastMethod)
            assertEquals("/api/v1/chat/settings", transport.lastPath)
            assertEquals(setOf("messages", "requests", "groups", "streakReminders", "showMessagePreview"),
                transport.lastBody!!.getJSONObject("notifications").keys().asSequence().toSet())
            assertEquals(true, settingsChanged)
        }
    }

    @Test
    fun failedInitialLoadShowsErrorAndRetryLoadsSettings() {
        val transport = FakeTransport().apply { failedLoadsRemaining = 1 }
        compose.setContent {
            MaterialTheme {
                ChatNotificationSettingsScreen(repository(transport), Executor { it.run() }, onBack = {}, onReauthenticate = {})
            }
        }

        compose.onNodeWithText("Couldn't load notification settings.").assertIsDisplayed()
        compose.onNodeWithText("Try again").performClick()
        compose.onNodeWithContentDescription("Messages").assertIsDisplayed()
    }

    @Test
    fun failedSaveRetainsServerValueAndSurfacesRetryableError() {
        val transport = FakeTransport().apply { failNextUpdate = true }
        compose.setContent {
            MaterialTheme {
                ChatNotificationSettingsScreen(repository(transport), Executor { it.run() }, onBack = {}, onReauthenticate = {})
            }
        }

        compose.onNodeWithContentDescription("Messages").performClick()
        compose.onNodeWithContentDescription("Messages").assertIsOn()
        compose.onNodeWithText("Chat settings request failed. Try again.").assertIsDisplayed()
    }

    @Test
    fun messageRequestAudienceIsLoadedAndSavedThroughSettingsApi() {
        val transport = FakeTransport()
        var settingsChanged = false
        compose.setContent {
            MaterialTheme {
                ChatNotificationSettingsScreen(repository(transport), Executor { it.run() }, onBack = {}, onReauthenticate = {}, onSettingsChanged = { settingsChanged = true })
            }
        }

        compose.onNodeWithContentDescription("Allow message requests from Everyone").assertIsDisplayed()
        compose.onNodeWithContentDescription("Allow message requests from Nobody").performClick()
        compose.onNodeWithContentDescription("Allow message requests from Nobody").assertIsSelected()
        compose.runOnIdle {
            assertEquals(setOf("messageRequestsFrom"), transport.lastBody!!.keys().asSequence().toSet())
            assertEquals("nobody", transport.lastBody!!.getString("messageRequestsFrom"))
            assertEquals(true, settingsChanged)
        }
    }

    @Test
    fun directGroupAdditionPrivacyUsesServerValueAndSendsOnlyItsOwnPatchField() {
        val transport = FakeTransport()
        var settingsChanged = false
        compose.setContent {
            MaterialTheme {
                ChatNotificationSettingsScreen(repository(transport), Executor { it.run() }, onBack = {}, onReauthenticate = {}, onSettingsChanged = { settingsChanged = true })
            }
        }

        compose.onNodeWithContentDescription("Require invitations to join groups").assertIsOff().performClick()
        compose.onNodeWithContentDescription("Require invitations to join groups").assertIsOn()
        compose.runOnIdle {
            assertEquals(setOf("preventDirectGroupAdds"), transport.lastBody!!.keys().asSequence().toSet())
            assertEquals(true, transport.lastBody!!.getBoolean("preventDirectGroupAdds"))
            assertEquals(true, settingsChanged)
        }
    }

    @Test
    fun exposesBlockedAccountsActionWithoutDuplicatingConnectionFlow() {
        var opened = false
        compose.setContent {
            MaterialTheme {
                ChatNotificationSettingsScreen(repository(FakeTransport()), Executor { it.run() }, onBack = {}, onReauthenticate = {}, onOpenBlockedAccounts = { opened = true })
            }
        }

        compose.onNodeWithText("Blocked accounts").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(true, opened) }
    }

    private fun repository(transport: FakeTransport) = ChatNotificationSettingsRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = { AccountSession("chat-access", "chat-refresh", AccountUser("u1", "Ari", "ari", null, null, emptyList())) },
        transport = transport,
    )

    private class FakeTransport : ChatSettingsTransport {
        var lastMethod: String? = null
        var lastPath: String? = null
        var lastBody: JSONObject? = null
        val methods = mutableListOf<String>()
        var failedLoadsRemaining = 0
        var failNextUpdate = false
        private var messages = true
        private var audience = "everyone"
        private var preventDirectGroupAdds = false

        override fun getSettings(accessToken: String): JSONObject {
            record("GET", null)
            if (failedLoadsRemaining > 0) {
                failedLoadsRemaining--
                throw IllegalStateException("Couldn't load notification settings.")
            }
            return settings()
        }

        override fun updateSettings(accessToken: String, fields: JSONObject): JSONObject {
            record("PATCH", fields)
            if (failNextUpdate) {
                failNextUpdate = false
                throw ChatSettingsHttpException(503, "Chat settings request failed. Try again.")
            }
            if (fields.has("notifications")) messages = fields.getJSONObject("notifications").getBoolean("messages")
            if (fields.has("messageRequestsFrom")) audience = fields.getString("messageRequestsFrom")
            if (fields.has("preventDirectGroupAdds")) preventDirectGroupAdds = fields.getBoolean("preventDirectGroupAdds")
            return settings()
        }

        private fun settings() = JSONObject().put("data", JSONObject()
            .put("messageRequestsFrom", audience)
            .put("preventDirectGroupAdds", preventDirectGroupAdds)
            .put("notifications", JSONObject()
                .put("messages", messages)
                .put("requests", false)
                .put("groups", true)
                .put("streakReminders", false)
                .put("showMessagePreview", true)))

        private fun record(method: String, body: JSONObject?) {
            lastMethod = method
            methods += method
            lastPath = "/api/v1/chat/settings"
            lastBody = body
        }
    }
}
