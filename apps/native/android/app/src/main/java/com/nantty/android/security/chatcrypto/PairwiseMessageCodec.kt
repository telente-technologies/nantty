package com.nantty.android.security.chatcrypto

internal sealed interface PairwiseWireMessage {
    data class Message(val header: DoubleRatchet.Header, val ciphertext: ByteArray) : PairwiseWireMessage
    data class PreKey(
        val registrationId: Long,
        val identityKey: ByteArray,
        val baseKey: ByteArray,
        val signedPreKeyId: Long,
        val oneTimePreKeyId: Long?,
        val message: Message,
    ) : PairwiseWireMessage
}

/** Binary codec for packages/chatCrypto/src/wireMessage.ts (0x31 ratchet, 0x32 prekey). */
internal object PairwiseMessageCodec {
    private const val RATCHET_VERSION = 0x31
    private const val PREKEY_VERSION = 0x32
    private const val KEY_BYTES = 32
    private const val MINIMUM_CIPHERTEXT_BYTES = 16

    fun encode(message: PairwiseWireMessage): ByteArray = when (message) {
        is PairwiseWireMessage.Message -> encodeMessage(message)
        is PairwiseWireMessage.PreKey -> {
            requireUInt32(message.registrationId, "Registration id")
            require(message.registrationId > 0) { "Registration id must be positive" }
            requireKey(message.identityKey, "Identity key")
            requireKey(message.baseKey, "Base key")
            requireUInt32(message.signedPreKeyId, "Signed prekey id")
            requireUInt32(message.oneTimePreKeyId ?: 0L, "One-time prekey id")
            byteArrayOf(PREKEY_VERSION.toByte()) +
                ChatCryptoPrimitives.writeUint32(message.registrationId) +
                message.identityKey + message.baseKey +
                ChatCryptoPrimitives.writeUint32(message.signedPreKeyId) +
                ChatCryptoPrimitives.writeUint32(message.oneTimePreKeyId ?: 0L) +
                encodeMessage(message.message)
        }
    }

    fun decode(bytes: ByteArray): PairwiseWireMessage {
        try {
            val reader = Reader(bytes)
            return when (reader.byte()) {
                RATCHET_VERSION -> decodeMessage(reader)
                PREKEY_VERSION -> {
                    val registrationId = reader.uint32()
                    val identityKey = reader.take(KEY_BYTES)
                    val baseKey = reader.take(KEY_BYTES)
                    val signedPreKeyId = reader.uint32()
                    val oneTimePreKeyId = reader.uint32().takeIf { it != 0L }
                    require(registrationId > 0) { "Registration id must be positive" }
                    PairwiseWireMessage.PreKey(
                        registrationId, identityKey, baseKey, signedPreKeyId, oneTimePreKeyId, decodeEmbeddedMessage(reader),
                    )
                }
                else -> throw IllegalArgumentException("Unknown pairwise message version")
            }
        } catch (error: Exception) {
            if (error is IllegalArgumentException) throw error
            throw IllegalArgumentException("Malformed pairwise message", error)
        }
    }

    private fun encodeMessage(message: PairwiseWireMessage.Message): ByteArray {
        require(message.ciphertext.size >= MINIMUM_CIPHERTEXT_BYTES) { "Ratchet ciphertext is truncated" }
        return byteArrayOf(RATCHET_VERSION.toByte()) + DoubleRatchet.encodeHeader(message.header) + message.ciphertext
    }

    private fun decodeMessage(reader: Reader): PairwiseWireMessage.Message {
        return decodeMessageBody(reader)
    }

    private fun decodeEmbeddedMessage(reader: Reader): PairwiseWireMessage.Message {
        require(reader.byte() == RATCHET_VERSION) { "Unknown embedded ratchet message version" }
        return decodeMessageBody(reader)
    }

    private fun decodeMessageBody(reader: Reader): PairwiseWireMessage.Message {
        val header = DoubleRatchet.decodeHeader(reader.take(DoubleRatchet.HEADER_LENGTH))
        val ciphertext = reader.rest()
        require(ciphertext.size >= MINIMUM_CIPHERTEXT_BYTES) { "Ratchet ciphertext is truncated" }
        return PairwiseWireMessage.Message(header, ciphertext)
    }

    private fun requireKey(value: ByteArray, label: String) {
        require(value.size == KEY_BYTES) { "$label must be exactly $KEY_BYTES bytes" }
    }

    private fun requireUInt32(value: Long, label: String) {
        require(value in 0L..0xffff_ffffL) { "$label must be an unsigned 32-bit integer" }
    }

    private class Reader(private val bytes: ByteArray) {
        private var offset = 0
        fun byte(): Int {
            require(offset < bytes.size) { "Truncated pairwise message" }
            return bytes[offset++].toInt() and 0xff
        }
        fun uint32(): Long = ChatCryptoPrimitives.readUint32(take(4))
        fun take(count: Int): ByteArray {
            require(count >= 0 && count <= bytes.size - offset) { "Truncated pairwise message" }
            return bytes.copyOfRange(offset, offset + count).also { offset += count }
        }
        fun rest(): ByteArray = take(bytes.size - offset)
    }
}
