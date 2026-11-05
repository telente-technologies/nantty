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
        val payload = JSONObject("""{"id":"$STORE_ID","name":"Store","logoUrl":"javascript:alert(1)","bannerUrl":"https://cdn.nantty.com/banner.jpg","followers":4,"productsCount":-2,"rating":99,"ratingCount":-1,"verified":true,"ownerUserId":"private-owner-id"}""")

        val store = repository.parseStore(payload, STORE_ID)

        assertEquals(null, store.logoUrl)
        assertEquals("https://cdn.nantty.com/banner.jpg", store.bannerUrl)
        assertEquals(4, store.followers)
        assertEquals(0, store.productsCount)
        assertEquals(5.0, store.rating, 0.0)
        assertEquals(0, store.ratingCount)
        assertFalse(store.handle.isNotBlank())
        assertTrue(runCatching { repository.parseStore(payload, "another-store") }.isFailure)
    }

    @Test
    fun parserRejectsUnavailableOrMalformedFollowerProjectionInsteadOfInventingZero() {
        val repository = StoreRepository("https://api.nantty.com", { null }, RecordingStoreTransport())

        listOf(
            """{"id":"$STORE_ID","name":"Store"}""",
            """{"id":"$STORE_ID","name":"Store","followers":null}""",
            """{"id":"$STORE_ID","name":"Store","followers":-1}""",
        ).forEach { payload ->
            assertTrue(runCatching { repository.parseStore(JSONObject(payload), STORE_ID) }.isFailure)
        }
    }

    @Test
    fun storeFollowRequiresSessionAndUsesSocialFollowRoutesForAuthoritativeState() {
        val guestTransport = RecordingStoreTransport()
        val guestRepository = StoreRepository("https://api.nantty.com", { null }, guestTransport)
        val guestResult = guestRepository.setFollowing(STORE_ID, follow = true) as StoreFollowResult.Failure
        assertTrue(guestResult.authenticationRequired)
        assertTrue(guestTransport.posts.isEmpty())

        val transport = RecordingStoreTransport()
        val repository = StoreRepository("https://api.nantty.com", ::session, transport)
        val followed = repository.setFollowing(STORE_ID, follow = true) as StoreFollowResult.Success
        assertEquals(StoreFollowState(STORE_ID, true, 19), followed.state)
        assertEquals(listOf("/api/v1/stores/$STORE_ID/follow"), transport.posts)
        assertFalse(transport.paths.any { it.endsWith("/follow-status") })
        assertEquals(listOf("store-token"), transport.writeTokens)

        val unfollowed = repository.setFollowing(STORE_ID, follow = false) as StoreFollowResult.Success
        assertEquals(StoreFollowState(STORE_ID, false, 18), unfollowed.state)
        assertEquals(listOf("/api/v1/stores/$STORE_ID/follow"), transport.deletes)
        assertFalse(transport.paths.any { it.endsWith("/follow-status") })
    }

    @Test
    fun forbiddenStoreFollowResponseRequiresAuthentication() {
        val repository = StoreRepository(
            "https://api.nantty.com",
            ::session,
            object : StoreTransport {
                override fun get(path: String, accessToken: String?): JSONObject = error("Unexpected read")
                override fun post(path: String, accessToken: String): JSONObject = throw StoreTransportException(403, "Forbidden")
            },
        )

        val result = repository.setFollowing(STORE_ID, follow = true) as StoreFollowResult.Failure

        assertTrue("Expected 403 to be treated as authentication-required: $result", result.authenticationRequired)
    }

    @Test
    fun storeFollowRefreshesExpiredTokenOnceAndUsesCanonicalRetryResponse() {
        val tokens = mutableListOf<String>()
        var refreshCount = 0
        val transport = object : StoreTransport {
            override fun get(path: String, accessToken: String?): JSONObject = error("Unexpected read")
            override fun post(path: String, accessToken: String): JSONObject {
                tokens += accessToken
                if (tokens.size == 1) throw StoreTransportException(401, "Expired")
                return JSONObject("""{"storeId":"$STORE_ID","isFollowing":true,"followers":19}""")
            }
        }
        val refreshed = session().copy(accessToken = "refreshed-token")
        val repository = StoreRepository(
            "https://api.nantty.com",
            ::session,
            transport,
            refreshSessionProvider = { refreshCount += 1; refreshed },
        )

        val result = repository.setFollowing(STORE_ID, follow = true) as StoreFollowResult.Success

        assertEquals(StoreFollowState(STORE_ID, true, 19), result.state)
        assertEquals(listOf("store-token", "refreshed-token"), tokens)
        assertEquals(1, refreshCount)
    }

    @Test
    fun storeFollowStopsAfterOneRefreshAndTreatsRevokedSessionAsAuthenticationRequired() {
        var requestCount = 0
        var refreshCount = 0
        val transport = object : StoreTransport {
            override fun get(path: String, accessToken: String?): JSONObject = error("Unexpected read")
            override fun post(path: String, accessToken: String): JSONObject {
                requestCount += 1
                throw StoreTransportException(401, "Expired")
            }
        }
        val repository = StoreRepository(
            "https://api.nantty.com",
            ::session,
            transport,
            refreshSessionProvider = { refreshCount += 1; null },
        )

        val result = repository.setFollowing(STORE_ID, follow = true) as StoreFollowResult.Failure

        assertTrue(result.authenticationRequired)
        assertEquals(1, requestCount)
        assertEquals(1, refreshCount)
    }

    @Test
    fun rejectsMalformedFollowerCountFromUnfollowResponseInsteadOfReplacingItWithZero() {
        val transport = RecordingStoreTransport().apply {
            deleteResponse = JSONObject("""{"storeId":"$STORE_ID","isFollowing":false}""")
        }

        val result = StoreRepository("https://api.nantty.com", ::session, transport).setFollowing(STORE_ID, follow = false)

        assertTrue(result is StoreFollowResult.Failure)
    }

    private class RecordingStoreTransport : StoreTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()
        val posts = mutableListOf<String>()
        val deletes = mutableListOf<String>()
        val writeTokens = mutableListOf<String>()
        var deleteResponse: JSONObject? = null

        override fun get(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            return when {
                path == "/api/v1/stores/$STORE_ID" -> JSONObject("""{"id":"$STORE_ID","name":"Ada Fabrics","handle":"adafabrics","bio":"Handmade textiles","logoUrl":"https://cdn.nantty.com/logo.png","followers":18,"productsCount":1,"rating":4.7,"ratingCount":5,"verified":true}""")
                path == "/api/v1/stores/$STORE_ID/follow-status" -> JSONObject("""{"storeId":"$STORE_ID","isFollowing":false,"followers":18}""")
                path.startsWith("/api/v1/stores/$STORE_ID/products") -> JSONObject("""{"data":[{"id":"product-1","name":"Indigo scarf","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.com/scarf.jpg","stock":4}],"nextCursor":"next-page"}""")
                else -> error("Unexpected store request: $path")
            }
        }

        override fun post(path: String, accessToken: String): JSONObject {
            posts += path
            writeTokens += accessToken
            return JSONObject("""{"storeId":"$STORE_ID","isFollowing":true,"followers":19}""")
        }

        override fun delete(path: String, accessToken: String): JSONObject {
            deletes += path
            writeTokens += accessToken
            return deleteResponse ?: JSONObject("""{"storeId":"$STORE_ID","isFollowing":false,"followers":18}""")
        }
    }

    companion object {
        private const val STORE_ID = "0192a4f0-0000-7000-8000-000000000000"
        private fun session() = AccountSession("store-token", "refresh-token", AccountUser("user-1", "Ada", "ada", null, null, emptyList()))
    }
}
