package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

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
