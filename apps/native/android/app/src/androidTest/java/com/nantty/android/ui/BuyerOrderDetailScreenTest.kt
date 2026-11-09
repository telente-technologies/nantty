package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.BuyerOrderReceiptTransport
import com.nantty.android.data.BuyerReturnsRepository
import com.nantty.android.data.BuyerReturnsTransport
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerOrdersTransport
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeTransport
import com.nantty.android.data.ChatThreadTransport
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.InboxConversation
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.assertEquals
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicReference

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

    @Test
    fun buyerCanVisitTheStoreFromOrderDetails() {
        val session = AccountSession("buyer-token", "refresh", AccountUser("buyer-id", "Ari", "ari", null, null, emptyList()))
        val orders = BuyerOrdersRepository("https://api.nantty.com", { session }, OrderTransport())
        val openedStoreId = AtomicReference<String?>(null)

        compose.setContent {
            MaterialTheme {
                BuyerOrderDetailScreen(
                    orderId = "order-123",
                    repository = orders,
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onOpenStore = openedStoreId::set,
                )
            }
        }

        compose.onNodeWithText("Visit store").performScrollTo().performClick()
        assertEquals("store-1", openedStoreId.get())
        compose.onAllNodesWithText("Check payment").assertCountEquals(0)
    }

    @Test
    fun buyerCanContactTheStoreFromOrderDetails() {
        val session = AccountSession("buyer-token", "refresh", AccountUser("buyer-id", "Ari", "ari", null, null, emptyList()))
        val storeId = "77777777-7777-4777-8777-777777777777"
        val orders = BuyerOrdersRepository("https://api.nantty.com", { session }, OrderTransport(storeId = storeId))
        val messages = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { session },
            threadTransport = ChatThreadTransport { method, path, _, body ->
                assertEquals("POST", method)
                assertEquals("/api/v1/conversations/stores/$storeId", path)
                assertEquals(null, body)
                JSONObject("""{"data":{"id":"11111111-1111-4111-8111-111111111111","peer":{"id":"$storeId","name":"Ayo Market","username":"","avatarUrl":null},"lastMessage":"","lastMessageKind":null,"lastMessageAt":"2026-11-04T12:00:00Z","unread":0,"isFriend":false,"kind":"business","title":null,"description":null,"encryptedAttributes":null,"photoUrl":null,"photoMediaId":null,"memberCount":2,"myRole":"member","disappearingMessagesSeconds":null,"onlyAdminsCanMentionAll":false,"store":{"id":"$storeId","name":"Ayo Market","avatarUrl":null},"inboxFolder":"chats","spamReason":null,"streak":null,"mutedUntil":null}}""")
            },
        )
        val openedConversation = AtomicReference<InboxConversation?>(null)

        compose.setContent {
            MaterialTheme {
                BuyerOrderDetailScreen(
                    orderId = "order-123",
                    repository = orders,
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    messagesRepository = messages,
                    onOpenConversation = openedConversation::set,
                )
            }
        }

        compose.onNodeWithText("Contact seller").performScrollTo().performClick()
        assertEquals("Ayo Market", openedConversation.get()?.title)
        assertEquals("11111111-1111-4111-8111-111111111111", openedConversation.get()?.id)
    }

    @Test
    fun buyerCanOpenAProductFromOrderDetails() {
        val session = AccountSession("buyer-token", "refresh", AccountUser("buyer-id", "Ari", "ari", null, null, emptyList()))
        val orders = BuyerOrdersRepository("https://api.nantty.com", { session }, OrderTransport())
        val openedProductId = AtomicReference<String?>(null)

        compose.setContent {
            MaterialTheme {
                BuyerOrderDetailScreen(
                    orderId = "order-123",
                    repository = orders,
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onOpenProduct = openedProductId::set,
                )
            }
        }

        compose.onNodeWithText("Beans").performScrollTo().performClick()
        assertEquals("product-1", openedProductId.get())
    }

    @Test
    fun pendingBuyerOrderCanContinueToPaymentVerification() {
        val session = AccountSession("buyer-token", "refresh", AccountUser("buyer-id", "Ari", "ari", null, null, emptyList()))
        val orders = BuyerOrdersRepository("https://api.nantty.com", { session }, OrderTransport(status = "pending"))
        val selectedOrder = AtomicReference<BuyerOrderDetail?>(null)

        compose.setContent {
            MaterialTheme {
                BuyerOrderDetailScreen(
                    orderId = "order-123",
                    repository = orders,
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onCheckPayment = selectedOrder::set,
                )
            }
        }

        compose.onNodeWithText("Check payment").performScrollTo().assertIsDisplayed().performClick()
        assertEquals("order-123", selectedOrder.get()?.id)
        assertEquals(12_500L, selectedOrder.get()?.totalMinor)
        assertEquals("NGN", selectedOrder.get()?.currency)
    }

    @Test
    fun deliveredBuyerCanSelectPurchasedQuantityAndSubmitReturnRequest() {
        val session = AccountSession("buyer-token", "refresh", AccountUser("buyer-id", "Ari", "ari", null, null, emptyList()))
        val transport = OrderTransport(status = "delivered")
        val orders = BuyerOrdersRepository("https://api.nantty.com", { session }, transport)
        val returns = BuyerReturnsRepository("https://api.nantty.com", { session }, transport)

        compose.setContent {
            MaterialTheme {
                BuyerOrderDetailScreen(
                    orderId = "order-123",
                    repository = orders,
                    returnRepository = returns,
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                )
            }
        }

        compose.onNodeWithText("Request a return").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Select Beans for return").performClick()
        compose.onNodeWithContentDescription("Increase return quantity for Beans").performClick()
        compose.onNodeWithText("Quantity: 2 of 2").assertIsDisplayed()
        compose.onNodeWithContentDescription("Increase return quantity for Beans").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Reason for return").performTextInput("The item arrived damaged")
        compose.onNodeWithContentDescription("Submit return request for NT-123").performScrollTo().performClick()
        compose.onNodeWithText("Return request submitted").performScrollTo().assertIsDisplayed()

        assertEquals("/api/v1/orders/order-123/returns", transport.returnPath)
        assertEquals("buyer-token", transport.returnToken)
        assertEquals("The item arrived damaged", transport.returnBody?.getString("reason"))
        assertEquals("123e4567-e89b-42d3-a456-426614174002", transport.returnBody?.getJSONArray("lines")?.getJSONObject(0)?.getString("orderItemId"))
        assertEquals(2, transport.returnBody?.getJSONArray("lines")?.getJSONObject(0)?.getInt("quantity"))
    }

    @Test
    fun returnRequestFormIsNotShownBeforeDelivery() {
        val session = AccountSession("buyer-token", "refresh", AccountUser("buyer-id", "Ari", "ari", null, null, emptyList()))
        val orders = BuyerOrdersRepository("https://api.nantty.com", { session }, OrderTransport(status = "shipped"))

        compose.setContent {
            MaterialTheme {
                BuyerOrderDetailScreen(
                    orderId = "order-123",
                    repository = orders,
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                )
            }
        }

        compose.onAllNodesWithText("Request a return").assertCountEquals(0)
    }

    private class OrderTransport(private val status: String = "shipped", private val storeId: String = "store-1") : BuyerOrderReceiptTransport, BuyerReturnsTransport {
        var returnPath: String? = null
        var returnToken: String? = null
        var returnBody: JSONObject? = null

        override fun get(path: String, accessToken: String): JSONObject = if (path.startsWith("/api/v1/returns?")) {
            JSONObject("""{"data":[],"nextCursor":null}""")
        } else JSONObject(
            """{"id":"order-123","reference":"NT-123","status":"$status","fulfilmentStatus":"in_transit","paymentStatus":"paid","paymentMode":"escrow","store":{"id":"$storeId","name":"Ayo Market"},"items":[{"id":"123e4567-e89b-42d3-a456-426614174002","product":{"id":"product-1","name":"Beans"},"quantity":2}],"subtotal":{"amountMinor":10000,"currency":"NGN"},"discount":{"amountMinor":0,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":2500,"currency":"NGN"},"total":{"amountMinor":12500,"currency":"NGN"},"shipment":{"courierName":"Swift","trackingNumber":"TRACK-123","shippedAt":"2026-11-03T10:00:00Z","estimatedDeliveryAt":null},"createdAt":"2026-11-03T10:00:00Z"}""",
        )

        override fun post(path: String, accessToken: String, idempotencyKey: String): JSONObject = error("Not expected in this test")

        override fun post(path: String, accessToken: String, body: JSONObject): JSONObject {
            returnPath = path
            returnToken = accessToken
            returnBody = body
            return JSONObject("""{"id":"123e4567-e89b-42d3-a456-426614174003","orderId":"order-123","orderNumber":"NT-123","buyerName":"Ari","lines":[],"reason":"The item arrived damaged","status":"requested","declineNote":null,"refundAmount":{"amountMinor":12500,"currency":"NGN"},"createdAt":"2026-11-03T10:00:00Z"}""")
        }
    }

    private class EscrowTransport : DisputeTransport {
        override fun get(path: String, accessToken: String): JSONObject = JSONObject(
            """{"escrowId":"escrow-1","orderId":"order-123","orderReference":"NT-123","stage":"shipped","status":"shipped","heldAmount":{"amountMinor":12500,"currency":"NGN"},"platformFee":{"amountMinor":500,"currency":"NGN"},"sellerPayoutAmount":{"amountMinor":12000,"currency":"NGN"},"refundedAmount":{"amountMinor":0,"currency":"NGN"},"buyer":{"id":"buyer-id"},"store":{"id":"store-1"},"sellerUserId":"seller-1","paidAt":"2026-11-03T10:00:00Z","preparingSince":null,"shipment":null,"deliveredAt":null,"buyerConfirmedAt":null,"autoReleaseAt":null,"expectedReleaseAt":null,"releasedAt":null,"refundedAt":null,"disputeId":null,"undeliveredReviewAt":null,"feesKeptOnRefund":{"amountMinor":0,"currency":"NGN"}}""",
        )

        override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject = error("Not expected in this test")
    }
}
