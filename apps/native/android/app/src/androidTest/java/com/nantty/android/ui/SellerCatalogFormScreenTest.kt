package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.SellerCatalogRepository
import com.nantty.android.data.SellerCatalogResponse
import com.nantty.android.data.SellerCatalogTransport
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SellerCatalogFormScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun createFormAddsOptionsAndUsesServerBackedLocationChoices() {
        val repository = SellerCatalogRepository(
            sessionProvider = {
                AccountSession("seller-token", "refresh", AccountUser("seller", "Seller", "seller", null, null, listOf("seller")))
            },
            transport = SellerCatalogTransport { method, path, _, _, _ ->
                check(method == "GET")
                when (path) {
                    SellerCatalogRepository.LOCATIONS_PATH -> SellerCatalogResponse(
                        200,
                        """{"data":[{"id":"location-1","name":"Lagos","active":true,"isDefault":true}]}""",
                    )
                    else -> SellerCatalogResponse(200, """{"data":[]}""")
                }
            },
        )

        compose.setContent {
            MaterialTheme {
                SellerCatalogFormScreen(
                    repository = repository,
                    productId = null,
                    onBack = {},
                    onAuthenticationRequired = {},
                    onSaved = {},
                )
            }
        }

        compose.onNodeWithText("New product").assertIsDisplayed()
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithText("Opening stock will be added to Lagos.").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Opening stock will be added to Lagos.").assertIsDisplayed()
        compose.onNodeWithText("Add option").performClick()
        compose.onNodeWithText("Option 1 name").assertIsDisplayed()
        compose.onNodeWithText("Values separated by commas").assertIsDisplayed()
    }

    @Test
    fun editFormCanRemoveExistingProductPhotoFromTheNextSavePayload() {
        val repository = SellerCatalogRepository(
            sessionProvider = {
                AccountSession("seller-token", "refresh", AccountUser("seller", "Seller", "seller", null, null, listOf("seller")))
            },
            transport = SellerCatalogTransport { _, path, _, _, _ ->
                check(path == SellerCatalogRepository.productPath("product-1"))
                SellerCatalogResponse(
                    200,
                    """{"data":{"id":"product-1","name":"Linen shirt","description":"","status":"active","publishedOnline":true,"images":[{"mediaId":"media-1","url":"https://cdn.nantty.com/shirt.jpg"}],"options":[],"variants":[{"id":"variant-1","optionValues":{},"sku":"shirt","price":{"amountMinor":25000,"currency":"NGN"},"stock":[]}],"tags":[]}}""",
                )
            },
        )

        compose.setContent {
            MaterialTheme {
                SellerCatalogFormScreen(repository, "product-1", {}, {}, {})
            }
        }

        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithText("Product photos (1/10)").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithContentDescription("Remove product photo 1").performClick()
        compose.onNodeWithText("Product photos (0/10)").assertIsDisplayed()
    }
}
