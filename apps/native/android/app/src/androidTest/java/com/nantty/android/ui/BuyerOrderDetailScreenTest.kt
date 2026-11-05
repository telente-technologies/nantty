package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.BuyerOrderReceiptTransport
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerOrdersTransport
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeTransport
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class BuyerOrderDetailScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun eligibleEscrowOrderCanOpenDisputeForm() {
        val session = AccountSession("buyer-token", "refresh", AccountUser("buyer-id", "Ari", "ari", null, null, emptyList()))
        val orders = BuyerOrdersRepository("https://api.nantty.com", { session }, OrderTransport())
        val disputes = DisputeRepository("https://api.nantty.com", { session }, EscrowTransport())
        val media = CreatorSampleMediaRepository("https://api.nantty.com", { session })

        compose.setContent {
            MaterialTheme {
                BuyerOrderDetailScreen(
                    orderId = "order-123",
                    repository = orders,
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    disputeRepository = disputes,
                    privateMediaUploadsRepository = media,
                )
            }
        }

        compose.onNodeWithText("Open a dispute").performScrollTo().performClick()
        compose.onNodeWithText("What went wrong?").assertIsDisplayed()
        compose.onNodeWithText("Photo evidence (optional)").assertIsDisplayed()
        compose.onNodeWithText("Only you, the seller and Nantty support can see them.", substring = true).assertIsDisplayed()
    }

    private class OrderTransport : BuyerOrderReceiptTransport {
        override fun get(path: String, accessToken: String): JSONObject = JSONObject(
            """{"id":"order-123","reference":"NT-123","status":"shipped","fulfilmentStatus":"in_transit","paymentStatus":"paid","paymentMode":"escrow","store":{"id":"store-1","name":"Ayo Market"},"items":[{"product":{"id":"product-1","name":"Beans"},"quantity":2}],"subtotal":{"amountMinor":10000,"currency":"NGN"},"discount":{"amountMinor":0,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":2500,"currency":"NGN"},"total":{"amountMinor":12500,"currency":"NGN"},"shipment":{"courierName":"Swift","trackingNumber":"TRACK-123","shippedAt":"2026-11-03T10:00:00Z","estimatedDeliveryAt":null},"createdAt":"2026-11-03T10:00:00Z"}""",
        )

        override fun post(path: String, accessToken: String, idempotencyKey: String): JSONObject = error("Not expected in this test")
    }

    private class EscrowTransport : DisputeTransport {
        override fun get(path: String, accessToken: String): JSONObject = JSONObject(
            """{"escrowId":"escrow-1","orderId":"order-123","orderReference":"NT-123","stage":"shipped","status":"shipped","heldAmount":{"amountMinor":12500,"currency":"NGN"},"platformFee":{"amountMinor":500,"currency":"NGN"},"sellerPayoutAmount":{"amountMinor":12000,"currency":"NGN"},"refundedAmount":{"amountMinor":0,"currency":"NGN"},"buyer":{"id":"buyer-id"},"store":{"id":"store-1"},"sellerUserId":"seller-1","paidAt":"2026-11-03T10:00:00Z","preparingSince":null,"shipment":null,"deliveredAt":null,"buyerConfirmedAt":null,"autoReleaseAt":null,"expectedReleaseAt":null,"releasedAt":null,"refundedAt":null,"disputeId":null,"undeliveredReviewAt":null,"feesKeptOnRefund":{"amountMinor":0,"currency":"NGN"}}""",
        )

        override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject = error("Not expected in this test")
    }
}
