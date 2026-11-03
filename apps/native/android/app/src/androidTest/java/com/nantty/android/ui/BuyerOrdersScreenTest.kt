package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerOrdersTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class BuyerOrdersScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun opensBuyerScopedReadOnlyOrderDetailFromOrdersList() {
        val transport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                BuyerOrdersScreen(
                    BuyerOrdersRepository("https://api.nantty.com", ::signedInSession, transport),
                    Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                )
            }
        }

        compose.onNodeWithText("My orders").assertIsDisplayed()
        compose.onNodeWithText("Beans from Ayo Market").assertIsDisplayed().performClick()
        compose.onNodeWithText("Order details").assertIsDisplayed()
        compose.onNodeWithText("Ayo Market").assertIsDisplayed()
        compose.onNodeWithText("2 × Beans").assertIsDisplayed()
        compose.onNodeWithText("Track shipment").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals("/api/v1/orders?limit=20", transport.paths.first())
            assertEquals("/api/v1/orders/order-123", transport.paths.last())
            assertEquals(listOf("buyer-token", "buyer-token"), transport.tokens)
        }
    }

    private class FakeTransport : BuyerOrdersTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String>()

        override fun get(path: String, accessToken: String): JSONObject {
            paths += path
            tokens += accessToken
            return if (path.contains("?")) {
                JSONObject("""{"data":[{"id":"order-123","reference":"NT-123","status":"processing","paymentStatus":"paid","store":{"name":"Ayo Market"},"items":[{"product":{"name":"Beans from Ayo Market"}}],"total":{"amountMinor":12500,"currency":"NGN"},"createdAt":"2026-11-03T10:00:00Z"}],"nextCursor":null}""")
            } else {
                JSONObject("""{"id":"order-123","reference":"NT-123","status":"shipped","fulfilmentStatus":"in_transit","paymentStatus":"paid","paymentMode":"escrow","store":{"name":"Ayo Market"},"items":[{"product":{"name":"Beans"},"quantity":2}],"subtotal":{"amountMinor":10000,"currency":"NGN"},"discount":{"amountMinor":0,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":2500,"currency":"NGN"},"total":{"amountMinor":12500,"currency":"NGN"},"shipment":{"courierName":"Swift","trackingNumber":"TRACK-123","trackingUrl":"https://carrier.example/track/TRACK-123","shippedAt":"2026-11-03T10:00:00Z"},"createdAt":"2026-11-03T10:00:00Z"}""")
            }
        }
    }

    private fun signedInSession() = AccountSession("buyer-token", "refresh", AccountUser("buyer-id", "Ayo", "ayo", null, null, emptyList()))
}
