package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StoreRepositoryTest {
    @Test
    fun loadsStoreAndProductsUsingPublicContractsAndOptionalViewerToken() {
        val transport = RecordingStoreTransport()
        val repository = StoreRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { session() },
            transport = transport,
        )

        val result = repository.loadStore(STORE_ID) as PublicStoreResult.Success

        assertEquals(
            listOf("/api/v1/stores/$STORE_ID", "/api/v1/stores/$STORE_ID/products?limit=${StoreRepository.PRODUCT_PAGE_SIZE}"),
            transport.paths,
        )
        assertEquals(listOf("store-token", "store-token"), transport.tokens)
        assertEquals("Ada Fabrics", result.page.store.name)
        assertEquals("adafabrics", result.page.store.handle)
        assertEquals(18, result.page.store.followers)
        assertEquals(listOf("product-1"), result.page.products.map(SearchProduct::id))
        assertEquals("next-page", result.page.nextCursor)
    }

    @Test
    fun guestLoadsPublicStoreWithoutAuthorizationAndUnsafeIdentifiersNeverCallTransport() {
        val transport = RecordingStoreTransport()
        val repository = StoreRepository("https://api.nantty.com", { null }, transport)

        assertTrue(repository.loadStore(STORE_ID) is PublicStoreResult.Success)
        assertEquals(listOf(null, null), transport.tokens)
        val requestCount = transport.paths.size
        assertTrue(repository.loadStore("../private") is PublicStoreResult.Failure)
        assertEquals(requestCount, transport.paths.size)
    }

    @Test
    fun parserSanitizesExternalMediaClampsCountsAndRejectsMismatchedStoreIdentity() {
        val repository = StoreRepository("https://api.nantty.com", { null }, RecordingStoreTransport())
        val payload = JSONObject("""{"id":"$STORE_ID","name":"Store","logoUrl":"javascript:alert(1)","bannerUrl":"https://cdn.nantty.com/banner.jpg","followers":-4,"productsCount":-2,"rating":99,"ratingCount":-1,"verified":true,"ownerUserId":"private-owner-id"}""")

        val store = repository.parseStore(payload, STORE_ID)

        assertEquals(null, store.logoUrl)
        assertEquals("https://cdn.nantty.com/banner.jpg", store.bannerUrl)
        assertEquals(0, store.followers)
        assertEquals(0, store.productsCount)
        assertEquals(5.0, store.rating, 0.0)
        assertEquals(0, store.ratingCount)
        assertFalse(store.handle.isNotBlank())
        assertTrue(runCatching { repository.parseStore(payload, "another-store") }.isFailure)
    }

    private class RecordingStoreTransport : StoreTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()

        override fun get(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            return when {
                path == "/api/v1/stores/$STORE_ID" -> JSONObject("""{"id":"$STORE_ID","name":"Ada Fabrics","handle":"adafabrics","bio":"Handmade textiles","logoUrl":"https://cdn.nantty.com/logo.png","followers":18,"productsCount":1,"rating":4.7,"ratingCount":5,"verified":true}""")
                path.startsWith("/api/v1/stores/$STORE_ID/products") -> JSONObject("""{"data":[{"id":"product-1","name":"Indigo scarf","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.com/scarf.jpg","stock":4}],"nextCursor":"next-page"}""")
                else -> error("Unexpected store request: $path")
            }
        }
    }

    companion object {
        private const val STORE_ID = "0192a4f0-0000-7000-8000-000000000000"
        private fun session() = AccountSession("store-token", "refresh-token", AccountUser("user-1", "Ada", "ada", null, null, emptyList()))
    }
}
