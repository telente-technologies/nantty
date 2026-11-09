package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.HttpURLConnection

class ProductSaveRepositoryTest {
    @Test
    fun loadsAuthenticatedProductSaveStatusFromExactStatusContract() {
        val transport = RecordingProductSaveTransport(ProductSaveResponse(200, """{"data":{"isSaved":true}}"""))
        val repository = ProductSaveRepository("https://api.nantty.com", { "token" }, transport)

        assertEquals(ProductSaveStatusResult.Success(true), repository.loadStatus("product-1"))
        assertEquals(listOf("GET" to "/api/v1/saves/status?type=product&targetId=product-1"), transport.calls.map { it.method to it.path })
        assertEquals(listOf("token"), transport.calls.map { it.token })
    }

    @Test
    fun requiresAuthenticationAndRejectsUnsafeIdsBeforeTransport() {
        var called = false
        val transport = ProductSaveTransport { _, _, _, _ -> called = true; ProductSaveResponse(200, "{\"isSaved\":false}") }
        assertEquals(ProductSaveStatusResult.AuthenticationRequired, ProductSaveRepository("https://api.nantty.com", { null }, transport).loadStatus("product-1"))
        assertTrue(ProductSaveRepository("https://api.nantty.com", { "token" }, transport).setSaved("../private", true) is ProductSaveMutationResult.Failure)
        assertFalse(called)
    }

    @Test
    fun writesUseReactNativePostAndDeletePayloadShapes() {
        val transport = RecordingProductSaveTransport(ProductSaveResponse(HttpURLConnection.HTTP_NO_CONTENT, ""))
        val repository = ProductSaveRepository("https://api.nantty.com", { "token" }, transport)

        assertEquals(ProductSaveMutationResult.Success, repository.setSaved("product-1", true))
        assertEquals(ProductSaveMutationResult.Success, repository.setSaved("product-1", false))
        assertEquals("POST", transport.calls[0].method)
        assertEquals("/api/v1/saves", transport.calls[0].path)
        assertEquals("product", transport.calls[0].body?.getString("type"))
        assertEquals("product-1", transport.calls[0].body?.getString("targetId"))
        assertEquals("DELETE", transport.calls[1].method)
        assertEquals("/api/v1/saves?type=product&targetId=product-1", transport.calls[1].path)
        assertEquals(null, transport.calls[1].body)
    }

    @Test
    fun mapsAuthenticationAndServerFailuresWithoutPretendingTheWriteWorked() {
        val authTransport = RecordingProductSaveTransport(ProductSaveResponse(HttpURLConnection.HTTP_UNAUTHORIZED, ""))
        val failTransport = RecordingProductSaveTransport(ProductSaveResponse(HttpURLConnection.HTTP_INTERNAL_ERROR, ""))

        assertEquals(ProductSaveMutationResult.AuthenticationRequired, ProductSaveRepository("https://api.nantty.com", { "token" }, authTransport).setSaved("product-1", true))
        assertTrue(ProductSaveRepository("https://api.nantty.com", { "token" }, failTransport).setSaved("product-1", true) is ProductSaveMutationResult.Failure)
    }
}

private class RecordingProductSaveTransport(private val response: ProductSaveResponse) : ProductSaveTransport {
    data class Call(val method: String, val path: String, val token: String, val body: JSONObject?)
    val calls = mutableListOf<Call>()

    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): ProductSaveResponse {
        calls += Call(method, path, accessToken, body)
        return response
    }
}
