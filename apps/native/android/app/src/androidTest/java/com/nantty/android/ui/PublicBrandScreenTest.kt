package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.hasTestTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.PublicBrandRepository
import com.nantty.android.data.PublicBrandTransport
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfileTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PublicBrandScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun displaysPublicBrandProductsAndRoutesToOfficialStoreAndProduct() {
        val transport = BrandScreenTransport()
        val repository = PublicBrandRepository("https://api.nantty.com", { null }, transport)
        val postsTransport = BrandOwnerPostsTransport()
        var openedStore: String? = null
        var openedProduct: String? = null
        var openedPost: String? = null
        compose.setContent {
            MaterialTheme {
                PublicBrandScreen(
                    brandId = "brand_1",
                    repository = repository,
                    profileRepository = PublicProfileRepository(baseUrl = "https://api.nantty.com", transport = postsTransport),
                    onBack = {},
                    onOpenStore = { openedStore = it },
                    onOpenProduct = { openedProduct = it },
                    onOpenPost = { openedPost = it },
                    onRequireSignIn = {},
                    onRequireSignInWithAction = {},
                    isGuest = true,
                )
            }
        }

        compose.onNodeWithTag("brand-header").assertIsDisplayed()
        compose.onNodeWithText("Woven in Nigeria").assertIsDisplayed()
        compose.onNodeWithText("Official store").assertIsDisplayed()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Owner post one").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag("public-brand-content").performScrollToNode(hasTestTag("brand-official-store"))
        compose.onNodeWithText("Adire cloth").assertIsDisplayed()
        compose.onNodeWithTag("brand-official-store").performClick()
        compose.onNodeWithTag("public-brand-content").performScrollToNode(hasTestTag("product-search-result-product_1"))
        compose.onNodeWithText("Also sold by other sellers").assertIsDisplayed()
        compose.onNodeWithText("Handwoven bag").assertIsDisplayed()
        compose.onNodeWithTag("product-search-result-product_1").performClick()
        compose.onNodeWithTag("public-brand-content").performScrollToNode(hasText("Owner post two"))
        compose.onNodeWithText("Owner post two").assertIsDisplayed()
        compose.onNodeWithTag("public-brand-content").performScrollToNode(hasText("Owner post three"))
        compose.onNodeWithText("Owner post three").assertIsDisplayed()
        assertEquals(4, postsTransport.returnedPostCount)
        compose.onNodeWithTag("public-brand-content").performScrollToNode(hasText("Posts"))
        compose.onNodeWithText("Posts").assertIsDisplayed()
        compose.onNodeWithTag("public-brand-content").performScrollToNode(hasText("Owner post one"))
        compose.onNodeWithText("Owner post one").assertIsDisplayed()
        compose.onNodeWithText("Owner post one").performClick()
        compose.runOnIdle {
            assertEquals("store_1", openedStore)
            assertEquals("product_1", openedProduct)
            assertEquals("post_1", openedPost)
            assertEquals(listOf("GET /api/v1/brands/brand_1", "GET /api/v1/brands/brand_1/products"), transport.calls)
            assertEquals(listOf("/api/v1/users/owner_1/posts?visibility=public"), postsTransport.calls)
        }
    }

    @Test
    fun guestFollowRequestsDeferredAuthenticationAction() {
        val transport = BrandScreenTransport()
        var requestedAction: (() -> Unit)? = null
        compose.setContent {
            MaterialTheme {
                PublicBrandScreen(
                    brandId = "brand_1",
                    repository = PublicBrandRepository("https://api.nantty.com", { null }, transport),
                    profileRepository = PublicProfileRepository(baseUrl = "https://api.nantty.com", transport = BrandOwnerPostsTransport()),
                    onBack = {},
                    onOpenStore = {},
                    onOpenProduct = {},
                    onOpenPost = {},
                    onRequireSignIn = {},
                    onRequireSignInWithAction = { requestedAction = it },
                    isGuest = true,
                )
            }
        }

        compose.onNodeWithTag("brand-follow-button").performClick()
        compose.runOnIdle {
            assertNotNull(requestedAction)
            assertEquals(listOf("GET /api/v1/brands/brand_1", "GET /api/v1/brands/brand_1/products"), transport.calls)
        }
    }
}

private class BrandScreenTransport : PublicBrandTransport {
    val calls = mutableListOf<String>()
    override fun get(path: String, accessToken: String?): JSONObject {
        calls += "GET $path"
        return if (path.endsWith("/products")) JSONObject("""{"data":{"officialStoreProducts":[{"id":"product_1","name":"Adire cloth","price":{"amountMinor":250000,"currency":"NGN"},"stock":4}],"otherSellersProducts":[{"id":"product_2","name":"Handwoven bag","price":{"amountMinor":125000,"currency":"NGN"},"stock":2}]}}""")
        else JSONObject("""{"data":{"id":"brand_1","name":"Nigerian Loom","handle":"nigerian-loom","ownerUserId":"owner_1","followers":42,"categoryName":"Fashion","description":"Woven in Nigeria","official":true,"sellingEnabled":true,"isFollowing":false,"officialStore":{"id":"store_1","name":"Nigerian Loom Official"}}}""")
    }
}

private class BrandOwnerPostsTransport : PublicProfileTransport {
    val calls = mutableListOf<String>()
    var returnedPostCount = 0
    override fun get(path: String, accessToken: String?): JSONObject {
        calls += path
        returnedPostCount = 4
        return JSONObject("""{"data":[
            {"id":"post_1","author":{"id":"owner_1","name":"Nigerian Loom","username":"nigerianloom"},"text":"Owner post one"},
            {"id":"post_2","author":{"id":"owner_1","name":"Nigerian Loom","username":"nigerianloom"},"text":"Owner post two"},
            {"id":"post_3","author":{"id":"owner_1","name":"Nigerian Loom","username":"nigerianloom"},"text":"Owner post three"},
            {"id":"post_4","author":{"id":"owner_1","name":"Nigerian Loom","username":"nigerianloom"},"text":"Owner post four"}
        ],"nextCursor":"next"} """)
    }
    override fun post(path: String, accessToken: String): JSONObject = error("Unexpected profile POST")
    override fun delete(path: String, accessToken: String) = error("Unexpected profile DELETE")
}

