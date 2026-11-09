package com.nantty.android.share

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AffiliateProductShareLinkTest {
    @Test
    fun createsBrandedTrackedProductUrlWithNormalizedName() {
        val url = affiliateProductShareUrl(
            productId = "product_1",
            productName = "Écru & Linen Shirt",
            affiliateLinkId = "link-1",
            webAppBaseUrl = "https://shop.example.test/",
        )

        assertEquals("https://shop.example.test/p/ecru-and-linen-shirt-product_1?aff=link-1", url)
    }

    @Test
    fun rejectsUntrustedOriginsAndMalformedIds() {
        assertTrue(runCatching { affiliateProductShareUrl("../product", "Product", "link-1") }.isFailure)
        assertTrue(runCatching { affiliateProductShareUrl("product-1", "Product", "link-1", "http://example.test") }.isFailure)
        assertTrue(runCatching { affiliateProductShareUrl("product-1", "Product", "link-1", "https://user@example.test") }.isFailure)
    }
}
