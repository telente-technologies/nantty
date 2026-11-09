package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class CartRepositoryTest {
    @Test
    fun addsChosenVariantUsingAuthenticatedCartContract() {
        val transport = RecordingCartTransport()
        val result = CartRepository("https://api.nantty.com", { "buyer-access" }, transport)
            .addProduct("product_1", "variant_2", 2)

        assertEquals(AddToCartResult.Success, result)
        assertEquals("/api/v1/cart/items", transport.path)
        assertEquals("buyer-access", transport.token)
        assertEquals("product_1", transport.body?.getString("productId"))
        assertEquals("variant_2", transport.body?.getString("variantId"))
        assertEquals(2, transport.body?.getInt("quantity"))
    }

    @Test
    fun addsIndependentProductOptionsUsingTheReactNativeCartContract() {
        val transport = RecordingCartTransport()
        val result = CartRepository("https://api.nantty.com", { "buyer-access" }, transport).addProduct(
            productId = "product_1",
            variantId = null,
            quantity = 2,
            size = "M",
            color = "Blue",
            options = mapOf("Material" to "Silk"),
        )

        assertEquals(AddToCartResult.Success, result)
        assertEquals("M", transport.body?.getString("size"))
        assertEquals("Blue", transport.body?.getString("color"))
        assertEquals("Silk", transport.body?.getJSONObject("options")?.getString("Material"))
        assertEquals(false, transport.body?.has("variantId"))
    }

    @Test
    fun rejectsConflictingOrMalformedProductOptionPayloadsBeforeRequest() {
        val transport = RecordingCartTransport()
        val repository = CartRepository("https://api.nantty.com", { "buyer-access" }, transport)

        assertTrue(repository.addProduct("product_1", "variant_1", size = "M") is AddToCartResult.Failure)
        assertTrue(repository.addProduct("product_1", null, options = mapOf("Material" to "  ")) is AddToCartResult.Failure)
        assertNull(transport.path)
    }

    @Test
    fun cartAddCarriesOnlyLiveCanonicalSaleAttribution() {
        val validId = UUID.randomUUID().toString()
        val transport = RecordingCartTransport()
        val repository = CartRepository("https://api.nantty.com", { "buyer-access" }, transport)

        assertEquals(
            AddToCartResult.Success,
            repository.addProduct("product_1", null, attribution = SaleAttribution(SaleAttributionSource.POST, validId, System.currentTimeMillis() + 60_000)),
        )
        assertEquals("post", transport.body?.getJSONObject("attribution")?.getString("source"))
        assertEquals(validId, transport.body?.getJSONObject("attribution")?.getString("id"))

        val invalid = RecordingCartTransport()
        CartRepository("https://api.nantty.com", { "buyer-access" }, invalid).addProduct(
            "product_1", null, attribution = SaleAttribution(SaleAttributionSource.CLIP, "not-a-uuid", System.currentTimeMillis() + 60_000),
        )
        assertFalse(invalid.body?.has("attribution") == true)

        val expired = RecordingCartTransport()
        CartRepository("https://api.nantty.com", { "buyer-access" }, expired).addProduct(
            "product_1", null, attribution = SaleAttribution(SaleAttributionSource.LINK, validId, System.currentTimeMillis() - 1),
        )
        assertFalse(expired.body?.has("attribution") == true)
    }

    @Test
    fun feedAttributionAcceptsOnlyTrustedUuidBackedNonSponsoredPosts() {
        val id = UUID.randomUUID().toString()
        val post = FeedPost(
            id = id, authorName = "Maker", username = "maker", avatarUrl = null, verified = false,
            verificationColor = null, postedAsName = null, postedAsHandle = null, postedAsAvatarUrl = null,
            kind = "post", text = "Tagged product", media = emptyList(), likes = 0, comments = 0,
            reposts = 0, shares = 0, createdAt = "2026-11-07T10:00:00Z",
        )
        assertEquals(SaleAttributionSource.POST, saleAttributionForFeedPost(post)?.source)
        assertEquals(SaleAttributionSource.CLIP, saleAttributionForFeedPost(post.copy(kind = "clip"))?.source)
        assertNull(saleAttributionForFeedPost(post.copy(id = "post_123")))
        assertNull(saleAttributionForFeedPost(post.copy(isSponsored = true)))
        assertNull(restoreSaleAttribution("unknown", id, System.currentTimeMillis() + 10_000))
        assertNull(restoreSaleAttribution("post", id, System.currentTimeMillis() - 1))
    }

    @Test
    fun recordsAddToCartOnlyAfterTheCartServerAcceptsTheProduct() {
        val requests = mutableListOf<CartInteractionConnection>()
        val interactions = ProductInteractionRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "buyer-access" },
            openConnection = { url ->
                CartInteractionConnection(
                    url,
                    if (url.path.endsWith("/users/me/consents")) {
                        """{"data":[{"consentType":"analytics","status":"granted"}]}"""
                    } else "{}",
                ).also(requests::add)
            },
        )
        val successfulCart = RecordingCartTransport()
        val repository = CartRepository(
            "https://api.nantty.com",
            { "buyer-access" },
            successfulCart,
            interactions,
        )

        assertEquals(AddToCartResult.Success, repository.addProduct("product_1", "variant_1", 2))
        assertEquals(2, requests.size)
        val recorded = JSONObject(requests.last().requestBody.toString(Charsets.UTF_8.name()))
            .getJSONArray("events").getJSONObject(0)
        assertEquals("product.addedToCart", recorded.getString("event"))
        assertEquals("product_1", recorded.getJSONObject("payload").getString("productId"))
        assertEquals(2, recorded.getJSONObject("payload").getInt("quantity"))

        val failedCart = RecordingCartTransport().apply { failureStatusCode = 422 }
        val failedRepository = CartRepository(
            "https://api.nantty.com",
            { "buyer-access" },
            failedCart,
            interactions,
        )
        val requestCountBeforeFailure = requests.size
        assertTrue(failedRepository.addProduct("product_2", "variant_1") is AddToCartResult.Failure)
        assertEquals(requestCountBeforeFailure, requests.size)
    }

    @Test
    fun loadsCartRowsAndGrandTotalFromServerResponse() {
        val transport = RecordingCartTransport().apply {
            response = JSONObject(
                """{"itemsTotal":{"amountMinor":5400,"currency":"NGN"},"total":{"amountMinor":5900,"currency":"NGN"},"payableGroupCount":1,"groups":[{"storeId":"store_1","storeName":"Demo store","subtotal":{"amountMinor":5400,"currency":"NGN"},"discounts":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":5900,"currency":"NGN"},"shipping":{"status":"calculated","fee":{"amountMinor":500,"currency":"NGN"},"message":null,"isFree":false,"freeThreshold":null,"amountToFreeShipping":null},"items":[{"id":"cart_1","product":{"id":"product_1","name":"Tea","price":{"amountMinor":2700,"currency":"NGN"},"imageUrl":"https://cdn.example/tea.jpg"},"quantity":2,"variantDetail":{"title":"Large"}}]}]}""",
            )
        }

        val result = CartRepository("https://api.nantty.com", { "buyer-access" }, transport).loadCart()

        assertEquals("/api/v1/cart", transport.path)
        assertEquals("buyer-access", transport.token)
        val cart = (result as CartResult.Success).cart
        assertEquals(5900L, cart.totalAmountMinor)
        assertEquals("NGN", cart.currency)
        assertEquals(1, cart.payableGroupCount)
        assertEquals("Tea", cart.lines.single().name)
        assertEquals("Large", cart.lines.single().variant)
        assertEquals("Demo store", cart.lines.single().storeName)
        assertEquals("store_1", cart.sellerGroups.single().storeId)
        assertEquals(false, cart.sellerGroups.single().verified)
        assertEquals("calculated", cart.sellerGroups.single().shipping.status)
        assertEquals(500L, cart.sellerGroups.single().shipping.fee?.amountMinor)
    }

    @Test
    fun carriesVerifiedEligibilityOnlyFromNestedServerStoreSummary() {
        val transport = RecordingCartTransport().apply {
            response = JSONObject(
                """{"total":{"amountMinor":200,"currency":"NGN"},"groups":[
                    {"storeId":"store_verified","storeName":"Verified","store":{"verified":true},"subtotal":{"amountMinor":100,"currency":"NGN"},"discounts":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":100,"currency":"NGN"},"shipping":{"status":"calculated"},"items":[]},
                    {"storeId":"store_unverified","storeName":"Unverified","store":{"verified":false},"subtotal":{"amountMinor":100,"currency":"NGN"},"discounts":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":100,"currency":"NGN"},"shipping":{"status":"calculated"},"items":[]}
                ]}""",
            )
        }

        val result = CartRepository("https://api.nantty.com", { "buyer-access" }, transport).loadCart() as CartResult.Success

        assertEquals(listOf(true, false), result.cart.sellerGroups.map(CartSellerSummary::verified))
    }

    @Test
    fun rejectsIncompleteSellerShippingQuoteInsteadOfHidingTheGroup() {
        val transport = RecordingCartTransport().apply {
            response = JSONObject("""{"total":{"amountMinor":100,"currency":"NGN"},"groups":[{"storeId":"store_1","storeName":"Shop","items":[],"subtotal":{"amountMinor":100,"currency":"NGN"}}]}""")
        }

        assertTrue(CartRepository("https://api.nantty.com", { "buyer-access" }, transport).loadCart() is CartResult.Failure)
    }

    @Test
    fun rejectsIncompleteCartTotalsInsteadOfInventingZero() {
        val transport = RecordingCartTransport().apply { response = JSONObject("""{"items":[],"groups":[],"total":{}}""") }

        val result = CartRepository("https://api.nantty.com", { "buyer-access" }, transport).loadCart()

        assertTrue(result is CartResult.Failure)
    }

    @Test
    fun updatesQuantityAndRemovesOnlyValidatedCartItemIds() {
        val transport = RecordingCartTransport()
        val repository = CartRepository("https://api.nantty.com", { "buyer-access" }, transport)

        assertEquals(CartMutationResult.Success, repository.changeQuantity("cart_item-2", 3))
        assertEquals("PATCH", transport.method)
        assertEquals("/api/v1/cart/items/cart_item-2", transport.path)
        assertEquals(3, transport.body?.getInt("quantity"))

        assertEquals(CartMutationResult.Success, repository.removeItem("cart_item-2"))
        assertEquals("DELETE", transport.method)
        assertEquals("/api/v1/cart/items/cart_item-2", transport.path)

        val invalid = repository.removeItem("../other-user-item")
        assertTrue(invalid is CartMutationResult.Failure)
        assertEquals("DELETE", transport.method)
    }

    @Test
    fun cartReadsAndMutationsRequireAnAuthenticatedSession() {
        val transport = RecordingCartTransport()
        val repository = CartRepository("https://api.nantty.com", { null }, transport)

        assertTrue((repository.loadCart() as CartResult.Failure).authenticationRequired)
        assertTrue((repository.changeQuantity("cart_1", 2) as CartMutationResult.Failure).authenticationRequired)
        assertTrue((repository.removeItem("cart_1") as CartMutationResult.Failure).authenticationRequired)
        assertNull(transport.path)
    }

    @Test
    fun requiresSessionAndRejectsUnsafeInputWithoutNetworkRequest() {
        val transport = RecordingCartTransport()
        val signedOut = CartRepository("https://api.nantty.com", { null }, transport)
            .addProduct("product_1", "variant_1") as AddToCartResult.Failure
        assertTrue(signedOut.authenticationRequired)
        assertNull(transport.path)

        val invalid = CartRepository("https://api.nantty.com", { "buyer-access" }, transport)
            .addProduct("../another-product", "variant_1") as AddToCartResult.Failure
        assertFalse(invalid.authenticationRequired)
        assertNull(transport.path)
    }

    @Test
    fun mapsExpiredSessionAndUnavailableOptionToSafeUserMessages() {
        val expiredTransport = RecordingCartTransport().apply { failureStatusCode = 401 }
        val expired = CartRepository("https://api.nantty.com", { "buyer-access" }, expiredTransport)
            .addProduct("product_1", "variant_1") as AddToCartResult.Failure
        assertTrue(expired.authenticationRequired)
        assertTrue(expired.message.contains("session has expired"))

        val unavailableTransport = RecordingCartTransport().apply { failureStatusCode = 409 }
        val unavailable = CartRepository("https://api.nantty.com", { "buyer-access" }, unavailableTransport)
            .addProduct("product_1", "variant_1") as AddToCartResult.Failure
        assertFalse(unavailable.authenticationRequired)
        assertTrue(unavailable.message.contains("no longer available"))
    }

    @Test
    fun mapsUnprocessableCartMutationToUnavailableOptionWithoutLeakingServerDetails() {
        val transport = RecordingCartTransport().apply { failureStatusCode = 422 }

        val result = CartRepository("https://api.nantty.com", { "buyer-access" }, transport)
            .addProduct("product_1", "variant_1") as AddToCartResult.Failure

        assertEquals("/api/v1/cart/items", transport.path)
        assertFalse(result.authenticationRequired)
        assertTrue(result.message.contains("no longer available"))
    }

    private class RecordingCartTransport : CartTransport {
        var path: String? = null
        var token: String? = null
        var body: JSONObject? = null
        var response = JSONObject()
        var method: String? = null
        var failureStatusCode: Int? = null

        private fun failIfConfigured() {
            failureStatusCode?.let { throw CartHttpException(it) }
        }

        override fun get(path: String, accessToken: String): JSONObject {
            this.path = path
            token = accessToken
            method = "GET"
            failIfConfigured()
            return response
        }

        override fun add(path: String, accessToken: String, body: JSONObject) {
            this.path = path
            token = accessToken
            this.body = body
            method = "POST"
            failIfConfigured()
        }

        override fun patch(path: String, accessToken: String, body: JSONObject) {
            this.path = path
            token = accessToken
            this.body = body
            method = "PATCH"
            failIfConfigured()
        }

        override fun delete(path: String, accessToken: String) {
            this.path = path
            token = accessToken
            method = "DELETE"
            failIfConfigured()
        }
    }
}

private class CartInteractionConnection(url: URL, private val responseBody: String) : HttpURLConnection(url) {
    val requestBody = ByteArrayOutputStream()
    override fun getResponseCode(): Int = 200
    override fun getInputStream() = ByteArrayInputStream(responseBody.toByteArray())
    override fun getOutputStream() = requestBody
    override fun usingProxy(): Boolean = false
    override fun connect() = Unit
    override fun disconnect() = Unit
}
