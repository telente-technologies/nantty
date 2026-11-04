package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckoutRepositoryTest {
    private val addressId = "2b3a4e12-1234-4234-9234-123456789abc"
    private val orderId = "4b3a4e12-1234-4234-9234-123456789abc"
    private val checkoutId = "6b3a4e12-1234-4234-9234-123456789abc"
    private val idempotencyKey = "checkout-test-key-123456"

    @Test
    fun listsOnlyValidAddressesAndPreservesDefaultAndPhone() {
        val transport = RecordingTransport().apply {
            getResponse = JSONObject("""{"data":[{"id":"$addressId","fullName":"Buyer","phone":"+2348000000000","line1":"12 Market Road","city":"Lagos","state":"Lagos","country":"Nigeria","isDefault":true},{"id":"../other","fullName":"Injected","line1":"No"}]}""")
        }
        val repo = repository(transport)

        val result = repo.loadAddresses() as CheckoutAddressesResult.Success

        assertEquals(1, result.addresses.size)
        assertEquals("Buyer", result.addresses.single().fullName)
        assertEquals("+2348000000000", result.addresses.single().phone)
        assertTrue(result.addresses.single().isDefault)
    }

    @Test
    fun loadsGeoChoicesFromBackendRatherThanAssumingLocationIds() {
        val countryId = "6b3a4e12-1234-4234-9234-123456789abc"
        val stateId = "7b3a4e12-1234-4234-9234-123456789abc"
        val transport = RecordingTransport().apply {
            getResponse = JSONObject("""{"data":[{"id":"$countryId","name":"Nigeria","levels":["state","lga","city"],"stateLabel":"State","lgaLabel":"LGA"}]}""")
        }
        val repository = repository(transport)

        val countries = repository.loadGeoCountries()

        assertEquals(countryId, countries.single().id)
        assertTrue(countries.single().levels.containsAll(setOf("state", "lga", "city")))
        transport.getResponse = JSONObject("""{"data":[{"id":"$stateId","name":"Lagos","parentId":"$countryId"}]}""")
        assertEquals("Lagos", repository.loadGeoAreas("/api/v1/geo/countries/$countryId/regions").single().name)
        assertEquals("/api/v1/geo/countries/$countryId/regions", transport.path)
    }

    @Test
    fun createsAddressUsingSelectedBackendGeoIdsAndParsesCanonicalResponse() {
        val countryId = "6b3a4e12-1234-4234-9234-123456789abc"
        val stateId = "7b3a4e12-1234-4234-9234-123456789abc"
        val savedId = "8b3a4e12-1234-4234-9234-123456789abc"
        val transport = RecordingTransport().apply {
            postResponse = JSONObject("""{"data":{"id":"$savedId","fullName":"Buyer Name","phone":"+2348012345678","line1":"12 Market Road","city":"Ikeja","state":"Lagos","country":"Nigeria","isDefault":true}}""")
        }

        val address = repository(transport).createAddress(
            CheckoutAddressInput("Buyer Name", "+234 801-234-5678", "12 Market Road", "", "", countryId, stateId, null, null, "", ""),
        )

        assertEquals("/api/v1/users/me/addresses", transport.path)
        assertEquals("$stateId", transport.body?.getString("stateId"))
        assertEquals(countryId, transport.body?.getString("countryId"))
        assertEquals("+2348012345678", transport.body?.getString("phone"))
        assertEquals("+2348012345678", address.phone)
        assertTrue(address.isDefault)
    }

    @Test
    fun rejectsInvalidAddressBeforeSendingItToTheApi() {
        val transport = RecordingTransport()
        val result = runCatching {
            repository(transport).createAddress(
                CheckoutAddressInput("Buyer", "0800000000", "12 Road", "", "", addressId, null, null, null, "", ""),
            )
        }
        assertTrue(result.isFailure)
        assertNull(transport.path)
    }

    @Test
    fun quoteUsesSelectedAddressAndServerCartTotal() {
        val transport = RecordingTransport().apply {
            postResponse = JSONObject("""{"data":{"itemsTotal":{"amountMinor":6000,"currency":"NGN"},"shopDiscount":{"amountMinor":300,"currency":"NGN"},"storeCredit":{"amountMinor":0,"currency":"NGN"},"shipping":{"amountMinor":1500,"currency":"NGN"},"total":{"amountMinor":7200,"currency":"NGN"},"payableGroupCount":1,"groups":[]}}""")
        }
        val result = repository(transport).quoteCart(addressId) as CheckoutCartResult.Success

        assertEquals("/api/v1/cart/shipping-quote", transport.path)
        assertEquals("buyer-token", transport.token)
        assertEquals(addressId, transport.body?.getString("addressId"))
        assertEquals(7200L, result.cart.totalAmountMinor)
        assertEquals("NGN", result.cart.currency)
        assertEquals(6000L, result.cart.itemsTotal?.amountMinor)
        assertEquals(300L, result.cart.discounts?.amountMinor)
        assertEquals(1500L, result.cart.shipping?.amountMinor)
    }

    @Test
    fun checkoutUsesServerAuthoritativeEscrowDefaultsAndStableIdempotencyKey() {
        val transport = RecordingTransport().apply {
            postResponse = JSONObject("""{"data":{"checkoutId":"$checkoutId","payableOrderId":"$orderId","total":{"amountMinor":7200,"currency":"NGN"},"orders":[{},{}]}}""")
        }
        val result = repository(transport).placeOrder(addressId, idempotencyKey) as PlaceCheckoutResult.Success

        assertEquals("/api/v1/orders/checkout", transport.path)
        assertEquals(idempotencyKey, transport.idempotencyKey)
        assertEquals(addressId, transport.body?.getString("addressId"))
        assertEquals(false, transport.body?.getBoolean("directPaymentAccepted"))
        assertEquals(0, transport.body?.getJSONArray("paymentModes")?.length())
        assertEquals(7200L, result.receipt.total.amountMinor)
        assertEquals(2, result.receipt.orderCount)
    }

    @Test
    fun rejectsBadAddressOrIdempotencyKeyBeforeCreatingAnOrder() {
        val transport = RecordingTransport()
        val repository = repository(transport)

        assertTrue(repository.placeOrder("../other", idempotencyKey) is PlaceCheckoutResult.Failure)
        assertTrue(repository.placeOrder(addressId, "bad") is PlaceCheckoutResult.Failure)
        assertNull(transport.path)
    }

    @Test
    fun rejectsCheckoutResponseWithoutAnOrderInsteadOfInventingOne() {
        val repo = repository()
        val malformed = JSONObject("""{"checkoutId":"$checkoutId","payableOrderId":"$orderId","total":{"amountMinor":1,"currency":"NGN"},"orders":[]}""")

        assertTrue(runCatching { repo.parseCheckoutReceipt(malformed) }.isFailure)
    }

    @Test
    fun hostedPaymentRequiresHttpsAndVerificationMapsOnlyServerStatus() {
        val repo = repository()
        assertEquals(
            HostedPayment(orderId, "https://payments.example/checkout/abc"),
            repo.parseHostedPayment(JSONObject("""{"data":{"orderId":"$orderId","checkoutUrl":"https://payments.example/checkout/abc"}}"""), orderId),
        )
        assertTrue(runCatching { repo.parseHostedPayment(JSONObject("""{"checkoutUrl":"http://payments.example/pay"}"""), orderId) }.isFailure)

        val transport = RecordingTransport().apply {
            postResponse = JSONObject("""{"data":{"status":"pending"}}""")
        }
        assertEquals(PaymentVerificationResult.Pending, repository(transport).verifyPayment(orderId))
        transport.postResponse = JSONObject("""{"data":{"status":"paid"}}""")
        assertEquals(PaymentVerificationResult.Paid, repository(transport).verifyPayment(orderId))
        transport.postResponse = JSONObject("""{"data":{"status":"failed"}}""")
        assertEquals(PaymentVerificationResult.Failed, repository(transport).verifyPayment(orderId))
    }

    @Test
    fun missingSessionNeverCallsCheckoutTransport() {
        val transport = RecordingTransport()
        val result = CheckoutRepository("https://api.nantty.com", { null }, transport).loadAddresses()

        val failure = result as CheckoutAddressesResult.Failure
        assertTrue(failure.authenticationRequired)
        assertNull(transport.path)
        assertFalse(failure.message.isBlank())
    }

    private fun repository(transport: RecordingTransport = RecordingTransport()) =
        CheckoutRepository("https://api.nantty.com", { AccountSession("buyer-token", "refresh", AccountUser("u", "Buyer", "buyer", null, null, emptyList())) }, transport)

    private class RecordingTransport : CheckoutTransport {
        var path: String? = null
        var token: String? = null
        var body: JSONObject? = null
        var idempotencyKey: String? = null
        var getResponse = JSONObject()
        var postResponse = JSONObject()

        override fun get(path: String, accessToken: String): JSONObject {
            this.path = path
            token = accessToken
            return getResponse
        }

        override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
            this.path = path
            token = accessToken
            this.body = body
            this.idempotencyKey = idempotencyKey
            return postResponse
        }
    }
}
