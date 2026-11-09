package com.nantty.android.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.ExploreSuggestion
import com.nantty.android.data.ExploreUserSummary
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class PeopleYouMayKnowFeedModuleTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun suggestionCardExposesFollowProfileAndDismissActions() {
        val suggestion = ExploreSuggestion(
            user = ExploreUserSummary("user-1", "Ada Lovelace", "ada", null, true),
            reasonCode = "popular_in_region",
            reasonLabel = "Popular in your region",
            isOfficial = false,
            checkmarkTier = "none",
            isPrivate = false,
        )
        val actions = mutableListOf<String>()

        composeRule.setContent {
            PeopleYouMayKnowFeedModule(
                suggestions = listOf(suggestion),
                followStates = emptyMap(),
                busyIds = emptySet(),
                onOpenProfile = { actions += "profile:$it" },
                onFollow = { actions += "follow:${it.user.id}" },
                onDismiss = { actions += "dismiss:${it.user.id}" },
                onSeeAll = { actions += "see-all" },
            )
        }

        composeRule.onNodeWithTag("feed-people-you-may-know").assertIsDisplayed()
        composeRule.onNodeWithTag("follow-suggested-person-user-1").performClick()
        composeRule.onNodeWithContentDescription("Open Ada Lovelace's profile").performClick()
        composeRule.onNodeWithTag("dismiss-suggested-person-user-1").performClick()
        composeRule.onNodeWithText("See all").performClick()
        composeRule.runOnIdle {
            assertEquals(listOf("follow:user-1", "profile:user-1", "dismiss:user-1", "see-all"), actions)
        }
    }
}
