package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.ProductAdsRepository
import com.nantty.android.data.ProductAdsTransport
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SearchTransport
import java.util.Collections
import java.util.concurrent.Executor
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SearchProductAdTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun serverSearchTileTracksVisibleImpressionAndProductClick() {
        val adTransport = RecordingSearchAdTransport()
        var openedProductId: String? = null
        val adsRepository = ProductAdsRepository(accessTokenProvider = { "search-token" }, transport = adTransport)
        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    SearchRepository("https://api.nantty.com", ::signedInSession, ProductSearchTransport()),
                    Executor { it.run() },
                    onOpenProduct = { openedProductId = it },
                    productAdsRepository = adsRepository,
                )
            }
        }

        compose.onNodeWithText("Products").performClick()
        compose.onNode(hasSetTextAction()).performTextInput("adire")
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
        compose.onNodeWithTag("search-product-ad").assertIsDisplayed()
        compose.onNodeWithText("Sponsored").assertIsDisplayed()
        compose.mainClock.advanceTimeBy(1_100)
        compose.waitUntil(5_000) { adTransport.calls.any { it.path == ProductAdsRepository.EVENTS_PATH } }
        compose.onNodeWithTag("search-product-ad-cta").performClick()
        compose.waitUntil(5_000) { adTransport.calls.count { it.path == ProductAdsRepository.EVENTS_PATH } >= 2 }

        compose.runOnIdle {
            val decision = adTransport.calls.single { it.path == ProductAdsRepository.DECIDE_PATH }
            assertEquals("searchTile", decision.body.getJSONObject("slot").getString("kind"))
            assertEquals("search-token", decision.accessToken)
            val events = adTransport.calls.filter { it.path == ProductAdsRepository.EVENTS_PATH }
                .map { it.body.getJSONArray("events").getJSONObject(0) }
            assertEquals(listOf("impression", "click"), events.map { it.getString("type") })
            assertTrue(events.all { it.getString("placement") == "search" && it.getString("token") == "signed-search-token" })
            assertEquals("product-1", openedProductId)
            assertEquals(1, adTransport.calls.count { it.path == ProductAdsRepository.DECIDE_PATH })
        }
    }

    private class ProductSearchTransport : SearchTransport {
        override fun request(path: String, accessToken: String?): JSONObject = when {
            path.startsWith("/api/v1/search/recent") -> JSONObject().put("data", JSONArray()).put("nextCursor", JSONObject.NULL)
            path.contains("type=products") -> JSONObject("""{"data":[{"type":"product","id":"prod-1","name":"Adire jacket","price":{"amountMinor":1250000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.test/jacket.jpg","stock":3}],"nextCursor":null,"scope":"global"}""")
            else -> JSONObject().put("data", JSONArray()).put("nextCursor", JSONObject.NULL)
        }
    }

    private class RecordingSearchAdTransport : ProductAdsTransport {
        data class Call(val path: String, val accessToken: String, val body: JSONObject)
        val calls = Collections.synchronizedList(mutableListOf<Call>())

        override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
            calls += Call(path, accessToken, body)
            return if (path == ProductAdsRepository.DECIDE_PATH) JSONObject(
                """{"ad":{"adId":"search-product-ad-1","impressionToken":"signed-search-token","expiresAt":"2099-11-07T13:00:00Z","placement":"search","slotKind":"searchTile","format":"product","label":"Ad","creative":{"format":"product","media":[{"kind":"image","url":"https://cdn.nantty.test/search-product.jpg"}],"headline":"Search match","primaryText":"A sponsored product selected for this search","callToAction":"shop_now","destination":{"type":"product","targetId":"product-1"},"identity":{"name":"Ada Atelier","handle":"adaatelier","verifiedBusiness":true}}}}""",
            ) else JSONObject()
        }
    }

    private fun signedInSession() = AccountSession("search-token", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
}
