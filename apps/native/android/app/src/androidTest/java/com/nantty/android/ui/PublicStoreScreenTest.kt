package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.StoreTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class PublicStoreScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun rendersApiStoreAndOpensProductThenBack() {
        var openedProduct: String? = null
        var wentBack = false
        val repository = StoreRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = StoreTransport { path, _ ->
                when {
                    path == "/api/v1/stores/$STORE_ID" -> JSONObject("""{"id":"$STORE_ID","name":"Ada Fabrics","handle":"adafabrics","bio":"Handmade textiles","followers":18,"productsCount":1,"rating":4.7,"ratingCount":5,"verified":true}""")
                    path.startsWith("/api/v1/stores/$STORE_ID/products") -> JSONObject("""{"data":[{"id":"product-1","name":"Indigo scarf","price":{"amountMinor":125000,"currency":"NGN"},"stock":4}],"nextCursor":null}""")
                    else -> error("Unexpected store path: $path")
                }
            },
        )

        compose.setContent {
            MaterialTheme {
                PublicStoreScreen(STORE_ID, repository, Executor { it.run() }, onBack = { wentBack = true }, onOpenProduct = { openedProduct = it })
            }
        }

        compose.onNodeWithText("Ada Fabrics").assertIsDisplayed()
        compose.onNodeWithText("@adafabrics").assertIsDisplayed()
        compose.onNodeWithTag("product-search-result-product-1").performClick()
        compose.runOnIdle { assertEquals("product-1", openedProduct) }
        compose.onNodeWithContentDescription("Back to search").performClick()
        compose.runOnIdle { assertEquals(true, wentBack) }
    }

    @Test
    fun showsAnHonestEmptyProductsState() {
        val repository = StoreRepository(
            baseUrl = "https://api.nantty.com",
            transport = StoreTransport { path, _ ->
                when {
                    path == "/api/v1/stores/$STORE_ID" -> JSONObject("""{"id":"$STORE_ID","name":"Ada Fabrics","productsCount":0}""")
                    else -> JSONObject("""{"data":[],"nextCursor":null}""")
                }
            },
        )
        compose.setContent {
            MaterialTheme { PublicStoreScreen(STORE_ID, repository, Executor { it.run() }, onBack = {}, onOpenProduct = {}) }
        }

        compose.onNodeWithText("No products available").assertIsDisplayed()
    }

    private fun signedInSession() = AccountSession("store-token", "refresh-token", AccountUser("user-1", "Ada", "ada", null, null, emptyList()))

    companion object {
        private const val STORE_ID = "0192a4f0-0000-7000-8000-000000000000"
    }
}
