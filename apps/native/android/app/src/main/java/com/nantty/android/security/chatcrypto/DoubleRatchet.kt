package com.nantty.android.security.chatcrypto

import java.nio.charset.StandardCharsets

/**
 * Pure Kotlin port of packages/chatCrypto/src/doubleRatchet.ts.
 *
 * This is an algorithm implementation only: it is not connected to session
 * persistence, identity trust, message envelopes, or chat send/decrypt UI.
 */
internal object DoubleRatchet {
    const val MAXIMUM_SKIPPED_PER_CHAIN = 2_000
    const val MAXIMUM_STORED_SKIPPED_KEYS = 2_000
    const val HEADER_LENGTH = 40
    private const val REMEMBERED_REMOTE_RATCHET_KEYS = 8
    private val zeroSalt = ByteArray(32)
    private val rootKdfInfo = "NanttyRatchetv1".toByteArray(StandardCharsets.UTF_8)
    private val messageKeyKdfInfo = "NanttyMessageKeysv1".toByteArray(StandardCharsets.UTF_8)

    data class ChainState(val key: ByteArray, val index: Long)
    data class SkippedMessageKey(val ratchetKey: ByteArray, val index: Long, val messageKey: ByteArray)
    data class PendingPreKey(val signedPreKeyId: Long, val oneTimePreKeyId: Long?)
    data class AgreementKeyPair(val publicKey: ByteArray, val secretKey: ByteArray)
    data class RatchetState(
        val rootKey: ByteArray,
        val sendingRatchet: AgreementKeyPair,
        val remoteRatchetKey: ByteArray?,
        val previousRemoteRatchetKeys: List<ByteArray>,
        val sendingChain: ChainState?,
        val receivingChain: ChainState?,
        val previousCounter: Long,
        val skipped: List<SkippedMessageKey>,
        val associatedData: ByteArray,
        val remoteIdentityKey: ByteArray,
        val baseKey: ByteArray,
        val pendingPreKey: PendingPreKey?,
    )
    data class Header(val ratchetKey: ByteArray, val previousCounter: Long, val index: Long)
    data class Encrypted(val state: RatchetState, val header: Header, val ciphertext: ByteArray)
    data class Decrypted(val state: RatchetState, val plaintext: ByteArray)

    class RatchetException(val code: Code, message: String, cause: Throwable? = null) : IllegalArgumentException(message, cause) {
        enum class Code { DUPLICATE_MESSAGE, NO_SESSION, INVALID_MESSAGE, TOO_MANY_SKIPPED }
    }

    fun initializeInitiator(
        x3dh: X3dhInitiation,
        remoteSignedPreKey: ByteArray,
        remoteIdentityKey: ByteArray,
        pendingPreKey: PendingPreKey,
        random: (Int) -> ByteArray,
    ): RatchetState {
        val sendingRatchet = generateAgreementKeyPair(random)
        val (rootKey, sendingChainKey) = kdfRoot(
            x3dh.sharedSecret,
            ChatCryptoPrimitives.x25519(sendingRatchet.secretKey, remoteSignedPreKey),
        )
        return RatchetState(
            rootKey = rootKey,
            sendingRatchet = sendingRatchet,
            remoteRatchetKey = remoteSignedPreKey.copyOf(),
            previousRemoteRatchetKeys = emptyList(),
            sendingChain = ChainState(sendingChainKey, 0),
            receivingChain = null,
            previousCounter = 0,
            skipped = emptyList(),
            associatedData = x3dh.associatedData.copyOf(),
            remoteIdentityKey = remoteIdentityKey.copyOf(),
            baseKey = x3dh.baseKeyPublic.copyOf(),
            pendingPreKey = pendingPreKey,
        )
    }

    fun initializeResponder(
        x3dh: X3dhResponse,
        signedPreKey: AgreementKeyPair,
        remoteIdentityKey: ByteArray,
        baseKey: ByteArray,
    ): RatchetState = RatchetState(
        rootKey = x3dh.sharedSecret.copyOf(),
        sendingRatchet = copyKeyPair(signedPreKey),
        remoteRatchetKey = null,
        previousRemoteRatchetKeys = emptyList(),
        sendingChain = null,
        receivingChain = null,
        previousCounter = 0,
        skipped = emptyList(),
        associatedData = x3dh.associatedData.copyOf(),
        remoteIdentityKey = remoteIdentityKey.copyOf(),
        baseKey = baseKey.copyOf(),
        pendingPreKey = null,
    )

    fun ratchetEncrypt(state: RatchetState, plaintext: ByteArray): Encrypted {
        val chain = state.sendingChain ?: throw RatchetException(
            RatchetException.Code.NO_SESSION,
            "This session cannot send yet.",
        )
        requireUint32(chain.index, "Sending chain index")
        val (messageKey, nextChainKey) = chainStep(chain.key)
        val header = Header(state.sendingRatchet.publicKey.copyOf(), state.previousCounter, chain.index)
        val ciphertext = sealWithMessageKey(messageKey, state.associatedData, header, plaintext)
        return Encrypted(state.copy(sendingChain = ChainState(nextChainKey, chain.index + 1)), header, ciphertext)
    }

    fun ratchetDecrypt(state: RatchetState, header: Header, ciphertext: ByteArray, random: (Int) -> ByteArray): Decrypted {
        validateHeader(header)
        val skippedIndex = state.skipped.indexOfFirst {
            it.index == header.index && bytesEqual(it.ratchetKey, header.ratchetKey)
        }
        if (skippedIndex >= 0) {
            val entry = state.skipped[skippedIndex]
            val plaintext = openWithMessageKey(entry.messageKey, state.associatedData, header, ciphertext)
            return Decrypted(
                state.copy(skipped = state.skipped.filterIndexed { index, _ -> index != skippedIndex }, pendingPreKey = null),
                plaintext,
            )
        }
        if (state.previousRemoteRatchetKeys.any { bytesEqual(it, header.ratchetKey) }) {
            throw duplicateMessage()
        }

        var next = state
        if (next.remoteRatchetKey == null || !bytesEqual(header.ratchetKey, next.remoteRatchetKey)) {
            next = stepRatchet(skipMessageKeys(next, header.previousCounter), header.ratchetKey, random)
        }
        val receivingChain = next.receivingChain
            ?: throw RatchetException(RatchetException.Code.INVALID_MESSAGE, "The message ratchet has no receiving chain.")
        if (header.index < receivingChain.index) throw duplicateMessage()
        next = skipMessageKeys(next, header.index)
        val currentReceivingChain = next.receivingChain
            ?: throw RatchetException(RatchetException.Code.INVALID_MESSAGE, "The message ratchet has no receiving chain.")
        val (messageKey, nextChainKey) = chainStep(currentReceivingChain.key)
        val plaintext = openWithMessageKey(messageKey, next.associatedData, header, ciphertext)
        return Decrypted(
            next.copy(
                receivingChain = ChainState(nextChainKey, header.index + 1),
                pendingPreKey = null,
            ),
            plaintext,
        )
    }

    fun encodeHeader(header: Header): ByteArray {
        require(header.ratchetKey.size == 32) { "Ratchet public key must be exactly 32 bytes." }
        validateHeader(header)
        return header.ratchetKey + ChatCryptoPrimitives.writeUint32(header.previousCounter) +
            ChatCryptoPrimitives.writeUint32(header.index)
    }

    /** Matches the TypeScript ByteReader: truncated input is rejected, trailing bytes are ignored. */
    fun decodeHeader(bytes: ByteArray): Header {
        require(bytes.size >= HEADER_LENGTH) { "Truncated ratchet header." }
        return Header(
            ratchetKey = bytes.copyOfRange(0, 32),
            previousCounter = ChatCryptoPrimitives.readUint32(bytes, 32),
            index = ChatCryptoPrimitives.readUint32(bytes, 36),
        )
    }

    private fun skipMessageKeys(state: RatchetState, until: Long): RatchetState {
        val chain = state.receivingChain
        val remoteKey = state.remoteRatchetKey
        if (chain == null || remoteKey == null) return state
        if (until - chain.index > MAXIMUM_SKIPPED_PER_CHAIN) {
            throw RatchetException(RatchetException.Code.TOO_MANY_SKIPPED, "Too many messages were skipped.")
        }
        var currentChain: ChainState = chain
        val skipped = state.skipped.toMutableList()
        while (currentChain.index < until) {
            val (messageKey, nextChainKey) = chainStep(currentChain.key)
            skipped += SkippedMessageKey(remoteKey.copyOf(), currentChain.index, messageKey)
            currentChain = ChainState(nextChainKey, currentChain.index + 1)
        }
        return state.copy(receivingChain = currentChain, skipped = skipped.takeLast(MAXIMUM_STORED_SKIPPED_KEYS))
    }

    private fun stepRatchet(state: RatchetState, remoteRatchetKey: ByteArray, random: (Int) -> ByteArray): RatchetState {
        val (receivingRoot, receivingChainKey) = kdfRoot(
            state.rootKey,
            ChatCryptoPrimitives.x25519(state.sendingRatchet.secretKey, remoteRatchetKey),
        )
        val sendingRatchet = generateAgreementKeyPair(random)
        val (rootKey, sendingChainKey) = kdfRoot(
            receivingRoot,
            ChatCryptoPrimitives.x25519(sendingRatchet.secretKey, remoteRatchetKey),
        )
        val previous = state.remoteRatchetKey?.let { state.previousRemoteRatchetKeys + listOf(it.copyOf()) }
            ?: state.previousRemoteRatchetKeys
        return state.copy(
            rootKey = rootKey,
            sendingRatchet = sendingRatchet,
            remoteRatchetKey = remoteRatchetKey.copyOf(),
            previousRemoteRatchetKeys = previous.takeLast(REMEMBERED_REMOTE_RATCHET_KEYS),
            previousCounter = state.sendingChain?.index ?: 0,
            receivingChain = ChainState(receivingChainKey, 0),
            sendingChain = ChainState(sendingChainKey, 0),
        )
    }

    private fun kdfRoot(rootKey: ByteArray, agreement: ByteArray): Pair<ByteArray, ByteArray> {
        val output = ChatCryptoPrimitives.hkdfSha256(agreement, rootKey, rootKdfInfo, 64)
        return output.copyOfRange(0, 32) to output.copyOfRange(32, 64)
    }

    private fun chainStep(chainKey: ByteArray): Pair<ByteArray, ByteArray> =
        ChatCryptoPrimitives.hmacSha256(chainKey, byteArrayOf(1)) to
            ChatCryptoPrimitives.hmacSha256(chainKey, byteArrayOf(2))

    private fun sealWithMessageKey(messageKey: ByteArray, associatedData: ByteArray, header: Header, plaintext: ByteArray): ByteArray {
        val (key, nonce) = messageKeyMaterial(messageKey)
        return ChatCryptoPrimitives.aes256GcmSeal(key, nonce, plaintext, associatedData + encodeHeader(header))
    }

    private fun openWithMessageKey(messageKey: ByteArray, associatedData: ByteArray, header: Header, ciphertext: ByteArray): ByteArray {
        val (key, nonce) = messageKeyMaterial(messageKey)
        return try {
            ChatCryptoPrimitives.aes256GcmOpen(key, nonce, ciphertext, associatedData + encodeHeader(header))
        } catch (error: Exception) {
            throw RatchetException(
                RatchetException.Code.INVALID_MESSAGE,
                "The message could not be authenticated.",
                error,
            )
        }
    }

    private fun messageKeyMaterial(messageKey: ByteArray): Pair<ByteArray, ByteArray> {
        val material = ChatCryptoPrimitives.hkdfSha256(messageKey, zeroSalt, messageKeyKdfInfo, 44)
        return material.copyOfRange(0, 32) to material.copyOfRange(32, 44)
    }

    private fun generateAgreementKeyPair(random: (Int) -> ByteArray): AgreementKeyPair {
        val secret = random(32)
        require(secret.size == 32) { "Random source must return exactly the requested number of bytes." }
        return AgreementKeyPair(ChatCryptoPrimitives.x25519PublicKey(secret), secret)
    }

    private fun copyKeyPair(keyPair: AgreementKeyPair) = AgreementKeyPair(keyPair.publicKey.copyOf(), keyPair.secretKey.copyOf())

    private fun validateHeader(header: Header) {
        if (header.ratchetKey.size != 32) throw invalidMessage("Ratchet public key must be exactly 32 bytes.")
        if (header.previousCounter !in 0L..0xffff_ffffL || header.index !in 0L..0xffff_ffffL) {
            throw invalidMessage("Ratchet header counters must be uint32 values.")
        }
    }

    private fun requireUint32(value: Long, label: String) {
        if (value !in 0L..0xffff_ffffL) throw invalidMessage("$label is outside the uint32 range.")
    }

    private fun bytesEqual(left: ByteArray, right: ByteArray): Boolean {
        if (left.size != right.size) return false
        var difference = 0
        for (index in left.indices) difference = difference or (left[index].toInt() xor right[index].toInt())
        return difference == 0
    }

    private fun duplicateMessage() = RatchetException(
        RatchetException.Code.DUPLICATE_MESSAGE,
        "This message was already received.",
    )

    private fun invalidMessage(message: String) = RatchetException(RatchetException.Code.INVALID_MESSAGE, message)
}
