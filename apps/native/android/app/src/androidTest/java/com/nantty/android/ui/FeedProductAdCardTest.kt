package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.MartProductAd
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class FeedProductAdCardTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun displaysAdvertiserIdentityAndProductCreativeThenNavigatesOnCta() {
        composeRule.mainClock.autoAdvance = false
        val ad = feedAd()
        var opened = false
        var viewed = 0
        composeRule.setContent {
            MaterialTheme {
                FeedProductAdCard(ad, onOpenProduct = { opened = true }, onViewed = { viewed++; true })
            }
        }

        composeRule.onNodeWithTag("feed-product-ad").assertIsDisplayed()
        composeRule.onNodeWithText("Sponsored").assertIsDisplayed()
        composeRule.onNodeWithText("@adaatelier").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Verified business").assertIsDisplayed()
        composeRule.onNodeWithText("Handwoven tote").assertIsDisplayed()
        composeRule.mainClock.advanceTimeBy(500)
        composeRule.runOnIdle { assertEquals(0, viewed) }
        composeRule.mainClock.advanceTimeBy(600)
        composeRule.runOnIdle { assertEquals(1, viewed) }
        composeRule.onNodeWithContentDescription("Shop now, Handwoven tote").performClick()
        composeRule.runOnIdle {
            assertEquals(true, opened)
            assertEquals(1, viewed)
        }
    }

    @Test
    fun productPreviewIsAnAccessibleLinkToTheSameProduct() {
        var opened = false
        composeRule.setContent {
            MaterialTheme {
                FeedProductAdCard(feedAd(), onOpenProduct = { opened = true }, onViewed = { true })
            }
        }

        composeRule.onNodeWithContentDescription("Handwoven tote, sponsored product").assertIsDisplayed().performClick()
        composeRule.runOnIdle { assertEquals(true, opened) }
    }

    @Test
    fun retriesAVisibleImpressionUntilTheSignedEventIsAccepted() {
        composeRule.mainClock.autoAdvance = false
        var attempts = 0
        composeRule.setContent {
            MaterialTheme {
                FeedProductAdCard(
                    feedAd(),
                    onOpenProduct = {},
                    onViewed = { attempts++; attempts >= 2 },
                )
            }
        }

        composeRule.waitForIdle()
        composeRule.mainClock.advanceTimeBy(1_100)
        composeRule.runOnIdle { assertEquals(1, attempts) }
        composeRule.mainClock.advanceTimeBy(2_100)
        composeRule.runOnIdle { assertEquals(2, attempts) }
    }

    private fun feedAd() = MartProductAd(
        adId = "feed-ad-1", impressionToken = "signed-token-123", expiresAt = "2099-01-01T00:00:00Z",
        label = "Ad", headline = "Handwoven tote", primaryText = "Made by Ada Atelier",
        callToAction = "shop_now", imageUrl = "https://cdn.nantty.test/tote.jpg",
        advertiserName = "Ada Atelier", verifiedBusiness = true, productId = "product-1",
        placement = "feed", slotKind = "feedProduct",
        advertiserHandle = "adaatelier", advertiserAvatarUrl = "https://cdn.nantty.test/ada-avatar.jpg",
    )

}
