package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class InvitationLinkExpiryPickerTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun selectionUpdatesTheDisplayedExpiryDuration() {
        val selectedHours = mutableIntStateOf(DEFAULT_INVITATION_LINK_EXPIRY_HOURS)
        compose.setContent {
            MaterialTheme {
                InvitationLinkExpiryPicker("Group", selectedHours.intValue) { selectedHours.intValue = it }
            }
        }

        compose.onNodeWithContentDescription("Group invite link expiry, 7 days").performClick()
        compose.onNodeWithText("30 days").performClick()
        compose.onNodeWithContentDescription("Group invite link expiry, 30 days").assertIsDisplayed()
        compose.runOnIdle { assertEquals(720, selectedHours.intValue) }
    }
}
