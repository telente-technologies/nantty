package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.SellerApplicationTransport
import com.nantty.android.data.SellerWorkspaceRepository
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.Executor
import org.junit.Assert.assertTrue

class SellerApplicationFormTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun missingCountryGateOpensTheCountryPreferenceFlow() {
        val transport = object : SellerApplicationTransport {
            override fun get(path: String, accessToken: String): String = when (path) {
                "/api/v1/users/me/settings" -> """{"data":{}}"""
                "/api/v1/categories" -> """{"data":{"items":[{"id":"11111111-1111-4111-8111-111111111111","name":"Fashion"}]}}"""
                "/api/v1/banks?country=US" -> """{"data":[]}"""
                else -> error("Unexpected route: $path")
            }

            override fun post(path: String, accessToken: String, idempotencyKey: String?, body: JSONObject): String =
                error("Seller application must not submit outside Nigeria.")
        }
        val repository = SellerWorkspaceRepository(
            sessionProvider = { AccountSession("token", "refresh", AccountUser("user", "Seller", "seller", null, null, emptyList())) },
            applicationTransport = transport,
        )

        var openedCountrySettings = false
        composeRule.setContent {
            MaterialTheme {
                SellerApplicationForm(repository, Executor { it.run() }, {}, {}, {}, onOpenCountryPreferences = { openedCountrySettings = true })
            }
        }

        composeRule.onNodeWithText(
            "Seller applications are currently open only to sellers based in Nigeria. Your account country is not set.",
            substring = true,
        ).assertIsDisplayed()
        composeRule.onNodeWithText("Creator applications from outside Nigeria remain available.").assertIsDisplayed()
        composeRule.onNodeWithText("Open country settings").assertIsDisplayed().performClick()
        composeRule.runOnIdle { assertTrue(openedCountrySettings) }
    }
}
