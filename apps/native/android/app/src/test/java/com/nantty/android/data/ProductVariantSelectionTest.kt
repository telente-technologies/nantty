package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProductVariantSelectionTest {
    private val variants = listOf(
        variant("small-blue-silk", "S", "Blue", mapOf("Material" to "Silk"), inStock = true),
        variant("medium-blue-silk", "M", "Blue", mapOf("Material" to "Silk"), inStock = true),
        variant("medium-red-cotton", "M", "Red", mapOf("Material" to "Cotton"), inStock = true),
        variant("large-red-cotton", "L", "Red", mapOf("Material" to "Cotton"), inStock = false),
    )

    @Test
    fun exposesIndependentSizeColorAndSellerOptionGroups() {
        val groups = productOptionGroups(detail())

        assertEquals(listOf("size", "color", "Material"), groups.map { it.key })
        assertEquals(listOf("S", "M", "L"), groups.first().choices.map { it.value })
        assertEquals(listOf("Silk", "Cotton"), groups.last().choices.map { it.value })
    }

    @Test
    fun resolvesOnlyTheVariantMatchingEverySelectedDimension() {
        val detail = detail()
        val groups = productOptionGroups(detail)

        assertNull(resolveProductVariant(detail, groups, mapOf("size" to "M", "color" to "Red")))
        assertEquals(
            "medium-red-cotton",
            resolveProductVariant(detail, groups, mapOf("size" to "M", "color" to "Red", "Material" to "Cotton"))?.id,
        )
        assertNull(resolveProductVariant(detail, groups, mapOf("size" to "M", "color" to "Red", "Material" to "Silk")))
    }

    @Test
    fun marksAnOptionAvailableOnlyWhenItHasAnInStockMatchingVariant() {
        assertTrue(productOptionHasStock(variants, emptyMap(), "size", "S"))
        assertTrue(!productOptionHasStock(variants, emptyMap(), "size", "L"))
        assertTrue(productOptionHasStock(variants, mapOf("size" to "M", "color" to "Red"), "Material", "Cotton"))
        assertTrue(!productOptionHasStock(variants, mapOf("size" to "M", "color" to "Red"), "Material", "Silk"))
    }

    @Test
    fun fallsBackToServerVariantIdsWhenOptionDimensionsAreMissing() {
        val legacy = detail().copy(
            sizes = emptyList(),
            colors = emptyList(),
            variants = listOf(variant("v1", "", "", emptyMap()), variant("v2", "", "", emptyMap())),
        )
        val groups = productOptionGroups(legacy)

        assertEquals(PRODUCT_VARIANT_ID_OPTION_KEY, groups.single().key)
        assertEquals("v2", resolveProductVariant(legacy, groups, mapOf(PRODUCT_VARIANT_ID_OPTION_KEY to "v2"))?.id)
    }

    private fun detail() = MartProductDetail(
        id = "product_1",
        title = "Dress",
        amountMinor = 1_000,
        currency = "NGN",
        stock = 4,
        images = emptyList(),
        rating = 0.0,
        promo = null,
        sizes = listOf("S", "M", "L"),
        colors = listOf("Blue", "Red"),
        shippingInfo = "",
        description = "",
        store = MartStoreSummary("store_1", "Store", null, 0.0, 0, 0),
        variants = variants,
    )

    private fun variant(
        id: String,
        size: String,
        color: String,
        optionValues: Map<String, String>,
        inStock: Boolean = true,
    ) = MartProductVariant(id, "$size / $color", 1_000, "NGN", inStock, size, color, optionValues)
}
