package com.nantty.android.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.core.graphics.scale
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.math.max

internal fun copyCreatorSampleBounded(
    input: InputStream,
    target: File,
    maximumBytes: Long,
    cancellation: CreatorSampleCancellation,
    tooLargeMessage: String = "This photo is too large to prepare. Choose a smaller image.",
) {
    input.use { source -> FileOutputStream(target).use { output ->
        val buffer = ByteArray(8_192)
        var total = 0L
        while (true) {
            cancellation.throwIfCancelled()
            val count = source.read(buffer)
            if (count < 0) break
            total += count
            require(total <= maximumBytes) { tooLargeMessage }
            output.write(buffer, 0, count)
        }
    } }
}

internal fun hasSupportedCreatorImageSignature(file: File): Boolean {
    val bytes = ByteArray(16)
    val count = FileInputStream(file).use { it.read(bytes) }
    if (count >= 3 && bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() && bytes[2] == 0xff.toByte()) return true
    if (count >= 8 && bytes.copyOfRange(0, 8).contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))) return true
    if (count >= 12 && String(bytes, 0, 4, Charsets.US_ASCII) == "RIFF" && String(bytes, 8, 4, Charsets.US_ASCII) == "WEBP") return true
    return count >= 12 && String(bytes, 4, 4, Charsets.US_ASCII) == "ftyp" &&
        listOf("heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis").any { brand -> String(bytes, 8, 4, Charsets.US_ASCII) == brand }
}

internal fun readCreatorSampleChunk(file: File, offset: Long, size: Int, cancellation: CreatorSampleCancellation): ByteArray {
    require(size in 1..CreatorSampleMediaRepository.MAX_CHUNK_BYTES) { "Invalid media chunk size." }
    cancellation.throwIfCancelled()
    val bytes = ByteArray(size)
    java.io.RandomAccessFile(file, "r").use { source ->
        source.seek(offset)
        var read = 0
        while (read < size) {
            cancellation.throwIfCancelled()
            val count = source.read(bytes, read, size - read)
            if (count < 0) error("The prepared image changed during upload.")
            read += count
        }
    }
    return bytes
}

internal fun creatorSampleCancellableDelay(durationMillis: Long, cancellation: CreatorSampleCancellation) {
    var remaining = durationMillis.coerceAtLeast(0L)
    while (remaining > 0L) {
        cancellation.throwIfCancelled()
        val step = minOf(remaining, 100L)
        Thread.sleep(step)
        remaining -= step
    }
}

internal object AndroidCreatorSampleImagePreparer : CreatorSampleImagePreparer {
    override fun prepare(sourceFile: File, cacheDir: File, cancellation: CreatorSampleCancellation): PreparedCreatorSampleImage {
        cancellation.throwIfCancelled()
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(sourceFile.absolutePath, bounds)
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Nantty couldn't read the selected image." }
        require(bounds.outWidth.toLong() * bounds.outHeight.toLong() <= CreatorSampleMediaRepository.MAX_INPUT_PIXELS) {
            "This image has too many pixels. Choose a smaller image."
        }
        val decoded = BitmapFactory.decodeFile(sourceFile.absolutePath, BitmapFactory.Options().apply { inSampleSize = calculateSampleSize(bounds.outWidth, bounds.outHeight) })
            ?: error("This image format can't be opened on this device.")
        var outputBitmap: Bitmap? = null
        val bitmap = try {
            cancellation.throwIfCancelled()
            val edge = max(decoded.width, decoded.height)
            outputBitmap = if (edge > CreatorSampleMediaRepository.MAX_IMAGE_EDGE) {
                val scale = CreatorSampleMediaRepository.MAX_IMAGE_EDGE.toFloat() / edge
                decoded.scale((decoded.width * scale).toInt().coerceAtLeast(1), (decoded.height * scale).toInt().coerceAtLeast(1), filter = true)
            } else decoded
            outputBitmap!!
        } catch (error: Exception) {
            decoded.recycle()
            outputBitmap?.takeIf { it !== decoded }?.recycle()
            throw error
        }
        val output = File.createTempFile("creator-sample-ready-", ".jpg", cacheDir)
        try {
            FileOutputStream(output).use { stream ->
                require(bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream)) { "Couldn't prepare this image for upload." }
            }
            require(output.length() in 1..CreatorSampleMediaRepository.MAX_PREPARED_IMAGE_BYTES) {
                "This image is too large to upload. Choose a smaller image."
            }
            return PreparedCreatorSampleImage(output, output.length(), bitmap.width, bitmap.height)
        } catch (error: Exception) {
            output.delete()
            throw error
        } finally {
            bitmap.recycle()
            if (decoded !== bitmap) decoded.recycle()
        }
    }

    private fun calculateSampleSize(width: Int, height: Int): Int {
        var sample = 1
        while (max(width / sample, height / sample) > CreatorSampleMediaRepository.MAX_IMAGE_EDGE) sample *= 2
        return sample
    }
}
