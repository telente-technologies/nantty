package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProductReportRepositoryTest {
    @Test
    fun submitsProductReportUsingSocialApiContractAndStableRetryKey() {
        val transport = RecordingProductReportTransport(JSONObject("""{"data":{"id":"report-1","status":"received","priority":"normal"}}"""))
        val repository = ProductReportRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "access-token" },
            transport = transport,
        )

        val result = repository.submit("prd-1", ProductReportReason.COUNTERFEIT_PRODUCT, "retry-key-0001")

        assertEquals(ProductReportResult.Success("report-1"), result)
        assertEquals("/api/v1/reports", transport.path)
        assertEquals("access-token", transport.accessToken)
        assertEquals("retry-key-0001", transport.idempotencyKey)
        assertEquals("product", transport.body!!.getString("targetType"))
        assertEquals("prd-1", transport.body!!.getString("targetId"))
        assertEquals("counterfeit_product", transport.body!!.getString("reason"))
        assertEquals("", transport.body!!.getString("details"))
    }

    @Test
    fun signedOutAndInvalidRequestsDoNotReachTransport() {
        val transport = RecordingProductReportTransport(JSONObject("""{"id":"report-1","status":"received"}"""))
        val repository = ProductReportRepository("https://api.nantty.com", { null }, transport)

        val signedOut = repository.submit("prd-1", ProductReportReason.SPAM) as ProductReportResult.Failure
        assertTrue(signedOut.authenticationRequired)
        assertEquals(ProductReportResult.Failure("This product link is invalid."), repository.submit("../private", ProductReportReason.SPAM))
        assertEquals(ProductReportResult.Failure("Could not safely prepare this report. Please try again."), repository.submit("prd-1", ProductReportReason.SPAM, "bad key"))
        assertFalse(transport.called)
    }

    @Test
    fun expiredSessionAndRateLimitRemainActionable() {
        val session = AccountSession("access-token", "refresh-token", AccountUser("u1", "Ada", "ada", null, null, emptyList()))
        val expired = ProductReportRepository("https://api.nantty.com", { session.accessToken }, FailingProductReportTransport(401))
        val rateLimited = ProductReportRepository("https://api.nantty.com", { session.accessToken }, FailingProductReportTransport(429))

        val expiredResult = expired.submit("prd-1", ProductReportReason.SPAM) as ProductReportResult.Failure
        assertTrue(expiredResult.authenticationRequired)
        assertEquals("You've sent too many reports. Try again later.", (rateLimited.submit("prd-1", ProductReportReason.SPAM) as ProductReportResult.Failure).message)
    }

    private class RecordingProductReportTransport(private val response: JSONObject) : ProductReportTransport {
        var called = false
        var path: String? = null
        var accessToken: String? = null
        var idempotencyKey: String? = null
        var body: JSONObject? = null

        override fun submit(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
            called = true
            this.path = path
            this.accessToken = accessToken
            this.idempotencyKey = idempotencyKey
            this.body = body
            return response
        }
    }

    private class FailingProductReportTransport(private val status: Int) : ProductReportTransport {
        override fun submit(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject =
            throw ProductReportHttpException(status)
    }
}
