package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.MartProduct
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class MartRecommendationsRailTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun loadingStateUsesTheExistingMartHeadingAndProgressCopy() {
        showRecommendations(products = null)

        composeRule.onNodeWithText("Products you might like").assertIsDisplayed()
        composeRule.onNodeWithText("Finding products for you…").assertIsDisplayed()
    }

    @Test
    fun emptyRecommendationsHideTheShelfLikeReactNative() {
        showRecommendations(products = emptyList(), source = "popular")

        composeRule.onNodeWithText("Products you might like").assertDoesNotExist()
        composeRule.onNodeWithText("More product suggestions will appear here as they become available.").assertDoesNotExist()
    }

    @Test
    fun errorStateCanRetryWithoutReplacingTheMartDesign() {
        var retries = 0
        showRecommendations(products = null, error = "offline", onRetry = { retries++ })

        composeRule.onNodeWithText("Product recommendations are unavailable right now.").assertIsDisplayed()
        composeRule.onNodeWithText("Try again").performClick()
        composeRule.runOnIdle { assertEquals(1, retries) }
    }

    @Test
    fun popularFallbackIsLabeledAndExistingProductCardOpensProduct() {
        var openedProductId: String? = null
        showRecommendations(
            products = listOf(product),
            source = "popular",
            onOpenProduct = { openedProductId = it },
        )

        composeRule.onNodeWithText("Popular products on Nantty").assertIsDisplayed()
        composeRule.onNodeWithText("Adire tote").assertIsDisplayed().performClick()
        composeRule.runOnIdle { assertEquals("product-1", openedProductId) }
    }

    @Test
    fun personalizedResultsAreClearlyIdentified() {
        showRecommendations(products = listOf(product), source = "personalized")

        composeRule.onNodeWithText("Picked for you").assertIsDisplayed()
    }

    private fun showRecommendations(
        products: List<MartProduct>?,
        source: String? = null,
        error: String? = null,
        onRetry: () -> Unit = {},
        onOpenProduct: (String) -> Unit = {},
    ) {
        composeRule.setContent {
            MaterialTheme {
                MartRecommendationsSection(
                    products = products,
                    source = source,
                    errorMessage = error,
                    onOpenProduct = onOpenProduct,
                    onRetry = onRetry,
                )
            }
        }
    }

    private companion object {
        val product = MartProduct(
            id = "product-1",
            name = "Adire tote",
            amountMinor = 250_000,
            currency = "NGN",
            imageUrl = null,
            stock = 3,
        )
    }
}
