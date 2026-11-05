package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.CartRepository
import com.nantty.android.data.CartTransport
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.CheckoutTransport
import com.nantty.android.data.AccountUser
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class CartScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun cartEntryPointHasAnAccessibleHeaderAction() {
        var opened = false
        compose.setContent {
            MaterialTheme {
                AppHeader(
                    onRefresh = {},
                    onOpenMart = {},
                    onOpenOrders = {},
                    accountUser = AccountUser("buyer-1", "Buyer", "buyer", null, null, emptyList()),
                    onSignOut = {},
                    onOpenCart = { opened = true },
                )
            }
        }

        compose.onNodeWithContentDescription("Open cart").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(true, opened) }
    }

    @Test
    fun rendersServerCartAndCallsAuthenticatedQuantityAndRemoveContracts() {
        val transport = FakeCartTransport()
        val addressId = "8b3a4e12-1234-4234-9234-123456789abc"
        val checkoutTransport = FakeCheckoutTransport(addressId)
        var checkoutAddressId: String? = null
        compose.setContent {
            MaterialTheme {
                CartScreen(
                    CartRepository("https://api.nantty.com", { "buyer-token" }, transport),
                    CheckoutRepository("https://api.nantty.com", { testSession() }, checkoutTransport),
                    Executor { it.run() },
                    selectedAddressId = null,
                    onAddressSelected = { checkoutAddressId = it },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onProceedToCheckout = { checkoutAddressId = it },
                )
            }
        }

        compose.onNodeWithText("Your cart").assertIsDisplayed()
        compose.onNodeWithText("Handwoven bag").assertIsDisplayed()
        compose.onNodeWithText("Ayo Market").assertIsDisplayed()
        compose.onNodeWithContentDescription("Choose delivery address").performClick()
        compose.onNodeWithContentDescription("Buyer, 12 Market Road, Lagos, Nigeria").performClick()
        compose.onNodeWithText("Order total").assertIsDisplayed()
        compose.onNodeWithText("Shipping").assertIsDisplayed()
        compose.onNodeWithText(formatWalletAmount(WalletMoney(500, "NGN"))).assertIsDisplayed()
        compose.onNodeWithText("Terms of Service").assertIsDisplayed()
        compose.onNodeWithText("Privacy Policy").assertIsDisplayed()
        compose.onNodeWithText("Continue to checkout").assertIsDisplayed().performClick()
        compose.onNodeWithContentDescription("Increase Handwoven bag quantity").performClick()
        compose.onNodeWithContentDescription("Line subtotal ${formatWalletAmount(WalletMoney(25_000, "NGN"))}").assertIsDisplayed()
        compose.onNodeWithContentDescription("Remove Handwoven bag from cart").performClick()

        compose.runOnIdle {
            assertEquals(listOf("GET:/api/v1/cart", "PATCH:/api/v1/cart/items/cart-1", "GET:/api/v1/cart", "DELETE:/api/v1/cart/items/cart-1", "GET:/api/v1/cart"), transport.calls)
            assertEquals(listOf("buyer-token", "buyer-token", "buyer-token", "buyer-token", "buyer-token"), transport.tokens)
            assertEquals(addressId, checkoutAddressId)
            assertTrue(checkoutTransport.paths.contains("POST:/api/v1/cart/shipping-quote"))
        }
    }

    @Test
    fun omitsLineSubtotalWhenQuantityMultiplicationWouldOverflow() {
        val transport = FakeCartTransport().apply {
            quantity = 2
            unitAmountMinor = Long.MAX_VALUE
        }
        compose.setContent {
            MaterialTheme {
                CartScreen(
                    CartRepository("https://api.nantty.com", { "buyer-token" }, transport),
                    CheckoutRepository("https://api.nantty.com", { testSession() }, FakeCheckoutTransport(ADDRESS_ID)),
                    Executor { it.run() },
                    selectedAddressId = null,
                    onAddressSelected = {},
                    onBack = {},
                    onAuthenticationRequired = {},
                    onProceedToCheckout = {},
                )
            }
        }

        compose.onNodeWithText("Handwoven bag").assertIsDisplayed()
        compose.onNodeWithText("Line subtotal").assertDoesNotExist()
    }

    private class FakeCartTransport : CartTransport {
        val calls = mutableListOf<String>()
        val tokens = mutableListOf<String>()
        var quantity = 1
        var unitAmountMinor = 12_500L
        var removed = false

        override fun get(path: String, accessToken: String): JSONObject {
            calls += "GET:$path"
            tokens += accessToken
            val lines = if (removed) "[]" else """[{"id":"cart-1","product":{"id":"product-1","name":"Handwoven bag","price":{"amountMinor":$unitAmountMinor,"currency":"NGN"}},"quantity":$quantity}]"""
            val total = if (removed) 0 else runCatching { Math.multiplyExact(quantity.toLong(), unitAmountMinor.toLong()) }.getOrDefault(Long.MAX_VALUE)
            val group = if (removed) "[]" else """[{"storeId":"store_1","storeName":"Ayo Market","subtotal":{"amountMinor":$total,"currency":"NGN"},"discounts":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":$total,"currency":"NGN"},"shipping":{"status":"needsAddress","fee":null,"message":"Choose an address to check delivery.","isFree":false,"freeThreshold":null,"amountToFreeShipping":null},"items":$lines}]"""
            val payableGroups = if (removed) 0 else 1
            return JSONObject("""{"total":{"amountMinor":$total,"currency":"NGN"},"currency":"NGN","payableGroupCount":$payableGroups,"groups":$group}""")
        }

        override fun add(path: String, accessToken: String, body: JSONObject) = error("Add should not be called from cart review.")

        override fun patch(path: String, accessToken: String, body: JSONObject) {
            calls += "PATCH:$path"
            tokens += accessToken
            quantity = body.getInt("quantity")
        }

        override fun delete(path: String, accessToken: String) {
            calls += "DELETE:$path"
            tokens += accessToken
            removed = true
        }
    }

    private fun testSession() = com.nantty.android.data.AccountSession(
        "buyer-token", "refresh-token", AccountUser("buyer-id", "Buyer", "buyer", null, null, emptyList()),
    )

    private class FakeCheckoutTransport(private val addressId: String) : CheckoutTransport {
        val paths = mutableListOf<String>()
        override fun get(path: String, accessToken: String): JSONObject {
            paths += "GET:$path"
            return if (path == "/api/v1/users/me/addresses") JSONObject("""{"data":[{"id":"$addressId","fullName":"Buyer","phone":"+2348000000000","line1":"12 Market Road","city":"Lagos","state":"Lagos","country":"Nigeria","isDefault":true}]}""") else JSONObject("""{"data":[]}""")
        }

        override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
            paths += "POST:$path"
            val lines = """[{"id":"cart-1","product":{"id":"product-1","name":"Handwoven bag","price":{"amountMinor":12500,"currency":"NGN"}},"quantity":1}]"""
            return JSONObject("""{"data":{"addressId":"$addressId","itemsTotal":{"amountMinor":12500,"currency":"NGN"},"shopDiscount":{"amountMinor":0,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":500,"currency":"NGN"},"total":{"amountMinor":13000,"currency":"NGN"},"payableGroupCount":1,"groups":[{"storeId":"store_1","storeName":"Ayo Market","subtotal":{"amountMinor":12500,"currency":"NGN"},"discounts":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":13000,"currency":"NGN"},"shipping":{"status":"calculated","fee":{"amountMinor":500,"currency":"NGN"},"message":null,"isFree":false,"freeThreshold":null,"amountToFreeShipping":null},"items":$lines}]}}""")
        }
    }

    private companion object { const val ADDRESS_ID = "8b3a4e12-1234-4234-9234-123456789abc" }
}
