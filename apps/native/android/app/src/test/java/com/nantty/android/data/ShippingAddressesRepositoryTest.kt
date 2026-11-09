package com.nantty.android.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShippingAddressesRepositoryTest {
    @Test
    fun loadsOwnerAddressesFromAuthenticatedCollectionRoute() {
        val transport = RecordingShippingAddressTransport { method, path, _, _ ->
            assertEquals("GET", method)
            assertEquals("/api/v1/users/me/addresses", path)
            JSONObject().put("data", JSONArray().put(addressJson()))
        }
        val result = ShippingAddressesRepository(::signedInSession, transport = transport).load()

        assertTrue(result is ShippingAddressesResult.Success)
        assertEquals("Ada Lovelace", (result as ShippingAddressesResult.Success).addresses.single().fullName)
        assertEquals("buyer-token", transport.accessToken)
    }

    @Test
    fun createAndUpdateSendValidatedAddressFieldsAndDefaultState() {
        val transport = RecordingShippingAddressTransport { method, _, _, _ -> addressJson() }
        val repository = ShippingAddressesRepository(::signedInSession, transport = transport)
        val input = validInput(isDefault = true)

        assertTrue(repository.create(input) is ShippingAddressResult.Success)
        assertEquals("POST", transport.method)
        assertEquals("Ada Lovelace", transport.body?.getString("fullName"))
        assertEquals("+2348012345678", transport.body?.getString("phone"))
        assertTrue(transport.body?.getBoolean("isDefault") == true)

        assertTrue(repository.update(ADDRESS_ID, input.copy(isDefault = false)) is ShippingAddressResult.Success)
        assertEquals("PATCH", transport.method)
        assertEquals("/api/v1/users/me/addresses/$ADDRESS_ID", transport.path)
        assertFalse(transport.body?.getBoolean("isDefault") ?: true)
    }

    @Test
    fun defaultAndDeleteUseOwnerScopedAddressRoutes() {
        val transport = RecordingShippingAddressTransport { _, _, _, _ -> addressJson() }
        val repository = ShippingAddressesRepository(::signedInSession, transport = transport)

        assertTrue(repository.setDefault(ADDRESS_ID) is ShippingAddressResult.Success)
        assertEquals("PATCH", transport.method)
        assertEquals("/api/v1/users/me/addresses/$ADDRESS_ID", transport.path)
        assertTrue(transport.body?.getBoolean("isDefault") == true)

        assertTrue(repository.delete(ADDRESS_ID) is ShippingAddressDeleteResult.Success)
        assertEquals("DELETE", transport.method)
        assertEquals("/api/v1/users/me/addresses/$ADDRESS_ID", transport.path)
        assertEquals(null, transport.body)
    }

    @Test
    fun rejectsInvalidAddressIdsWithoutMakingARequest() {
        val transport = RecordingShippingAddressTransport { _, _, _, _ -> addressJson() }
        val repository = ShippingAddressesRepository(::signedInSession, transport = transport)

        assertTrue(repository.update("../other", validInput()) is ShippingAddressResult.Failure)
        assertTrue(repository.delete("not-an-id") is ShippingAddressDeleteResult.Failure)
        assertEquals(0, transport.requestCount)
    }

    @Test
    fun requiresAnAuthenticatedSession() {
        val transport = RecordingShippingAddressTransport { _, _, _, _ -> addressJson() }
        val result = ShippingAddressesRepository({ null }, transport = transport).load()

        assertTrue(result is ShippingAddressesResult.Failure)
        assertTrue((result as ShippingAddressesResult.Failure).authenticationRequired)
        assertEquals(0, transport.requestCount)
    }

    @Test
    fun retriesUnauthorizedReadsWithTheRefreshedSessionOnce() {
        val refreshed = signedInSession("fresh-token")
        val transport = RecordingShippingAddressTransport { _, _, token, _ ->
            if (token == "buyer-token") throw ShippingAddressHttpException(401, "expired")
            JSONObject().put("data", JSONArray().put(addressJson()))
        }
        val result = ShippingAddressesRepository(
            sessionProvider = ::signedInSession,
            refreshSessionProvider = { refreshed },
            transport = transport,
        ).load()

        assertTrue(result is ShippingAddressesResult.Success)
        assertEquals(2, transport.requestCount)
        assertEquals("fresh-token", transport.accessToken)
    }

    private fun validInput(isDefault: Boolean = false) = SavedShippingAddressInput(
        fullName = "Ada Lovelace",
        phone = "+234 801 234 5678",
        line1 = "1 Analytical Way",
        postalCode = "100001",
        details = "Blue gate",
        isDefault = isDefault,
        countryId = "ng",
        stateId = null,
        lgaId = null,
        cityId = null,
    )

    private fun signedInSession(token: String = "buyer-token") = AccountSession(
        token,
        "refresh-token",
        AccountUser("buyer-id", "Ada Lovelace", "ada", null, null, emptyList()),
    )

    private fun addressJson() = JSONObject()
        .put("id", ADDRESS_ID)
        .put("fullName", "Ada Lovelace")
        .put("phone", "+2348012345678")
        .put("line1", "1 Analytical Way")
        .put("postalCode", "100001")
        .put("details", "Blue gate")
        .put("isDefault", true)
        .put("countryId", "ng")
        .put("countryCode", "NG")
        .put("country", "Nigeria")
        .put("stateId", JSONObject.NULL)
        .put("state", "")
        .put("lgaId", JSONObject.NULL)
        .put("lga", JSONObject.NULL)
        .put("cityId", JSONObject.NULL)
        .put("city", JSONObject.NULL)

    private class RecordingShippingAddressTransport(
        private val response: (String, String, String, JSONObject?) -> JSONObject,
    ) : ShippingAddressTransport {
        var method: String? = null
        var path: String? = null
        var accessToken: String? = null
        var body: JSONObject? = null
        var requestCount = 0

        override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
            this.method = method
            this.path = path
            this.accessToken = accessToken
            this.body = body
            requestCount++
            return response(method, path, accessToken, body)
        }
    }

    private companion object {
        const val ADDRESS_ID = "0192f0a0-0000-7000-8000-0000000000aa"
    }
}
