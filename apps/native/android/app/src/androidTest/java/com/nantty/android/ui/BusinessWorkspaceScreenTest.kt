package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BusinessWorkspaceScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun keepsBusinessAreasReachableInOneNativeWorkspace() {
        compose.setContent {
            MaterialTheme {
                BusinessWorkspaceScreen(
                    sellerContent = { androidx.compose.material3.Text("Seller panel") },
                    creatorContent = { androidx.compose.material3.Text("Creator panel") },
                    brandContent = { androidx.compose.material3.Text("Brand panel") },
                    adsContent = { androidx.compose.material3.Text("Ads panel") },
                    onBack = {},
                )
            }
        }

        compose.onNodeWithText("Business tools").assertIsDisplayed()
        compose.onNodeWithText("Seller panel").assertIsDisplayed()
        compose.onNodeWithText("Creator").performClick()
        compose.onNodeWithText("Creator panel").assertIsDisplayed()
        compose.onNodeWithText("Brands").performClick()
        compose.onNodeWithText("Brand panel").assertIsDisplayed()
        compose.onNodeWithText("Ads").performClick()
        compose.onNodeWithText("Ads panel").assertIsDisplayed()
    }
}
