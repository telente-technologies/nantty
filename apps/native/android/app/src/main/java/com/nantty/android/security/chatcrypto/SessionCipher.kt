package com.nantty.android.security.chatcrypto

/** Errors surfaced by the Android counterpart of RN's SessionCipher. */
internal class SessionCipherException(
    val code: Code,
    message: String,
    cause: Throwable? = null,
) : IllegalArgumentException(message, cause) {
    enum class Code {
        NO_SESSION,
        UNTRUSTED_IDENTITY,
        DUPLICATE_MESSAGE,
        PREKEY_NOT_FOUND,
        INVALID_MESSAGE,
        INVALID_SIGNATURE,
    }
}

/**
 * Kotlin counterpart of `packages/chatCrypto/src/sessionCipher.ts`.
 * This implements protocol session operations only; it is not wired to UI or transport.
 */
internal class SessionCipher(
    private val store: ProtocolStore,
    private val identity: ChatDeviceIdentity,
    private val random: ChatCryptoRandomSource = ChatCryptoRandomSource { length ->
        ByteArray(length).also(java.security.SecureRandom()::nextBytes)
    },
) {
    init {
        validateIdentity()
    }

    @Synchronized
    fun hasSession(userId: String, deviceId: String): Boolean = store.loadSession(userId, deviceId).current != null

    @Synchronized
    fun initiateFromBundle(bundle: ChatPreKeyBundle) {
        require(bundle.userId.isNotBlank() && bundle.deviceId.isNotBlank()) { "A peer user and device are required." }
        require(bundle.registrationId > 0) { "Peer registration id is invalid." }

        val identityKey = decodeKey(bundle.identityKey, "identity key")
        val signedPreKey = decodeKey(bundle.signedPreKey.publicKey, "signed prekey")
        val signature = decodeKey(bundle.signedPreKey.signature, "signed prekey signature")
        val oneTimePreKey = bundle.oneTimePreKey?.let { decodeKey(it.publicKey, "one-time prekey") }
        val signedPreKeyId = bundle.signedPreKey.keyId.toLong()
        val oneTimePreKeyId = bundle.oneTimePreKey?.keyId?.toLong()
        require(signedPreKeyId in 0..MAXIMUM_PREKEY_ID) { "Peer signed prekey id is invalid." }
        require(oneTimePreKeyId == null || oneTimePreKeyId in 1..MAXIMUM_PREKEY_ID) { "Peer one-time prekey id is invalid." }

        val x3dh = try {
            X3dh.initiate(
                localIdentitySeed = identity.signingSeed,
                localIdentityKey = identity.signingPublicKey,
                bundle = X3dhPreKeyBundle(
                    identityKey = identityKey,
                    signedPreKeyId = signedPreKeyId,
                    signedPreKey = signedPreKey,
                    signedPreKeySignature = signature,
                    oneTimePreKey = oneTimePreKey,
                ),
                baseKeyPrivate = random.bytes(32).also { require(it.size == 32) { "Random source returned an invalid key." } },
            )
        } catch (error: Exception) {
            throw SessionCipherException(
                SessionCipherException.Code.INVALID_SIGNATURE,
                "The signed prekey signature is invalid.",
                error,
            )
        }
        val state = DoubleRatchet.initializeInitiator(
            x3dh = x3dh,
            remoteSignedPreKey = signedPreKey,
            remoteIdentityKey = identityKey,
            pendingPreKey = DoubleRatchet.PendingPreKey(signedPreKeyId, oneTimePreKeyId),
            random = random::bytes,
        )
        val record = store.loadSession(bundle.userId, bundle.deviceId)
        store.saveSession(bundle.userId, bundle.deviceId, withCurrent(record, state))
    }

    @Synchronized
    fun encrypt(userId: String, deviceId: String, plaintext: ByteArray): ByteArray {
        val record = store.loadSession(userId, deviceId)
        val encodedCurrent = record.current ?: throw failure(
            SessionCipherException.Code.NO_SESSION,
            "There is no session with this device.",
        )
        val encrypted = try {
            DoubleRatchet.ratchetEncrypt(DoubleRatchetRecordCodec.decode(encodedCurrent), plaintext)
        } catch (error: DoubleRatchet.RatchetException) {
            throw error
        } catch (error: Exception) {
            throw failure(SessionCipherException.Code.INVALID_MESSAGE, "The message could not be encrypted.", error)
        }
        store.saveSession(
            userId,
            deviceId,
            record.copy(current = DoubleRatchetRecordCodec.encode(encrypted.state)),
        )
        val message = PairwiseWireMessage.Message(encrypted.header, encrypted.ciphertext)
        val pending = encrypted.state.pendingPreKey
        return if (pending == null) {
            PairwiseMessageCodec.encode(message)
        } else {
            PairwiseMessageCodec.encode(
                PairwiseWireMessage.PreKey(
                    registrationId = identity.registrationId.toLong(),
                    identityKey = identity.signingPublicKey,
                    baseKey = encrypted.state.baseKey,
                    signedPreKeyId = pending.signedPreKeyId,
                    oneTimePreKeyId = pending.oneTimePreKeyId,
                    message = message,
                ),
            )
        }
    }

    @Synchronized
    fun decrypt(
        userId: String,
        deviceId: String,
        bytes: ByteArray,
        isTrustedIdentity: (identityKey: ByteArray) -> Boolean,
    ): ByteArray {
        val wire = try {
            PairwiseMessageCodec.decode(bytes)
        } catch (error: Exception) {
            throw failure(SessionCipherException.Code.INVALID_MESSAGE, "The message is malformed.", error)
        }
        val record = store.loadSession(userId, deviceId)
        val message = when (wire) {
            is PairwiseWireMessage.Message -> wire
            is PairwiseWireMessage.PreKey -> wire.message
        }
        val preKey = wire as? PairwiseWireMessage.PreKey
        val existingStates = decodeStates(record)

        if (preKey == null || existingStates.any { bytesEqual(it.state.baseKey, preKey.baseKey) }) {
            return decryptWithExistingStates(userId, deviceId, record, existingStates, message)
        }

        val encodedBaseKey = ChatCryptoPrimitives.encodeBase64(preKey.baseKey)
        if (encodedBaseKey in record.seenBaseKeys) {
            throw failure(SessionCipherException.Code.DUPLICATE_MESSAGE, "This message was already received.")
        }
        val trusted = try {
            isTrustedIdentity(preKey.identityKey.copyOf())
        } catch (error: Exception) {
            throw failure(SessionCipherException.Code.UNTRUSTED_IDENTITY, "The sender's identity could not be verified.", error)
        }
        if (!trusted) {
            throw failure(SessionCipherException.Code.UNTRUSTED_IDENTITY, "The sender's identity key is not on record.")
        }

        val signedPreKey = store.loadSignedPreKey(preKey.signedPreKeyId.toInt())
            ?: throw failure(SessionCipherException.Code.PREKEY_NOT_FOUND, "The signed prekey for this message is gone.")
        val signedPair = decodeStoredKeyPair(signedPreKey, preKey.signedPreKeyId, "signed prekey")
        val oneTimePreKey = preKey.oneTimePreKeyId?.let { keyId ->
            val stored = store.loadOneTimePreKey(keyId.toInt())
                ?: throw failure(SessionCipherException.Code.PREKEY_NOT_FOUND, "The one-time prekey for this message is gone.")
            decodeStoredKeyPair(stored, keyId, "one-time prekey")
        }

        val x3dh = try {
            X3dh.respond(
                localIdentitySeed = identity.signingSeed,
                localIdentityKey = identity.signingPublicKey,
                signedPreKeyPrivate = signedPair.secretKey,
                oneTimePreKeyPrivate = oneTimePreKey?.secretKey,
                remoteIdentityKey = preKey.identityKey,
                remoteBaseKey = preKey.baseKey,
            )
        } catch (error: Exception) {
            throw failure(SessionCipherException.Code.INVALID_MESSAGE, "The prekey message could not be authenticated.", error)
        }
        val responder = DoubleRatchet.initializeResponder(x3dh, signedPair, preKey.identityKey, preKey.baseKey)
        val decrypted = try {
            DoubleRatchet.ratchetDecrypt(responder, message.header, message.ciphertext, random::bytes)
        } catch (error: DoubleRatchet.RatchetException) {
            throw error
        } catch (error: Exception) {
            throw failure(SessionCipherException.Code.INVALID_MESSAGE, "The message could not be authenticated.", error)
        }

        val updatedRecord = withCurrent(record, decrypted.state, preKey.baseKey)
        if (oneTimePreKey != null) {
            store.saveSessionAndConsumeOneTimePreKey(userId, deviceId, updatedRecord, preKey.oneTimePreKeyId!!.toInt())
        } else {
            store.saveSession(userId, deviceId, updatedRecord)
        }
        return decrypted.plaintext
    }

    @Synchronized
    fun reset(userId: String, deviceId: String) = store.deleteSession(userId, deviceId)

    private fun decryptWithExistingStates(
        userId: String,
        deviceId: String,
        record: ProtocolSessionRecord,
        states: List<IndexedState>,
        message: PairwiseWireMessage.Message,
    ): ByteArray {
        if (states.isEmpty()) {
            throw failure(SessionCipherException.Code.NO_SESSION, "There is no session with this device.")
        }
        val failures = mutableListOf<Exception>()
        states.forEach { candidate ->
            try {
                val decrypted = DoubleRatchet.ratchetDecrypt(candidate.state, message.header, message.ciphertext, random::bytes)
                val encodedState = DoubleRatchetRecordCodec.encode(decrypted.state)
                val updated = if (candidate.current) {
                    record.copy(current = encodedState)
                } else {
                    record.copy(archived = record.archived.mapIndexed { index, archived ->
                        if (index == candidate.archivedIndex) encodedState else archived
                    })
                }
                store.saveSession(userId, deviceId, updated)
                return decrypted.plaintext
            } catch (error: Exception) {
                failures += error
            }
        }
        failures.firstOrNull { it is DoubleRatchet.RatchetException && it.code == DoubleRatchet.RatchetException.Code.DUPLICATE_MESSAGE }
            ?.let { throw it }
        failures.firstOrNull { it is DoubleRatchet.RatchetException }?.let { throw it }
        throw failure(SessionCipherException.Code.INVALID_MESSAGE, "The message could not be decrypted.", failures.firstOrNull())
    }

    private fun decodeStates(record: ProtocolSessionRecord): List<IndexedState> = buildList {
        record.current?.let { add(IndexedState(DoubleRatchetRecordCodec.decode(it), current = true)) }
        record.archived.forEachIndexed { index, encoded ->
            add(IndexedState(DoubleRatchetRecordCodec.decode(encoded), current = false, archivedIndex = index))
        }
    }

    private fun decodeStoredKeyPair(record: Map<String, Any?>, expectedId: Long, label: String): DoubleRatchet.AgreementKeyPair {
        val keyId = (record["keyId"] as? Number)?.toLong()
            ?: throw failure(SessionCipherException.Code.PREKEY_NOT_FOUND, "The stored $label is malformed.")
        if (keyId != expectedId) throw failure(SessionCipherException.Code.PREKEY_NOT_FOUND, "The stored $label does not match the message.")
        val pair = record["keyPair"] as? Map<*, *>
            ?: throw failure(SessionCipherException.Code.PREKEY_NOT_FOUND, "The stored $label is malformed.")
        val publicKey = pair["publicKey"] as? ByteArray
            ?: throw failure(SessionCipherException.Code.PREKEY_NOT_FOUND, "The stored $label public key is malformed.")
        val secretKey = pair["secretKey"] as? ByteArray
            ?: throw failure(SessionCipherException.Code.PREKEY_NOT_FOUND, "The stored $label private key is malformed.")
        if (publicKey.size != 32 || secretKey.size != 32 || !bytesEqual(ChatCryptoPrimitives.x25519PublicKey(secretKey), publicKey)) {
            throw failure(SessionCipherException.Code.PREKEY_NOT_FOUND, "The stored $label keypair is invalid.")
        }
        return DoubleRatchet.AgreementKeyPair(publicKey.copyOf(), secretKey.copyOf())
    }

    private fun decodeKey(value: String, label: String): ByteArray = try {
        ChatCryptoPrimitives.decodeBase64(value).also {
            require(it.size == 32 || (label == "signed prekey signature" && it.size == 64))
        }
    } catch (error: Exception) {
        throw failure(SessionCipherException.Code.INVALID_MESSAGE, "The peer $label is malformed.", error)
    }

    private fun withCurrent(
        record: ProtocolSessionRecord,
        state: DoubleRatchet.RatchetState,
        seenBaseKey: ByteArray? = null,
    ): ProtocolSessionRecord {
        val archived = listOfNotNull(record.current) + record.archived
        val seen = if (seenBaseKey == null) record.seenBaseKeys else {
            (record.seenBaseKeys + ChatCryptoPrimitives.encodeBase64(seenBaseKey)).takeLast(MAXIMUM_REMEMBERED_BASE_KEYS)
        }
        return ProtocolSessionRecord(
            current = DoubleRatchetRecordCodec.encode(state),
            archived = archived.take(MAXIMUM_ARCHIVED_STATES),
            seenBaseKeys = seen,
        )
    }

    private data class IndexedState(
        val state: DoubleRatchet.RatchetState,
        val current: Boolean = false,
        val archivedIndex: Int = -1,
    )

    private fun bytesEqual(left: ByteArray, right: ByteArray): Boolean {
        if (left.size != right.size) return false
        var diff = 0
        left.indices.forEach { diff = diff or (left[it].toInt() xor right[it].toInt()) }
        return diff == 0
    }

    private fun failure(code: SessionCipherException.Code, message: String, cause: Throwable? = null) =
        SessionCipherException(code, message, cause)

    private fun validateIdentity() {
        require(identity.userId.isNotBlank() && identity.deviceId.isNotBlank()) { "A local device identity is required." }
        require(identity.registrationId in 1..16_380) { "Local registration id is invalid." }
        require(identity.signingSeed.size == 32 && identity.signingPublicKey.size == 32) { "Local signing identity is malformed." }
        require(bytesEqual(ChatCryptoPrimitives.ed25519PublicKey(identity.signingSeed), identity.signingPublicKey)) {
            "Local signing identity does not match its keypair."
        }
    }

    private companion object {
        const val MAXIMUM_ARCHIVED_STATES = 5
        const val MAXIMUM_REMEMBERED_BASE_KEYS = 64
        const val MAXIMUM_PREKEY_ID = 0x7fff_ffffL
    }
}
