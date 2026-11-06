package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.ChannelInvitation
import com.nantty.android.data.ChannelInvitationStatus
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class ChannelInvitationConsentRowTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun channelInvitationRequiresExplicitAcceptOrDeclineAction() {
        val actions = mutableListOf<String>()
        compose.setContent {
            MaterialTheme {
                ChannelInvitationConsentRow(
                    ChannelInvitation(
                        id = "22222222-2222-4222-8222-222222222222",
                        channelId = "11111111-1111-4111-8111-111111111111",
                        channelTitle = "Nantty updates",
                        status = ChannelInvitationStatus.PENDING,
                        createdAt = "2026-11-06T12:00:00Z",
                        expiresAt = "2026-11-13T12:00:00Z",
                    ),
                    busyId = null,
                    onRespond = actions::add,
                )
            }
        }

        compose.onNodeWithText("Nantty updates").assertIsDisplayed()
        compose.onNodeWithContentDescription("Accept channel invitation").performClick()
        compose.onNodeWithContentDescription("Decline channel invitation").performClick()

        compose.runOnIdle { assertEquals(listOf("accept", "decline"), actions) }
    }
}
