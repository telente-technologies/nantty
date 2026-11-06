package com.nantty.android.data

import android.media.MediaMetadataRetriever
import java.io.File
import java.io.FileInputStream

internal fun hasSupportedStoryVideoSignature(file: File, mimeType: String): Boolean {
    val header = ByteArray(12)
    val count = FileInputStream(file).use { it.read(header) }
    return when (mimeType.lowercase()) {
        "video/mp4", "video/quicktime" -> count >= 8 && String(header, 4, 4, Charsets.US_ASCII) == "ftyp"
        "video/webm" -> count >= 4 && header.copyOfRange(0, 4).contentEquals(byteArrayOf(0x1a, 0x45, 0xdf.toByte(), 0xa3.toByte()))
        else -> false
    }
}

internal fun readStoryVideoDurationMillis(file: File): Long? {
    val retriever = MediaMetadataRetriever()
    return try {
        retriever.setDataSource(file.absolutePath)
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
    } finally {
        retriever.release()
    }
}
