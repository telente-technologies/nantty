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
