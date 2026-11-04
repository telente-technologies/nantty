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

    @Test
    fun storeFollowRequiresSessionAndUsesSocialFollowRoutesForAuthoritativeState() {
        val guestTransport = RecordingStoreTransport()
        val guestRepository = StoreRepository("https://api.nantty.com", { null }, guestTransport)
        val guestResult = guestRepository.setFollowing(STORE_ID, follow = true) as StoreFollowResult.Failure
        assertTrue(guestResult.authenticationRequired)
        assertTrue(guestTransport.posts.isEmpty())

        val transport = RecordingStoreTransport().apply {
            statusResponses += JSONObject("""{"storeId":"$STORE_ID","isFollowing":true,"followers":19}""")
            statusResponses += JSONObject("""{"storeId":"$STORE_ID","isFollowing":false,"followers":18}""")
        }
        val repository = StoreRepository("https://api.nantty.com", ::session, transport)
        val followed = repository.setFollowing(STORE_ID, follow = true) as StoreFollowResult.Success
        assertEquals(StoreFollowState(STORE_ID, true, 19), followed.state)
        assertEquals(listOf("/api/v1/stores/$STORE_ID/follow"), transport.posts)
        assertEquals("/api/v1/stores/$STORE_ID/follow-status", transport.paths.last())
        assertEquals(listOf("store-token"), transport.writeTokens)

        val unfollowed = repository.setFollowing(STORE_ID, follow = false) as StoreFollowResult.Success
        assertEquals(StoreFollowState(STORE_ID, false, 18), unfollowed.state)
        assertEquals(listOf("/api/v1/stores/$STORE_ID/follow"), transport.deletes)
        assertEquals("/api/v1/stores/$STORE_ID/follow-status", transport.paths.last())
        assertEquals("store-token", transport.tokens.last())
    }

    private class RecordingStoreTransport : StoreTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()
        val posts = mutableListOf<String>()
        val deletes = mutableListOf<String>()
        val writeTokens = mutableListOf<String>()
        val statusResponses = ArrayDeque<JSONObject>()

        override fun get(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            return when {
                path == "/api/v1/stores/$STORE_ID" -> JSONObject("""{"id":"$STORE_ID","name":"Ada Fabrics","handle":"adafabrics","bio":"Handmade textiles","logoUrl":"https://cdn.nantty.com/logo.png","followers":18,"productsCount":1,"rating":4.7,"ratingCount":5,"verified":true}""")
                path == "/api/v1/stores/$STORE_ID/follow-status" -> statusResponses.removeFirst()
                path.startsWith("/api/v1/stores/$STORE_ID/products") -> JSONObject("""{"data":[{"id":"product-1","name":"Indigo scarf","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.com/scarf.jpg","stock":4}],"nextCursor":"next-page"}""")
                else -> error("Unexpected store request: $path")
            }
        }

        override fun post(path: String, accessToken: String): JSONObject {
            posts += path
            writeTokens += accessToken
            return JSONObject()
        }

        override fun delete(path: String, accessToken: String) {
            deletes += path
            writeTokens += accessToken
        }
    }

    companion object {
        private const val STORE_ID = "0192a4f0-0000-7000-8000-000000000000"
        private fun session() = AccountSession("store-token", "refresh-token", AccountUser("user-1", "Ada", "ada", null, null, emptyList()))
    }
}
