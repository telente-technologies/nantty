package com.nantty.android.security.chatcrypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.bouncycastle.crypto.InvalidCipherTextException

class ChatCryptoPrimitivesTest {
    @Test
    fun x25519MatchesRfc7748Vector() {
        val scalar = hex("a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4")
        val point = hex("e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c")
        assertEquals(
            "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552",
            ChatCryptoPrimitives.x25519(scalar, point).toHex(),
        )
    }

    @Test
    fun ed25519MatchesRfc8032VectorAndRejectsWrongMessage() {
        val seed = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
        val publicKey = hex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a")
        val signature = hex("e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b")

        assertArrayEquals(publicKey, ChatCryptoPrimitives.ed25519PublicKey(seed))
        assertArrayEquals(signature, ChatCryptoPrimitives.ed25519Sign(seed, byteArrayOf()))
        assertTrue(ChatCryptoPrimitives.ed25519Verify(signature, byteArrayOf(), publicKey))
        assertFalse(ChatCryptoPrimitives.ed25519Verify(signature, byteArrayOf(1), publicKey))
    }

    @Test
    fun ed25519IdentityConversionMatchesNobleSemantics() {
        val seed = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
        val publicKey = ChatCryptoPrimitives.ed25519PublicKey(seed)
        val convertedPublic = ChatCryptoPrimitives.ed25519PublicToX25519(publicKey)
        val convertedPrivate = ChatCryptoPrimitives.ed25519SeedToX25519Private(seed)

        assertArrayEquals(convertedPublic, ChatCryptoPrimitives.x25519PublicKey(convertedPrivate))
    }

    @Test
    fun hkdfSha256MatchesRfc5869TestCase3() {
        val ikm = ByteArray(22) { 0x0b }
        val expected = "8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8"
        assertEquals(expected, ChatCryptoPrimitives.hkdfSha256(ikm, byteArrayOf(), byteArrayOf(), 42).toHex())
    }

    @Test
    fun hmacSha256MatchesRfc4231TestCase2() {
        val expected = "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        assertEquals(expected, ChatCryptoPrimitives.hmacSha256("Jefe".toByteArray(), "what do ya want for nothing?".toByteArray()).toHex())
    }

    @Test
    fun aes256GcmMatchesNobleRfcFixtureAndRejectsTampering() {
        val key = hex("feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308")
        val nonce = hex("cafebabefacedbaddecaf888")
        val aad = hex("feedfacedeadbeeffeedfacedeadbeefabaddad2")
        val plaintext = hex("d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39")
        val expected = hex("522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f66276fc6ece0f4e1768cddf8853bb2d551b")
        val sealed = ChatCryptoPrimitives.aes256GcmSeal(key, nonce, plaintext, aad)

        assertArrayEquals(expected, sealed)
        assertArrayEquals(plaintext, ChatCryptoPrimitives.aes256GcmOpen(key, nonce, sealed, aad))
        val tampered = sealed.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() }
        assertThrows(InvalidCipherTextException::class.java) {
            ChatCryptoPrimitives.aes256GcmOpen(key, nonce, tampered, aad)
        }
        assertThrows(InvalidCipherTextException::class.java) {
            ChatCryptoPrimitives.aes256GcmOpen(key, nonce, sealed, byteArrayOf())
        }
    }

    @Test
    fun base64AndUint32MatchSharedBinaryConventions() {
        val cases = listOf("" to "", "f" to "Zg==", "fo" to "Zm8=", "foo" to "Zm9v", "foobar" to "Zm9vYmFy")
        cases.forEach { (plain, encoded) ->
            assertEquals(encoded, ChatCryptoPrimitives.encodeBase64(plain.toByteArray()))
            assertArrayEquals(plain.toByteArray(), ChatCryptoPrimitives.decodeBase64(encoded))
        }
        assertThrows(IllegalArgumentException::class.java) { ChatCryptoPrimitives.decodeBase64("Zm9=v") }
        assertThrows(IllegalArgumentException::class.java) { ChatCryptoPrimitives.decodeBase64("Zm9") }

        val maxUint32 = 0xffff_ffffL
        assertArrayEquals(hex("ffffffff"), ChatCryptoPrimitives.writeUint32(maxUint32))
        assertEquals(maxUint32, ChatCryptoPrimitives.readUint32(hex("ffffffff")))
        assertThrows(IllegalArgumentException::class.java) { ChatCryptoPrimitives.writeUint32(-1) }
        assertThrows(IllegalArgumentException::class.java) { ChatCryptoPrimitives.readUint32(byteArrayOf(1, 2, 3)) }
    }

    @Test
    fun rejectsLowOrderX25519AndInvalidLengths() {
        assertThrows(IllegalArgumentException::class.java) {
            ChatCryptoPrimitives.x25519(ByteArray(32) { 1 }, ByteArray(32))
        }
        assertThrows(IllegalArgumentException::class.java) { ChatCryptoPrimitives.ed25519PublicKey(ByteArray(31)) }
        assertThrows(IllegalArgumentException::class.java) {
            ChatCryptoPrimitives.aes256GcmSeal(ByteArray(16), ByteArray(12), byteArrayOf(), byteArrayOf())
        }
    }

    private fun hex(value: String): ByteArray = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }
}
