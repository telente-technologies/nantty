package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.ProductReviewsRepository
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class ProductReviewsPreviewTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun showsRatingPreviewAndSeeAllAction() {
        var openedProductId: String? = null
        composeRule.setContent {
            MaterialTheme {
                ProductReviewsPreview(
                    productId = "product-1",
                    repository = repository { url -> successResponse(url) },
                    onSeeAll = { openedProductId = "product-1" },
                )
            }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("See all 1 review").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Ratings & reviews").assertIsDisplayed()
        composeRule.onNodeWithText("4.5").assertIsDisplayed()
        composeRule.onNodeWithText("Lovely quality.").assertIsDisplayed()
        composeRule.onNodeWithText("Verified purchase").assertIsDisplayed()
        composeRule.onNodeWithText("See all 1 review").performClick()
        composeRule.runOnIdle { assertEquals("product-1", openedProductId) }
    }

    @Test
    fun showsEmptyStateWhenServerSummaryHasNoReviews() {
        composeRule.setContent {
            MaterialTheme {
                ProductReviewsPreview(
                    productId = "product-1",
                    repository = repository { url -> emptyResponse(url) },
                    onSeeAll = {},
                )
            }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("No reviews yet").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Buyers can rate this product after it's delivered.").assertIsDisplayed()
    }

    @Test
    fun retriesWhenBothPreviewAndSummaryRequestsFail() {
        val requestCount = AtomicInteger()
        composeRule.setContent {
            MaterialTheme {
                ProductReviewsPreview(
                    productId = "product-1",
                    repository = repository { url ->
                        if (requestCount.incrementAndGet() <= 2) failedResponse(url) else successResponse(url)
                    },
                    onSeeAll = {},
                )
            }
        }

        composeRule.waitUntil(5_000) { requestCount.get() >= 2 }
        composeRule.onNodeWithText("Couldn't load reviews. Tap to try again.").assertIsDisplayed().performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Lovely quality.").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("See all 1 review").assertIsDisplayed()
    }
}

private fun repository(response: (URL) -> PreviewReviewsConnection) = ProductReviewsRepository(
    baseUrl = "https://api.nantty.com",
    openConnection = response,
)

private fun successResponse(url: URL): PreviewReviewsConnection = when (url.path) {
    "/api/v1/products/product-1/reviews" -> PreviewReviewsConnection(
        url,
        HttpURLConnection.HTTP_OK,
        """{"average":4.5,"count":1,"reviews":[{"id":"review-1","author":{"id":"user-1","name":"Ayo Oyin","username":"ayo","avatarUrl":null},"rating":5,"text":"Lovely quality.","title":"Beautiful","isVerifiedPurchase":true,"reply":null,"createdAt":"2026-10-01T00:00:00Z"}],"nextCursor":null}""",
    )
    "/api/v1/products/product-1/rating-summary" -> PreviewReviewsConnection(
        url,
        HttpURLConnection.HTTP_OK,
        """{"average":4.5,"count":1,"distribution":{"1":0,"2":0,"3":0,"4":1,"5":0}}""",
    )
    else -> error("Unexpected preview URL: $url")
}

private fun emptyResponse(url: URL): PreviewReviewsConnection = when (url.path) {
    "/api/v1/products/product-1/reviews" -> PreviewReviewsConnection(
        url,
        HttpURLConnection.HTTP_OK,
        """{"average":0,"count":0,"reviews":[],"nextCursor":null}""",
    )
    "/api/v1/products/product-1/rating-summary" -> PreviewReviewsConnection(
        url,
        HttpURLConnection.HTTP_OK,
        """{"average":0,"count":0,"distribution":{}}""",
    )
    else -> error("Unexpected preview URL: $url")
}

private fun failedResponse(url: URL) = PreviewReviewsConnection(url, 503, "{}")

private class PreviewReviewsConnection(
    url: URL,
    private val status: Int,
    private val body: String,
) : HttpURLConnection(url) {
    override fun getResponseCode() = status
    override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
    override fun getErrorStream() = ByteArrayInputStream(body.toByteArray())
    override fun usingProxy() = false
    override fun connect() = Unit
    override fun disconnect() = Unit
}

