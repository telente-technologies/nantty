package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.CartRepository
import com.nantty.android.data.CartTransport
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedTaggedProduct
import com.nantty.android.data.SaleAttributionSource
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.Executor
import java.util.UUID

class FeedTaggedProductsTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun taggedFeedProductOpensTheNativeProductDetailDestination() {
        var openedProductId: String? = null
        var openedAttribution: com.nantty.android.data.SaleAttribution? = null
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    post = taggedFeedPost(listOf(FeedTaggedProduct("product-42", "Linen set", 1_250_000, "NGN", null, 4))),
                    onOpenProduct = { openedProductId = it },
                    onOpenProductWithAttribution = { productId, attribution ->
                        openedProductId = productId
                        openedAttribution = attribution
                    },
                )
            }
        }

        composeRule.onNodeWithText("View products (1)").performClick()
        composeRule.onNodeWithTag("feed-tagged-products-sheet").assertIsDisplayed()
        composeRule.onNodeWithTag("feed-tagged-product-product-42").performClick()
        composeRule.runOnIdle {
            assertEquals("product-42", openedProductId)
            assertEquals(SaleAttributionSource.POST, openedAttribution?.source)
            assertEquals(TEST_POST_ID, openedAttribution?.id)
        }
    }

    @Test
    fun taggedProductsAddIndividuallyAndBulkAddUsesTheExistingSingleItemContract() {
        val addedProductIds = mutableListOf<String>()
        val recordedBodies = mutableListOf<JSONObject>()
        var openedCart = false
        val transport = object : CartTransport {
            override fun get(path: String, accessToken: String) = JSONObject()
            override fun add(path: String, accessToken: String, body: JSONObject) {
                assertEquals("/api/v1/cart/items", path)
                addedProductIds += body.getString("productId")
                recordedBodies += JSONObject(body.toString())
                assertEquals(1, body.getInt("quantity"))
            }
            override fun patch(path: String, accessToken: String, body: JSONObject) = Unit
            override fun delete(path: String, accessToken: String) = Unit
        }
        val repository = CartRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "test-token" },
            transport = transport,
        )
        val products = listOf(
            FeedTaggedProduct("product-42", "Linen set", 1_250_000, "NGN", null, 4),
            FeedTaggedProduct("product-43", "Travel mug", 350_000, "NGN", null, 9),
        )
        composeRule.setContent {
            MaterialTheme {
                FeedCard(
                    post = taggedFeedPost(products),
                    canInteract = true,
                    cartRepository = repository,
                    ioExecutor = Executor { it.run() },
                    onOpenProduct = {},
                    onOpenCart = { openedCart = true },
                )
            }
        }

        composeRule.onNodeWithText("View products (2)").performClick()
        composeRule.onNodeWithContentDescription("Add Linen set to cart").performClick()
        composeRule.waitUntil(5_000) { "product-42" in addedProductIds }
        composeRule.onNodeWithTag("feed-tagged-products-add-all").performClick()
        composeRule.waitUntil(5_000) { openedCart }
        composeRule.runOnIdle {
            assertEquals(listOf("product-42", "product-43"), addedProductIds)
            assertTrue(openedCart)
        }
        assertEquals("post", recordedBodies.first().getJSONObject("attribution").getString("source"))
        assertEquals(TEST_POST_ID, recordedBodies.first().getJSONObject("attribution").getString("id"))
    }

    private fun taggedFeedPost(products: List<FeedTaggedProduct>) = FeedPost(
        id = TEST_POST_ID,
        authorName = "Ari",
        username = "ari",
        avatarUrl = null,
        verified = false,
        verificationColor = null,
        postedAsName = null,
        postedAsHandle = null,
        postedAsAvatarUrl = null,
        kind = "post",
        text = "A tagged product",
        media = emptyList(),
        likes = 0,
        comments = 0,
        reposts = 0,
        shares = 0,
        createdAt = "2026-11-07T10:00:00Z",
        products = products,
    )

    companion object {
        private val TEST_POST_ID = UUID.fromString("23a7b4a2-aef6-41c1-a1d0-0b7e6e02a629").toString()
    }
}
