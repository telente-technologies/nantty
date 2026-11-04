package com.nantty.android.security.chatcrypto

import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.digests.SHA512Digest
import org.bouncycastle.crypto.engines.AESEngine
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.macs.HMac
import org.bouncycastle.crypto.modes.GCMBlockCipher
import org.bouncycastle.crypto.params.AEADParameters
import org.bouncycastle.crypto.params.KeyParameter
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.math.ec.rfc8032.Ed25519
import org.bouncycastle.math.ec.rfc7748.X25519
import java.math.BigInteger
import java.util.Base64

/** Primitive compatibility layer for Nantty's custom `signal-v1` implementation.
 * This is deliberately not a session, ratchet, envelope, or messaging protocol API.
 */
object ChatCryptoPrimitives {
    private const val KEY_SIZE = 32
    private const val ED_PUBLIC_SIZE = 32
    private const val ED_SIGNATURE_SIZE = 64
    private const val X_PUBLIC_SIZE = 32
    private const val X_PRIVATE_SIZE = 32
    private const val GCM_NONCE_SIZE = 12
    private const val GCM_TAG_BITS = 128
    private const val HKDF_HASH_SIZE = 32
    private const val HKDF_MAX_SIZE = 255 * HKDF_HASH_SIZE
    private val ED_FIELD_P = BigInteger.ONE.shiftLeft(255).subtract(BigInteger.valueOf(19))

    /** Ed25519 seed input and output public key use the raw 32-byte encoding used by Noble. */
    fun ed25519PublicKey(seed: ByteArray): ByteArray {
        requireLength(seed, KEY_SIZE, "Ed25519 seed")
        val publicKey = ByteArray(ED_PUBLIC_SIZE)
        Ed25519.generatePublicKey(seed, 0, publicKey, 0)
        return publicKey
    }

    fun ed25519Sign(seed: ByteArray, message: ByteArray): ByteArray {
        requireLength(seed, KEY_SIZE, "Ed25519 seed")
        val signature = ByteArray(ED_SIGNATURE_SIZE)
        Ed25519.sign(seed, 0, message, 0, message.size, signature, 0)
        return signature
    }

    fun ed25519Verify(signature: ByteArray, message: ByteArray, publicKey: ByteArray): Boolean {
        requireLength(signature, ED_SIGNATURE_SIZE, "Ed25519 signature")
        requireLength(publicKey, ED_PUBLIC_SIZE, "Ed25519 public key")
        return try {
            Ed25519.verify(signature, 0, publicKey, 0, message, 0, message.size)
        } catch (_: IllegalArgumentException) {
            false
        }
    }

    /** Noble-compatible Ed25519 seed -> X25519 scalar conversion: SHA-512(seed), clamp first half. */
    fun ed25519SeedToX25519Private(seed: ByteArray): ByteArray {
        requireLength(seed, KEY_SIZE, "Ed25519 seed")
        val digest = ByteArray(64)
        SHA512Digest().apply {
            update(seed, 0, seed.size)
            doFinal(digest, 0)
        }
        val scalar = digest.copyOfRange(0, KEY_SIZE)
        digest.fill(0)
        scalar[0] = (scalar[0].toInt() and 248).toByte()
        scalar[31] = ((scalar[31].toInt() and 127) or 64).toByte()
        return scalar
    }

    /** Convert a canonical, fully-valid compressed Ed25519 point to its Montgomery u coordinate. */
    fun ed25519PublicToX25519(publicKey: ByteArray): ByteArray {
        requireLength(publicKey, ED_PUBLIC_SIZE, "Ed25519 public key")
        require(Ed25519.validatePublicKeyFull(publicKey, 0)) { "Invalid Ed25519 public key" }
        val yBytes = publicKey.copyOf()
        yBytes[31] = (yBytes[31].toInt() and 0x7f).toByte()
        val y = littleEndianToBigInteger(yBytes)
        require(y < ED_FIELD_P && y != BigInteger.ONE) { "Invalid Ed25519 public key" }
        val numerator = BigInteger.ONE.add(y).mod(ED_FIELD_P)
        val denominator = BigInteger.ONE.subtract(y).mod(ED_FIELD_P)
        val u = numerator.multiply(denominator.modInverse(ED_FIELD_P)).mod(ED_FIELD_P)
        return bigIntegerToLittleEndian(u, X_PUBLIC_SIZE)
    }

    fun x25519PublicKey(privateKey: ByteArray): ByteArray {
        requireLength(privateKey, X_PRIVATE_SIZE, "X25519 private key")
        return X25519PrivateKeyParameters(privateKey, 0).generatePublicKey().encoded
    }

    /** Returns false for the all-zero shared secret (low-order peer inputs). */
    fun x25519(privateKey: ByteArray, publicKey: ByteArray): ByteArray {
        requireLength(privateKey, X_PRIVATE_SIZE, "X25519 private key")
        requireLength(publicKey, X_PUBLIC_SIZE, "X25519 public key")
        val secret = ByteArray(KEY_SIZE)
        val valid = X25519.calculateAgreement(privateKey, 0, publicKey, 0, secret, 0)
        require(valid) { "Invalid low-order X25519 public key" }
        return secret
    }

    fun hkdfSha256(ikm: ByteArray, salt: ByteArray, info: ByteArray, outputLength: Int): ByteArray {
        require(outputLength in 0..HKDF_MAX_SIZE) { "HKDF output length must be between 0 and $HKDF_MAX_SIZE bytes" }
        if (outputLength == 0) return byteArrayOf()
        val output = ByteArray(outputLength)
        HKDFBytesGenerator(SHA256Digest()).apply {
            init(org.bouncycastle.crypto.params.HKDFParameters(ikm, salt, info))
            generateBytes(output, 0, output.size)
        }
        return output
    }

    fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
        val mac = HMac(SHA256Digest())
        mac.init(KeyParameter(key))
        mac.update(data, 0, data.size)
        return ByteArray(mac.macSize).also { mac.doFinal(it, 0) }
    }

    /** Output is ciphertext followed by the 16-byte GCM tag, matching Noble's gcm output. */
    fun aes256GcmSeal(key: ByteArray, nonce: ByteArray, plaintext: ByteArray, associatedData: ByteArray): ByteArray {
        requireLength(key, KEY_SIZE, "AES-256 key")
        requireLength(nonce, GCM_NONCE_SIZE, "AES-GCM nonce")
        return gcm(true, key, nonce, associatedData, plaintext)
    }

    fun aes256GcmOpen(key: ByteArray, nonce: ByteArray, ciphertextAndTag: ByteArray, associatedData: ByteArray): ByteArray {
        requireLength(key, KEY_SIZE, "AES-256 key")
        requireLength(nonce, GCM_NONCE_SIZE, "AES-GCM nonce")
        require(ciphertextAndTag.size >= GCM_TAG_BITS / 8) { "AES-GCM input is shorter than its authentication tag" }
        return gcm(false, key, nonce, associatedData, ciphertextAndTag)
    }

    fun encodeBase64(bytes: ByteArray): String = Base64.getEncoder().encodeToString(bytes)

    fun decodeBase64(value: String): ByteArray {
        require(STANDARD_BASE64.matches(value)) { "Invalid standard Base64" }
        return try {
            Base64.getDecoder().decode(value)
        } catch (error: IllegalArgumentException) {
            throw IllegalArgumentException("Invalid standard Base64", error)
        }
    }

    fun writeUint32(value: Long): ByteArray {
        require(value in 0L..0xffff_ffffL) { "Value is not an unsigned 32-bit integer" }
        return byteArrayOf(
            (value ushr 24).toByte(), (value ushr 16).toByte(),
            (value ushr 8).toByte(), value.toByte(),
        )
    }

    fun readUint32(bytes: ByteArray, offset: Int = 0): Long {
        require(offset >= 0 && offset <= bytes.size - 4) { "Truncated uint32 input" }
        return ((bytes[offset].toLong() and 0xff) shl 24) or
            ((bytes[offset + 1].toLong() and 0xff) shl 16) or
            ((bytes[offset + 2].toLong() and 0xff) shl 8) or
            (bytes[offset + 3].toLong() and 0xff)
    }

    private fun gcm(encrypt: Boolean, key: ByteArray, nonce: ByteArray, aad: ByteArray, input: ByteArray): ByteArray {
        val cipher = GCMBlockCipher.newInstance(AESEngine.newInstance())
        cipher.init(encrypt, AEADParameters(KeyParameter(key), GCM_TAG_BITS, nonce, aad))
        val output = ByteArray(cipher.getOutputSize(input.size))
        val written = cipher.processBytes(input, 0, input.size, output, 0)
        val finalWritten = cipher.doFinal(output, written)
        return output.copyOf(written + finalWritten)
    }

    private fun requireLength(bytes: ByteArray, expected: Int, name: String) {
        require(bytes.size == expected) { "$name must be exactly $expected bytes" }
    }

    private val STANDARD_BASE64 = Regex("(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?")

    private fun littleEndianToBigInteger(bytes: ByteArray): BigInteger = BigInteger(1, bytes.reversedArray())

    private fun bigIntegerToLittleEndian(value: BigInteger, size: Int): ByteArray {
        val bigEndian = value.toByteArray().let { encoded ->
            if (encoded.size > size && encoded[0] == 0.toByte()) encoded.copyOfRange(1, encoded.size) else encoded
        }
        require(bigEndian.size <= size) { "Integer does not fit requested byte width" }
        return ByteArray(size).also { output ->
            for (index in bigEndian.indices) output[index] = bigEndian[bigEndian.lastIndex - index]
        }
    }
}
