package com.nantty.android.security.chatcrypto

internal data class X3dhPreKeyBundle(
    val identityKey: ByteArray,
    val signedPreKeyId: Long,
    val signedPreKey: ByteArray,
    val signedPreKeySignature: ByteArray,
    val oneTimePreKey: ByteArray? = null,
)

internal data class X3dhInitiation(
    val baseKeyPublic: ByteArray,
    val sharedSecret: ByteArray,
    val associatedData: ByteArray,
)

internal data class X3dhResponse(
    val sharedSecret: ByteArray,
    val associatedData: ByteArray,
)

/**
 * Port of the current React Native `x3dh.ts` exchange. This establishes only the
 * initial shared secret; it is deliberately not wired to message send/decrypt or a ratchet.
 */
internal object X3dh {
    private val signedPreKeyDomain = "nantty-signed-prekey-v1".toByteArray(Charsets.UTF_8)
    private val kdfDomain = ByteArray(32) { 0xff.toByte() }
    private val zeroSalt = ByteArray(32)
    private val kdfInfo = "NanttyX3DHv1".toByteArray(Charsets.UTF_8)

    fun initiate(
        localIdentitySeed: ByteArray,
        localIdentityKey: ByteArray,
        bundle: X3dhPreKeyBundle,
        baseKeyPrivate: ByteArray,
    ): X3dhInitiation {
        require(bundle.signedPreKeyId in 0L..0xffff_ffffL) { "Signed prekey id is not uint32" }
        val signedMessage = signedPreKeyDomain + ChatCryptoPrimitives.writeUint32(bundle.signedPreKeyId) + bundle.signedPreKey
        require(ChatCryptoPrimitives.ed25519Verify(bundle.signedPreKeySignature, signedMessage, bundle.identityKey)) {
            "The signed prekey signature is invalid"
        }

        val baseKeyPublic = ChatCryptoPrimitives.x25519PublicKey(baseKeyPrivate)
        val agreements = arrayOf(
            ChatCryptoPrimitives.x25519(
                ChatCryptoPrimitives.ed25519SeedToX25519Private(localIdentitySeed),
                bundle.signedPreKey,
            ),
            ChatCryptoPrimitives.x25519(baseKeyPrivate, ChatCryptoPrimitives.ed25519PublicToX25519(bundle.identityKey)),
            ChatCryptoPrimitives.x25519(baseKeyPrivate, bundle.signedPreKey),
        ) + (bundle.oneTimePreKey?.let { arrayOf(ChatCryptoPrimitives.x25519(baseKeyPrivate, it)) } ?: emptyArray())

        return X3dhInitiation(
            baseKeyPublic = baseKeyPublic,
            sharedSecret = deriveSharedSecret(agreements),
            associatedData = localIdentityKey + bundle.identityKey,
        )
    }

    fun respond(
        localIdentitySeed: ByteArray,
        localIdentityKey: ByteArray,
        signedPreKeyPrivate: ByteArray,
        oneTimePreKeyPrivate: ByteArray?,
        remoteIdentityKey: ByteArray,
        remoteBaseKey: ByteArray,
    ): X3dhResponse {
        val agreements = arrayOf(
            ChatCryptoPrimitives.x25519(signedPreKeyPrivate, ChatCryptoPrimitives.ed25519PublicToX25519(remoteIdentityKey)),
            ChatCryptoPrimitives.x25519(
                ChatCryptoPrimitives.ed25519SeedToX25519Private(localIdentitySeed),
                remoteBaseKey,
            ),
            ChatCryptoPrimitives.x25519(signedPreKeyPrivate, remoteBaseKey),
        ) + (oneTimePreKeyPrivate?.let { arrayOf(ChatCryptoPrimitives.x25519(it, remoteBaseKey)) } ?: emptyArray())

        return X3dhResponse(
            sharedSecret = deriveSharedSecret(agreements),
            associatedData = remoteIdentityKey + localIdentityKey,
        )
    }

    private fun deriveSharedSecret(agreements: Array<ByteArray>): ByteArray {
        val inputKeyMaterial = kdfDomain + agreements.fold(ByteArray(0)) { acc, secret -> acc + secret }
        return try {
            ChatCryptoPrimitives.hkdfSha256(inputKeyMaterial, zeroSalt, kdfInfo, 32)
        } finally {
            inputKeyMaterial.fill(0)
            agreements.forEach { it.fill(0) }
        }
    }
}
