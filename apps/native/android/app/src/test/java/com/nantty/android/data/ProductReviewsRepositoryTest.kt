package com.nantty.android.data

import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProductReviewsRepositoryTest {
    @Test
    fun buildsPublicReviewRoutesWithEncodedCursorAndBoundedPageSize() {
        assertEquals(
            "https://api.nantty.com/api/v1/products/prod_1/reviews?limit=20&cursor=cursor+%2F%2B%3D",
            buildProductReviewsUrl("https://api.nantty.com/", "prod_1", "cursor /+=", 20).toString(),
        )
        assertEquals(
            "https://api.nantty.com/api/v1/products/prod_1/rating-summary",
            buildProductRatingSummaryUrl("https://api.nantty.com", "prod_1").toString(),
        )
        assertTrue(runCatching { buildProductReviewsUrl("http://api.example.com", "prod_1", null, 20) }.isFailure)
        assertTrue(runCatching { buildProductReviewsUrl("https://user:pass@api.nantty.com", "prod_1", null, 20) }.isFailure)
        assertTrue(runCatching { buildProductReviewsUrl("https://api.nantty.com", "../secret", null, 20) }.isFailure)
        assertTrue(runCatching { buildProductReviewsUrl("https://api.nantty.com", "prod_1", null, 51) }.isFailure)
    }

    @Test
    fun parsesPublicPageIncludingNullableReplyAndRejectsMalformedRows() {
        val page = parseProductReviewPage(
            """{"average":4.5,"count":2,"nextCursor":"next/opaque","reviews":[{"id":"rev-1","author":{"id":"usr-1","name":"Ayo","username":"ayo","avatarUrl":"https://cdn.nantty.com/ayo.jpg"},"rating":5,"text":"Lovely","title":"Great","isVerifiedPurchase":true,"reply":{"body":"Thank you","authorName":"Shop","createdAt":"2026-01-01T00:00:00Z"},"createdAt":"2026-01-02T00:00:00Z"},{"id":"bad","author":{"id":"usr-2"},"rating":7,"text":"invalid"},{"id":"rev-2","author":{"id":"usr-3","name":"Bisi"},"rating":4,"text":"Nice","title":null,"isVerifiedPurchase":false,"reply":null,"createdAt":"2026-01-03T00:00:00Z"}]}""",
        )
        assertEquals(4.5, page.average, 0.0)
        assertEquals(2, page.count)
        assertEquals("next/opaque", page.nextCursor)
        assertEquals(2, page.reviews.size)
        assertEquals("https://cdn.nantty.com/ayo.jpg", page.reviews.first().author.avatarUrl)
        assertEquals("Thank you", page.reviews.first().reply?.body)
        assertEquals(null, page.reviews.last().title)
        assertEquals(null, page.reviews.last().reply)
    }

    @Test
    fun parsesRatingDistributionAndClampsInvalidCounts() {
        val summary = parseProductRatingSummary("""{"average":4.25,"count":4,"distribution":{"1":-1,"2":1,"3":0,"4":1,"5":2,"other":999}}""")
        assertEquals(4.25, summary.average, 0.0)
        assertEquals(4, summary.count)
        assertEquals(mapOf(1 to 0, 2 to 1, 3 to 0, 4 to 1, 5 to 2), summary.distribution)
        val invalid = parseProductRatingSummary("""{"average":99,"count":-4,"distribution":{}}""")
        assertEquals(0.0, invalid.average, 0.0)
        assertEquals(0, invalid.count)
    }

    @Test
    fun sendsOptionalBearerAndReturnsParsedPage() {
        lateinit var connection: ReviewsTestConnection
        val repository = ProductReviewsRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "test-token" },
            openConnection = { url ->
                connection = ReviewsTestConnection(url, 200, """{"average":4.0,"count":1,"reviews":[],"nextCursor":null}""")
                connection
            },
        )
        val result = repository.loadPage("prod-1") as ProductReviewsResult.Success
        assertEquals("https://api.nantty.com/api/v1/products/prod-1/reviews?limit=20", connection.url.toString())
        assertEquals("Bearer test-token", connection.getRequestProperty("Authorization"))
        assertEquals(1, result.value.count)
    }

    @Test
    fun invalidProductIdDoesNotMakeNetworkRequest() {
        var opened = false
        val repository = ProductReviewsRepository("https://api.nantty.com") {
            opened = true
            error("No request expected")
        }
        assertTrue(repository.loadPage("../private") is ProductReviewsResult.Failure)
        assertTrue(repository.loadRatingSummary("../private") is ProductRatingSummaryResult.Failure)
        assertFalse(opened)
    }

    @Test
    fun loadsViewerIdentityOnlyFromAuthenticatedMeContract() {
        lateinit var connection: ReviewsTestConnection
        val repository = ProductReviewsRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "viewer-token" },
            openConnection = { url ->
                connection = ReviewsTestConnection(url, 200, """{"data":{"id":"account-1"}}""")
                connection
            },
        )

        assertEquals("account-1", repository.loadViewerAccountId())
        assertEquals("https://api.nantty.com/api/v1/users/me", connection.url.toString())
        assertEquals("Bearer viewer-token", connection.getRequestProperty("Authorization"))
    }

    @Test
    fun deletesReviewUsingAuthenticatedOwnReviewContract() {
        lateinit var connection: ReviewsTestConnection
        val repository = ProductReviewsRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "viewer-token" },
            openConnection = { url ->
                connection = ReviewsTestConnection(url, 204, "")
                connection
            },
        )

        assertTrue(repository.deleteOwnReview("review-1") is ProductReviewDeleteResult.Success)
        assertEquals("https://api.nantty.com/api/v1/reviews/review-1", connection.url.toString())
        assertEquals("DELETE", connection.requestMethod)
        assertEquals("Bearer viewer-token", connection.getRequestProperty("Authorization"))
    }

    @Test
    fun guestOrInvalidReviewCannotTriggerDeleteRequest() {
        var opened = false
        val repository = ProductReviewsRepository("https://api.nantty.com", accessTokenProvider = { null }) { url ->
            opened = true
            ReviewsTestConnection(url, 204, "")
        }

        assertTrue(repository.deleteOwnReview("review-1") is ProductReviewDeleteResult.Failure)
        assertTrue(repository.deleteOwnReview("../other") is ProductReviewDeleteResult.Failure)
        assertEquals(null, repository.loadViewerAccountId())
        assertFalse(opened)
    }
}

private class ReviewsTestConnection(
    url: URL,
    private val status: Int,
    private val body: String,
) : HttpURLConnection(url) {
    private val requestHeaders = mutableMapOf<String, String>()
    override fun connect() = Unit
    override fun disconnect() = Unit
    override fun usingProxy() = false
    override fun getResponseCode() = status
    override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
    override fun getErrorStream() = ByteArrayInputStream(body.toByteArray())
    override fun setRequestProperty(key: String, value: String) { requestHeaders[key] = value }
    override fun getRequestProperty(key: String) = requestHeaders[key]
}
