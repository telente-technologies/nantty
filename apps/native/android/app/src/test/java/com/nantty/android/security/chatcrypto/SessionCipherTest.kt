package com.nantty.android.security.chatcrypto

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

class SessionCipherTest {
    @Test
    fun firstMessageMatchesReactNativeFixtureAndConversationUsesPrekeyThenMessageFrames() {
        val alice = device("alice", "vector-a")
        val bob = device("bob", "vector-b")
        alice.cipher.initiateFromBundle(bob.publishBundle())

        val first = alice.cipher.encrypt("bob", bob.identity.deviceId, "vector".toByteArray())
        assertEquals(fixture().getString("firstMessageHex"), first.toHex())
        assertTrue(PairwiseMessageCodec.decode(first) is PairwiseWireMessage.PreKey)
        assertArrayEquals("vector".toByteArray(), bob.cipher.decrypt("alice", alice.identity.deviceId, first) { true })
        assertNull(bob.store.loadOneTimePreKey(TEST_ONE_TIME_PREKEY_ID))

        val reply = bob.cipher.encrypt("alice", alice.identity.deviceId, "reply".toByteArray())
        assertTrue(PairwiseMessageCodec.decode(reply) is PairwiseWireMessage.Message)
        assertArrayEquals("reply".toByteArray(), alice.cipher.decrypt("bob", bob.identity.deviceId, reply) { true })
        val next = alice.cipher.encrypt("bob", bob.identity.deviceId, "next".toByteArray())
        assertTrue(PairwiseMessageCodec.decode(next) is PairwiseWireMessage.Message)
        assertArrayEquals("next".toByteArray(), bob.cipher.decrypt("alice", alice.identity.deviceId, next) { true })
    }

    @Test
    fun noSessionFailsClosedAndResetRemovesSession() {
        val alice = device("alice", "no-session")
        assertFalse(alice.cipher.hasSession("bob", "device"))
        val sendFailure = assertThrows(SessionCipherException::class.java) {
            alice.cipher.encrypt("bob", "device", byteArrayOf(1))
        }
        assertEquals(SessionCipherException.Code.NO_SESSION, sendFailure.code)
        val receiveFailure = assertThrows(SessionCipherException::class.java) {
            alice.cipher.decrypt("bob", "device", byteArrayOf(0x31)) { true }
        }
        assertEquals(SessionCipherException.Code.INVALID_MESSAGE, receiveFailure.code)

        val peer = device("bob", "no-session-peer")
        alice.cipher.initiateFromBundle(peer.publishBundle())
        assertTrue(alice.cipher.hasSession("bob", peer.identity.deviceId))
        alice.cipher.reset("bob", peer.identity.deviceId)
        assertFalse(alice.cipher.hasSession("bob", peer.identity.deviceId))
    }

    @Test
    fun bundleWithInvalidSignedPrekeySignatureDoesNotCreateSession() {
        val alice = device("alice", "signature-a")
        val bob = device("bob", "signature-b")
        val bundle = bob.publishBundle()
        val signature = ChatCryptoPrimitives.decodeBase64(bundle.signedPreKey.signature).also {
            it[it.lastIndex] = (it.last().toInt() xor 1).toByte()
        }

        val failure = assertThrows(SessionCipherException::class.java) {
            alice.cipher.initiateFromBundle(
                bundle.copy(signedPreKey = bundle.signedPreKey.copy(signature = ChatCryptoPrimitives.encodeBase64(signature))),
            )
        }

        assertEquals(SessionCipherException.Code.INVALID_SIGNATURE, failure.code)
        assertFalse(alice.cipher.hasSession("bob", bob.identity.deviceId))
    }

    @Test
    fun untrustedPrekeyMessageDoesNotCreateSessionOrConsumePrekey() {
        val alice = device("alice", "untrusted-a")
        val bob = device("bob", "untrusted-b")
        alice.cipher.initiateFromBundle(bob.publishBundle())
        val first = alice.cipher.encrypt("bob", bob.identity.deviceId, "secret".toByteArray())

        val failure = assertThrows(SessionCipherException::class.java) {
            bob.cipher.decrypt("alice", alice.identity.deviceId, first) { false }
        }

        assertEquals(SessionCipherException.Code.UNTRUSTED_IDENTITY, failure.code)
        assertFalse(bob.cipher.hasSession("alice", alice.identity.deviceId))
        assertTrue(bob.store.loadOneTimePreKey(TEST_ONE_TIME_PREKEY_ID) != null)
    }

    @Test
    fun duplicatePrekeyBaseIsRejectedEvenAfterSessionRecordIsDeleted() {
        val alice = device("alice", "duplicate-a")
        val bob = device("bob", "duplicate-b")
        alice.cipher.initiateFromBundle(bob.publishBundle())
        val first = alice.cipher.encrypt("bob", bob.identity.deviceId, "once".toByteArray())
        bob.cipher.decrypt("alice", alice.identity.deviceId, first) { true }
        val session = bob.store.loadSession("alice", alice.identity.deviceId)
        bob.store.saveSession("alice", alice.identity.deviceId, session.copy(current = null, archived = emptyList()))

        val failure = assertThrows(SessionCipherException::class.java) {
            bob.cipher.decrypt("alice", alice.identity.deviceId, first) { true }
        }

        assertEquals(SessionCipherException.Code.DUPLICATE_MESSAGE, failure.code)
    }

    @Test
    fun missingOneTimePrekeyRejectsMessageWithoutSavingSession() {
        val alice = device("alice", "missing-a")
        val bob = device("bob", "missing-b")
        val bundle = bob.publishBundle()
        alice.cipher.initiateFromBundle(bundle)
        val first = alice.cipher.encrypt("bob", bob.identity.deviceId, "secret".toByteArray())
        bob.store.removeOneTimePreKey(TEST_ONE_TIME_PREKEY_ID)

        val failure = assertThrows(SessionCipherException::class.java) {
            bob.cipher.decrypt("alice", alice.identity.deviceId, first) { true }
        }

        assertEquals(SessionCipherException.Code.PREKEY_NOT_FOUND, failure.code)
        assertFalse(bob.cipher.hasSession("alice", alice.identity.deviceId))
    }

    @Test
    fun failedAtomicFirstMessageCommitKeepsSessionAndOneTimePrekeyAndRetrySucceeds() {
        val alice = device("alice", "atomic-a")
        val bobDao = PersistentDao().apply { failNextBatchAfterFirstMutation = true }
        val bobStorage = AndroidChatCryptoStorage(bobDao, FixedKeyProvider)
        val bob = device("bob", "atomic-b", bobStorage)
        alice.cipher.initiateFromBundle(bob.publishBundle())
        val first = alice.cipher.encrypt("bob", bob.identity.deviceId, "retryable first message".toByteArray())
        val originalSession = bob.store.loadSession("alice", alice.identity.deviceId)

        assertThrows(IllegalStateException::class.java) {
            bob.cipher.decrypt("alice", alice.identity.deviceId, first) { true }
        }

        assertEquals(originalSession, bob.store.loadSession("alice", alice.identity.deviceId))
        assertTrue(bob.store.loadOneTimePreKey(TEST_ONE_TIME_PREKEY_ID) != null)
        assertFalse(bob.cipher.hasSession("alice", alice.identity.deviceId))

        assertArrayEquals(
            "retryable first message".toByteArray(),
            bob.cipher.decrypt("alice", alice.identity.deviceId, first) { true },
        )
        assertTrue(bob.cipher.hasSession("alice", alice.identity.deviceId))
        assertNull(bob.store.loadOneTimePreKey(TEST_ONE_TIME_PREKEY_ID))
        bobStorage.close()
    }

    @Test
    fun firstMessageWithoutOneTimePrekeyStillPersistsSession() {
        val alice = device("alice", "without-opk-a")
        val bob = device("bob", "without-opk-b")
        alice.cipher.initiateFromBundle(bob.publishBundle(oneTimePreKeyId = null))
        val first = alice.cipher.encrypt("bob", bob.identity.deviceId, "signed-prekey only".toByteArray())

        assertArrayEquals("signed-prekey only".toByteArray(), bob.cipher.decrypt("alice", alice.identity.deviceId, first) { true })
        assertTrue(bob.cipher.hasSession("alice", alice.identity.deviceId))
        assertNull(bob.store.loadOneTimePreKey(TEST_ONE_TIME_PREKEY_ID))
    }

    @Test
    fun encryptedStoreReopenPreservesSessionAndArchivedSessionDecryptsInFlightMessage() {
        val dao = PersistentDao()
        val alice = device("alice", "archive-a")
        val bobStorage = AndroidChatCryptoStorage(dao, FixedKeyProvider)
        val bob = device("bob", "archive-b", bobStorage)

        alice.cipher.initiateFromBundle(bob.publishBundle())
        val first = alice.cipher.encrypt("bob", bob.identity.deviceId, "initial".toByteArray())
        bob.cipher.decrypt("alice", alice.identity.deviceId, first) { true }
        val reply = bob.cipher.encrypt("alice", alice.identity.deviceId, "ack".toByteArray())
        alice.cipher.decrypt("bob", bob.identity.deviceId, reply) { true }
        val inFlight = alice.cipher.encrypt("bob", bob.identity.deviceId, "old session".toByteArray())

        bobStorage.close()
        val reopenedStorage = AndroidChatCryptoStorage(dao, FixedKeyProvider)
        val reopenedStore = ProtocolStore(reopenedStorage)
        val reopenedCipher = SessionCipher(reopenedStore, bob.identity, bob.random)
        assertTrue(reopenedCipher.hasSession("alice", alice.identity.deviceId))

        alice.cipher.reset("bob", bob.identity.deviceId)
        alice.cipher.initiateFromBundle(bob.publishBundle(oneTimePreKeyId = TEST_ONE_TIME_PREKEY_ID + 1))
        val replacement = alice.cipher.encrypt("bob", bob.identity.deviceId, "new session".toByteArray())
        reopenedCipher.decrypt("alice", alice.identity.deviceId, replacement) { true }

        assertArrayEquals("old session".toByteArray(), reopenedCipher.decrypt("alice", alice.identity.deviceId, inFlight) { true })
        assertEquals(1, reopenedStore.loadSession("alice", alice.identity.deviceId).archived.size)
        reopenedStorage.close()
    }

    private fun device(userId: String, seed: String, storage: ChatCryptoStorage = MemoryStorage()): TestDevice {
        val random = seededRandom(seed)
        val deviceId = random(16).toLowerHex()
        val registrationId = ((readUint32(random(4)) and 0x7fff_ffffL) % 16_380L + 1).toInt()
        val signingSeed = random(32)
        val identity = ChatDeviceIdentity(
            userId,
            deviceId,
            registrationId,
            signingSeed,
            ChatCryptoPrimitives.ed25519PublicKey(signingSeed),
        )
        val store = ProtocolStore(storage)
        val cipher = SessionCipher(store, identity, ChatCryptoRandomSource(random))
        return TestDevice(identity, store, cipher, random)
    }

    private class TestDevice(
        val identity: ChatDeviceIdentity,
        val store: ProtocolStore,
        val cipher: SessionCipher,
        val random: (Int) -> ByteArray,
    ) {
        fun publishBundle(
            oneTimePreKeyId: Int? = TEST_ONE_TIME_PREKEY_ID,
        ): ChatPreKeyBundle {
            val signedPrivate = random(32)
            val signedPublic = ChatCryptoPrimitives.x25519PublicKey(signedPrivate)
            val signedId = TEST_SIGNED_PREKEY_ID
            val signature = ChatCryptoPrimitives.ed25519Sign(
                identity.signingSeed,
                SIGNED_PREKEY_DOMAIN + ChatCryptoPrimitives.writeUint32(signedId.toLong()) + signedPublic,
            )
            val oneTimePrivate = oneTimePreKeyId?.let { random(32) }
            val oneTimePublic = oneTimePrivate?.let(ChatCryptoPrimitives::x25519PublicKey)
            store.saveSignedPreKey(
                mapOf(
                    "keyId" to signedId,
                    "keyPair" to mapOf("publicKey" to signedPublic, "secretKey" to signedPrivate),
                    "signature" to signature,
                    "createdAt" to 0L,
                ),
            )
            if (oneTimePreKeyId != null) {
                store.saveOneTimePreKey(
                    mapOf(
                        "keyId" to oneTimePreKeyId,
                        "keyPair" to mapOf("publicKey" to oneTimePublic, "secretKey" to oneTimePrivate),
                    ),
                )
            }
            return ChatPreKeyBundle(
                userId = identity.userId,
                deviceId = identity.deviceId,
                registrationId = identity.registrationId,
                identityKey = ChatCryptoPrimitives.encodeBase64(identity.signingPublicKey),
                signedPreKey = ChatWireSignedPreKey(
                    keyId = signedId,
                    publicKey = ChatCryptoPrimitives.encodeBase64(signedPublic),
                    signature = ChatCryptoPrimitives.encodeBase64(signature),
                ),
                oneTimePreKey = oneTimePreKeyId?.let { ChatWireOneTimePreKey(it, ChatCryptoPrimitives.encodeBase64(requireNotNull(oneTimePublic))) },
            )
        }
    }

    private class MemoryStorage : ChatCryptoStorage {
        override val secrets = MemoryKeyValueStore()
        override val records = MemoryKeyValueStore()
        override fun close() = Unit
    }

    private class MemoryKeyValueStore : ChatCryptoKeyValueStore {
        private val values = ConcurrentHashMap<String, String>()
        override fun get(key: String): String? = values[key]
        override fun set(key: String, value: String) { values[key] = value }
        override fun delete(key: String) { values.remove(key) }
        override fun applyBatch(mutations: List<ChatCryptoKeyValueMutation>) {
            synchronized(values) {
                val staged = values.toMutableMap()
                mutations.forEach { mutation ->
                    when (mutation) {
                        is ChatCryptoKeyValueMutation.Set -> staged[mutation.key] = mutation.value
                        is ChatCryptoKeyValueMutation.Delete -> staged.remove(mutation.key)
                    }
                }
                values.clear()
                values.putAll(staged)
            }
        }
        override fun keys(prefix: String): List<String> = values.keys.filter { it.startsWith(prefix) }.sorted()
    }

    private class PersistentDao : ChatCryptoValueDao {
        private val values = ConcurrentHashMap<Pair<ChatCryptoNamespace, String>, ByteArray>()
        var failNextBatchAfterFirstMutation: Boolean = false
        override fun get(namespace: ChatCryptoNamespace, key: String): ByteArray? = values[namespace to key]?.copyOf()
        override fun set(namespace: ChatCryptoNamespace, key: String, ciphertext: ByteArray) {
            values[namespace to key] = ciphertext.copyOf()
        }
        override fun delete(namespace: ChatCryptoNamespace, key: String) { values.remove(namespace to key) }
        override fun applyBatch(mutations: List<ChatCryptoValueMutation>) {
            synchronized(values) {
                val staged = values.mapValues { (_, value) -> value.copyOf() }.toMutableMap()
                mutations.forEachIndexed { index, mutation ->
                    when (mutation) {
                        is ChatCryptoValueMutation.Set -> staged[mutation.namespace to mutation.key] = mutation.ciphertext.copyOf()
                        is ChatCryptoValueMutation.Delete -> staged.remove(mutation.namespace to mutation.key)
                    }
                    if (index == 0 && failNextBatchAfterFirstMutation) {
                        failNextBatchAfterFirstMutation = false
                        throw IllegalStateException("injected atomic batch failure")
                    }
                }
                values.clear()
                values.putAll(staged)
            }
        }
        override fun keys(namespace: ChatCryptoNamespace, prefix: String): List<String> =
            values.keys.filter { it.first == namespace && it.second.startsWith(prefix) }.map { it.second }.sorted()
    }

    private object FixedKeyProvider : ChatCryptoStorageKeyProvider {
        private val key: SecretKey = SecretKeySpec(ByteArray(32) { (it + 1).toByte() }, "AES")
        override fun getOrCreate(): SecretKey = key
    }

    private fun fixture(): JSONObject {
        val relative = "packages/chatCrypto/fixtures/pairwise-message-v1.json"
        val start = File(System.getProperty("user.dir").orEmpty())
        val file = generateSequence(start) { it.parentFile }.map { File(it, relative) }.firstOrNull(File::isFile)
        return JSONObject(requireNotNull(file) { "Could not locate shared pairwise fixture from ${start.path}" }.readText())
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

    private fun readUint32(bytes: ByteArray): Long =
        ((bytes[0].toLong() and 0xff) shl 24) or ((bytes[1].toLong() and 0xff) shl 16) or
            ((bytes[2].toLong() and 0xff) shl 8) or (bytes[3].toLong() and 0xff)

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }
    private fun ByteArray.toLowerHex(): String = toHex()

    private companion object {
        const val TEST_SIGNED_PREKEY_ID = 11
        const val TEST_ONE_TIME_PREKEY_ID = 500
        val SIGNED_PREKEY_DOMAIN = "nantty-signed-prekey-v1".toByteArray(Charsets.UTF_8)
    }
}
