package com.nantty.android.security.chatcrypto

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets

/** Kotlin implementation of packages/chatCrypto/src/senderKeys.ts. Keep the wire format in lockstep. */
object SenderKeys {
    const val MAXIMUM_SKIP = 2_000
    private const val DISTRIBUTION_VERSION = 0x41
    private const val GROUP_MESSAGE_VERSION = 0x51
    private const val SIGNATURE_LENGTH = 64
    private const val MAXIMUM_STATES = 4
    private val zeroSalt = ByteArray(32)

    data class SigningKeyPair(val publicKey: ByteArray, val secretKey: ByteArray)
    data class OwnKey(
        val keyId: Long,
        val chainKey: ByteArray,
        val iteration: Long,
        val signing: SigningKeyPair,
        val distributedTo: List<String> = emptyList(),
        val createdAt: Long,
    )
    data class SkippedKey(val iteration: Long, val messageKey: ByteArray)
    data class PeerState(
        val keyId: Long,
        val chainKey: ByteArray,
        val iteration: Long,
        val signingPublicKey: ByteArray,
        val skipped: List<SkippedKey> = emptyList(),
    )
    data class PeerRecord(val states: List<PeerState>)
    data class Distribution(
        val conversationId: String,
        val keyId: Long,
        val iteration: Long,
        val chainKey: ByteArray,
        val signingPublicKey: ByteArray,
    )
    data class EncryptedMessage(val own: OwnKey, val message: ByteArray)
    data class DecryptedMessage(val record: PeerRecord, val plaintext: ByteArray)

    class CryptoException(val code: Code, message: String) : IllegalArgumentException(message) {
        enum class Code { INVALID_MESSAGE, NO_SENDER_KEY, INVALID_SIGNATURE, DUPLICATE_MESSAGE, TOO_MANY_SKIPPED }
    }

    fun createOwn(random: (Int) -> ByteArray, now: Long): OwnKey {
        val keyId = nextRandomKeyId(random)
        val chainKey = random(32).also { requireSize(it, 32, "chain key") }
        val secret = random(32).also { requireSize(it, 32, "signing seed") }
        return OwnKey(keyId, chainKey, 0, SigningKeyPair(ChatCryptoPrimitives.ed25519PublicKey(secret), secret), createdAt = now)
    }

    fun encodeDistribution(conversationId: String, key: OwnKey): ByteArray = concat(
        byteArrayOf(DISTRIBUTION_VERSION.toByte()),
        uint32(key.keyId),
        uint32(key.iteration),
        key.chainKey,
        key.signing.publicKey,
        conversationId.toByteArray(StandardCharsets.UTF_8),
    )

    fun decodeDistribution(bytes: ByteArray): Distribution = try {
        val reader = Reader(bytes)
        require(reader.uint8() == DISTRIBUTION_VERSION)
        val keyId = reader.uint32()
        val iteration = reader.uint32()
        val chainKey = reader.take(32)
        val signingPublicKey = reader.take(32)
        val conversationId = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(reader.rest())).toString()
        Distribution(conversationId, keyId, iteration, chainKey, signingPublicKey)
    } catch (_: Exception) {
        throw CryptoException(CryptoException.Code.INVALID_MESSAGE, "The sender key distribution is malformed.")
    }

    fun applyDistribution(record: PeerRecord?, distribution: Distribution): PeerRecord {
        val states = record?.states.orEmpty()
        if (states.any { it.keyId == distribution.keyId }) return PeerRecord(states)
        val state = PeerState(distribution.keyId, distribution.chainKey, distribution.iteration, distribution.signingPublicKey)
        return PeerRecord((listOf(state) + states).take(MAXIMUM_STATES))
    }

    fun groupEncrypt(
        own: OwnKey,
        conversationId: String,
        senderUserId: String,
        senderDeviceId: String,
        plaintext: ByteArray,
    ): EncryptedMessage {
        val (messageKey, nextChainKey) = chainStep(own.chainKey)
        val (key, nonce) = groupMessageKeys(messageKey)
        val associatedData = groupAssociatedData(conversationId, senderUserId, senderDeviceId)
        val body = concat(byteArrayOf(GROUP_MESSAGE_VERSION.toByte()), uint32(own.keyId), uint32(own.iteration), ChatCryptoPrimitives.aes256GcmSeal(key, nonce, plaintext, associatedData))
        val signature = ChatCryptoPrimitives.ed25519Sign(own.signing.secretKey, concat(associatedData, body))
        return EncryptedMessage(own.copy(chainKey = nextChainKey, iteration = own.iteration + 1), concat(body, signature))
    }

    fun readGroupMessageKeyId(message: ByteArray): Long {
        require(message.size >= 5) { "Malformed group message" }
        return Reader(message.copyOfRange(1, 5)).uint32()
    }

    fun groupDecrypt(
        record: PeerRecord?,
        conversationId: String,
        senderUserId: String,
        senderDeviceId: String,
        message: ByteArray,
    ): DecryptedMessage {
        if (message.size < 1 + 8 + 16 + SIGNATURE_LENGTH || message[0].toInt() and 0xff != GROUP_MESSAGE_VERSION) {
            throw CryptoException(CryptoException.Code.INVALID_MESSAGE, "The group message is malformed.")
        }
        val body = message.copyOfRange(0, message.size - SIGNATURE_LENGTH)
        val signature = message.copyOfRange(message.size - SIGNATURE_LENGTH, message.size)
        val reader = Reader(body)
        reader.uint8()
        val keyId = reader.uint32()
        val iteration = reader.uint32()
        val ciphertext = reader.rest()
        val currentRecord = record ?: throw CryptoException(CryptoException.Code.NO_SENDER_KEY, "The sender key for this message is missing.")
        val state = currentRecord.states.firstOrNull { it.keyId == keyId }
            ?: throw CryptoException(CryptoException.Code.NO_SENDER_KEY, "The sender key for this message is missing.")
        val associatedData = groupAssociatedData(conversationId, senderUserId, senderDeviceId)
        if (!ChatCryptoPrimitives.ed25519Verify(signature, concat(associatedData, body), state.signingPublicKey)) {
            throw CryptoException(CryptoException.Code.INVALID_SIGNATURE, "The group message signature is invalid.")
        }

        val next: PeerState
        val messageKey: ByteArray
        if (iteration < state.iteration) {
            val skipped = state.skipped.firstOrNull { it.iteration == iteration }
                ?: throw CryptoException(CryptoException.Code.DUPLICATE_MESSAGE, "This message was already received.")
            messageKey = skipped.messageKey
            next = state.copy(skipped = state.skipped.filterNot { it === skipped })
        } else {
            if (iteration - state.iteration > MAXIMUM_SKIP) {
                throw CryptoException(CryptoException.Code.TOO_MANY_SKIPPED, "Too many messages were skipped.")
            }
            val skipped = state.skipped.toMutableList()
            var chainKey = state.chainKey
            var current = state.iteration
            while (current < iteration) {
                val (skippedKey, following) = chainStep(chainKey)
                skipped += SkippedKey(current, skippedKey)
                chainKey = following
                current++
            }
            val (currentKey, following) = chainStep(chainKey)
            messageKey = currentKey
            next = state.copy(chainKey = following, iteration = iteration + 1, skipped = skipped.takeLast(MAXIMUM_SKIP))
        }

        val (key, nonce) = groupMessageKeys(messageKey)
        val plaintext = try {
            ChatCryptoPrimitives.aes256GcmOpen(key, nonce, ciphertext, associatedData)
        } catch (_: Exception) {
            throw CryptoException(CryptoException.Code.INVALID_MESSAGE, "The group message could not be authenticated.")
        }
        val updated = currentRecord.states.map { candidate -> if (candidate.keyId == keyId) next else candidate }
        return DecryptedMessage(PeerRecord(updated), plaintext)
    }

    private fun chainStep(chainKey: ByteArray): Pair<ByteArray, ByteArray> =
        ChatCryptoPrimitives.hmacSha256(chainKey, byteArrayOf(1)) to ChatCryptoPrimitives.hmacSha256(chainKey, byteArrayOf(2))

    private fun groupMessageKeys(messageKey: ByteArray): Pair<ByteArray, ByteArray> {
        val material = ChatCryptoPrimitives.hkdfSha256(messageKey, zeroSalt, "NanttySenderKeyv1".toByteArray(StandardCharsets.UTF_8), 44)
        return material.copyOfRange(0, 32) to material.copyOfRange(32, 44)
    }

    private fun groupAssociatedData(conversationId: String, senderUserId: String, senderDeviceId: String) =
        "nantty-group-v1|$conversationId|$senderUserId|$senderDeviceId".toByteArray(StandardCharsets.UTF_8)

    private fun nextRandomKeyId(random: (Int) -> ByteArray): Long {
        val bytes = random(4).also { requireSize(it, 4, "random key id") }
        val value = ((bytes[0].toLong() and 0xff) shl 24) or ((bytes[1].toLong() and 0xff) shl 16) or
            ((bytes[2].toLong() and 0xff) shl 8) or (bytes[3].toLong() and 0xff)
        return (value and 0x7fff_ffffL) % (0x7fff_ffffL - 1) + 1
    }

    private fun uint32(value: Long): ByteArray {
        require(value in 0..0xffff_ffffL) { "Value is not a uint32." }
        return ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(value.toInt()).array()
    }

    private fun concat(vararg arrays: ByteArray): ByteArray {
        val result = ByteArray(arrays.sumOf(ByteArray::size))
        var offset = 0
        arrays.forEach { array -> array.copyInto(result, offset); offset += array.size }
        return result
    }

    private fun requireSize(value: ByteArray, size: Int, label: String) {
        require(value.size == size) { "$label must be $size bytes" }
    }

    private class Reader(private val bytes: ByteArray) {
        private var offset = 0
        fun take(length: Int): ByteArray {
            require(length >= 0 && offset + length <= bytes.size) { "Truncated sender key input" }
            return bytes.copyOfRange(offset, offset + length).also { offset += length }
        }
        fun uint8(): Int = take(1)[0].toInt() and 0xff
        fun uint32(): Long = ByteBuffer.wrap(take(4)).order(ByteOrder.BIG_ENDIAN).int.toLong() and 0xffff_ffffL
        fun rest(): ByteArray = take(bytes.size - offset)
    }
}
