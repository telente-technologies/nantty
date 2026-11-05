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
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportReason
import com.nantty.android.data.ProductReportTransport
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.StoreTransport
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class MartProductDetailNavigationTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun martLandingCollectionTileOpensFilteredCollectionAndReturnsToMart() {
        val requestedUrls = CopyOnWriteArrayList<String>()
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url ->
                requestedUrls += url.toString()
                FakeMartConnection(url, responseFor(url))
            },
        )
        composeRule.setContent { MaterialTheme { MartScreen(repository) } }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Featured Brands").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Featured Brands").performClick()
        composeRule.waitUntil(5_000) {
            requestedUrls.any { it.endsWith("/api/v1/products?limit=20&collection=featured_brands") }
        }
        composeRule.onNodeWithText("Products in this collection.").assertIsDisplayed()
        composeRule.onNodeWithText("All Mart").performClick()
        composeRule.onNodeWithText("Browse products from stores on Nantty.").assertIsDisplayed()
    }

    @Test
    fun serverDrivenCollectionHighlightOpensFilteredMartResults() {
        val requestedUrls = CopyOnWriteArrayList<String>()
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url ->
                requestedUrls += url.toString()
                FakeMartConnection(url, responseFor(url))
            },
        )
        composeRule.setContent { MaterialTheme { MartScreen(repository) } }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("New arrivals").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("New arrivals").performClick()
        composeRule.waitUntil(5_000) {
            requestedUrls.any { it.contains("/api/v1/products?") && it.contains("collection=new_arrivals") }
        }
        composeRule.onNodeWithText("New arrivals").assertIsDisplayed()
        assertTrue(requestedUrls.any { it.contains("/api/v1/mart/highlights?limit=6") })
        assertTrue(requestedUrls.any { it.contains("/api/v1/products?limit=20&collection=new_arrivals") })
    }

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
    fun productDetailOpensItsStoreByServerStoreId() {
        var openedStoreId: String? = null
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url -> FakeMartConnection(url, responseFor(url)) },
        )
        composeRule.setContent {
            MaterialTheme { MartScreen(repository, onOpenStore = { openedStoreId = it }) }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Silk wrap dress").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Silk wrap dress").performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("View store").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithContentDescription("View Adire House store").performClick()
        composeRule.runOnIdle { assertEquals("store-1", openedStoreId) }
    }

    @Test
    fun productDetailFollowUsesStoreSocialRoutesAndServerStatus() {
        val transport = ProductStoreFollowTransport()
        val storeRepository = StoreRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { AccountSession("token", "refresh", AccountUser("user-1", "Ada", "ada", null, null, emptyList())) },
            transport = transport,
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
                    storeRepository = storeRepository,
                )
            }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Follow store").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Follow store").performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Following store").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Following store").performClick()
        composeRule.onNodeWithText("Unfollow store?").assertExists()
        assertEquals(emptyList<String>(), transport.deletes)
        composeRule.onNodeWithText("Unfollow", useUnmergedTree = true).performClick()
        composeRule.waitUntil(5_000) {
            transport.deletes.isNotEmpty()
        }
        assertEquals(listOf("/api/v1/stores/store-1/follow"), transport.posts)
        assertEquals(listOf("/api/v1/stores/store-1/follow"), transport.deletes)
    }

    @Test
    fun productReportSubmitsAuthenticatedSocialRequestAndShowsServerConfirmation() {
        val transport = RecordingProductReportTransport()
        val reportRepository = ProductReportRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "reporter-token" },
            transport = transport,
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
                    productReportRepositoryOverride = reportRepository,
                )
            }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Report this product").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Report this product").performClick()
        composeRule.onNodeWithText("Counterfeit / fake brand (trademark claim)").performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Thanks for reporting").fetchSemanticsNodes().isNotEmpty()
        }

        assertEquals("/api/v1/reports", transport.path)
        assertEquals("reporter-token", transport.accessToken)
        assertTrue(transport.idempotencyKey?.isNotBlank() == true)
        assertEquals("product", transport.body?.getString("targetType"))
        assertEquals("prd-1", transport.body?.getString("targetId"))
        assertEquals("counterfeit_product", transport.body?.getString("reason"))
    }

    @Test
    fun guestProductReportAsksForSignInWithoutOpeningReportDialog() {
        var signInRequested = false
        val productRepository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url -> FakeMartConnection(url, responseFor(url)) },
        )

        composeRule.setContent {
            MaterialTheme {
                MartProductDetailScreen(
                    productId = "prd-1",
                    repository = productRepository,
                    onAuthenticationRequired = { signInRequested = true },
                    onBack = {},
                )
            }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Report this product").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Report this product").performClick()
        composeRule.runOnIdle {
            assertTrue(signInRequested)
            assertTrue(composeRule.onAllNodesWithText("Choose the reason that best describes your concern.").fetchSemanticsNodes().isEmpty())
        }
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
        val categoryId = "0192a4f0-0000-7000-8000-000000000001"
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
                    initialCategoryId = categoryId,
                    initialCategoryName = "Clothing",
                    onInitialCategoryHandled = { categoryHandled = true },
                )
            }
        }

        composeRule.waitUntil(5_000) { requestedUrls.any { it.contains("categoryId=$categoryId") } }
        composeRule.runOnIdle { assertTrue(categoryHandled) }
        composeRule.onNodeWithText("Clothing").assertIsDisplayed()
        composeRule.onNodeWithText("Products in this category.").assertIsDisplayed()
        composeRule.onNodeWithText("Silk wrap dress").assertIsDisplayed()
        composeRule.onNodeWithText("All Mart").performClick()
        composeRule.onNodeWithText("Browse products from stores on Nantty.").assertIsDisplayed()
        assertTrue(requestedUrls.any { it.endsWith("/api/v1/products?limit=20&categoryId=$categoryId") })
        assertEquals(1, requestedUrls.count { it.endsWith("/api/v1/products?limit=20&categoryId=$categoryId") })
    }

    @Test
    fun productDetailOpensPagedReviewsAndBackReturnsToTheProduct() {
        val productRepository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url -> FakeMartConnection(url, responseFor(url)) },
        )
        val reviewsRepository = ProductReviewsRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url -> FakeReviewsConnection(url, reviewsResponseFor(url)) },
        )

        composeRule.setContent {
            MaterialTheme { MartScreen(productRepository, reviewsRepositoryOverride = reviewsRepository) }
        }

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Silk wrap dress").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Silk wrap dress").performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Read product reviews").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Read product reviews").performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("Product reviews").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Ayo Oyin").assertIsDisplayed()
        composeRule.onNodeWithText("Verified purchase").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Back to product").performClick()
        composeRule.onNodeWithText("Product details").assertIsDisplayed()
    }
}

private fun responseFor(url: URL, productName: String = "Silk wrap dress"): String = when {
    url.path == "/api/v1/mart/home" -> """{"categories":[]}"""
    url.path == "/api/v1/mart/highlights" -> """{"data":[{"id":"editorial-new-arrivals","kind":"new_arrivals","title":"New arrivals","subtitle":"Fresh this week","imageUrl":null,"target":{"type":"collection","collection":"new_arrivals","name":"New arrivals"},"ranking":{"score":0.6,"reason":{"code":"fresh_listings","label":"Just listed"}}}],"nextCursor":null}"""
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

private fun reviewsResponseFor(url: URL): String = when (url.path) {
    "/api/v1/products/prd-1/reviews" -> """{"average":5,"count":1,"reviews":[{"id":"review-1","author":{"id":"user-1","name":"Ayo Oyin","username":"ayo","avatarUrl":null},"rating":5,"text":"Lovely quality.","title":"Beautiful","isVerifiedPurchase":true,"reply":null,"createdAt":"2026-10-01T00:00:00Z"}],"nextCursor":null}"""
    "/api/v1/products/prd-1/rating-summary" -> """{"average":5,"count":1,"distribution":{"1":0,"2":0,"3":0,"4":0,"5":1}}"""
    else -> error("Unexpected reviews URL: $url")
}

private class FakeReviewsConnection(url: URL, private val body: String) : HttpURLConnection(url) {
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

private class ProductStoreFollowTransport : StoreTransport {
    val posts = mutableListOf<String>()
    val deletes = mutableListOf<String>()
    private var isFollowing = false

    override fun get(path: String, accessToken: String?): JSONObject {
        assertEquals("/api/v1/stores/store-1/follow-status", path)
        assertEquals("token", accessToken)
        return JSONObject("""{"storeId":"store-1","isFollowing":$isFollowing,"followers":${if (isFollowing) 19 else 18}}""")
    }

    override fun post(path: String, accessToken: String): JSONObject {
        assertEquals("token", accessToken)
        posts += path
        isFollowing = true
        return JSONObject("""{"storeId":"store-1","isFollowing":true,"followers":19}""")
    }

    override fun delete(path: String, accessToken: String): JSONObject {
        assertEquals("token", accessToken)
        deletes += path
        isFollowing = false
        return JSONObject("""{"storeId":"store-1","isFollowing":false,"followers":18}""")
    }
}

private class RecordingProductReportTransport : ProductReportTransport {
    var path: String? = null
    var accessToken: String? = null
    var idempotencyKey: String? = null
    var body: JSONObject? = null

    override fun submit(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
        this.path = path
        this.accessToken = accessToken
        this.idempotencyKey = idempotencyKey
        this.body = body
        return JSONObject("""{"data":{"id":"report-1","status":"received","priority":"normal"}}""")
    }
}
