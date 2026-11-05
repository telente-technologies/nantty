package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeTransport
import com.nantty.android.data.DisputeMoney
import com.nantty.android.data.OrderEscrowDetail
import com.nantty.android.data.DisputeShipment
import com.nantty.android.data.SellerOrdersRepository
import com.nantty.android.data.SellerOrdersTransport
import com.nantty.android.data.SellerShipmentRepository
import com.nantty.android.data.SellerShipmentTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class SellerOrdersScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun toShipFilterShowsServerFulfilmentStatesAndOpensOrderDetail() {
        val session = AccountSession("seller-token", "refresh", AccountUser("seller-id", "Seller", "seller", null, null, listOf("seller")))
        val rows = listOf(orderJson("order-new", "NAN-NEW", "new"), orderJson("order-shipped", "NAN-SHIPPED", "shipped"))
        val orders = SellerOrdersRepository("https://api.nantty.com", { session }, SellerOrdersTransport { path, _ ->
            if (path.endsWith("/order-new")) JSONObject("""{"data":${rows.first()}}""")
            else JSONObject("""{"data":${rows.joinToString(",", prefix = "[", postfix = "]")},"countsByStatus":{}}""")
        })
        val shipments = SellerShipmentRepository("https://api.nantty.com", { session }, SellerShipmentTransport { _, _, _, _, _ -> JSONObject() })
        val disputes = DisputeRepository("https://api.nantty.com", { session }, object : DisputeTransport {
            override fun get(path: String, accessToken: String): JSONObject = error("Unexpected dispute request: $path")
            override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject = error("Unexpected dispute request: $path")
        })
        var messagedBuyer: String? = null
        var openedBuyerProfile: String? = null

        compose.setContent {
            MaterialTheme {
                SellerOrdersScreen(
                    repository = orders,
                    shipmentRepository = shipments,
                    disputeRepository = disputes,
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onMessageBuyer = { messagedBuyer = it },
                    onOpenBuyerProfile = { openedBuyerProfile = it },
                )
            }
        }

        compose.onNodeWithText("To ship").performClick()
        compose.onNodeWithText("NAN-NEW").assertIsDisplayed()
        compose.onNodeWithContentDescription("Product image: Canvas bag").assertIsDisplayed()
        compose.onAllNodesWithText("NAN-SHIPPED").assertCountEquals(0)
        compose.onNodeWithText("NAN-NEW").performClick()
        compose.onNodeWithText("Order NAN-NEW").assertIsDisplayed()
        compose.onNodeWithText("Canvas bag").assertIsDisplayed()
        compose.onNodeWithText("Message buyer").performClick()
        assertEquals("buyer-id", messagedBuyer)
        compose.onNodeWithText("View buyer profile").performClick()
        assertEquals("buyer-id", openedBuyerProfile)
    }

    @Test
    fun paidOrdersUseReactNativeToShipStatusLabel() {
        compose.setContent {
            MaterialTheme {
                SellerOrderStatus("paid")
            }
        }

        compose.onNodeWithText("To ship").assertIsDisplayed()
    }

    @Test
    fun sellerEscrowSummaryAndTimelineShowPayoutAndShipmentProgress() {
        val escrow = OrderEscrowDetail(
            escrowId = "escrow-1",
            orderId = "order-1",
            orderReference = "NAN-1",
            stage = "shipped",
            status = "held",
            heldAmount = DisputeMoney(150_000, "NGN"),
            platformFee = DisputeMoney(7_500, "NGN"),
            sellerPayoutAmount = DisputeMoney(142_500, "NGN"),
            refundedAmount = DisputeMoney(0, "NGN"),
            buyerId = "buyer-1",
            storeId = "store-1",
            sellerUserId = "seller-1",
            paidAt = "2026-11-01T10:00:00Z",
            preparingSince = "2026-11-01T11:00:00Z",
            shipment = DisputeShipment("Courier", "TRACK-1234", null, "2026-11-02T10:00:00Z", "2026-11-04T10:00:00Z"),
            deliveredAt = null,
            buyerConfirmedAt = null,
            autoReleaseAt = "2026-11-07T10:00:00Z",
            expectedReleaseAt = "2026-11-07T10:00:00Z",
            releasedAt = null,
            refundedAt = null,
            disputeId = null,
            undeliveredReviewAt = null,
            feesKeptOnRefund = DisputeMoney(0, "NGN"),
        )

        compose.setContent {
            MaterialTheme {
                androidx.compose.foundation.layout.Column {
                    SellerEscrowSummary(escrow)
                    SellerEscrowTimeline(escrow)
                }
            }
        }

        compose.onNodeWithText("Your payout").assertIsDisplayed()
        compose.onNodeWithText("Paid into escrow", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Nantty fee", substring = true).assertIsDisplayed()
        compose.onNodeWithText("TRACK-1234", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Released to seller").assertIsDisplayed()
    }

    private fun orderJson(id: String, number: String, status: String) = """{
      "id":"$id","orderNumber":"$number","invoiceNumber":"INV-1",
      "buyer":{"id":"buyer-id","name":"Ari Buyer","username":"ari","phone":"08000000000"},
      "shippingAddress":{"recipientName":"Ari Buyer","phone":"08000000000","line1":"1 Main St","city":"Lagos","state":"Lagos","country":"NG"},
      "lines":[{"id":"line-1","productId":"product-1","variantId":"variant-1","name":"Canvas bag","variantTitle":"Blue","sku":"BAG-BLUE","imageUrl":"https://cdn.nantty.com/$id.jpg","quantity":1,"unitPrice":{"amountMinor":125000,"currency":"NGN"},"lineTotal":{"amountMinor":125000,"currency":"NGN"}}],
      "subtotal":{"amountMinor":125000,"currency":"NGN"},"discount":{"amountMinor":0,"currency":"NGN"},
      "storeCredit":{"amountMinor":0,"currency":"NGN"},"shippingFee":{"amountMinor":0,"currency":"NGN"},
      "total":{"amountMinor":125000,"currency":"NGN"},"sellerPayout":{"amountMinor":125000,"currency":"NGN"},
      "status":"$status","escrowStatus":"held","escrowReleaseAt":null,"fulfilment":null,"attributedCreator":null,
      "createdAt":"2026-10-31T10:00:00Z","deliveredAt":null,"paymentStatus":"paid","paymentMode":"direct",
      "paymentProvider":"transfer","paymentReference":"PAY-1","paidAt":"2026-10-31T10:01:00Z",
      "refundedAmount":{"amountMinor":0,"currency":"NGN"},"refunds":[],
      "delivery":{"status":"pending","riderName":null,"riderPhone":null,"estimatedDeliveryAt":null,"attempts":0,"lastAttemptNote":null},
      "timeline":[],"notes":[],"conversationId":null
    }"""
}
