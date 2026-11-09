package com.nantty.android.data

import android.os.OperationCanceledException
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.CancellationException

class CreatorSampleMediaRepositoryTest {
    @Test
    fun storyImageUploadUsesTheExistingStoryMediaPurpose() {
        val transport = RecordingTransport()
        val result = repository(transport).upload(
            input(),
            temporaryDirectory(),
            purpose = NativeImageUploadPurpose.STORY,
        )

        assertTrue(result is CreatorSampleMediaResult.Success)
        assertEquals(NativeImageUploadPurpose.STORY.wireValue, transport.createBody?.getString("purpose"))
    }

    @Test
    fun productImageUploadUsesTheProductPurposeAndReturnsAReusableMediaId() {
        val transport = RecordingTransport()

        val result = repository(transport).upload(
            input(),
            temporaryDirectory(),
            purpose = NativeImageUploadPurpose.PRODUCT,
        )

        assertTrue(result is CreatorSampleMediaResult.Success)
        assertEquals("product", transport.createBody?.getString("purpose"))
        assertEquals(MEDIA_ID, (result as CreatorSampleMediaResult.Success).image.mediaId)
    }

    @Test
    fun storyVideoUploadPreservesVideoMimeAndUsesExistingStoryPurpose() {
        val transport = RecordingTransport()
        val directory = temporaryDirectory()
        val result = repository(transport, videoDuration = { 60_000L }).uploadStoryVideo(
            CreatorStoryVideoInput("story-video.mp4", "video/mp4") { ByteArrayInputStream(MP4_PREFIX) },
            directory,
        )

        assertEquals(CreatorSampleMediaResult.VideoSuccess(MEDIA_ID), result)
        assertEquals("video/mp4", transport.createBody?.getString("mimeType"))
        assertEquals("story-video.mp4", transport.createBody?.getString("fileName"))
        assertEquals(NativeImageUploadPurpose.STORY.wireValue, transport.createBody?.getString("purpose"))
        assertEquals(MP4_PREFIX.size, transport.putBytes?.size)
        assertTrue(directory.listFiles().orEmpty().isEmpty())
    }

    @Test
    fun rejectsUnsupportedStoryVideoAndOverlongDurationBeforeCreatingUpload() {
        val transport = RecordingTransport()
        val invalid = repository(transport).uploadStoryVideo(
            CreatorStoryVideoInput("story-video.mp4", "video/mp4") { ByteArrayInputStream("not-video".toByteArray()) },
            temporaryDirectory(),
        )
        val tooLong = repository(transport, videoDuration = { 60_001L }).uploadStoryVideo(
            CreatorStoryVideoInput("story-video.mp4", "video/mp4") { ByteArrayInputStream(MP4_PREFIX) },
            temporaryDirectory(),
        )

        assertTrue(invalid is CreatorSampleMediaResult.Failure)
        assertTrue(tooLong is CreatorSampleMediaResult.Failure)
        assertEquals(null, transport.createBody)
    }

    @Test
    fun matchesRnDisputeEvidenceUploadContractAndExtractsPreferredImageUrl() {
        val transport = RecordingTransport()
        val repository = repository(transport)

        val result = repository.upload(input(), temporaryDirectory())

        assertTrue("Creator sample upload failed: $result", result is CreatorSampleMediaResult.Success)
        val image = (result as CreatorSampleMediaResult.Success).image
        assertEquals(MEDIA_ID, image.mediaId)
        assertEquals("https://cdn.example.test/1200.webp", image.imageUrl)
        assertEquals(CreatorSampleMediaRepository.CREATE_UPLOAD_PATH, transport.createPath)
        assertEquals("creator-access", transport.apiTokens.first())
        assertEquals("creator-sample.jpg", transport.createBody?.getString("fileName"))
        assertEquals("image/jpeg", transport.createBody?.getString("mimeType"))
        assertEquals(CreatorSampleMediaRepository.RN_PICKER_PURPOSE, transport.createBody?.getString("purpose"))
        assertEquals(12, transport.createBody?.getInt("sizeBytes"))
        assertEquals("$UPLOADS_PATH/$UPLOAD_ID/chunks/0/url", transport.chunkUrlPath)
        assertEquals("https://objects.example.test/part?signature=fake", transport.putUrl)
        assertEquals(12, transport.putBytes?.size)
        assertEquals("$UPLOADS_PATH/$UPLOAD_ID/complete", transport.completePath)
        assertEquals("$MEDIA_PATH/$MEDIA_ID", transport.assetPath)
        assertEquals(listOf("processing", "ready"), transport.assetStatusRequests)
        assertEquals(null, transport.abortedPath)
    }

    @Test
    fun retriesAuthenticatedApiOnceAfter401UsingRefreshedSession() {
        val transport = RecordingTransport().apply { unauthorizedCreates = 1 }
        val result = repository(
            transport,
            refresh = { sampleSession("creator-refreshed") },
        ).upload(input(), temporaryDirectory())

        assertTrue(result is CreatorSampleMediaResult.Success)
        assertEquals(listOf("creator-access", "creator-refreshed"), transport.createTokens)
        assertTrue(transport.apiTokens.contains("creator-refreshed"))
    }

    @Test
    fun reportsExpiredAuthenticationWhen401CannotBeRefreshed() {
        val transport = RecordingTransport().apply { unauthorizedCreates = 2 }
        val result = repository(transport).upload(input(), temporaryDirectory())

        assertTrue(result is CreatorSampleMediaResult.Failure)
        assertTrue((result as CreatorSampleMediaResult.Failure).authenticationRequired)
        assertEquals(1, transport.createTokens.size)
        assertEquals(null, transport.putBytes)
    }

    @Test
    fun rejectsMalformedImageAndOversizedSourceBeforeCallingApi() {
        val transport = RecordingTransport()
        val malformed = repository(transport).upload(input(bytes = "not-an-image".toByteArray()), temporaryDirectory())
        assertTrue(malformed is CreatorSampleMediaResult.Failure)
        assertEquals(null, transport.createBody)

        val oversizedStream = InputStreamWithPrefixAndLength(PNG_PREFIX, CreatorSampleMediaRepository.MAX_SOURCE_IMAGE_BYTES + 1)
        val oversized = repository(transport).upload(
            CreatorSampleImageInput("large.png", "image/png") { oversizedStream },
            temporaryDirectory(),
        )
        assertTrue(oversized is CreatorSampleMediaResult.Failure)
        assertEquals(null, transport.createBody)
    }

    @Test
    fun rejectsPreparedImageThatExceedsPurposeLimit() {
        val directory = temporaryDirectory()
        val transport = RecordingTransport()
        val oversizedPreparer = CreatorSampleImagePreparer { _, cacheDir, _ ->
            val file = File.createTempFile("too-large-", ".jpg", cacheDir)
            file.outputStream().use { output ->
                val buffer = ByteArray(8192)
                var remaining = CreatorSampleMediaRepository.MAX_PREPARED_IMAGE_BYTES + 1
                while (remaining > 0) {
                    val amount = minOf(buffer.size.toLong(), remaining).toInt()
                    output.write(buffer, 0, amount)
                    remaining -= amount
                }
            }
            PreparedCreatorSampleImage(file, file.length(), 100, 100)
        }

        val result = repository(transport, preparer = oversizedPreparer).upload(input(), directory)

        assertTrue(result is CreatorSampleMediaResult.Failure)
        assertEquals(null, transport.createBody)
        assertTrue(directory.listFiles().orEmpty().isEmpty())
    }

    @Test
    fun refusesUnsafeSignedChunkUrlAndCleansUpOpenSession() {
        val transport = RecordingTransport().apply { signedUrl = "http://127.0.0.1/steal" }
        val result = repository(transport).upload(input(), temporaryDirectory())

        assertTrue(result is CreatorSampleMediaResult.Failure)
        assertTrue(transport.abortedPath == "$UPLOADS_PATH/$UPLOAD_ID")
        assertEquals(null, transport.putBytes)
    }

    @Test
    fun rejectsMalformedUploadPlanAndAbortsWhenSessionIdWasParsed() {
        val transport = RecordingTransport().apply { chunkCount = 2 }
        val result = repository(transport).upload(input(), temporaryDirectory())

        assertTrue(result is CreatorSampleMediaResult.Failure)
        assertEquals("$UPLOADS_PATH/$UPLOAD_ID", transport.abortedPath)
        assertEquals(null, transport.putBytes)
    }

    @Test
    fun surfacesUploadAndProcessingFailuresAndAbortsOnlyIncompleteUploads() {
        val uploadFailureTransport = RecordingTransport().apply { failChunkWith = CreatorSampleMediaHttpException(503, "storage unavailable") }
        val uploadFailure = repository(uploadFailureTransport).upload(input(), temporaryDirectory())
        assertTrue(uploadFailure is CreatorSampleMediaResult.Failure)
        assertEquals("$UPLOADS_PATH/$UPLOAD_ID", uploadFailureTransport.abortedPath)

        val processingFailureTransport = RecordingTransport().apply { assetStatuses.clear(); assetStatuses.add("failed") }
        val processingFailure = repository(processingFailureTransport).upload(input(), temporaryDirectory())
        assertTrue(processingFailure is CreatorSampleMediaResult.Failure)
        assertEquals(null, processingFailureTransport.abortedPath)
    }

    @Test
    fun cancellationDuringChunkTransferAbortsTheServerUploadAndRemovesTemporaryFiles() {
        val directory = temporaryDirectory()
        val cancellation = ToggleCancellation()
        val transport = RecordingTransport().apply { cancelDuringPut = cancellation }

        val result = repository(transport).upload(input(), directory, cancellation)

        assertEquals(CreatorSampleMediaResult.Cancelled, result)
        assertEquals("$UPLOADS_PATH/$UPLOAD_ID", transport.abortedPath)
        assertTrue(directory.listFiles().orEmpty().isEmpty())
    }

    @Test
    fun rejectsUnknownStatusesAndMissingImageVariants() {
        val unknown = RecordingTransport().apply { assetStatuses.clear(); assetStatuses.add("queued") }
        assertTrue(repository(unknown).upload(input(), temporaryDirectory()) is CreatorSampleMediaResult.Failure)

        val noImageUrl = RecordingTransport().apply { imageVariants = "[]" }
        assertTrue(repository(noImageUrl).upload(input(), temporaryDirectory()) is CreatorSampleMediaResult.Failure)
    }

    private fun repository(
        transport: RecordingTransport,
        refresh: () -> AccountSession? = { null },
        preparer: CreatorSampleImagePreparer = testPreparer(),
        videoDuration: (File) -> Long? = { 30_000L },
    ) = CreatorSampleMediaRepository(
        baseUrl = "https://api.example.test",
        sessionProvider = { sampleSession() },
        refreshSessionProvider = refresh,
        transport = transport,
        imagePreparer = preparer,
        storyVideoDurationMillis = videoDuration,
        processingTimeoutMillis = 50,
        processingPollIntervalMillis = 0,
    )

    private fun testPreparer() = CreatorSampleImagePreparer { _, cacheDir, cancellation ->
        cancellation.throwIfCancelled()
        val file = File.createTempFile("prepared-", ".jpg", cacheDir)
        file.writeBytes(ByteArray(12) { (it + 1).toByte() })
        PreparedCreatorSampleImage(file, file.length(), 1200, 900)
    }

    private fun input(bytes: ByteArray = PNG_PREFIX + ByteArray(12)) = CreatorSampleImageInput("folder/creator sample.png", "image/png") {
        ByteArrayInputStream(bytes)
    }

    private fun temporaryDirectory(): File = Files.createTempDirectory("creator-sample-test-").toFile()

    private class RecordingTransport : CreatorSampleMediaTransport {
        val apiTokens = mutableListOf<String>()
        val createTokens = mutableListOf<String>()
        val assetStatuses = ArrayDeque(listOf("processing", "ready"))
        val assetStatusRequests = mutableListOf<String>()
        var createPath: String? = null
        var createBody: JSONObject? = null
        var chunkUrlPath: String? = null
        var putUrl: String? = null
        var putBytes: ByteArray? = null
        var completePath: String? = null
        var assetPath: String? = null
        var abortedPath: String? = null
        var signedUrl = "https://objects.example.test/part?signature=fake"
        var failChunkWith: Exception? = null
        var unauthorizedCreates = 0
        var chunkCount = 1
        var imageVariants = """[{"url":"https://cdn.example.test/640.jpg","width":640,"format":"jpeg"},{"url":"https://cdn.example.test/1200.avif","width":1200,"format":"avif"},{"url":"https://cdn.example.test/1200.webp","width":1200,"format":"webp"}]"""
        var cancelDuringPut: ToggleCancellation? = null

        override fun createUploadSession(path: String, accessToken: String, body: JSONObject, cancellation: CreatorSampleCancellation): JSONObject {
            createPath = path
            createTokens += accessToken
            apiTokens += accessToken
            if (unauthorizedCreates > 0) {
                unauthorizedCreates--
                throw CreatorSampleMediaHttpException(401, "expired")
            }
            createBody = body
            return JSONObject(
                """{"uploadId":"$UPLOAD_ID","mediaId":"$MEDIA_ID","mode":"single","partSizeBytes":12,"partCount":$chunkCount,"chunkSizeBytes":12,"totalChunks":$chunkCount,"uploadedChunks":[],"uploadMode":"presigned","expiresAt":"2099-01-01T00:00:00Z"}""",
            )
        }

        override fun getChunkUploadUrl(path: String, accessToken: String, cancellation: CreatorSampleCancellation): JSONObject {
            chunkUrlPath = path
            apiTokens += accessToken
            return JSONObject("""{"url":"$signedUrl","method":"PUT","expectedBytes":12,"expiresAt":"2099-01-01T00:00:00Z"}""")
        }

        override fun putSignedChunk(url: String, bytes: ByteArray, cancellation: CreatorSampleCancellation) {
            failChunkWith?.let { throw it }
            putUrl = url
            putBytes = bytes
            cancelDuringPut?.cancel()
        }

        override fun completeUpload(path: String, accessToken: String, cancellation: CreatorSampleCancellation): JSONObject {
            completePath = path
            apiTokens += accessToken
            return JSONObject("""{"mediaId":"$MEDIA_ID","status":"processing"}""")
        }

        override fun getMediaAsset(path: String, accessToken: String, cancellation: CreatorSampleCancellation): JSONObject {
            assetPath = path
            apiTokens += accessToken
            val status = assetStatuses.removeFirstOrNull() ?: "ready"
            assetStatusRequests += status
            return JSONObject(
                """{"id":"$MEDIA_ID","status":"$status","type":"image","purpose":"dispute_evidence","width":1200,"height":900,"variants":$imageVariants}""",
            )
        }

        override fun abortUpload(path: String, accessToken: String, cancellation: CreatorSampleCancellation) {
            abortedPath = path
        }
    }

    private class ToggleCancellation : CreatorSampleCancellation {
        private var cancelled = false
        override fun throwIfCancelled() { if (cancelled) throw CancellationException("cancelled") }
        override fun onCancel(listener: () -> Unit): AutoCloseable = AutoCloseable { }
        fun cancel() { cancelled = true }
    }

    private class InputStreamWithPrefixAndLength(prefix: ByteArray, private val totalBytes: Long) : InputStream() {
        private val header = prefix + byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8)
        private var position = 0L
        override fun read(): Int {
            if (position >= totalBytes) return -1
            val value = if (position < header.size) header[position.toInt()].toInt() and 0xff else 0x41
            position++
            return value
        }
        override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
            if (position >= totalBytes) return -1
            val count = minOf(length.toLong(), totalBytes - position).toInt()
            repeat(count) { index -> bytes[offset + index] = read().toByte() }
            return count
        }
    }

    private companion object {
        const val UPLOAD_ID = "31a56c6d-0381-4cba-93df-0b4eef4a1001"
        const val MEDIA_ID = "31a56c6d-0381-4cba-93df-0b4eef4a1002"
        const val UPLOADS_PATH = "/api/v1/media/uploads"
        const val MEDIA_PATH = "/api/v1/media"
        val PNG_PREFIX = byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
        val MP4_PREFIX = byteArrayOf(0, 0, 0, 24, 'f'.code.toByte(), 't'.code.toByte(), 'y'.code.toByte(), 'p'.code.toByte(), 'i'.code.toByte(), 's'.code.toByte(), 'o'.code.toByte(), 'm'.code.toByte())
    }
}

private fun sampleSession(accessToken: String = "creator-access") = AccountSession(
    accessToken = accessToken,
    refreshToken = "creator-refresh",
    user = AccountUser("account-1", "Creator", "creator", null, null, emptyList()),
)
