package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProviderWalletPaymentRepositoryTest {
    private val paymentReference = "ord-20261106_abc-123"
    private val idempotencyKey = "wallet-payment_123"

    @Test
    fun loadsWalletFromAuthenticatedProviderWalletContract() {
        val transport = RecordingTransport().apply {
            getResponse = JSONObject(
                """
                    {
                      "wallet": {"status": "active", "currency": "NGN"},
                      "balances": {
                        "currency": "NGN",
                        "availableMinor": 12000,
                        "depositHoldMinor": 3000,
                        "debtMinor": 2000,
                        "escrowLockedMinor": 999999
                      }
                    }
                """.trimIndent(),
            )
        }

        val result = repository(transport).loadWallet() as ProviderWalletLoadResult.Success
        val wallet = requireNotNull(result.wallet)

        assertEquals("/api/v1/payments/wallet/me", transport.path)
        assertEquals("GET", transport.method)
        assertEquals("buyer-token", transport.accessToken)
        assertEquals("active", wallet.status)
        assertEquals("NGN", wallet.currency)
        assertEquals(12000L, wallet.availableMinor)
        assertEquals(3000L, wallet.depositHoldMinor)
        assertEquals(2000L, wallet.debtMinor)
        assertEquals(13000L, wallet.spendableMinor)
    }

    @Test
    fun spendableBalanceNeverBecomesNegative() {
        val wallet = CheckoutProviderWallet("active", "NGN", 100, 50, 500)

        assertEquals(0L, wallet.spendableMinor)
    }

    @Test
    fun notReadyWalletIsSuccessfulWithoutAWallet() {
        val transport = RecordingTransport().apply {
            getResponse = JSONObject(
                """{"wallet":null,"status":"not_ready","balances":{"currency":"NGN"}}""",
            )
        }

        val result = repository(transport).loadWallet()

        assertEquals(ProviderWalletLoadResult.Success(null), result)
        assertEquals("/api/v1/payments/wallet/me", transport.path)
    }

    @Test
    fun walletDebitUsesReferencePathEmptyBodyBearerTokenAndIdempotencyHeader() {
        val transport = RecordingTransport().apply {
            postResponse = JSONObject("""{"status":"succeeded","reference":"$paymentReference"}""")
        }

        val result = repository(transport).payFromWallet(paymentReference, idempotencyKey)

        assertEquals(ProviderWalletPaymentResult.Success, result)
        assertEquals("/api/v1/payments/wallet-payments/$paymentReference", transport.path)
        assertEquals("POST", transport.method)
        assertEquals("buyer-token", transport.accessToken)
        assertEquals(idempotencyKey, transport.idempotencyKey)
        assertEquals(0, transport.body?.length())
    }

    @Test
    fun paidResponseIsAcceptedAndPendingResponseIsNotReportedAsPaid() {
        val transport = RecordingTransport().apply {
            postResponse = JSONObject("""{"status":"paid"}""")
        }
        assertEquals(ProviderWalletPaymentResult.Success, repository(transport).payFromWallet(paymentReference, idempotencyKey))

        transport.postResponse = JSONObject("""{"status":"pending"}""")
        val result = repository(transport).payFromWallet(paymentReference, idempotencyKey) as ProviderWalletPaymentResult.Failure
        assertFalse(result.authenticationRequired)
        assertFalse(result.message.contains("pending", ignoreCase = true))
    }

    @Test
    fun invalidReferenceAndIdempotencyKeysNeverCallTransport() {
        val transport = RecordingTransport()
        val repository = repository(transport)

        assertTrue(repository.payFromWallet("../payment", idempotencyKey) is ProviderWalletPaymentResult.Failure)
        assertTrue(repository.payFromWallet("x".repeat(81), idempotencyKey) is ProviderWalletPaymentResult.Failure)
        assertTrue(repository.payFromWallet(paymentReference, "short") is ProviderWalletPaymentResult.Failure)
        assertTrue(repository.payFromWallet(paymentReference, "bad key!!") is ProviderWalletPaymentResult.Failure)
        assertNull(transport.path)
        assertEquals(0, transport.calls)
    }

    @Test
    fun missingSessionDoesNotCallTransportAndRequiresAuthentication() {
        val transport = RecordingTransport()
        val repository = ProviderWalletPaymentRepository("https://api.nantty.com", { null }, transport)

        val load = repository.loadWallet() as ProviderWalletLoadResult.Failure
        val payment = repository.payFromWallet(paymentReference, idempotencyKey) as ProviderWalletPaymentResult.Failure

        assertTrue(load.authenticationRequired)
        assertTrue(payment.authenticationRequired)
        assertNull(transport.path)
        assertEquals(0, transport.calls)
    }

    @Test
    fun unauthorizedAndForbiddenResponsesRequireAuthenticationWithoutLeakingServerData() {
        for (statusCode in listOf(401, 403)) {
            val transport = RecordingTransport().apply { httpFailure = CheckoutHttpException(statusCode) }
            val repo = repository(transport)
            val result = repo.loadWallet() as ProviderWalletLoadResult.Failure

            assertTrue(result.authenticationRequired)
            assertFalse(result.message.contains(statusCode.toString()))
            assertFalse(result.message.contains("server", ignoreCase = true))

            val payment = repo.payFromWallet(paymentReference, idempotencyKey) as ProviderWalletPaymentResult.Failure
            assertTrue(payment.authenticationRequired)
        }
    }

    @Test
    fun malformedWalletResponseReturnsGenericFailure() {
        val transport = RecordingTransport().apply {
            getResponse = JSONObject(
                """
                    {
                      "wallet": {"status": "active", "currency": "USD"},
                      "balances": {
                        "currency": "NGN",
                        "availableMinor": 1,
                        "depositHoldMinor": 0,
                        "debtMinor": 0
                      }
                    }
                """.trimIndent(),
            )
        }

        val result = repository(transport).loadWallet() as ProviderWalletLoadResult.Failure

        assertFalse(result.authenticationRequired)
        assertFalse(result.message.contains("USD"))
    }

    private fun repository(transport: RecordingTransport) = ProviderWalletPaymentRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = {
            AccountSession(
                "buyer-token",
                "refresh-token",
                AccountUser("buyer", "Buyer", "buyer", null, null, emptyList()),
            )
        },
        transport = transport,
    )

    private class RecordingTransport : CheckoutTransport {
        var path: String? = null
        var method: String? = null
        var accessToken: String? = null
        var body: JSONObject? = null
        var idempotencyKey: String? = null
        var getResponse = JSONObject()
        var postResponse = JSONObject()
        var httpFailure: CheckoutHttpException? = null
        var calls = 0

        override fun get(path: String, accessToken: String): JSONObject {
            record(path, "GET", accessToken)
            httpFailure?.let { throw it }
            return getResponse
        }

        override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
            record(path, "POST", accessToken)
            this.body = body
            this.idempotencyKey = idempotencyKey
            httpFailure?.let { throw it }
            return postResponse
        }

        private fun record(path: String, method: String, accessToken: String) {
            calls += 1
            this.path = path
            this.method = method
            this.accessToken = accessToken
        }
    }
}
