package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CreatorAffiliatesRepositoryTest {
    @Test
    fun catalogUsesCreatorEndpointAndParsesSellerControlledTerms() {
        var request: List<Any?>? = null
        val repository = repository { method, path, token, body ->
            request = listOf(method, path, token, body)
            CreatorAffiliatesResponse(200, """{"data":[${productJson()}],"nextCursor":"next-page"}""")
        }

        val page = repository.listCatalog("linen shirt", null) as CreatorAffiliatesResult.Success

        assertEquals("GET", request?.get(0))
        assertEquals("/api/v1/creators/me/affiliate-catalog?sort=commission&limit=24&q=linen+shirt", request?.get(1))
        assertEquals("creator-token", request?.get(2))
        assertEquals("next-page", page.value.nextCursor)
        assertEquals("approval_required", page.value.data.single().access)
        assertEquals("manual", page.value.data.single().programme.approval)
        assertEquals(7, page.value.data.single().programme.attributionWindowDays)
    }

    @Test
    fun createsAffiliateLinkAndRequestsSellerApprovalWithProductId() {
        val productId = "product-1"
        var capturedBody: JSONObject? = null
        val repository = repository { method, path, _, body ->
            capturedBody = body
            when (method to path) {
                "POST" to CreatorAffiliatesRepository.LINKS_PATH -> CreatorAffiliatesResponse(200, """{"data":{"id":"link-1","productId":"$productId","storeId":"store-1","path":"/p/$productId?aff=link-1","clicks":0}}""")
                "POST" to CreatorAffiliatesRepository.AFFILIATIONS_PATH -> CreatorAffiliatesResponse(201, """{"data":{"id":"aff-1","status":"requested"}}""")
                else -> error("Unexpected affiliate call: $method $path")
            }
        }

        val link = repository.createLink(productId) as CreatorAffiliatesResult.Success
        assertEquals("link-1", link.value.id)
        assertEquals(productId, link.value.productId)
        assertEquals(productId, capturedBody?.optString("productId"))

        val promotion = repository.requestToPromote(productId)
        assertTrue(promotion is CreatorAffiliatesResult.Success)
        assertEquals(productId, capturedBody?.optString("productId"))
    }

    @Test
    fun rejectsUnsupportedEarningStatusAndUnsafeProductBeforeTransport() {
        var called = false
        val repository = repository { _, _, _, _ ->
            called = true
            error("Invalid requests must not reach the transport")
        }

        assertTrue(repository.listEarnings("all", null) is CreatorAffiliatesResult.Failure)
        assertTrue(repository.createLink("../product") is CreatorAffiliatesResult.Failure)
        assertTrue(repository.requestToPromote("../product") is CreatorAffiliatesResult.Failure)
        assertFalse(called)
    }

    @Test
    fun unauthenticatedRequestsDoNotReachTransport() {
        var called = false
        val repository = CreatorAffiliatesRepository(sessionProvider = { null }, transport = CreatorAffiliatesTransport { _, _, _, _ ->
            called = true
            error("A signed-out creator must not make this request")
        })

        val result = repository.listPromotions() as CreatorAffiliatesResult.Failure

        assertTrue(result.authenticationRequired)
        assertFalse(called)
    }

    private fun repository(transport: CreatorAffiliatesTransport): CreatorAffiliatesRepository = CreatorAffiliatesRepository(
        sessionProvider = { AccountSession("creator-token", "refresh-token", AccountUser("creator-1", "Ari", "ari", null, null, emptyList())) },
        transport = transport,
    )

    private fun productJson() = """{"productId":"product-1","name":"Linen shirt","imageUrl":null,"price":{"amountMinor":250000,"currency":"NGN"},"stock":8,"store":{"id":"store-1","name":"Ada Fabrics","logoUrl":null},"commissionBasisPoints":1000,"commissionPercent":10,"estimatedCommission":{"amountMinor":25000,"currency":"NGN"},"access":"approval_required","link":null,"programme":{"defaultCommissionPercent":10,"attributionWindowDays":7,"approval":"manual","autoApproveFollowersAbove":null,"commissionPaidWhen":"order_completed"}}"""
}
