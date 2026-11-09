package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.CheckoutTransport
import com.nantty.android.data.CheckoutPaymentMethod
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.ProviderWalletPaymentRepository
import com.nantty.android.data.DeviceSavedCard
import com.nantty.android.data.SavedCardCredentialStore
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class CheckoutPaymentModeTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun directOptionIsLimitedToVerifiedStoresAndRequiresTypedConfirmation() {
        val transport = RecordingCheckoutTransport()
        var checkoutCreated = false
        compose.setContent {
            MaterialTheme {
                CheckoutScreen(
                    repository = CheckoutRepository("https://api.nantty.com", { testSession() }, transport),
                    providerWalletRepository = ProviderWalletPaymentRepository("https://api.nantty.com", { testSession() }, transport),
                    savedCardCredentialStore = TestSavedCardCredentialStore(),
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onCheckoutCreated = { checkoutCreated = true },
                )
            }
        }

        compose.onNodeWithText("Verified Market").assertIsDisplayed()
        compose.onNodeWithText("Pay directly").assertIsDisplayed()
        compose.onNodeWithText("Escrow: locked in your own wallet until delivery").assertIsDisplayed()
        compose.onNodeWithContentDescription("Pay Unverified Market directly").assertDoesNotExist()

        compose.onNodeWithText("Pay directly").performClick()
        compose.onNodeWithText("You lose escrow protection. Refunds and disputes depend on the seller, and Nantty cannot hold or reverse this payment.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Type DIRECT to confirm paying Verified Market directly")
            .performTextInput("not-direct")
        compose.onNodeWithText("Continue to secure payment").performClick()

        compose.runOnIdle {
            val modes = transport.checkoutBody?.getJSONArray("paymentModes")
            assertEquals(1, modes?.length())
            assertEquals("store_verified", modes?.getJSONObject(0)?.getString("storeId"))
            assertEquals("escrow", modes?.getJSONObject(0)?.getString("paymentMode"))
            assertEquals(false, transport.checkoutBody?.getBoolean("directPaymentAccepted"))
            assertTrue(checkoutCreated)
        }
    }

    @Test
    fun checkoutDisplaysServerConfiguredPaymentChannelsAndIgnoresUnknownValues() {
        val transport = RecordingCheckoutTransport().apply {
            channelsResponse = JSONObject("""{"channels":["card","bank","bank_transfer","ussd","crypto"]}""")
        }
        compose.setContent {
            MaterialTheme {
                CheckoutScreen(
                    repository = CheckoutRepository("https://api.nantty.com", { testSession() }, transport),
                    providerWalletRepository = ProviderWalletPaymentRepository("https://api.nantty.com", { testSession() }, transport),
                    savedCardCredentialStore = TestSavedCardCredentialStore(),
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onCheckoutCreated = {},
                )
            }
        }

        compose.onNodeWithText("Card, Bank, Bank transfer, USSD").assertIsDisplayed()
        compose.runOnIdle { assertTrue("/api/v1/payments/channels" in transport.getPaths) }
    }

    @Test
    fun checkoutUsesSafeFallbackWhenServerHasNoConfiguredPaymentChannels() {
        val transport = RecordingCheckoutTransport().apply { channelsResponse = JSONObject("""{"channels":[]}""") }
        compose.setContent {
            MaterialTheme {
                CheckoutScreen(
                    repository = CheckoutRepository("https://api.nantty.com", { testSession() }, transport),
                    providerWalletRepository = ProviderWalletPaymentRepository("https://api.nantty.com", { testSession() }, transport),
                    savedCardCredentialStore = TestSavedCardCredentialStore(),
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onCheckoutCreated = {},
                )
            }
        }

        compose.onNodeWithText("Card, bank transfer or USSD").assertIsDisplayed()
    }

    @Test
    fun directModeIsSubmittedOnlyAfterTypingDirect() {
        val transport = RecordingCheckoutTransport()
        var checkoutCreated = false
        compose.setContent {
            MaterialTheme {
                CheckoutScreen(
                    repository = CheckoutRepository("https://api.nantty.com", { testSession() }, transport),
                    providerWalletRepository = ProviderWalletPaymentRepository("https://api.nantty.com", { testSession() }, transport),
                    savedCardCredentialStore = TestSavedCardCredentialStore(),
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onCheckoutCreated = { checkoutCreated = true },
                )
            }
        }

        compose.onNodeWithText("Pay directly").performClick()
        compose.onNodeWithContentDescription("Type DIRECT to confirm paying Verified Market directly")
            .performTextInput("DIRECT")
        compose.onNodeWithText("Continue to secure payment").performClick()

        compose.runOnIdle {
            val modes = transport.checkoutBody?.getJSONArray("paymentModes")
            assertEquals(1, modes?.length())
            assertEquals("store_verified", modes?.getJSONObject(0)?.getString("storeId"))
            assertEquals("direct", modes?.getJSONObject(0)?.getString("paymentMode"))
            assertEquals(true, transport.checkoutBody?.getBoolean("directPaymentAccepted"))
            assertTrue(checkoutCreated)
        }
    }

    @Test
    fun walletChoiceIsCarriedIntoTheCreatedPaymentReceipt() {
        val transport = RecordingCheckoutTransport()
        var receipt: CheckoutReceipt? = null
        compose.setContent {
            MaterialTheme {
                CheckoutScreen(
                    repository = CheckoutRepository("https://api.nantty.com", { testSession() }, transport),
                    providerWalletRepository = ProviderWalletPaymentRepository("https://api.nantty.com", { testSession() }, transport),
                    savedCardCredentialStore = TestSavedCardCredentialStore(),
                    executor = Executor { it.run() },
                    onBack = {},
                    onAuthenticationRequired = {},
                    onCheckoutCreated = { receipt = it },
                )
            }
        }

        compose.onNodeWithText("Pay from wallet").performClick()
        compose.onNodeWithText("Continue to secure payment").performClick()

        compose.runOnIdle {
            assertEquals(CheckoutPaymentMethod.PROVIDER_WALLET, receipt?.paymentMethod)
        }
    }

    private fun testSession() = AccountSession(
        "buyer-token",
        "refresh-token",
        AccountUser("buyer-id", "Buyer", "buyer", null, null, emptyList()),
    )

    private class TestSavedCardCredentialStore : SavedCardCredentialStore {
        private var card: DeviceSavedCard? = null
        override fun readDisplay() = card
        override fun readSavedCardIdAfterUserConfirmation() = card?.savedCardId
        override fun save(card: DeviceSavedCard) { this.card = card }
        override fun remove() { card = null }
    }

    private class RecordingCheckoutTransport : CheckoutTransport {
        var checkoutBody: JSONObject? = null
        var channelsResponse = JSONObject("""{"channels":["card","bank_transfer","ussd"]}""")
        val getPaths = mutableListOf<String>()
        private val addressId = "2b3a4e12-1234-4234-9234-123456789abc"

        override fun get(path: String, accessToken: String): JSONObject {
            getPaths += path
            return when (path) {
                "/api/v1/payments/wallet/me" -> JSONObject(
                    """{"wallet":{"status":"active","currency":"NGN"},"balances":{"currency":"NGN","availableMinor":5000,"depositHoldMinor":0,"debtMinor":0}}""",
                )
                "/api/v1/users/me/addresses" -> JSONObject(
                    """{"data":[{"id":"$addressId","fullName":"Buyer","phone":"+2348000000000","line1":"12 Market Road","city":"Lagos","state":"Lagos","country":"Nigeria","isDefault":true}]}""",
                )
                "/api/v1/payments/channels" -> channelsResponse
                else -> error("Unexpected GET $path")
            }
        }

        override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject = when (path) {
            "/api/v1/cart/shipping-quote" -> JSONObject(
                """{"data":{"itemsTotal":{"amountMinor":2000,"currency":"NGN"},"shopDiscount":{"amountMinor":0,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":2000,"currency":"NGN"},"payableGroupCount":2,"groups":[
                    {"storeId":"store_verified","storeName":"Verified Market","store":{"verified":true},"items":[{"id":"cart_verified","product":{"id":"product_verified","name":"Verified item","price":{"amountMinor":1000,"currency":"NGN"}},"quantity":1}],"subtotal":{"amountMinor":1000,"currency":"NGN"},"discounts":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":1000,"currency":"NGN"},"shipping":{"status":"calculated","fee":{"amountMinor":0,"currency":"NGN"},"isFree":true}},
                    {"storeId":"store_unverified","storeName":"Unverified Market","store":{"verified":false},"items":[{"id":"cart_unverified","product":{"id":"product_unverified","name":"Unverified item","price":{"amountMinor":1000,"currency":"NGN"}},"quantity":1}],"subtotal":{"amountMinor":1000,"currency":"NGN"},"discounts":{"amountMinor":0,"currency":"NGN"},"total":{"amountMinor":1000,"currency":"NGN"},"shipping":{"status":"calculated","fee":{"amountMinor":0,"currency":"NGN"},"isFree":true}}
                ]}}""",
            )
            "/api/v1/orders/checkout" -> {
                checkoutBody = body
                JSONObject("""{"data":{"checkoutId":"6b3a4e12-1234-4234-9234-123456789abc","payableOrderId":"4b3a4e12-1234-4234-9234-123456789abc","total":{"amountMinor":2000,"currency":"NGN"},"orders":[{},{}]}}""")
            }
            else -> error("Unexpected POST $path")
        }
    }
}
