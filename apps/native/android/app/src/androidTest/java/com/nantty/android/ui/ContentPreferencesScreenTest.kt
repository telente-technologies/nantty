package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.ContentPreferencesRepository
import com.nantty.android.data.ContentPreferencesTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.Executor

class ContentPreferencesScreenTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun eligibleAccountCanUpdateSensitiveContentPreferenceAndRefreshFeed() {
        val transport = TestContentPreferencesTransport("adult", canChange = true)
        val repository = ContentPreferencesRepository(
            sessionProvider = { testSession() },
            transport = transport,
        )
        var refreshed = false
        composeRule.setContent {
            MaterialTheme {
                ContentPreferencesScreen(repository, Executor { it.run() }, {}, {}, { refreshed = true })
            }
        }

        composeRule.onNodeWithText("Content preferences").assertIsDisplayed()
        composeRule.onNodeWithText("Show sensitive content without warning").assertIsDisplayed()
        composeRule.onNodeWithTag("contentPreferenceSwitch").performClick()
        composeRule.runOnIdle {
            assertEquals(true, transport.updatedValue)
            assertTrue(refreshed)
        }
    }

    @Test
    fun unknownAgeShowsLockedExplanationAndNoToggle() {
        val repository = ContentPreferencesRepository(
            sessionProvider = { testSession() },
            transport = TestContentPreferencesTransport("unknown", canChange = false),
        )
        composeRule.setContent {
            MaterialTheme {
                ContentPreferencesScreen(repository, Executor { it.run() }, {}, {}, {})
            }
        }

        composeRule.onNodeWithText("Sensitive content warnings stay on").assertIsDisplayed()
        composeRule.onNodeWithText("Your age is not confirmed. Warnings stay on, and adult content is never shown until your age is verified.").assertIsDisplayed()
        composeRule.onAllNodesWithTag("contentPreferenceSwitch").assertCountEquals(0)
    }
}

private fun testSession() = AccountSession(
    "access", "refresh", AccountUser("user", "Ari", "ari", null, null, emptyList()),
)

private class TestContentPreferencesTransport(
    private val ageBracket: String,
    private val canChange: Boolean,
) : ContentPreferencesTransport {
    var updatedValue: Boolean? = null

    override fun request(method: String, accessToken: String, body: JSONObject?): JSONObject {
        if (method == "PUT") updatedValue = body?.getBoolean("showSensitiveWithoutWarning")
        return JSONObject().put("data", JSONObject()
            .put("ageBracket", ageBracket)
            .put("canChangeSensitiveContentSetting", canChange)
            .put("showSensitiveWithoutWarning", updatedValue ?: false))
    }
}
