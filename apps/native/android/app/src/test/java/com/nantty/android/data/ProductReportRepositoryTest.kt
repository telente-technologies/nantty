package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProductReportRepositoryTest {
    @Test
    fun submitsPostReportUsingExistingAuthenticatedModerationContract() {
        val transport = RecordingProductReportTransport(JSONObject("""{"data":{"id":"report-post-1","status":"received"}}"""))
        val repository = ProductReportRepository("https://api.nantty.com", { "access-token" }, transport)

        val result = repository.submitPost(
            postId = "post-42",
            reason = ProductReportReason.HATE_OR_HARASSMENT,
            details = "  Targeted harassment  ",
            idempotencyKey = "post-report-key-1",
        )

        assertEquals(ProductReportResult.Success("report-post-1"), result)
        assertEquals("/api/v1/reports", transport.path)
        assertEquals("access-token", transport.accessToken)
        assertEquals("post-report-key-1", transport.idempotencyKey)
        assertEquals("post", transport.body!!.getString("targetType"))
        assertEquals("post-42", transport.body!!.getString("targetId"))
        assertEquals("hate_or_harassment", transport.body!!.getString("reason"))
        assertEquals("Targeted harassment", transport.body!!.getString("details"))
    }

    @Test
    fun submitsClipCommentReportUsingAuthenticatedModerationContract() {
        val transport = RecordingProductReportTransport(JSONObject("""{"data":{"id":"report-comment-1","status":"received"}}"""))
        val result = ProductReportRepository("https://api.nantty.com", { "access-token" }, transport)
            .submitComment("comment-42", ProductReportReason.HATE_OR_HARASSMENT, "Targeted abuse", "comment-report-key-1")

        assertEquals(ProductReportResult.Success("report-comment-1"), result)
        assertEquals("/api/v1/reports", transport.path)
        assertEquals("comment", transport.body!!.getString("targetType"))
        assertEquals("comment-42", transport.body!!.getString("targetId"))
        assertEquals("hate_or_harassment", transport.body!!.getString("reason"))
        assertEquals("Targeted abuse", transport.body!!.getString("details"))
    }

    @Test
    fun reportDetailsUseTheSharedCharacterLimitRatherThanUtf8ByteCount() {
        val transport = RecordingProductReportTransport(JSONObject("""{"data":{"id":"report-post-unicode","status":"received"}}"""))
        val details = "🔥".repeat(126) // 252 UTF-16 code units but more than 500 UTF-8 bytes.
        val result = ProductReportRepository("https://api.nantty.com", { "access-token" }, transport)
            .submitPost("post-43", ProductReportReason.SPAM, details, "post-report-key-2")

        assertEquals(ProductReportResult.Success("report-post-unicode"), result)
        assertEquals(details, transport.body!!.getString("details"))
    }

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
    fun submitsSpaceReportUsingExistingModerationTargetContract() {
        val transport = RecordingProductReportTransport(JSONObject("""{"data":{"id":"report-space-1","status":"received"}}"""))
        val repository = ProductReportRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "access-token" },
            transport = transport,
        )

        val result = repository.submitSpace(
            "00000000-0000-0000-0000-000000000001",
            ProductReportReason.SPAM,
            "Repeated promotional posts",
            "space-report-key-1",
        )

        assertEquals(ProductReportResult.Success("report-space-1"), result)
        assertEquals("space", transport.body!!.getString("targetType"))
        assertEquals("00000000-0000-0000-0000-000000000001", transport.body!!.getString("targetId"))
        assertEquals("spam", transport.body!!.getString("reason"))
        assertEquals("Repeated promotional posts", transport.body!!.getString("details"))
    }

    @Test
    fun submitsStoryAuthorReportAsUserAccountWithSelectedReasonAndDetails() {
        val transport = RecordingProductReportTransport(JSONObject("""{"data":{"id":"report-user-1","status":"received"}}"""))
        val repository = ProductReportRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "access-token" },
            transport = transport,
        )

        val result = repository.submitUser(
            authorId = "author-42",
            reason = ProductReportReason.HATE_OR_HARASSMENT,
            details = "  Repeated targeted harassment  ",
            idempotencyKey = "story-author-report-1",
        )

        assertEquals(ProductReportResult.Success("report-user-1"), result)
        assertEquals("/api/v1/reports", transport.path)
        assertEquals("access-token", transport.accessToken)
        assertEquals("story-author-report-1", transport.idempotencyKey)
        assertEquals("user", transport.body!!.getString("targetType"))
        assertEquals("author-42", transport.body!!.getString("targetId"))
        assertEquals("author-42", transport.body!!.getString("reportedUserId"))
        assertEquals("hate_or_harassment", transport.body!!.getString("reason"))
        assertEquals("Repeated targeted harassment", transport.body!!.getString("details"))
    }

    @Test
    fun invalidStoryAuthorIdsDoNotReachTransport() {
        val transport = RecordingProductReportTransport(JSONObject("""{"id":"report-user-1","status":"received"}"""))
        val repository = ProductReportRepository("https://api.nantty.com", { "access-token" }, transport)

        val result = repository.submitUser(
            authorId = "../private",
            reason = ProductReportReason.SPAM,
            details = "",
            idempotencyKey = "story-author-report-2",
        )

        assertEquals(ProductReportResult.Failure("This account link is invalid."), result)
        assertFalse(transport.called)
    }

    @Test
    fun storyAuthorReportPreservesDetailsLengthValidation() {
        val transport = RecordingProductReportTransport(JSONObject("""{"id":"report-user-1","status":"received"}"""))
        val repository = ProductReportRepository("https://api.nantty.com", { "access-token" }, transport)

        val result = repository.submitUser(
            authorId = "author-42",
            reason = ProductReportReason.SPAM,
            details = "x".repeat(501),
            idempotencyKey = "story-author-report-4",
        )

        assertEquals(ProductReportResult.Failure("Report details must be 500 characters or fewer."), result)
        assertFalse(transport.called)
    }

    @Test
    fun accountReportRequiresAuthenticationAndKeepsRetryKeyForRetryableFailures() {
        val signedOutTransport = RecordingProductReportTransport(JSONObject("""{"id":"report-user-1","status":"received"}"""))
        val signedOut = ProductReportRepository("https://api.nantty.com", { null }, signedOutTransport)
            .submitUser("author-42", ProductReportReason.SPAM, "", "story-author-report-3") as ProductReportResult.Failure
        assertTrue(signedOut.authenticationRequired)
        assertEquals("Sign in to report this account.", signedOut.message)
        assertFalse(signedOutTransport.called)

        val retryable = ProductReportRepository(
            "https://api.nantty.com",
            { "access-token" },
            FailingProductReportTransport(503),
        ).submitUser("author-42", ProductReportReason.SPAM, "", "story-author-report-3") as ProductReportResult.Failure
        assertTrue(retryable.retryable)
        assertFalse(retryable.rotateIdempotencyKeyOnRetry)

        val rateLimited = ProductReportRepository(
            "https://api.nantty.com",
            { "access-token" },
            FailingProductReportTransport(429),
        ).submitUser("author-42", ProductReportReason.SPAM, "", "story-author-report-3") as ProductReportResult.Failure
        assertTrue(rateLimited.retryable)
        assertTrue(rateLimited.rotateIdempotencyKeyOnRetry)
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

    @Test
    fun submitsLiveReportWithCapturedMomentContextAndServerReason() {
        val transport = RecordingProductReportTransport(JSONObject("""{"data":{"id":"report-live-1","status":"received"}}"""))
        val repository = ProductReportRepository("https://api.nantty.com", { "access-token" }, transport)
        val capturedAt = "2026-11-06T12:30:00Z"

        val result = repository.submitLive(
            liveId = "live-123",
            reason = LiveReportReason.CHILD_SAFETY,
            details = "  Please review the speaker  ",
            capturedAt = capturedAt,
            offsetSeconds = 87,
            idempotencyKey = "live-report-key-01",
        )

        assertEquals(ProductReportResult.Success("report-live-1"), result)
        assertEquals("live", transport.body!!.getString("targetType"))
        assertEquals("live-123", transport.body!!.getString("targetId"))
        assertEquals("child_safety", transport.body!!.getString("reason"))
        assertEquals("Please review the speaker", transport.body!!.getString("details"))
        assertEquals(87L, transport.body!!.getJSONObject("liveContext").getLong("offsetSeconds"))
        assertEquals("live:live-123@$capturedAt", transport.body!!.getJSONObject("liveContext").getString("frameRef"))
        assertEquals(capturedAt, transport.body!!.getJSONObject("liveContext").getString("capturedAt"))
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
