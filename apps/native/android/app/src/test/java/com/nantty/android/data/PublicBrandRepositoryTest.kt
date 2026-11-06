package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PublicBrandRepositoryTest {
    @Test
    fun guestLoadsPublicBrandAndProductsWithoutAuthorization() {
        val transport = RecordingPublicBrandTransport()
        val repository = PublicBrandRepository("https://api.nantty.com", { null }, transport)

        val result = repository.load("brand_1") as PublicBrandResult.Success

        assertEquals(listOf("GET /api/v1/brands/brand_1", "GET /api/v1/brands/brand_1/products"), transport.calls)
        assertEquals(listOf(null, null), transport.tokens)
        assertEquals("Nigerian Loom", result.page.brand.name)
        assertEquals("store_1", result.page.brand.officialStoreId)
        assertEquals("owner_1", result.page.brand.ownerUserId)
        assertFalse(result.page.brand.isFollowing)
        assertEquals("product_1", result.page.products.officialStore.single().id)
        assertEquals("product_2", result.page.products.otherSellers.single().id)
    }

    @Test
    fun followUsesAuthenticatedPostAndDeleteContractsWithNoContentResponse() {
        val transport = RecordingPublicBrandTransport()
        val repository = PublicBrandRepository("https://api.nantty.com", ::publicBrandSession, transport)

        assertEquals(BrandFollowResult.Success(true), repository.setFollowing("brand_1", true))
        assertEquals(BrandFollowResult.Success(false), repository.setFollowing("brand_1", false))
        assertEquals(
            listOf("POST /api/v1/brands/brand_1/follow", "DELETE /api/v1/brands/brand_1/follow"),
            transport.calls,
        )
        assertEquals(listOf("brand-access", "brand-access"), transport.tokens)
    }

    @Test
    fun followRequiresAuthenticationAndInvalidIdsNeverReachTransport() {
        val transport = RecordingPublicBrandTransport()
        val guestRepository = PublicBrandRepository("https://api.nantty.com", { null }, transport)
        val missingAuth = guestRepository.setFollowing("brand_1", true) as BrandFollowResult.Failure
        assertTrue(missingAuth.authenticationRequired)
        assertTrue(guestRepository.load("../unsafe") is PublicBrandResult.Failure)
        assertTrue(transport.calls.isEmpty())

        val unauthorizedTransport = RecordingPublicBrandTransport().apply { followStatus = 401 }
        val unauthorized = PublicBrandRepository("https://api.nantty.com", ::publicBrandSession, unauthorizedTransport)
            .setFollowing("brand_1", true) as BrandFollowResult.Failure
        assertTrue(unauthorized.authenticationRequired)
    }

    @Test
    fun parserSanitizesMediaAndMapsOptionalOfficialStore() {
        val transport = RecordingPublicBrandTransport()
        val repository = PublicBrandRepository("https://api.nantty.com", { null }, transport)
        transport.brandPayload = JSONObject("""{"data":{"id":"brand_1","name":"Studio North","handle":"north","logoUrl":"javascript:bad()","coverUrl":null,"followers":-3,"categoryName":"Fashion","description":"Design","website":"https://north.example","official":true,"sellingEnabled":false,"isFollowing":false,"officialStore":null}}""")

        val brand = repository.load("brand_1") as PublicBrandResult.Success

        assertNull(brand.page.brand.logoUrl)
        assertEquals(0, brand.page.brand.followers)
        assertNull(brand.page.brand.officialStoreId)
        assertFalse(brand.page.brand.sellingEnabled)
    }
}

private class RecordingPublicBrandTransport : PublicBrandTransport {
    val calls = mutableListOf<String>()
    val tokens = mutableListOf<String?>()
    var followStatus = 204
    var brandPayload = publicBrandPayload()

    override fun get(path: String, accessToken: String?): JSONObject {
        calls += "GET $path"
        tokens += accessToken
        return if (path.endsWith("/products")) publicBrandProductsPayload() else brandPayload
    }

    override fun post(path: String, accessToken: String): JSONObject {
        calls += "POST $path"
        tokens += accessToken
        if (followStatus != 204) throw BrandTransportException(followStatus)
        return JSONObject()
    }

    override fun delete(path: String, accessToken: String): JSONObject {
        calls += "DELETE $path"
        tokens += accessToken
        if (followStatus != 204) throw BrandTransportException(followStatus)
        return JSONObject()
    }
}

private fun publicBrandPayload() = JSONObject("""{"data":{"id":"brand_1","name":"Nigerian Loom","handle":"nigerian-loom","ownerUserId":"owner_1","logoUrl":"https://cdn.nantty.com/loom.png","coverUrl":"https://cdn.nantty.com/loom-cover.png","followers":42,"categoryName":"Fashion","description":"Woven in Nigeria","website":"https://loom.example","official":true,"sellingEnabled":true,"isFollowing":false,"officialStore":{"id":"store_1","name":"Nigerian Loom Official"}}}""")

private fun publicBrandProductsPayload() = JSONObject("""{"data":{"officialStoreProducts":[{"id":"product_1","name":"Adire cloth","price":{"amountMinor":250000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.com/adire.png","stock":4}],"otherSellersProducts":[{"id":"product_2","name":"Handwoven bag","price":{"amountMinor":125000,"currency":"NGN"},"stock":2}]}}""")

private fun publicBrandSession() = AccountSession(
    accessToken = "brand-access",
    refreshToken = "brand-refresh",
    user = AccountUser("account_1", "Ari", "ari", null, null, listOf("user")),
)
