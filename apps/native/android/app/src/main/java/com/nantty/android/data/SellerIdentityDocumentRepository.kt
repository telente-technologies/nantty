package com.nantty.android.data

import android.content.ContentResolver
import android.net.Uri
import java.io.File

internal sealed interface SellerIdentityUploadResult {
    data class Success(val url: String) : SellerIdentityUploadResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SellerIdentityUploadResult
    data object Cancelled : SellerIdentityUploadResult
}

/** Uses the same identity_document-purpose media pipeline as the React Native seller form. */
internal class SellerIdentityDocumentRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: CreatorSampleMediaTransport = JdkCreatorSampleMediaTransport(com.nantty.android.BuildConfig.NANTTY_API_BASE_URL),
    private val imagePreparer: CreatorSampleImagePreparer = AndroidCreatorSampleImagePreparer,
) {
    fun upload(uri: Uri, resolver: ContentResolver, cacheDir: File, cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation): SellerIdentityUploadResult {
        val mime = resolver.getType(uri)?.lowercase()?.trim()
            ?: return SellerIdentityUploadResult.Failure("Choose a supported photo of your identity document.")
        val name = uri.lastPathSegment?.substringAfterLast('/')?.takeIf(String::isNotBlank) ?: "identity-document"
        return upload(CreatorSampleImageInput(name, mime) {
            resolver.openInputStream(uri) ?: error("Couldn't read that photo. Choose another image.")
        }, cacheDir, cancellation)
    }

    internal fun upload(input: CreatorSampleImageInput, cacheDir: File, cancellation: CreatorSampleCancellation = NoopCreatorSampleCancellation): SellerIdentityUploadResult {
        var source: File? = null
        var prepared: PreparedCreatorSampleImage? = null
        var uploadId: String? = null
        var token: String? = null
        var completed = false
        return try {
            cancellation.throwIfCancelled()
            val current = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
                ?: return SellerIdentityUploadResult.Failure("Sign in to upload your identity document.", true)
            token = current.accessToken
            require(input.mimeType.lowercase() in ACCEPTED_INPUT_TYPES) { "Choose a JPEG, PNG, WebP, HEIC or AVIF image." }
            require(cacheDir.exists() || cacheDir.mkdirs()) { "Secure upload storage is unavailable." }
            source = File.createTempFile("seller-identity-source-", ".bin", cacheDir)
            copyCreatorSampleBounded(input.openStream(), source!!, CreatorSampleMediaRepository.MAX_SOURCE_IMAGE_BYTES, cancellation)
            require(source!!.length() > 0 && hasSupportedCreatorImageSignature(source!!)) { "The selected file is not a supported image." }
            prepared = imagePreparer.prepare(source!!, cacheDir, cancellation)
            require(prepared!!.sizeBytes in 1L..CreatorSampleMediaRepository.MAX_PREPARED_IMAGE_BYTES.toLong() && prepared!!.file.length() == prepared!!.sizeBytes) {
                "This identity photo is too large to upload. Choose a smaller image."
            }
            val plan = transport.createUploadSession(
                CreatorSampleMediaRepository.CREATE_UPLOAD_PATH,
                token!!,
                org.json.JSONObject().put("fileName", "seller-identity.jpg").put("mimeType", "image/jpeg")
                    .put("sizeBytes", prepared!!.sizeBytes).put("purpose", PURPOSE),
                cancellation,
            ).dataObject()
            uploadId = plan.requiredUuid("uploadId")
            val mediaId = plan.requiredUuid("mediaId")
            val chunkSize = plan.optInt("partSizeBytes", plan.optInt("chunkSizeBytes", -1))
            val chunkCount = plan.optInt("partCount", plan.optInt("totalChunks", -1))
            require(chunkSize in 1..CreatorSampleMediaRepository.MAX_CHUNK_BYTES && chunkCount in 1..CreatorSampleMediaRepository.MAX_CHUNKS) {
                "Nantty returned an invalid identity upload plan."
            }
            require(chunkCount == kotlin.math.ceil(prepared!!.sizeBytes.toDouble() / chunkSize).toInt()) { "Nantty returned an inconsistent identity upload plan." }
            for (index in 0 until chunkCount) {
                cancellation.throwIfCancelled()
                val offset = index.toLong() * chunkSize
                val length = minOf(chunkSize.toLong(), prepared!!.sizeBytes - offset).toInt()
                val target = transport.getChunkUploadUrl("${CreatorSampleMediaRepository.UPLOADS_PATH}/$uploadId/chunks/$index/url", token!!, cancellation).dataObject()
                require(target.optString("method") == "PUT" && target.optLong("expectedBytes") == length.toLong()) { "Nantty returned an invalid identity upload target." }
                val url = target.optString("url")
                val expires = runCatching { java.time.Instant.parse(target.optString("expiresAt")).toEpochMilli() }.getOrNull()
                require(isSafeCreatorSampleSignedObjectUrl(url) && expires != null && expires > System.currentTimeMillis()) { "Nantty returned an unsafe or expired identity upload target." }
                transport.putSignedChunk(url, readCreatorSampleChunk(prepared!!.file, offset, length, cancellation), cancellation)
            }
            val completion = transport.completeUpload("${CreatorSampleMediaRepository.UPLOADS_PATH}/$uploadId/complete", token!!, cancellation).dataObject()
            require(completion.optString("status") == "processing" && completion.requiredUuid("mediaId") == mediaId) {
                "Nantty did not accept the identity photo for processing."
            }
            completed = true
            val deadline = System.currentTimeMillis() + PROCESSING_TIMEOUT_MS
            while (true) {
                cancellation.throwIfCancelled()
                val asset = transport.getMediaAsset("${CreatorSampleMediaRepository.MEDIA_PATH}/$mediaId", token!!, cancellation).dataObject()
                when (asset.optString("status")) {
                    "ready" -> {
                        val rows = asset.optJSONArray("variants") ?: org.json.JSONArray()
                        val url = buildList {
                            for (i in 0 until rows.length()) rows.optJSONObject(i)?.let { row ->
                                val variantUrl = row.optString("url")
                                if (isSafeCreatorSampleMediaUrl(variantUrl) && row.optString("format") in setOf("jpeg", "webp", "avif")) add(row.optInt("width") to variantUrl)
                            }
                        }.maxByOrNull { it.first }?.second ?: asset.optString("posterUrl").takeIf(::isSafeCreatorSampleMediaUrl)
                            ?: error("Nantty processed the identity photo but did not return its secure URL.")
                        return SellerIdentityUploadResult.Success(url)
                    }
                    "failed" -> error("Nantty couldn't process this identity photo. Choose another image.")
                    "processing" -> Unit
                    else -> error("Nantty returned an unknown identity photo status.")
                }
                if (System.currentTimeMillis() >= deadline) error("Identity photo processing is taking longer than expected. Try again.")
                creatorSampleCancellableDelay(POLL_INTERVAL_MS, cancellation)
            }
            @Suppress("UNREACHABLE_CODE") SellerIdentityUploadResult.Failure("Upload failed.")
        } catch (_: android.os.OperationCanceledException) {
            SellerIdentityUploadResult.Cancelled
        } catch (_: java.util.concurrent.CancellationException) {
            SellerIdentityUploadResult.Cancelled
        } catch (error: Exception) {
            SellerIdentityUploadResult.Failure(
                error.message ?: "Couldn't upload this identity photo. Check your connection and try again.",
                authenticationRequired = error is CreatorSampleMediaHttpException && error.statusCode in setOf(401, 403),
            )
        } finally {
            if (!completed && uploadId != null && token != null) runCatching {
                transport.abortUpload("${CreatorSampleMediaRepository.UPLOADS_PATH}/$uploadId", token!!, NoopCreatorSampleCancellation)
            }
            source?.delete()
            prepared?.file?.delete()
        }
    }

    private companion object {
        const val PURPOSE = "identity_document"
        const val PROCESSING_TIMEOUT_MS = 5 * 60_000L
        const val POLL_INTERVAL_MS = 1_000L
        val ACCEPTED_INPUT_TYPES = setOf("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif")
    }
}
