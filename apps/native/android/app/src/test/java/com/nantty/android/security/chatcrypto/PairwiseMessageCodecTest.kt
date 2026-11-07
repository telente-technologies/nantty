package com.nantty.android.security.chatcrypto

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.File

class PairwiseMessageCodecTest {
    @Test
    fun decodesAndReencodesSharedReactNativePrekeyMessageVector() {
        val hex = fixture().getString("firstMessageHex")
        val encoded = hex.toByteArrayFromHex()

        val decoded = PairwiseMessageCodec.decode(encoded) as PairwiseWireMessage.PreKey

        assertEquals(12_023L, decoded.registrationId)
        assertEquals(11L, decoded.signedPreKeyId)
        assertEquals(500L, decoded.oneTimePreKeyId)
        assertEquals(0L, decoded.message.header.previousCounter)
        assertEquals(0L, decoded.message.header.index)
        assertArrayEquals(encoded, PairwiseMessageCodec.encode(decoded))
    }

    @Test
    fun rejectsUnknownVersionsTruncatedHeadersAndCiphertexts() {
        assertThrows(IllegalArgumentException::class.java) { PairwiseMessageCodec.decode(byteArrayOf(0x30)) }
        assertThrows(IllegalArgumentException::class.java) { PairwiseMessageCodec.decode(byteArrayOf(0x32, 0)) }

        val encoded = fixture().getString("firstMessageHex").toByteArrayFromHex()
        assertThrows(IllegalArgumentException::class.java) {
            PairwiseMessageCodec.decode(encoded.copyOfRange(0, encoded.size - 7))
        }
    }

    private fun fixture(): JSONObject {
        val relative = "packages/chatCrypto/fixtures/pairwise-message-v1.json"
        val start = File(System.getProperty("user.dir").orEmpty())
        val file = generateSequence(start) { it.parentFile }.map { File(it, relative) }.firstOrNull(File::isFile)
        return JSONObject(requireNotNull(file) { "Could not locate shared pairwise fixture from ${start.path}" }.readText())
    }

    private fun String.toByteArrayFromHex(): ByteArray {
        require(length % 2 == 0)
        return chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }
}
