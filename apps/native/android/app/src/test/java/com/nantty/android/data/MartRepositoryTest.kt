package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class MartRepositoryTest {
    @Test
    fun buildsBoundedPublicCatalogRoutesAndEncodesFilters() {
        assertEquals(
            "https://api.nantty.com/api/v1/products?limit=20&categoryId=home_goods&cursor=opaque+cursor%2F%2B%3D%3D",
            buildMartProductsUrl("https://api.nantty.com/", "home_goods", "opaque cursor/+==").toString(),
        )
        assertEquals("https://api.nantty.com/api/v1/mart/home", buildMartHomeUrl("https://api.nantty.com").toString())
        assertTrue(runCatching { buildMartProductsUrl("http://api.example.com", null, null) }.isFailure)
        assertTrue(runCatching { buildMartProductsUrl("https://user:pass@api.nantty.com", null, null) }.isFailure)
        assertTrue(runCatching { buildMartHomeUrl("https://api.nantty.com/?token=secret") }.isFailure)
        assertTrue(runCatching { buildMartProductsUrl("http://10.0.2.2:8080", null, null) }.isSuccess)
    }

    @Test
    fun parsesCategoriesAndProductsAndRejectsUnsafeImages() {
        val repository = MartRepository("https://api.nantty.com") { url ->
            RecordingMartConnection(url, 200, """{"categories":[{"id":"cat-1","name":"Home","depth":0},{"id":"","name":"Invalid"}]}""")
        }
        val home = repository.loadHome() as MartResult.Home
        assertEquals(listOf(MartCategory("cat-1", "Home", 0)), home.value.categories)

        val productsRepository = MartRepository("https://api.nantty.com") { url ->
            RecordingMartConnection(url, 200, """{"data":[{"id":"prd-1","name":"Table lamp","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":"https://cdn.nantty.com/lamp.jpg","stock":4},{"id":"prd-2","name":"Unsafe","price":{"amountMinor":10,"currency":"NGN"},"imageUrl":"http://evil.example/image.jpg","stock":-3}],"nextCursor":"page-2"}""")
        }
        val page = productsRepository.loadProducts() as MartResult.Products
        assertEquals(2, page.value.products.size)
        assertEquals("https://cdn.nantty.com/lamp.jpg", page.value.products[0].imageUrl)
        assertEquals(null, page.value.products[1].imageUrl)
        assertEquals(0, page.value.products[1].stock)
        assertEquals("page-2", page.value.nextCursor)
    }

    @Test
    fun invalidCategoryIsRejectedBeforeNetworkRequest() {
        var opened = false
        val repository = MartRepository("https://api.nantty.com") {
            opened = true
            error("No request expected")
        }
        assertTrue(repository.loadProducts(categoryId = "../private") is MartResult.Failure)
        assertFalse(opened)
    }

    @Test
    fun loadsDirectProductDetailRouteWithOptionalBearerAndParsesPublicFields() {
        val body = """{"id":"prd-1","name":"Silk wrap","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":"javascript:alert(1)","stock":3,"images":["https://cdn.nantty.com/front.jpg","http://evil.example/back.jpg"],"title":"Silk wrap dress","rating":4.5,"promo":"New","sizes":["S","M"],"colors":["Blue"],"shippingInfo":"Calculated at checkout.","description":"Hand-finished silk.","store":{"id":"store-1","name":"Adire House","logoUrl":"https://cdn.nantty.com/store.jpg","rating":4.8,"ratingCount":12,"reviewCount":9},"related":[],"brand":null,"variants":[{"id":"var-1","title":"Blue / M","size":"M","color":"Blue","optionValues":{"Material":"Silk"},"price":{"amountMinor":125000,"currency":"NGN"},"inStock":true}]}"""
        lateinit var connection: RecordingMartConnection
        val repository = MartRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "synthetic-token" },
            openConnection = { url ->
                connection = RecordingMartConnection(url, 200, body)
                connection
            },
        )

        val result = repository.loadProductDetail("prd-1") as MartProductDetailResult.Success

        assertEquals("https://api.nantty.com/api/v1/products/prd-1", connection.url.toString())
        assertEquals("Bearer synthetic-token", connection.getRequestProperty("Authorization"))
        assertEquals(125000L, result.value.amountMinor)
        assertEquals("NGN", result.value.currency)
        assertEquals("Silk wrap dress", result.value.title)
        assertEquals(listOf("https://cdn.nantty.com/front.jpg"), result.value.images)
        assertEquals("Adire House", result.value.store.name)
        assertEquals(1, result.value.variants.size)
        assertEquals("M", result.value.variants.single().size)
        assertEquals("Blue", result.value.variants.single().color)
        assertEquals(mapOf("Material" to "Silk"), result.value.variants.single().optionValues)
    }

    @Test
    fun productDetailRejectsBadIdsResponseIdentityAndFractionalMinorUnits() {
        var opened = false
        val invalidIdRepository = MartRepository("https://api.nantty.com") {
            opened = true
            error("No request expected")
        }
        assertTrue(invalidIdRepository.loadProductDetail("../other") is MartProductDetailResult.Failure)
        assertFalse(opened)

        val mismatch = """{"id":"prd-2","title":"Wrong item","price":{"amountMinor":100,"currency":"NGN"},"store":{"id":"store-1","name":"Shop"}}"""
        val fractional = """{"id":"prd-1","title":"Invalid amount","price":{"amountMinor":12.5,"currency":"NGN"},"store":{"id":"store-1","name":"Shop"}}"""
        val repository = MartRepository("https://api.nantty.com")
        assertTrue(runCatching { repository.parseProductDetail(mismatch, "prd-1") }.isFailure)
        assertTrue(runCatching { repository.parseProductDetail(fractional, "prd-1") }.isFailure)
    }
}

private class RecordingMartConnection(
    url: URL,
    private val status: Int,
    private val responseBody: String,
) : HttpURLConnection(url) {
    override fun getResponseCode(): Int = status
    override fun getInputStream() = ByteArrayInputStream(responseBody.toByteArray())
    override fun getErrorStream() = ByteArrayInputStream(responseBody.toByteArray())
    override fun usingProxy(): Boolean = false
    override fun connect() = Unit
    override fun disconnect() = Unit
}
