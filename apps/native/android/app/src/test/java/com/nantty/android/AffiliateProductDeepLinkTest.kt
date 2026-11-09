package com.nantty.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AffiliateProductDeepLinkTest {
    private val productId = "8f14e45f-ea4f-4a5b-9d9d-8f14e45fea4f"

    @Test
    fun parsesTrustedProductAndAffiliateLinks() {
        val parsed = AffiliateProductDeepLinkParser.parse(
            "https://web.nantty.com/p/handwoven-bag-$productId?aff=creator_link_1",
            "web.nantty.com",
        )

        assertEquals(productId, parsed?.productId)
        assertEquals("creator_link_1", parsed?.affiliateLinkId)
    }

    @Test
    fun productLinkWithoutValidAffiliateQueryStillOpensWithoutAttribution() {
        listOf(
            "https://web.nantty.com/p/item-$productId",
            "https://web.nantty.com/p/item-$productId?aff=bad%20value",
            "https://web.nantty.com/p/item-$productId?aff=one&extra=value",
        ).forEach { url ->
            val parsed = AffiliateProductDeepLinkParser.parse(url, "web.nantty.com")
            assertEquals(productId, parsed?.productId)
            assertNull(parsed?.affiliateLinkId)
        }
    }

    @Test
    fun rejectsUntrustedOrAmbiguousProductUrls() {
        listOf(
            "http://web.nantty.com/p/item-$productId",
            "https://web.nantty.com.evil.test/p/item-$productId",
            "https://user@web.nantty.com/p/item-$productId",
            "https://web.nantty.com:443/p/item-$productId",
            "https://web.nantty.com/p/item-$productId/extra",
            "https://web.nantty.com/p/item%2F-$productId",
            "https://web.nantty.com/p/item-$productId#fragment",
        ).forEach { url ->
            assertNull(url, AffiliateProductDeepLinkParser.parse(url, "web.nantty.com"))
        }
    }
}
