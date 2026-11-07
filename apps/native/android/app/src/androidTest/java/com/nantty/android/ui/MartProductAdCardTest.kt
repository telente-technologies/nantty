package com.nantty.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.nantty.android.data.MartProductAd
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class MartProductAdCardTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun showsServerCreativeAndOpensItsProductDestination() {
        val ad = MartProductAd(
            adId = "ad-1", impressionToken = "signed-token-123", expiresAt = "2099-01-01T00:00:00Z",
            label = "Ad", headline = "Handwoven tote", primaryText = "Made by Ada Atelier",
            callToAction = "shop_now", imageUrl = "https://cdn.nantty.test/tote.jpg",
            advertiserName = "Ada Atelier", verifiedBusiness = true, productId = "product-1",
        )
        var opened: String? = null
        var viewed = 0
        composeRule.setContent {
            MaterialTheme {
                MartProductAdCard(ad, onOpenProduct = { opened = it }, onViewed = { viewed++ })
            }
        }

        composeRule.onNodeWithTag("mart-product-ad").assertIsDisplayed()
        composeRule.onNodeWithText("Ad").assertIsDisplayed()
        composeRule.onNodeWithText("Handwoven tote").assertIsDisplayed()
        composeRule.onNodeWithText("Made by Ada Atelier").assertIsDisplayed()
        composeRule.onNodeWithText("Shop now").performClick()
        composeRule.runOnIdle {
            assertEquals("product-1", opened)
            assertEquals(1, viewed)
        }
    }

    @Test
    fun doesNotRecordLazyPrecompositionAndWaitsForVisibleDwellBeforeImpression() {
        composeRule.mainClock.autoAdvance = false
        var viewed = 0
        var scrollToAd: (() -> Unit)? = null
        composeRule.setContent {
            MaterialTheme {
                val scrollState = rememberScrollState()
                val scope = rememberCoroutineScope()
                scrollToAd = { scope.launch { scrollState.scrollTo(scrollState.maxValue) } }
                Column(Modifier.height(160.dp).verticalScroll(scrollState)) {
                    Spacer(Modifier.height(1_000.dp))
                    MartProductAdCard(ad(), onOpenProduct = {}, onViewed = { viewed++ })
                }
            }
        }

        composeRule.waitForIdle()
        composeRule.mainClock.advanceTimeBy(1_200)
        composeRule.runOnIdle { assertEquals(0, viewed) }

        composeRule.runOnIdle { scrollToAd?.invoke() }
        composeRule.waitForIdle()
        composeRule.mainClock.advanceTimeBy(900)
        composeRule.runOnIdle { assertEquals(0, viewed) }
        composeRule.mainClock.advanceTimeBy(200)
        composeRule.runOnIdle { assertEquals(1, viewed) }
    }

    private fun ad() = MartProductAd(
        adId = "ad-1", impressionToken = "signed-token-123", expiresAt = "2099-01-01T00:00:00Z",
        label = "Ad", headline = "Handwoven tote", primaryText = "Made by Ada Atelier",
        callToAction = "shop_now", imageUrl = "https://cdn.nantty.test/tote.jpg",
        advertiserName = "Ada Atelier", verifiedBusiness = true, productId = "product-1",
    )
}
