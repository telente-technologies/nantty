package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class SharedContentRepositoryTest {
    @Test fun requiresAuthenticationAndRejectsInvalidReferenceBeforeNetwork() {
        var requests = 0
        val repository = SharedContentRepository("https://api.nantty.com") {
            requests++
            error("Unexpected request")
        }
        assertEquals(SharedContentResult.AuthenticationRequired, repository.resolve(SharedContentReference("post", "p1"), null))
        assertTrue(repository.resolve(SharedContentReference("unsupported", "p1"), "token") is SharedContentResult.Failure)
        assertTrue(repository.resolve(SharedContentReference("post", "bad\nid"), "token") is SharedContentResult.Failure)
        assertEquals(0, requests)
    }

    @Test fun requestsAuthenticatedSharedCardAndParsesAvailabilityFields() {
        lateinit var requestedUrl: URL
        lateinit var connection: SharedCardConnection
        val repository = SharedContentRepository("https://api.nantty.com/") { url ->
            requestedUrl = url
            SharedCardConnection(url, 200, """{"reference":{"kind":"product","id":"p 1"},"availability":"available","title":"Handmade bag","subtitle":"@maker","imageUrl":"https://cdn.nantty.com/bag.jpg","priceLabel":"₦12,000","stock":3,"isLive":false,"followsAuthor":true,"profileUserId":"user-1"}""").also { connection = it }
        }

        val result = repository.resolve(SharedContentReference("product", "p 1"), "access-token") as SharedContentResult.Success

        assertEquals("https://api.nantty.com/api/v1/chat/content?kind=product&id=p+1", requestedUrl.toString())
        assertEquals("GET", connection.requestMethod)
        assertEquals("Bearer access-token", connection.getRequestProperty("Authorization"))
        assertEquals("Handmade bag", result.card.title)
        assertEquals(3, result.card.stock)
        assertEquals("user-1", result.card.profileUserId)
    }

    @Test fun treatsUnauthorizedAsAuthenticationRequiredAndSanitizesUnsafeImages() {
        val unauthorized = SharedContentRepository("https://api.nantty.com") { url -> SharedCardConnection(url, 401, "{}") }
        assertEquals(SharedContentResult.AuthenticationRequired, unauthorized.resolve(SharedContentReference("profile", "ari"), "expired"))

        val unsafeImage = SharedContentRepository("https://api.nantty.com") { url ->
            SharedCardConnection(url, 200, """{"availability":"available","title":"Profile","imageUrl":"http://evil.test/photo.jpg"}""")
        }
        val card = (unsafeImage.resolve(SharedContentReference("profile", "ari"), "token") as SharedContentResult.Success).card
        assertEquals(null, card.imageUrl)
        assertFalse(card.isLive)
    }
}

private class SharedCardConnection(
    url: URL,
    private val status: Int,
    private val body: String,
) : HttpURLConnection(url) {
    private val headers = mutableMapOf<String, String>()
    override fun disconnect() = Unit
    override fun usingProxy(): Boolean = false
    override fun connect() = Unit
    override fun getResponseCode(): Int = status
    override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
    override fun getErrorStream() = ByteArrayInputStream(body.toByteArray())
    override fun setRequestProperty(key: String, value: String) { headers[key] = value }
    override fun getRequestProperty(key: String): String? = headers[key]
}
