package com.nantty.android.data

import android.os.CancellationSignal
import java.io.File
import java.io.InputStream

data class CreatorSampleImageInput(
    val fileName: String,
    val mimeType: String,
    val openStream: () -> InputStream,
)

data class PreparedCreatorSampleImage(
    val file: File,
    val sizeBytes: Long,
    val width: Int,
    val height: Int,
)

data class CreatorSampleMediaVariant(val url: String, val width: Int, val format: String)

data class UploadedCreatorSampleImage(val mediaId: String, val imageUrl: String, val width: Int, val height: Int)

sealed interface CreatorSampleMediaResult {
    data class Success(val image: UploadedCreatorSampleImage) : CreatorSampleMediaResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : CreatorSampleMediaResult
    data object Cancelled : CreatorSampleMediaResult
}

interface CreatorSampleCancellation {
    fun throwIfCancelled()
    fun onCancel(listener: () -> Unit): AutoCloseable
}

class AndroidCreatorSampleCancellation(private val signal: CancellationSignal = CancellationSignal()) : CreatorSampleCancellation {
    fun cancel() = signal.cancel()
    override fun throwIfCancelled() = signal.throwIfCanceled()
    override fun onCancel(listener: () -> Unit): AutoCloseable {
        signal.setOnCancelListener { listener() }
        return AutoCloseable { signal.setOnCancelListener(null) }
    }
}

object NoopCreatorSampleCancellation : CreatorSampleCancellation {
    override fun throwIfCancelled() = Unit
    override fun onCancel(listener: () -> Unit): AutoCloseable = AutoCloseable { }
}

fun interface CreatorSampleImagePreparer {
    fun prepare(sourceFile: File, cacheDir: File, cancellation: CreatorSampleCancellation): PreparedCreatorSampleImage
}

/** Injectable seam around authenticated media API calls and unauthenticated signed-object PUTs. */
interface CreatorSampleMediaTransport {
    fun createUploadSession(path: String, accessToken: String, body: org.json.JSONObject, cancellation: CreatorSampleCancellation): org.json.JSONObject
    fun getChunkUploadUrl(path: String, accessToken: String, cancellation: CreatorSampleCancellation): org.json.JSONObject
    fun putSignedChunk(url: String, bytes: ByteArray, cancellation: CreatorSampleCancellation)
    fun completeUpload(path: String, accessToken: String, cancellation: CreatorSampleCancellation): org.json.JSONObject
    fun getMediaAsset(path: String, accessToken: String, cancellation: CreatorSampleCancellation): org.json.JSONObject
    fun abortUpload(path: String, accessToken: String, cancellation: CreatorSampleCancellation)
}

class CreatorSampleMediaHttpException(val statusCode: Int, message: String) : Exception(message)
