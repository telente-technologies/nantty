package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GetVerifiedFeedCardTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun offerShowsBlueCopyAndEachActionCallsItsOwnCallback() {
        val actions = mutableListOf<String>()
        compose.setContent {
            MaterialTheme {
                GetVerifiedFeedCard(
                    state = GetVerifiedFeedCardState(
                        kind = GetVerifiedCardKind.OFFER,
                        color = GetVerifiedCheckmarkColor.BLUE,
                        profileName = "Ada Creator",
                        profileAvatarUrl = null,
                    ),
                    onOpenVerification = { actions += "open" },
                    onDismiss = { actions += "dismiss" },
                    onNeverShowAgain = { actions += "never" },
                )
            }
        }

        compose.onNodeWithTag("feed-get-verified-card").assertIsDisplayed()
        compose.onNodeWithText("Get the Blue checkmark").assertIsDisplayed()
        compose.onNodeWithText("Show people it’s really you and stand out in comments, search and live.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Hide this suggestion for now").assertHasClickAction().performClick()
        compose.onNodeWithText("Get verified").performClick()
        compose.onNodeWithText("Don’t show again").performClick()
        compose.runOnIdle { assertEquals(listOf("dismiss", "open", "never"), actions) }
    }

    @Test
    fun pendingCardHasNoPermanentHideAction() {
        compose.setContent {
            MaterialTheme {
                GetVerifiedFeedCard(
                    state = GetVerifiedFeedCardState(
                        kind = GetVerifiedCardKind.PENDING,
                        color = GetVerifiedCheckmarkColor.GOLD,
                        profileName = "Nantty Store",
                        profileAvatarUrl = null,
                    ),
                    onOpenVerification = {},
                    onDismiss = {},
                    onNeverShowAgain = {},
                )
            }
        }

        compose.onNodeWithText("Your verification is in review").assertIsDisplayed()
        compose.onNodeWithText("We’ll let you know as soon as your Gold checkmark is approved.").assertIsDisplayed()
        compose.onNodeWithText("Don’t show again").assertDoesNotExist()
    }
}
