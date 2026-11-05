package com.nantty.android.data

import android.content.ContentResolver
import android.net.Uri
import android.os.OperationCanceledException
import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.util.concurrent.CancellationException
import kotlin.math.ceil

/** Uploads sample images through the same private dispute-evidence purpose used by RN PhotoEvidencePicker. */
class CreatorSampleMediaRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: CreatorSampleMediaTransport = JdkCreatorSampleMediaTransport(baseUrl),
    private val imagePreparer: CreatorSampleImagePreparer = AndroidCreatorSampleImagePreparer,
    private val processingTimeoutMillis: Long = MEDIA_PROCESSING_TIMEOUT_MS,
    private val processingPollIntervalMillis: Long = MEDIA_PROCESSING_POLL_INTERVAL_MS,
) {
    fun upload(
        uri: Uri,
        resolver: ContentResolver,
        cacheDir: File,
        cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation,
    ): CreatorSampleMediaResult {
        val mimeType = resolver.getType(uri)?.lowercase()?.trim()
            ?: return CreatorSampleMediaResult.Failure("Couldn't read that image. Choose another photo.")
        val name = uri.lastPathSegment?.substringAfterLast('/')?.takeIf(String::isNotBlank) ?: "creator-sample"
        return upload(CreatorSampleImageInput(name, mimeType) {
            resolver.openInputStream(uri) ?: error("Couldn't read that image. Choose another photo.")
        }, cacheDir, cancellation)
    }

    fun upload(
        input: CreatorSampleImageInput,
        cacheDir: File,
        cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation,
    ): CreatorSampleMediaResult {
        var sourceFile: File? = null
        var prepared: PreparedCreatorSampleImage? = null
        var uploadId: String? = null
        var accessToken: String? = null
        var completed = false
        return try {
            cancellation.throwIfCancelled()
            require(trustedApiOrigin(baseUrl) != null) { "Configure a trusted HTTPS Nantty API URL to upload creator samples." }
            val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
                ?: return CreatorSampleMediaResult.Failure("Sign in to upload creator samples.", authenticationRequired = true)
            accessToken = session.accessToken
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

            val created = apiCall(cancellation, setToken = { accessToken = it }) { token ->
                transport.createUploadSession(
                    CREATE_UPLOAD_PATH,
                    token,
                    JSONObject()
                        .put("fileName", creatorSampleSafeFileName(input.fileName))
                        .put("mimeType", "image/jpeg")
                        .put("sizeBytes", prepared!!.sizeBytes)
                        .put("purpose", RN_PICKER_PURPOSE),
                    cancellation,
                )
            }
            val plan = parseSession(created)
            uploadId = plan.uploadId
            val expectedPartCount = ceil(prepared!!.sizeBytes.toDouble() / plan.chunkSizeBytes).toInt()
            require(plan.totalChunks == expectedPartCount && plan.totalChunks in 1..MAX_CHUNKS) { "Nantty returned an invalid upload plan." }
            require(plan.chunkSizeBytes in 1..MAX_CHUNK_BYTES) { "Nantty returned an unsupported chunk size." }

            for (chunkIndex in 0 until plan.totalChunks) {
                cancellation.throwIfCancelled()
                val offset = chunkIndex.toLong() * plan.chunkSizeBytes
                val expectedBytes = minOf(plan.chunkSizeBytes.toLong(), prepared!!.sizeBytes - offset).toInt()
                val targetPayload = apiCall(cancellation, setToken = { accessToken = it }) { token ->
                    transport.getChunkUploadUrl("$UPLOADS_PATH/${plan.uploadId}/chunks/$chunkIndex/url", token, cancellation)
                }
                val target = parseChunkTarget(targetPayload)
                require(target.expectedBytes == expectedBytes) { "Nantty returned an invalid chunk size." }
                require(isSafeCreatorSampleSignedObjectUrl(target.url)) { "Nantty returned an unsafe signed upload URL." }
                require(target.expiresAtMillis > System.currentTimeMillis()) { "Nantty returned an expired upload URL. Try again." }
                val bytes = readCreatorSampleChunk(prepared!!.file, offset, expectedBytes, cancellation)
                transport.putSignedChunk(target.url, bytes, cancellation)
            }

            cancellation.throwIfCancelled()
            val completion = apiCall(cancellation, setToken = { accessToken = it }) { token ->
                transport.completeUpload("$UPLOADS_PATH/${plan.uploadId}/complete", token, cancellation)
            }
            val completedMediaId = parseCompletedMediaId(completion)
            require(completedMediaId == plan.mediaId) { "Nantty completed a different media upload." }
            completed = true

            val readyAsset = pollUntilReady(completedMediaId, cancellation) { accessToken = it }
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
                error.message ?: "Couldn't upload this sample image. Check your connection and try again.",
                authenticationRequired = error is CreatorSampleMediaHttpException && error.statusCode in setOf(401, 403),
            )
        } finally {
            if (!completed && uploadId != null && accessToken != null) {
                runCatching {
                    transport.abortUpload("$UPLOADS_PATH/$uploadId", accessToken!!, NoopCreatorSampleCancellation)
                }
            }
            sourceFile?.delete()
            prepared?.file?.delete()
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
                "failed" -> error("Nantty couldn't process this image. Choose another image and try again.")
                "processing" -> Unit
                else -> error("Nantty returned an unknown image processing status.")
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
            ?: error("Sign in to upload creator samples.")
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
        const val MAX_PREPARED_IMAGE_BYTES = 10 * 1024 * 1024L
        const val MAX_CHUNK_BYTES = 8 * 1024 * 1024
        const val MAX_CHUNKS = 16
        const val MAX_IMAGE_EDGE = 4096
        const val MAX_INPUT_PIXELS = 100_000_000L
        private const val MEDIA_PROCESSING_TIMEOUT_MS = 5 * 60_000L
        private const val MEDIA_PROCESSING_POLL_INTERVAL_MS = 1_000L
        private val INPUT_IMAGE_MIME_TYPES = setOf("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif")
    }
}
