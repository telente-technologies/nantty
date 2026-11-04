package com.nantty.android.ui

import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test

class MartCategorySelectionRestorationTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun selectedCategorySurvivesAdaptiveConfigurationRecreation() {
        val restorationTester = StateRestorationTester(composeRule)
        restorationTester.setContent {
            MaterialTheme {
                var selectedCategoryId by rememberMartCategorySelection()
                Button(onClick = { selectedCategoryId = "category-fashion" }) {
                    Text(selectedCategoryId ?: "All categories")
                }
            }
        }

        composeRule.onNodeWithText("All categories").performClick()
        composeRule.onNodeWithText("category-fashion").assertExists()
        restorationTester.emulateSavedInstanceStateRestore()
        composeRule.onNodeWithText("category-fashion").assertExists()
    }
}
