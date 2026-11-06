package com.nantty.android.ui

import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.CheckoutHttpException
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.CheckoutTransport
import com.nantty.android.data.SavedCardChargeStatus
import com.nantty.android.data.SavedCardRepository
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SavedCardPaymentAttemptTest {
    private val paymentReference = "payment-ref-20261106"
    private val savedCardId = "8b3a4e12-1234-4234-9234-123456789abc"
    private val orderId = "order-123"
    private val paymentKey = "payment-idempotency-key-1234"
    private val chargeKey = "charge-idempotency-key-1234"

    @Test
    fun initializesOrderBeforeChargingAndPreservesExplicitAuthenticationFallback() {
        val transport = ScriptedTransport().apply {
            initialization = JSONObject("""{"reference":"$paymentReference","checkoutUrl":"https://pay.example/order"}""")
            charge = JSONObject("""{"status":"requires_authentication","authorizationUrl":"https://pay.example/verify"}""")
        }

        val result = attempt(transport)

        assertTrue(result is SavedCardPaymentAttempt.Prepared)
        val prepared = result as SavedCardPaymentAttempt.Prepared
        val charged = chargePreparedSavedCardPayment(
            savedCardRepository = SavedCardRepository(API_BASE_URL, ::session, transport),
            paymentReference = requireNotNull(prepared.payment.reference),
            savedCardId = savedCardId,
            idempotencyKey = chargeKey,
        ) as com.nantty.android.data.SavedCardResult.Success
        assertEquals(SavedCardChargeStatus.REQUIRES_AUTHENTICATION, charged.value.status)
        assertEquals("https://pay.example/verify", charged.value.actionUrl)
        assertEquals(listOf("/api/v1/payments/initialize", "/api/v1/payments/saved-cards/charges"), transport.paths)
        assertEquals(paymentKey, transport.idempotencyKeys[0])
        assertEquals(chargeKey, transport.idempotencyKeys[1])
        assertEquals(paymentReference, transport.chargeBody?.getString("paymentReference"))
        assertEquals(savedCardId, transport.chargeBody?.getString("savedCardId"))
    }

    @Test
    fun neverChargesWhenOrderIntentHasNoServerReference() {
        val transport = ScriptedTransport().apply {
            initialization = JSONObject("""{"checkoutUrl":"https://pay.example/order"}""")
        }

        val result = attempt(transport)

        assertTrue(result is SavedCardPaymentAttempt.Failure)
        assertEquals(listOf("/api/v1/payments/initialize"), transport.paths)
        assertFalse(transport.paths.contains("/api/v1/payments/saved-cards/charges"))
    }

    @Test
    fun chargeFailureIsReturnedWithoutClaimingPaymentSuccess() {
        val transport = ScriptedTransport().apply {
            initialization = JSONObject("""{"reference":"$paymentReference","checkoutUrl":"https://pay.example/order"}""")
            charge = JSONObject("""{"status":"failed"}""")
        }

        val result = attempt(transport)

        assertTrue(result is SavedCardPaymentAttempt.Prepared)
        val prepared = result as SavedCardPaymentAttempt.Prepared
        val charged = chargePreparedSavedCardPayment(
            savedCardRepository = SavedCardRepository(API_BASE_URL, ::session, transport),
            paymentReference = requireNotNull(prepared.payment.reference),
            savedCardId = savedCardId,
            idempotencyKey = chargeKey,
        ) as com.nantty.android.data.SavedCardResult.Success
        assertEquals(SavedCardChargeStatus.FAILED, charged.value.status)
    }

    private fun attempt(transport: ScriptedTransport) = prepareSavedCardPayment(
        checkoutRepository = CheckoutRepository(API_BASE_URL, ::session, transport),
        orderId = orderId,
        paymentIdempotencyKey = paymentKey,
    )

    private class ScriptedTransport : CheckoutTransport {
        var initialization = JSONObject()
        var charge = JSONObject()
        val paths = mutableListOf<String>()
        val idempotencyKeys = mutableListOf<String?>()
        var chargeBody: JSONObject? = null

        override fun get(path: String, accessToken: String): JSONObject = error("Unexpected GET: $path")

        override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
            paths += path
            idempotencyKeys += idempotencyKey
            return when (path) {
                "/api/v1/payments/initialize" -> initialization
                "/api/v1/payments/saved-cards/charges" -> charge.also { chargeBody = body }
                else -> throw CheckoutHttpException(404)
            }
        }
    }

    private companion object {
        const val API_BASE_URL = "https://api.nantty.com"
        fun session() = AccountSession(
            "buyer-token",
            "refresh-token",
            AccountUser("buyer-id", "Buyer", "buyer", null, null, emptyList()),
        )
    }
}
