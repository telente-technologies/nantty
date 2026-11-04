package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AccountUser
import org.junit.Rule
import org.junit.Test

class AppHeaderResponsiveTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun compactHeaderMovesRefreshAndSignOutIntoAccessibleOverflow() {
        composeRule.setContent {
            MaterialTheme {
                Box(Modifier.width(360.dp)) {
                    AppHeader({}, {}, {}, testUser(), {})
                }
            }
        }

        composeRule.onNodeWithContentDescription("Open Mart").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Open my orders").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("More account actions").assertIsDisplayed().performClick()
        composeRule.onNodeWithText("Refresh feed").assertIsDisplayed()
        composeRule.onNodeWithText("Sign out").assertIsDisplayed()
        composeRule.onNodeWithText("Ari Oyinlola · @ari").assertIsDisplayed()
    }

    @Test
    fun wideHeaderKeepsPrimaryActionsVisibleWithoutOverflow() {
        composeRule.setContent {
            MaterialTheme {
                Box(Modifier.width(720.dp)) {
                    AppHeader({}, {}, {}, testUser(), {})
                }
            }
        }

        composeRule.onNodeWithText("Ari Oyinlola").assertIsDisplayed()
        composeRule.onNodeWithText("Sign out").assertIsDisplayed()
        composeRule.onNodeWithText("Refresh").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("More account actions").assertDoesNotExist()
    }

    private fun testUser() = AccountUser("user-1", "Ari Oyinlola", "ari", "ari@example.test", null, listOf("user"))
}
