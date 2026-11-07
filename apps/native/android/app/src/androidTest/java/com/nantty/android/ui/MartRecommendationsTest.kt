package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nantty.android.data.MartRepository
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class MartRecommendationsTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun martShowsRecommendedProductUsingExistingProductCardAndGoRoute() {
        val requestedUrls = CopyOnWriteArrayList<String>()
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url ->
                requestedUrls += url.toString()
                TestMartConnection(url, when {
                    url.path == "/api/v1/mart/recommendations/for-you" ->
                        """{"source":"personalized","products":[{"id":"prd-recommended","name":"Handwoven bag","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":null,"stock":5,"hasVariants":false}]}"""
                    url.path == "/api/v1/mart/home" -> """{"categories":[]}"""
                    url.path == "/api/v1/mart/highlights" -> """{"data":[]}"""
                    url.path == "/api/v1/products" -> """{"data":[],"nextCursor":null}"""
                    else -> "{}"
                })
            },
        )

        composeRule.setContent { MaterialTheme { MartScreen(repository) } }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Handwoven bag").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Products you might like").assertIsDisplayed()
        composeRule.onNodeWithText("Handwoven bag").assertIsDisplayed()
        assertTrue(requestedUrls.contains("https://api.nantty.com/api/v1/mart/recommendations/for-you"))
        assertTrue(requestedUrls.none { it.contains("/v1/recommendations/products") })
    }

    @Test
    fun recommendationsRemainVisibleWhileFilteringMartByCategory() {
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url ->
                val body = when (url.path) {
                    "/api/v1/mart/recommendations/for-you" ->
                        """{"source":"personalized","products":[{"id":"prd-recommended","name":"Handwoven bag","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":null,"stock":5}]}"""
                    "/api/v1/mart/home" ->
                        """{"categories":[{"id":"cat-clothing","name":"Clothing","depth":0}]}"""
                    "/api/v1/mart/highlights" -> """{"data":[]}"""
                    "/api/v1/products" -> """{"data":[],"nextCursor":null}"""
                    else -> "{}"
                }
                TestMartConnection(url, body)
            },
        )

        composeRule.setContent { MaterialTheme { MartScreen(repository) } }
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Handwoven bag").fetchSemanticsNodes().isNotEmpty()
        }

        composeRule.onNodeWithText("Clothing").performClick()

        composeRule.onNodeWithText("Products you might like").assertIsDisplayed()
        composeRule.onNodeWithText("Handwoven bag").assertIsDisplayed()
    }
}

private class TestMartConnection(
    url: URL,
    private val body: String,
) : HttpURLConnection(url) {
    override fun getResponseCode(): Int = 200
    override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
    override fun getErrorStream() = ByteArrayInputStream(body.toByteArray())
    override fun usingProxy(): Boolean = false
    override fun connect() = Unit
    override fun disconnect() = Unit
}
