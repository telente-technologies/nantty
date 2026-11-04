package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.MartRepository
import com.nantty.android.data.CartRepository
import com.nantty.android.data.CartTransport
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class MartProductDetailNavigationTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun catalogCardOpensReadOnlyDetailsAndBackReturnsToCatalog() {
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url ->
                FakeMartConnection(url, responseFor(url))
            },
        )

        composeRule.setContent {
            MaterialTheme {
                MartScreen(repository)
            }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Silk wrap dress").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Silk wrap dress").performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Product details").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Product details").assertIsDisplayed()
        composeRule.onNodeWithText("Adire House").assertIsDisplayed()

        composeRule.onNodeWithContentDescription("Back to Mart").performClick()
        composeRule.onNodeWithText("Silk wrap dress").assertIsDisplayed()
    }

    @Test
    fun longProductTitleCanWrapAtLargeSystemFontScale() {
        val productName = "Handwoven Adire Silk Wrap Dress with Adjustable Waist and Custom Indigo Detail"
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url -> FakeMartConnection(url, responseFor(url, productName)) },
        )

        composeRule.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 2f)) {
                MaterialTheme { MartScreen(repository) }
            }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText(productName).fetchSemanticsNodes().isNotEmpty()
        }
        val title = composeRule.onNodeWithText(productName).assertIsDisplayed().fetchSemanticsNode()
        assertTrue("Product title should wrap instead of being limited to two lines", title.boundsInRoot.height > with(composeRule.density) { 72.dp.toPx() })
    }

    @Test
    fun selectedQuantityIsSentWithProductAddRequest() {
        val cartTransport = RecordingProductCartTransport()
        val cartRepository = CartRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "synthetic-buyer-token" },
            transport = cartTransport,
        )
        val productRepository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url -> FakeMartConnection(url, responseFor(url)) },
        )

        composeRule.setContent {
            MaterialTheme {
                MartProductDetailScreen(
                    productId = "prd-1",
                    repository = productRepository,
                    onAuthenticationRequired = {},
                    onBack = {},
                    cartRepositoryOverride = cartRepository,
                )
            }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Silk wrap dress").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithContentDescription("Increase quantity").performClick()
        composeRule.onNodeWithContentDescription("Increase quantity").performClick()
        composeRule.onNodeWithContentDescription("Product quantity: 3").assertIsDisplayed()
        composeRule.onNodeWithText("Add to cart").performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Added to your cart.").fetchSemanticsNodes().isNotEmpty()
        }

        assertEquals(3, cartTransport.body?.getInt("quantity"))
        assertEquals("prd-1", cartTransport.body?.getString("productId"))
        assertEquals("variant-1", cartTransport.body?.getString("variantId"))
    }

    @Test
    fun externalCategorySelectionLoadsProductsByCategoryId() {
        val requestedUrls = mutableListOf<String>()
        var categoryHandled = false
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url ->
                requestedUrls += url.toString()
                FakeMartConnection(url, responseFor(url))
            },
        )

        composeRule.setContent {
            MaterialTheme {
                MartScreen(
                    repository = repository,
                    initialCategoryId = "category-fashion",
                    onInitialCategoryHandled = { categoryHandled = true },
                )
            }
        }

        composeRule.waitUntil(5_000) { requestedUrls.any { it.contains("categoryId=category-fashion") } }
        composeRule.runOnIdle { assertTrue(categoryHandled) }
        composeRule.onNodeWithText("Silk wrap dress").assertIsDisplayed()
        assertTrue(requestedUrls.any { it.endsWith("/api/v1/products?limit=20&categoryId=category-fashion") })
    }
}

private fun responseFor(url: URL, productName: String = "Silk wrap dress"): String = when {
    url.path == "/api/v1/mart/home" -> """{"categories":[]}"""
    url.path == "/api/v1/products" -> """{"data":[{"id":"prd-1","name":"$productName","price":{"amountMinor":125000,"currency":"NGN"},"stock":3}],"nextCursor":null}"""
    url.path == "/api/v1/products/prd-1" -> """{"id":"prd-1","title":"$productName","price":{"amountMinor":125000,"currency":"NGN"},"stock":3,"images":[],"rating":0,"sizes":["S","M"],"colors":["Blue"],"shippingInfo":"Calculated at checkout.","description":"Hand-finished silk.","store":{"id":"store-1","name":"Adire House"},"variants":[{"id":"variant-1","title":"Medium / Blue","size":"M","color":"Blue","price":{"amountMinor":125000,"currency":"NGN"},"inStock":true}]}"""
    else -> error("Unexpected catalog URL: $url")
}

private class FakeMartConnection(url: URL, private val body: String) : HttpURLConnection(url) {
    override fun getResponseCode(): Int = HttpURLConnection.HTTP_OK
    override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
    override fun usingProxy(): Boolean = false
    override fun connect() = Unit
    override fun disconnect() = Unit
}

private class RecordingProductCartTransport : CartTransport {
    var body: JSONObject? = null

    override fun get(path: String, accessToken: String): JSONObject = error("Unexpected cart read")
    override fun add(path: String, accessToken: String, body: JSONObject) {
        assertEquals("/api/v1/cart/items", path)
        assertEquals("synthetic-buyer-token", accessToken)
        this.body = body
    }
    override fun patch(path: String, accessToken: String, body: JSONObject) = error("Unexpected cart update")
    override fun delete(path: String, accessToken: String) = error("Unexpected cart delete")
}
