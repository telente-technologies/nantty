package com.nantty.android.security.chatcrypto

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class X3dhTest {
    private val fixture by lazy {
        val path = requireNotNull(System.getProperty("nanttyX3dhFixture")) {
            "Gradle must provide the shared X3DH fixture path"
        }
        JSONObject(File(path).readText())
    }

    @Test
    fun initiatorAndResponderMatchReactNativeFixture() {
        val data = fixture
        val aliceSeed = signingSeed(data.getString("initiatorSeed"))
        val bobSeed = signingSeed(data.getString("responderSeed"))
        val alicePublic = ChatCryptoPrimitives.ed25519PublicKey(aliceSeed)
        val bobPublic = ChatCryptoPrimitives.ed25519PublicKey(bobSeed)
        val signedPreKeyPrivate = seededRandom(data.getString("signedPreKeySeed"))(32)
        val signedPreKeyPublic = ChatCryptoPrimitives.x25519PublicKey(signedPreKeyPrivate)
        val signedPreKeyId = data.getLong("signedPreKeyId")
        val signedMessage = "nantty-signed-prekey-v1".toByteArray(Charsets.UTF_8) +
            ChatCryptoPrimitives.writeUint32(signedPreKeyId) + signedPreKeyPublic
        val signedPreKeySignature = ChatCryptoPrimitives.ed25519Sign(bobSeed, signedMessage)
        val oneTimePreKeyPrivate = seededRandom(data.getString("oneTimePreKeySeed"))(32)
        val oneTimePreKeyPublic = ChatCryptoPrimitives.x25519PublicKey(oneTimePreKeyPrivate)
        val bundle = X3dhPreKeyBundle(
            identityKey = bobPublic,
            signedPreKeyId = signedPreKeyId,
            signedPreKey = signedPreKeyPublic,
            signedPreKeySignature = signedPreKeySignature,
            oneTimePreKey = oneTimePreKeyPublic,
        )

        val initiated = X3dh.initiate(
            aliceSeed,
            alicePublic,
            bundle,
            seededRandom(data.getString("baseKeySeed"))(32),
        )
        val responded = X3dh.respond(
            bobSeed,
            bobPublic,
            signedPreKeyPrivate,
            oneTimePreKeyPrivate,
            alicePublic,
            initiated.baseKeyPublic,
        )

        assertEquals(data.getString("aliceIdentityPublic"), alicePublic.toHex())
        assertEquals(data.getString("bobIdentityPublic"), bobPublic.toHex())
        assertEquals(data.getString("signedPreKeyPublic"), signedPreKeyPublic.toHex())
        assertEquals(data.getString("signedPreKeySignature"), signedPreKeySignature.toHex())
        assertEquals(data.getString("oneTimePreKeyPublic"), oneTimePreKeyPublic.toHex())
        assertEquals(data.getString("baseKeyPublic"), initiated.baseKeyPublic.toHex())
        assertEquals(data.getString("sharedSecret"), initiated.sharedSecret.toHex())
        assertArrayEquals(initiated.sharedSecret, responded.sharedSecret)
        assertEquals(data.getString("associatedData"), initiated.associatedData.toHex())
        assertArrayEquals(initiated.associatedData, responded.associatedData)
    }

    @Test
    fun rejectsModifiedSignedPreKeyAndInvalidKeyId() {
        val data = fixture
        val aliceSeed = signingSeed(data.getString("initiatorSeed"))
        val bobSeed = signingSeed(data.getString("responderSeed"))
        val bobPublic = ChatCryptoPrimitives.ed25519PublicKey(bobSeed)
        val private = seededRandom(data.getString("signedPreKeySeed"))(32)
        val public = ChatCryptoPrimitives.x25519PublicKey(private)
        val message = "nantty-signed-prekey-v1".toByteArray(Charsets.UTF_8) +
            ChatCryptoPrimitives.writeUint32(data.getLong("signedPreKeyId")) + public
        val signature = ChatCryptoPrimitives.ed25519Sign(bobSeed, message)
        val invalidSignatureBundle = X3dhPreKeyBundle(bobPublic, 43, public, signature)

        assertThrows(IllegalArgumentException::class.java) {
            X3dh.initiate(aliceSeed, ChatCryptoPrimitives.ed25519PublicKey(aliceSeed), invalidSignatureBundle, ByteArray(32) { 1 })
        }
        assertThrows(IllegalArgumentException::class.java) {
            X3dh.initiate(aliceSeed, ChatCryptoPrimitives.ed25519PublicKey(aliceSeed), invalidSignatureBundle.copy(signedPreKeyId = -1), ByteArray(32) { 1 })
        }
    }

    private fun signingSeed(seed: String): ByteArray {
        val random = seededRandom(seed)
        random(16)
        random(4)
        return random(32)
    }

    private fun seededRandom(seed: String): (Int) -> ByteArray {
        var counter = 0
        return { length ->
            ByteArray(length).also { output ->
                var offset = 0
                while (offset < output.size) {
                    val block = MessageDigest.getInstance("SHA-256").digest("$seed:${counter++}".toByteArray(Charsets.UTF_8))
                    val count = minOf(block.size, output.size - offset)
                    block.copyInto(output, offset, 0, count)
                    offset += count
                }
            }
        }
    }

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }
}
