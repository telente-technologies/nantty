package com.nantty.android.data

import android.content.ContentResolver
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.OperationCanceledException
import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.util.concurrent.CancellationException
import kotlin.math.ceil

/** Uploads bounded, prepared images through the configured media purpose and existing chunked-upload API. */
class CreatorSampleMediaRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: CreatorSampleMediaTransport = JdkCreatorSampleMediaTransport(baseUrl),
    private val imagePreparer: CreatorSampleImagePreparer = AndroidCreatorSampleImagePreparer,
    private val storyVideoDurationMillis: (File) -> Long? = ::readStoryVideoDurationMillis,
    private val processingTimeoutMillis: Long = MEDIA_PROCESSING_TIMEOUT_MS,
    private val processingPollIntervalMillis: Long = MEDIA_PROCESSING_POLL_INTERVAL_MS,
) {
    fun upload(
        uri: Uri,
        resolver: ContentResolver,
        cacheDir: File,
        cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation,
        purpose: NativeImageUploadPurpose = NativeImageUploadPurpose.DISPUTE_EVIDENCE,
    ): CreatorSampleMediaResult {
        val mimeType = resolver.getType(uri)?.lowercase()?.trim()
            ?: return CreatorSampleMediaResult.Failure("Couldn't read that image. Choose another photo.")
        val name = uri.lastPathSegment?.substringAfterLast('/')?.takeIf(String::isNotBlank) ?: "creator-sample"
        return upload(CreatorSampleImageInput(name, mimeType) {
            resolver.openInputStream(uri) ?: error("Couldn't read that image. Choose another photo.")
        }, cacheDir, cancellation, purpose)
    }

    fun upload(
        input: CreatorSampleImageInput,
        cacheDir: File,
        cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation,
        purpose: NativeImageUploadPurpose = NativeImageUploadPurpose.DISPUTE_EVIDENCE,
    ): CreatorSampleMediaResult {
        var sourceFile: File? = null
        var prepared: PreparedCreatorSampleImage? = null
        return try {
            cancellation.throwIfCancelled()
            val assetDescription = purpose.assetDescription
            require(trustedApiOrigin(baseUrl) != null) { "Configure a trusted HTTPS Nantty API URL to upload $assetDescription." }
            if (sessionProvider()?.accessToken.isNullOrBlank()) {
                return CreatorSampleMediaResult.Failure("Sign in to upload $assetDescription.", authenticationRequired = true)
            }
            require(input.mimeType.lowercase() in INPUT_IMAGE_MIME_TYPES) { "Choose a JPEG, PNG, WebP, HEIC or AVIF image." }
            require(cacheDir.exists() || cacheDir.mkdirs()) { "Creator sample upload storage is unavailable." }

            sourceFile = File.createTempFile("creator-sample-source-", ".bin", cacheDir)
            copyCreatorSampleBounded(input.openStream(), sourceFile!!, MAX_SOURCE_IMAGE_BYTES, cancellation)
            require(sourceFile!!.length() > 0L) { "The selected image is empty." }
            require(hasSupportedCreatorImageSignature(sourceFile!!)) { "The selected file is not a supported image." }
            prepared = imagePreparer.prepare(sourceFile!!, cacheDir, cancellation)
            require(prepared!!.file.isFile && prepared!!.sizeBytes == prepared!!.file.length() && prepared!!.sizeBytes in 1..MAX_PREPARED_IMAGE_BYTES) {
                "This image is too large to upload. Choose a smaller image."
            }
            require(prepared!!.width > 0 && prepared!!.height > 0) { "Nantty couldn't read the selected image." }
            cancellation.throwIfCancelled()

            val readyAsset = uploadPreparedMedia(
                file = prepared!!.file,
                fileName = creatorSampleSafeFileName(input.fileName),
                mimeType = "image/jpeg",
                sizeBytes = prepared!!.sizeBytes,
                cancellation = cancellation,
                purpose = purpose,
            )
            val completedMediaId = readyAsset.id
            val displayUrl = selectImageUrl(readyAsset)
            CreatorSampleMediaResult.Success(
                UploadedCreatorSampleImage(completedMediaId, displayUrl, readyAsset.width, readyAsset.height),
            )
        } catch (_: OperationCanceledException) {
            CreatorSampleMediaResult.Cancelled
        } catch (_: CancellationException) {
            CreatorSampleMediaResult.Cancelled
        } catch (error: Exception) {
            CreatorSampleMediaResult.Failure(
                error.message ?: "Couldn't upload this ${purpose.assetDescription}. Check your connection and try again.",
                authenticationRequired = error is CreatorSampleMediaHttpException && error.statusCode in setOf(401, 403),
            )
        } finally {
            sourceFile?.delete()
            prepared?.file?.delete()
        }
    }

    fun uploadStoryVideo(
        uri: Uri,
        resolver: ContentResolver,
        cacheDir: File,
        cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation,
    ): CreatorSampleMediaResult {
        val mimeType = resolver.getType(uri)?.lowercase()?.trim()
            ?: return CreatorSampleMediaResult.Failure("Couldn't read that video. Choose another clip.")
        val fileName = STORY_VIDEO_FILE_NAMES[mimeType]
            ?: return CreatorSampleMediaResult.Failure("Choose an MP4, QuickTime or WebM video.")
        return uploadStoryVideo(CreatorStoryVideoInput(fileName, mimeType) {
            resolver.openInputStream(uri) ?: error("Couldn't read that video. Choose another clip.")
        }, cacheDir, cancellation)
    }

    fun uploadStoryVideo(
        input: CreatorStoryVideoInput,
        cacheDir: File,
        cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation,
    ): CreatorSampleMediaResult {
        var sourceFile: File? = null
        return try {
            cancellation.throwIfCancelled()
            require(trustedApiOrigin(baseUrl) != null) { "Configure a trusted HTTPS Nantty API URL to upload a story video." }
            if (sessionProvider()?.accessToken.isNullOrBlank()) {
                return CreatorSampleMediaResult.Failure("Sign in to upload this story video.", authenticationRequired = true)
            }
            require(input.mimeType.lowercase() in STORY_VIDEO_MIME_TYPES) { "Choose an MP4, QuickTime or WebM video." }
            require(cacheDir.exists() || cacheDir.mkdirs()) { "Story video upload storage is unavailable." }
            sourceFile = File.createTempFile("story-video-source-", ".bin", cacheDir)
            copyCreatorSampleBounded(
                input.openStream(), sourceFile!!, MAX_STORY_VIDEO_BYTES, cancellation,
                tooLargeMessage = "This story video is larger than 100 MiB. Choose a smaller video.",
            )
            require(sourceFile!!.length() > 0L) { "The selected video is empty." }
            require(hasSupportedStoryVideoSignature(sourceFile!!, input.mimeType)) { "The selected file is not a supported video." }
            val durationMillis = storyVideoDurationMillis(sourceFile!!)
                ?: error("Nantty couldn't read this video's duration. Choose another video.")
            require(durationMillis in 1..MAX_STORY_VIDEO_DURATION_MILLIS) { "Story videos can be up to 60 seconds long." }
            cancellation.throwIfCancelled()
            val readyAsset = uploadPreparedMedia(
                file = sourceFile!!,
                fileName = input.fileName,
                mimeType = input.mimeType.lowercase(),
                sizeBytes = sourceFile!!.length(),
                cancellation = cancellation,
                purpose = NativeImageUploadPurpose.STORY,
            )
            CreatorSampleMediaResult.VideoSuccess(readyAsset.id)
        } catch (_: OperationCanceledException) {
            CreatorSampleMediaResult.Cancelled
        } catch (_: CancellationException) {
            CreatorSampleMediaResult.Cancelled
        } catch (error: Exception) {
            CreatorSampleMediaResult.Failure(
                error.message ?: "Couldn't upload this story video. Check your connection and try again.",
                authenticationRequired = error is CreatorSampleMediaHttpException && error.statusCode in setOf(401, 403),
            )
        } finally {
            sourceFile?.delete()
        }
    }

    private fun uploadPreparedMedia(
        file: File,
        fileName: String,
        mimeType: String,
        sizeBytes: Long,
        cancellation: CreatorSampleCancellation,
        purpose: NativeImageUploadPurpose,
    ): ParsedAsset {
        var uploadId: String? = null
        var accessToken: String? = null
        var completed = false
        try {
            val created = apiCall(cancellation, setToken = { accessToken = it }) { token ->
                transport.createUploadSession(
                    CREATE_UPLOAD_PATH,
                    token,
                    JSONObject().put("fileName", fileName).put("mimeType", mimeType)
                        .put("sizeBytes", sizeBytes).put("purpose", purpose.wireValue),
                    cancellation,
                )
            }
            val plan = parseSession(created)
            uploadId = plan.uploadId
            val expectedPartCount = ceil(sizeBytes.toDouble() / plan.chunkSizeBytes).toInt()
            require(plan.totalChunks == expectedPartCount && plan.totalChunks in 1..MAX_CHUNKS) { "Nantty returned an invalid upload plan." }
            require(plan.chunkSizeBytes in 1..MAX_CHUNK_BYTES) { "Nantty returned an unsupported upload chunk size." }
            for (chunkIndex in 0 until plan.totalChunks) {
                cancellation.throwIfCancelled()
                val offset = chunkIndex.toLong() * plan.chunkSizeBytes
                val expectedBytes = minOf(plan.chunkSizeBytes.toLong(), sizeBytes - offset).toInt()
                val targetPayload = apiCall(cancellation, setToken = { accessToken = it }) { token ->
                    transport.getChunkUploadUrl("$UPLOADS_PATH/${plan.uploadId}/chunks/$chunkIndex/url", token, cancellation)
                }
                val target = parseChunkTarget(targetPayload)
                require(target.expectedBytes == expectedBytes) { "Nantty returned an invalid upload chunk size." }
                require(isSafeCreatorSampleSignedObjectUrl(target.url)) { "Nantty returned an unsafe signed upload URL." }
                require(target.expiresAtMillis > System.currentTimeMillis()) { "Nantty returned an expired signed upload URL. Try again." }
                transport.putSignedChunk(target.url, readCreatorSampleChunk(file, offset, expectedBytes, cancellation), cancellation)
            }
            cancellation.throwIfCancelled()
            val completion = apiCall(cancellation, setToken = { accessToken = it }) { token ->
                transport.completeUpload("$UPLOADS_PATH/${plan.uploadId}/complete", token, cancellation)
            }
            val completedMediaId = parseCompletedMediaId(completion)
            require(completedMediaId == plan.mediaId) { "Nantty completed a different media upload." }
            completed = true
            return pollUntilReady(completedMediaId, cancellation) { accessToken = it }
        } finally {
            if (!completed && uploadId != null && accessToken != null) {
                runCatching { transport.abortUpload("$UPLOADS_PATH/$uploadId", accessToken!!, NoopCreatorSampleCancellation) }
            }
        }
    }

    private fun pollUntilReady(
        mediaId: String,
        cancellation: CreatorSampleCancellation,
        onToken: (String) -> Unit,
    ): ParsedAsset {
        val deadline = System.currentTimeMillis() + processingTimeoutMillis.coerceAtLeast(0L)
        do {
            cancellation.throwIfCancelled()
            val asset = apiCall(cancellation, setToken = onToken) { currentToken ->
                transport.getMediaAsset("$MEDIA_PATH/$mediaId", currentToken, cancellation)
            }.let(::parseMediaAsset)
            when (asset.status) {
                "ready" -> return asset
                "failed" -> error("Nantty couldn't process this media. Choose another file and try again.")
                "processing" -> Unit
                else -> error("Nantty returned an unknown media processing status.")
            }
            if (System.currentTimeMillis() >= deadline) error("Image processing is taking longer than expected. Please try again.")
            creatorSampleCancellableDelay(processingPollIntervalMillis, cancellation)
        } while (true)
    }

    private fun <T> apiCall(
        cancellation: CreatorSampleCancellation,
        setToken: ((String) -> Unit)? = null,
        request: (String) -> T,
    ): T {
        var token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: error("Sign in to continue this media upload.")
        setToken?.invoke(token)
        return try {
            cancellation.throwIfCancelled()
            request(token)
        } catch (error: CreatorSampleMediaHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw CreatorSampleMediaHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
            token = refreshed
            setToken?.invoke(token)
            cancellation.throwIfCancelled()
            request(token)
        }
    }

    private data class UploadPlan(val uploadId: String, val mediaId: String, val chunkSizeBytes: Int, val totalChunks: Int)
    private data class ChunkTarget(val url: String, val expectedBytes: Int, val expiresAtMillis: Long)
    private data class ParsedAsset(
        val id: String,
        val status: String,
        val width: Int,
        val height: Int,
        val variants: List<CreatorSampleMediaVariant>,
        val posterUrl: String?,
    )

    private fun parseSession(payload: JSONObject): UploadPlan {
        val body = payload.dataObject()
        val uploadId = body.requiredUuid("uploadId")
        val mediaId = body.requiredUuid("mediaId")
        val chunkSize = body.optLong("partSizeBytes", body.optLong("chunkSizeBytes", -1L))
        val chunks = body.optInt("partCount", body.optInt("totalChunks", -1))
        require(chunkSize in 1..MAX_CHUNK_BYTES.toLong() && chunks in 1..MAX_CHUNKS) { "Nantty returned an invalid upload plan." }
        return UploadPlan(uploadId, mediaId, chunkSize.toInt(), chunks)
    }

    private fun parseChunkTarget(payload: JSONObject): ChunkTarget {
        val body = payload.dataObject()
        require(body.optString("method") == "PUT") { "Nantty returned an unsupported upload method." }
        val url = body.optString("url").takeIf(String::isNotBlank) ?: error("Nantty returned an invalid signed upload URL.")
        val expectedBytes = body.optLong("expectedBytes", -1L)
        require(expectedBytes in 1..MAX_CHUNK_BYTES.toLong()) { "Nantty returned an invalid chunk size." }
        val expiresAt = runCatching { java.time.Instant.parse(body.optString("expiresAt")).toEpochMilli() }.getOrNull()
            ?: error("Nantty returned an invalid signed URL expiry.")
        return ChunkTarget(url, expectedBytes.toInt(), expiresAt)
    }

    private fun parseCompletedMediaId(payload: JSONObject): String {
        val body = payload.dataObject()
        require(body.optString("status") == "processing") { "Nantty did not accept the completed upload for processing." }
        return body.requiredUuid("mediaId")
    }

    private fun parseMediaAsset(payload: JSONObject): ParsedAsset {
        val body = payload.dataObject()
        val variants = body.optJSONArray("variants") ?: JSONArray()
        val parsedVariants = buildList {
            for (index in 0 until variants.length()) {
                val row = variants.optJSONObject(index) ?: continue
                val url = row.optString("url")
                val format = row.optString("format").lowercase()
                val width = row.optInt("width", 0)
                if (url.isNotBlank() && width > 0) add(CreatorSampleMediaVariant(url, width, format))
            }
        }
        return ParsedAsset(
            id = body.requiredUuid("id"),
            status = body.optString("status"),
            width = body.optInt("width", 0),
            height = body.optInt("height", 0),
            variants = parsedVariants,
            posterUrl = body.optString("posterUrl").takeIf(String::isNotBlank),
        )
    }

    private fun selectImageUrl(asset: ParsedAsset): String {
        val formatRank = listOf("jpeg", "webp", "avif")
        return asset.variants
            .filter { it.format in formatRank && isSafeCreatorSampleMediaUrl(it.url) }
            .sortedWith(compareByDescending<CreatorSampleMediaVariant> { it.width }.thenBy { formatRank.indexOf(it.format) })
            .firstOrNull()?.url
            ?: asset.posterUrl?.takeIf(::isSafeCreatorSampleMediaUrl)
            ?: error("Upload finished but no safe image URL is available yet. Please try again.")
    }

    companion object {
        const val CREATE_UPLOAD_PATH = "/api/v1/media/uploads"
        const val UPLOADS_PATH = "/api/v1/media/uploads"
        const val MEDIA_PATH = "/api/v1/media"
        const val RN_PICKER_PURPOSE = "dispute_evidence"
        const val MAX_SOURCE_IMAGE_BYTES = 40 * 1024 * 1024L
        const val MAX_STORY_VIDEO_BYTES = 100 * 1024 * 1024L
        const val MAX_STORY_VIDEO_DURATION_MILLIS = 60_000L
        const val MAX_STORY_VIDEO_DURATION_SECONDS = (MAX_STORY_VIDEO_DURATION_MILLIS / 1_000L).toInt()
        const val MAX_PREPARED_IMAGE_BYTES = 10 * 1024 * 1024L
        const val MAX_CHUNK_BYTES = 8 * 1024 * 1024
        const val MAX_CHUNKS = 16
        const val MAX_IMAGE_EDGE = 4096
        const val MAX_INPUT_PIXELS = 100_000_000L
        private const val MEDIA_PROCESSING_TIMEOUT_MS = 5 * 60_000L
        private const val MEDIA_PROCESSING_POLL_INTERVAL_MS = 1_000L
        private val INPUT_IMAGE_MIME_TYPES = setOf("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif")
        private val STORY_VIDEO_MIME_TYPES = setOf("video/mp4", "video/quicktime", "video/webm")
        private val STORY_VIDEO_FILE_NAMES = mapOf(
            "video/mp4" to "story-video.mp4",
            "video/quicktime" to "story-video.mov",
            "video/webm" to "story-video.webm",
        )
    }
}

private val NativeImageUploadPurpose.assetDescription: String
    get() = when (this) {
        NativeImageUploadPurpose.DISPUTE_EVIDENCE -> "evidence image"
        NativeImageUploadPurpose.STORY -> "story media"
    }
