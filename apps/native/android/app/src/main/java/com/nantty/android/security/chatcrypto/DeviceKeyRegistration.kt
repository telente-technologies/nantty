package com.nantty.android.security.chatcrypto

import java.security.SecureRandom

internal const val CHAT_ONE_TIME_PREKEY_BATCH_SIZE = 100
internal const val CHAT_ONE_TIME_PREKEY_LOW_WATER = 25
internal const val CHAT_SIGNED_PREKEY_ROTATION_MILLIS = 7L * 24 * 60 * 60 * 1_000
internal const val CHAT_DEVICE_KEY_RECHECK_MILLIS = 10L * 60 * 1_000
private const val MAXIMUM_KEY_ID = 0x7fffffffL
private const val MAXIMUM_PREVIOUS_SIGNED_PREKEYS = 2

internal fun interface ChatCryptoRandomSource {
    fun bytes(length: Int): ByteArray
}

internal data class ChatDeviceKeyStatus(
    val deviceId: String,
    val identityKey: String,
    val signedPreKeyId: Int,
    val oneTimePreKeyCount: Int,
)

internal data class ChatWireSignedPreKey(val keyId: Int, val publicKey: String, val signature: String)
internal data class ChatWireOneTimePreKey(val keyId: Int, val publicKey: String)
internal data class ChatDirectoryDevice(val deviceId: String, val registrationId: Int, val identityKey: String)
internal data class ChatUserDeviceList(val userId: String, val devices: List<ChatDirectoryDevice>)
internal data class ChatDeviceAddress(val userId: String, val deviceId: String)
internal data class ChatPreKeyBundle(
    val userId: String,
    val deviceId: String,
    val registrationId: Int,
    val identityKey: String,
    val signedPreKey: ChatWireSignedPreKey,
    val oneTimePreKey: ChatWireOneTimePreKey?,
)
internal data class ChatDeviceRegistrationRequest(
    val registrationId: Int,
    val identityKey: String,
    val signedPreKey: ChatWireSignedPreKey,
    val oneTimePreKeys: List<ChatWireOneTimePreKey>,
)

/** The authenticated Social key-directory operations used by RN's chat-crypto client. */
internal interface ChatDeviceKeyDirectory {
    fun registerDevice(deviceId: String, request: ChatDeviceRegistrationRequest): ChatDeviceKeyStatus
    fun fetchDeviceStatus(deviceId: String): ChatDeviceKeyStatus?
    fun uploadOneTimePreKeys(deviceId: String, keys: List<ChatWireOneTimePreKey>): ChatDeviceKeyStatus
    fun rotateSignedPreKey(deviceId: String, key: ChatWireSignedPreKey): ChatDeviceKeyStatus
    fun listDevices(userIds: List<String>): List<ChatUserDeviceList>
    fun claimPreKeyBundles(devices: List<ChatDeviceAddress>): List<ChatPreKeyBundle>
    fun removeDevice(deviceId: String)
}

internal data class ChatDeviceIdentity(
    val userId: String,
    val deviceId: String,
    val registrationId: Int,
    val signingSeed: ByteArray,
    val signingPublicKey: ByteArray,
)

/**
 * Kotlin port of packages/chatCrypto/src/deviceRegistration.ts.
 * This only provisions the key-directory identity/prekeys; it does not establish sessions
 * and must not be used as evidence that Android can send or decrypt chat messages.
 */
internal class DeviceKeyRegistration(
    private val store: ProtocolStore,
    private val directory: ChatDeviceKeyDirectory,
    private val random: ChatCryptoRandomSource = ChatCryptoRandomSource { length -> ByteArray(length).also(SecureRandom()::nextBytes) },
    private val now: () -> Long = System::currentTimeMillis,
) {
    private var identity: ChatDeviceIdentity? = null
    private var lastCheckedAt = 0L

    @Synchronized
    fun ensureReady(userId: String): ChatDeviceIdentity {
        require(userId.isNotBlank()) { "A signed-in account is required to register secure chat." }
        var resolved = identity ?: store.loadIdentity()?.let(::decodeIdentity)
        if (resolved == null || resolved.userId != userId) {
            store.clearEverything()
            resolved = createAndRegister(userId)
            identity = resolved
            lastCheckedAt = now()
            return resolved
        }

        val currentTime = now()
        if (currentTime - lastCheckedAt > CHAT_DEVICE_KEY_RECHECK_MILLIS) {
            maintainDeviceKeys(resolved)
            lastCheckedAt = currentTime
        }
        identity = resolved
        return resolved
    }

    @Synchronized
    fun signOut(userId: String? = null) {
        val resolved = identity ?: store.loadIdentity()?.let(::decodeIdentity)
        try {
            if (resolved != null && (userId == null || resolved.userId == userId)) {
                runCatching { directory.removeDevice(resolved.deviceId) }
            }
        } finally {
            store.clearEverything()
            identity = null
            lastCheckedAt = 0L
        }
    }

    private fun createAndRegister(userId: String): ChatDeviceIdentity {
        val deviceId = random.bytes(16).toLowerHex()
        val registrationId = (randomUint31() % 16_380L).toInt() + 1
        val signingSeed = random.bytes(32)
        val signingPublicKey = ChatCryptoPrimitives.ed25519PublicKey(signingSeed)
        val generatedIdentity = ChatDeviceIdentity(
            userId = userId,
            deviceId = deviceId,
            registrationId = registrationId,
            signingSeed = signingSeed,
            signingPublicKey = signingPublicKey,
        )
        val signedPreKey = createSignedPreKey(generatedIdentity, nextRandomKeyId(), now())
        val counters = ProtocolPreKeyCounters(nextOneTimePreKeyId = nextRandomKeyId(), currentSignedPreKeyId = signedPreKey.first, previousSignedPreKeyIds = emptyList())
        store.saveSignedPreKey(signedPreKey.second)
        store.saveCounters(counters)
        store.saveIdentity(encodeIdentity(generatedIdentity))
        registerWithDirectory(generatedIdentity, counters)
        return generatedIdentity
    }

    private fun maintainDeviceKeys(currentIdentity: ChatDeviceIdentity) {
        var counters = store.loadCounters() ?: error("Secure-chat prekey counters are missing.")
        val status = directory.fetchDeviceStatus(currentIdentity.deviceId)
        val encodedIdentity = ChatCryptoPrimitives.encodeBase64(currentIdentity.signingPublicKey)
        if (status == null || status.identityKey != encodedIdentity) {
            registerWithDirectory(currentIdentity, counters)
            return
        }

        val currentSignedPreKey = store.loadSignedPreKey(counters.currentSignedPreKeyId)
        val createdAt = currentSignedPreKey?.get("createdAt") as? Number
        if (createdAt == null || now() - createdAt.toLong() > CHAT_SIGNED_PREKEY_ROTATION_MILLIS) {
            counters = rotateSignedPreKey(currentIdentity, counters)
        }
        if (status.oneTimePreKeyCount < CHAT_ONE_TIME_PREKEY_LOW_WATER) {
            val generated = generateOneTimePreKeys(counters, CHAT_ONE_TIME_PREKEY_BATCH_SIZE - status.oneTimePreKeyCount)
            directory.uploadOneTimePreKeys(currentIdentity.deviceId, generated.second)
        }
    }

    private fun registerWithDirectory(currentIdentity: ChatDeviceIdentity, counters: ProtocolPreKeyCounters) {
        val signed = store.loadSignedPreKey(counters.currentSignedPreKeyId)
            ?: error("The current secure-chat signed prekey is missing.")
        val generated = generateOneTimePreKeys(counters, CHAT_ONE_TIME_PREKEY_BATCH_SIZE)
        directory.registerDevice(
            currentIdentity.deviceId,
            ChatDeviceRegistrationRequest(
                registrationId = currentIdentity.registrationId,
                identityKey = ChatCryptoPrimitives.encodeBase64(currentIdentity.signingPublicKey),
                signedPreKey = wireSignedPreKey(signed),
                oneTimePreKeys = generated.second,
            ),
        )
    }

    private fun generateOneTimePreKeys(counters: ProtocolPreKeyCounters, count: Int): Pair<ProtocolPreKeyCounters, List<ChatWireOneTimePreKey>> {
        require(count in 0..CHAT_ONE_TIME_PREKEY_BATCH_SIZE) { "Invalid secure-chat one-time prekey batch size." }
        val wireKeys = ArrayList<ChatWireOneTimePreKey>(count)
        var keyId = counters.nextOneTimePreKeyId
        repeat(count) {
            val secretKey = random.bytes(32)
            val publicKey = ChatCryptoPrimitives.x25519PublicKey(secretKey)
            val record = mapOf("keyId" to keyId, "keyPair" to mapOf("publicKey" to publicKey, "secretKey" to secretKey))
            store.saveOneTimePreKey(record)
            wireKeys += ChatWireOneTimePreKey(keyId, ChatCryptoPrimitives.encodeBase64(publicKey))
            keyId = ((keyId.toLong() % MAXIMUM_KEY_ID) + 1).toInt()
        }
        val updated = counters.copy(nextOneTimePreKeyId = keyId)
        store.saveCounters(updated)
        return updated to wireKeys
    }

    private fun rotateSignedPreKey(currentIdentity: ChatDeviceIdentity, counters: ProtocolPreKeyCounters): ProtocolPreKeyCounters {
        val nextId = nextRandomKeyId()
        val signed = createSignedPreKey(currentIdentity, nextId, now())
        store.saveSignedPreKey(signed.second)
        val prior = listOf(counters.currentSignedPreKeyId) + counters.previousSignedPreKeyIds
        prior.drop(MAXIMUM_PREVIOUS_SIGNED_PREKEYS).forEach(store::removeSignedPreKey)
        val updated = counters.copy(currentSignedPreKeyId = nextId, previousSignedPreKeyIds = prior.take(MAXIMUM_PREVIOUS_SIGNED_PREKEYS))
        store.saveCounters(updated)
        directory.rotateSignedPreKey(currentIdentity.deviceId, wireSignedPreKey(signed.second))
        return updated
    }

    private fun createSignedPreKey(currentIdentity: ChatDeviceIdentity, keyId: Int, createdAt: Long): Pair<Int, Map<String, Any?>> {
        val secretKey = random.bytes(32)
        val publicKey = ChatCryptoPrimitives.x25519PublicKey(secretKey)
        val signedMessage = SIGNED_PREKEY_DOMAIN + ChatCryptoPrimitives.writeUint32(keyId.toLong()) + publicKey
        val signature = ChatCryptoPrimitives.ed25519Sign(currentIdentity.signingSeed, signedMessage)
        return keyId to mapOf(
            "keyId" to keyId,
            "keyPair" to mapOf("publicKey" to publicKey, "secretKey" to secretKey),
            "signature" to signature,
            "createdAt" to createdAt,
        )
    }

    private fun wireSignedPreKey(record: Map<String, Any?>): ChatWireSignedPreKey {
        val pair = record["keyPair"] as? Map<*, *> ?: error("Stored signed prekey is malformed.")
        val keyId = (record["keyId"] as? Number)?.toInt() ?: error("Stored signed prekey id is malformed.")
        val publicKey = pair["publicKey"] as? ByteArray ?: error("Stored signed prekey public key is malformed.")
        val signature = record["signature"] as? ByteArray ?: error("Stored signed prekey signature is malformed.")
        return ChatWireSignedPreKey(keyId, ChatCryptoPrimitives.encodeBase64(publicKey), ChatCryptoPrimitives.encodeBase64(signature))
    }

    private fun decodeIdentity(record: Map<String, Any?>): ChatDeviceIdentity {
        val signing = record["signing"] as? Map<*, *> ?: error("Stored secure-chat identity is malformed.")
        val userId = record["userId"] as? String ?: error("Stored secure-chat account identity is malformed.")
        val deviceId = record["deviceId"] as? String ?: error("Stored secure-chat device identity is malformed.")
        val registrationId = (record["registrationId"] as? Number)?.toInt() ?: error("Stored secure-chat registration id is malformed.")
        val seed = signing["secretKey"] as? ByteArray ?: error("Stored secure-chat signing key is malformed.")
        val publicKey = signing["publicKey"] as? ByteArray ?: error("Stored secure-chat signing key is malformed.")
        require(seed.size == 32 && publicKey.size == 32 && deviceId.matches(Regex("^[a-f0-9]{32}$")) && registrationId in 1..16_380) {
            "Stored secure-chat identity is invalid."
        }
        require(ChatCryptoPrimitives.ed25519PublicKey(seed).contentEquals(publicKey)) { "Stored secure-chat signing key does not match its public key." }
        return ChatDeviceIdentity(userId, deviceId, registrationId, seed, publicKey)
    }

    private fun encodeIdentity(value: ChatDeviceIdentity): Map<String, Any?> = mapOf(
        "userId" to value.userId,
        "deviceId" to value.deviceId,
        "registrationId" to value.registrationId,
        "signing" to mapOf("publicKey" to value.signingPublicKey, "secretKey" to value.signingSeed),
    )

    private fun randomUint31(): Long = ChatCryptoPrimitives.readUint32(random.bytes(4)) and MAXIMUM_KEY_ID

    private fun nextRandomKeyId(): Int = (randomUint31() % (MAXIMUM_KEY_ID - 1)).toInt() + 1

    private fun ByteArray.toLowerHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }

    private companion object {
        val SIGNED_PREKEY_DOMAIN = "nantty-signed-prekey-v1".toByteArray(Charsets.UTF_8)
    }
}
