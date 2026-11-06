package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SavedCardRepositoryTest {
    private val setupReference = "card-setup_20261106-abc"
    private val paymentReference = "pay_20261106-abc"
    private val savedCardId = "8b3a4e12-1234-4234-9234-123456789abc"
    private val key = "saved-card-test-key-123"

    @Test
    fun setupUsesAuthenticatedEndpointEmptyBodyAndIdempotencyKey() {
        val transport = RecordingTransport().apply {
            postResponse = JSONObject(
                """{"reference":"$setupReference","checkoutUrl":"https://payments.example/checkout/123","verificationCharge":{"amountMinor":100,"currency":"NGN"}}""",
            )
        }

        val result = repository(transport).startSetup(key) as SavedCardResult.Success

        assertEquals(SavedCardSetup(setupReference, "https://payments.example/checkout/123"), result.value)
        assertEquals("POST", transport.method)
        assertEquals("/api/v1/payments/saved-cards/setups", transport.path)
        assertEquals("buyer-token", transport.accessToken)
        assertEquals(key, transport.idempotencyKey)
        assertEquals(0, transport.body?.length())
    }

    @Test
    fun completionUsesValidatedReferenceAndParsesOnlyMaskedCardFields() {
        val transport = RecordingTransport().apply {
            postResponse = JSONObject(
                """{"data":{"savedCardId":"$savedCardId","brand":"Visa","last4":"4242","expiryMonth":9,"expiryYear":2032,"pan":"4111111111111111","authorizationCode":"must-not-be-read"}}""",
            )
        }

        val result = repository(transport).completeSetup(setupReference) as SavedCardResult.Success

        assertEquals("POST", transport.method)
        assertEquals("/api/v1/payments/saved-cards/setups/$setupReference/complete", transport.path)
        assertEquals("buyer-token", transport.accessToken)
        assertNull(transport.idempotencyKey)
        assertEquals(0, transport.body?.length())
        assertEquals(SavedCardSummary(savedCardId, "Visa", "4242", 9, 2032), result.value)
    }

    @Test
    fun chargeUsesExactEndpointBodyAndRequiredIdempotencyKey() {
        val transport = RecordingTransport().apply {
            postResponse = JSONObject("""{"status":"processing","paymentIntent":{"reference":"ignored"}}""")
        }

        val result = repository(transport).charge(paymentReference, savedCardId, key) as SavedCardResult.Success

        assertEquals("POST", transport.method)
        assertEquals("/api/v1/payments/saved-cards/charges", transport.path)
        assertEquals("buyer-token", transport.accessToken)
        assertEquals(key, transport.idempotencyKey)
        assertEquals(paymentReference, transport.body?.getString("paymentReference"))
        assertEquals(savedCardId, transport.body?.getString("savedCardId"))
        assertEquals(2, transport.body?.length())
        assertEquals(SavedCardChargeStatus.PROCESSING, result.value.status)
    }

    @Test
    fun chargeModelsPaidFailedPendingAndHostedOrAuthenticationFallbackExplicitly() {
        val transport = RecordingTransport()
        val repository = repository(transport)

        transport.postResponse = JSONObject("""{"status":"paid"}""")
        assertEquals(SavedCardChargeStatus.PAID, (repository.charge(paymentReference, savedCardId, key) as SavedCardResult.Success).value.status)

        transport.postResponse = JSONObject("""{"status":"failed"}""")
        assertEquals(SavedCardChargeStatus.FAILED, (repository.charge(paymentReference, savedCardId, key) as SavedCardResult.Success).value.status)

        transport.postResponse = JSONObject("""{"status":"pending"}""")
        assertEquals(SavedCardChargeStatus.PENDING, (repository.charge(paymentReference, savedCardId, key) as SavedCardResult.Success).value.status)

        transport.postResponse = JSONObject("""{"status":"requires_authentication","authorizationUrl":"https://payments.example/auth/step"}""")
        val authentication = (repository.charge(paymentReference, savedCardId, key) as SavedCardResult.Success).value
        assertEquals(SavedCardChargeStatus.REQUIRES_AUTHENTICATION, authentication.status)
        assertEquals("https://payments.example/auth/step", authentication.actionUrl)

        transport.postResponse = JSONObject("""{"status":"requires_checkout","checkoutUrl":"https://payments.example/checkout/fallback"}""")
        val checkout = (repository.charge(paymentReference, savedCardId, key) as SavedCardResult.Success).value
        assertEquals(SavedCardChargeStatus.REQUIRES_CHECKOUT, checkout.status)
        assertEquals("https://payments.example/checkout/fallback", checkout.actionUrl)
    }

    @Test
    fun malformedReferencesIdsCardMetadataAndUnsafeUrlsAreRejectedBeforeUse() {
        val transport = RecordingTransport()
        val repository = repository(transport)

        assertTrue(repository.completeSetup("../escape") is SavedCardResult.Failure)
        assertTrue(repository.completeSetup("x".repeat(81)) is SavedCardResult.Failure)
        assertTrue(repository.charge("../payment", savedCardId, key) is SavedCardResult.Failure)
        assertTrue(repository.charge(paymentReference, "not-a-uuid", key) is SavedCardResult.Failure)
        assertTrue(repository.charge(paymentReference, savedCardId, "bad key") is SavedCardResult.Failure)
        assertEquals(0, transport.calls)

        transport.postResponse = JSONObject("""{"reference":"$setupReference","checkoutUrl":"http://payments.example/checkout"}""")
        assertTrue(repository.startSetup(key) is SavedCardResult.Failure)

        transport.postResponse = JSONObject("""{"savedCardId":"$savedCardId","brand":"Visa","last4":"42x2","expiryMonth":13,"expiryYear":2032}""")
        assertTrue(repository.completeSetup(setupReference) is SavedCardResult.Failure)

        transport.postResponse = JSONObject("""{"status":"requires_authentication","authorizationUrl":"javascript:alert(1)"}""")
        assertTrue(repository.charge(paymentReference, savedCardId, key) is SavedCardResult.Failure)
    }

    @Test
    fun malformedOrUnknownChargeStatusReturnsGenericFailure() {
        val transport = RecordingTransport().apply { postResponse = JSONObject("""{"status":"unexpected-provider-state"}""") }

        val result = repository(transport).charge(paymentReference, savedCardId, key) as SavedCardResult.Failure

        assertFalse(result.authenticationRequired)
        assertFalse(result.message.contains("unexpected-provider-state"))
    }

    @Test
    fun missingSessionAndUnauthorizedErrorsAreMarkedAuthenticationRequired() {
        val noSession = SavedCardRepository("https://api.nantty.com", { null }, RecordingTransport())
        val noSessionResult = noSession.startSetup(key) as SavedCardResult.Failure
        assertTrue(noSessionResult.authenticationRequired)

        for (statusCode in listOf(401, 403)) {
            val transport = RecordingTransport().apply { httpFailure = CheckoutHttpException(statusCode) }
            val result = repository(transport).charge(paymentReference, savedCardId, key) as SavedCardResult.Failure
            assertTrue(result.authenticationRequired)
            assertFalse(result.message.contains(statusCode.toString()))
            assertFalse(result.message.contains("provider", ignoreCase = true))
        }
    }

    @Test
    fun serverErrorsReturnGenericSafeFailure() {
        val transport = RecordingTransport().apply { httpFailure = CheckoutHttpException(422) }

        val result = repository(transport).startSetup(key) as SavedCardResult.Failure

        assertFalse(result.authenticationRequired)
        assertFalse(result.message.contains("422"))
        assertFalse(result.message.contains("server", ignoreCase = true))
    }

    private fun repository(transport: RecordingTransport) = SavedCardRepository(
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
        var postResponse = JSONObject()
        var httpFailure: CheckoutHttpException? = null
        var calls = 0

        override fun get(path: String, accessToken: String): JSONObject = error("Unexpected GET request")

        override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
            calls += 1
            this.path = path
            this.method = "POST"
            this.accessToken = accessToken
            this.body = body
            this.idempotencyKey = idempotencyKey
            httpFailure?.let { throw it }
            return postResponse
        }
    }
}
