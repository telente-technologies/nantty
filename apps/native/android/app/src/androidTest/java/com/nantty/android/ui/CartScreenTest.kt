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
import com.nantty.android.data.AccountUser
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import org.json.JSONObject
import org.junit.Assert.assertEquals
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
        compose.setContent {
            MaterialTheme {
                CartScreen(
                    CartRepository("https://api.nantty.com", { "buyer-token" }, transport),
                    Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                )
            }
        }

        compose.onNodeWithText("Your cart").assertIsDisplayed()
        compose.onNodeWithText("Handwoven bag").assertIsDisplayed()
        compose.onNodeWithText("Ayo Market").assertIsDisplayed()
        compose.onNodeWithText("Cart total").assertIsDisplayed()
        compose.onNodeWithText("Checkout is not yet available in the Android app.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Increase Handwoven bag quantity").performClick()
        compose.onNodeWithContentDescription("Line subtotal ${formatWalletAmount(WalletMoney(25_000, "NGN"))}").assertIsDisplayed()
        compose.onNodeWithContentDescription("Remove Handwoven bag from cart").performClick()

        compose.runOnIdle {
            assertEquals(listOf("GET:/api/v1/cart", "PATCH:/api/v1/cart/items/cart-1", "GET:/api/v1/cart", "DELETE:/api/v1/cart/items/cart-1", "GET:/api/v1/cart"), transport.calls)
            assertEquals(listOf("buyer-token", "buyer-token", "buyer-token", "buyer-token", "buyer-token"), transport.tokens)
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
                    Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
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
            val group = if (removed) "[]" else """[{"storeName":"Ayo Market","items":$lines}]"""
            val total = if (removed) 0 else runCatching { Math.multiplyExact(quantity.toLong(), unitAmountMinor.toLong()) }.getOrDefault(Long.MAX_VALUE)
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
}
