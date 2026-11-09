package com.nantty.android.share

import org.junit.Assert.assertEquals
import org.junit.Test

class ProductShareActionsTest {
    @Test
    fun buildsCanonicalSluggedProductUrlFromConfiguredWebOrigin() {
        assertEquals(
            "https://web.nantty.com/p/cafe-and-wrap-product-123",
            productShareUrl("123", "Café & Wrap Product", "https://web.nantty.com/"),
        )
    }

    @Test
    fun rejectsUntrustedProductIdentifiersAndFallsBackFromUntrustedOrigin() {
        assertEquals("https://web.nantty.com/p/product-1", productShareUrl("1", "Product", "https://malicious.example"))
        assertEquals(true, runCatching { productShareUrl("../private", "Product") }.isFailure)
    }
}
