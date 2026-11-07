package com.nantty.android.security.chatcrypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

class DoubleRatchetRecordCodecTest {
    @Test
    fun fullStateRoundTripsThroughProtocolStoreEncryptedStorage() {
        val dao = PersistentDaoHarness()
        val storage = AndroidChatCryptoStorage(dao.open(), FixedTestKeyProvider)
        val state = fullState()
        val store = ProtocolStore(storage)

        val rememberedBaseKeys = listOf(ChatCryptoPrimitives.encodeBase64(bytes(31)), ChatCryptoPrimitives.encodeBase64(bytes(32)))
        store.saveSession("user", "device", ProtocolSessionRecord(DoubleRatchetRecordCodec.encode(state), emptyList(), rememberedBaseKeys))

        val encodedJson = requireNotNull(storage.records.get("session:user:device"))
        assertEquals(true, encodedJson.contains("\"\$b64\""))
        storage.close()

        val reopenedStorage = AndroidChatCryptoStorage(dao.open(), FixedTestKeyProvider)
        val record = ProtocolStore(reopenedStorage).loadSession("user", "device")
        val restored = DoubleRatchetRecordCodec.decode(requireNotNull(record.current))
        assertEquals(rememberedBaseKeys, record.seenBaseKeys)
        assertStateEquals(state, restored)
        assertNull(restored.remoteRatchetKey)
        assertNull(restored.receivingChain)
        assertEquals(null, restored.pendingPreKey?.oneTimePreKeyId)
        assertEquals(4_294_967_295L, restored.previousCounter)
        assertEquals(4_294_967_295L, restored.sendingChain?.index)
        reopenedStorage.close()
    }

    @Test
    fun sessionStoreReadsLegacyRecordsAndBoundsRememberedPrekeyKeys() {
        val storage = AndroidChatCryptoStorage(PersistentDaoHarness().open(), FixedTestKeyProvider)
        storage.records.set("session:legacy-user:legacy-device", "{\"current\":null,\"archived\":[]}")

        assertEquals(emptyList<String>(), ProtocolStore(storage).loadSession("legacy-user", "legacy-device").seenBaseKeys)

        val tooManyKeys = List(65) { ChatCryptoPrimitives.encodeBase64(bytes(it + 1)) }
        ProtocolStore(storage).saveSession("peer", "device", ProtocolSessionRecord(null, emptyList(), tooManyKeys))
        assertEquals(64, ProtocolStore(storage).loadSession("peer", "device").seenBaseKeys.size)
        storage.close()
    }

    @Test
    fun codecDefensivelyCopiesBytesOnEncodeAndDecode() {
        val state = fullState()
        val rootBefore = state.rootKey.copyOf()
        val encoded = DoubleRatchetRecordCodec.encode(state).toMutableMap()
        state.rootKey.fill(0)
        val encodedRoot = encoded["rootKey"] as ByteArray
        assertArrayEquals(rootBefore, encodedRoot)

        val decoded = DoubleRatchetRecordCodec.decode(encoded)
        encodedRoot.fill(0)
        assertArrayEquals(rootBefore, decoded.rootKey)
    }

    @Test
    fun nullFieldsAreRequiredAndPreserved() {
        val encoded = DoubleRatchetRecordCodec.encode(fullState()).toMutableMap()
        encoded["remoteRatchetKey"] = null
        encoded["sendingChain"] = null
        encoded["receivingChain"] = null
        encoded["pendingPreKey"] = null
        val decoded = DoubleRatchetRecordCodec.decode(encoded)
        assertNull(decoded.remoteRatchetKey)
        assertNull(decoded.sendingChain)
        assertNull(decoded.receivingChain)
        assertNull(decoded.pendingPreKey)

        encoded.remove("pendingPreKey")
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(encoded) }
    }

    @Test
    fun rejectsMissingUnexpectedAndTypeInvalidFields() {
        val baseline = DoubleRatchetRecordCodec.encode(fullState())

        val missing = baseline.toMutableMap().apply { remove("associatedData") }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(missing) }

        val unexpected = baseline.toMutableMap().apply { put("extra", "not in SessionRecord") }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(unexpected) }

        val wrongRoot = baseline.toMutableMap().apply { put("rootKey", "not bytes") }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(wrongRoot) }

        val wrongNestedType = baseline.toMutableMap().apply { put("sendingRatchet", listOf(1, 2)) }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(wrongNestedType) }

        val wrongChain = baseline.toMutableMap().apply { put("sendingChain", mapOf("key" to ByteArray(32), "index" to "3")) }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(wrongChain) }

        val wrongPending = baseline.toMutableMap().apply { put("pendingPreKey", mapOf("signedPreKeyId" to 1L)) }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(wrongPending) }
    }

    @Test
    fun rejectsInvalidByteLengthsCountersAndOversizedCollections() {
        val baseline = DoubleRatchetRecordCodec.encode(fullState())
        val wrongKey = baseline.toMutableMap().apply { put("rootKey", ByteArray(31)) }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(wrongKey) }

        val negativeCounter = baseline.toMutableMap().apply { put("previousCounter", -1L) }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(negativeCounter) }

        val overflowCounter = baseline.toMutableMap().apply { put("previousCounter", 4_294_967_296L) }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(overflowCounter) }

        val fractionalCounter = baseline.toMutableMap().apply { put("previousCounter", 1.5) }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(fractionalCounter) }

        val tooManyPreviousKeys = baseline.toMutableMap().apply { put("previousRemoteRatchetKeys", List(9) { ByteArray(32) }) }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(tooManyPreviousKeys) }

        val tooManySkipped = baseline.toMutableMap().apply {
            put("skipped", List(DoubleRatchet.MAXIMUM_STORED_SKIPPED_KEYS + 1) {
                mapOf("ratchetKey" to ByteArray(32), "index" to 0L, "messageKey" to ByteArray(32))
            })
        }
        assertThrows(IllegalArgumentException::class.java) { DoubleRatchetRecordCodec.decode(tooManySkipped) }
    }

    private fun fullState() = DoubleRatchet.RatchetState(
        rootKey = bytes(1),
        sendingRatchet = DoubleRatchet.AgreementKeyPair(bytes(2), bytes(3)),
        remoteRatchetKey = null,
        previousRemoteRatchetKeys = listOf(bytes(4), bytes(5)),
        sendingChain = DoubleRatchet.ChainState(bytes(6), 4_294_967_295L),
        receivingChain = null,
        previousCounter = 4_294_967_295L,
        skipped = listOf(
            DoubleRatchet.SkippedMessageKey(bytes(7), 0L, bytes(8)),
            DoubleRatchet.SkippedMessageKey(bytes(9), 4_294_967_294L, bytes(10)),
        ),
        associatedData = byteArrayOf(11, 12, 13, 14),
        remoteIdentityKey = bytes(15),
        baseKey = bytes(16),
        pendingPreKey = DoubleRatchet.PendingPreKey(4_294_967_295L, null),
    )

    private fun bytes(seed: Int) = ByteArray(32) { index -> (seed + index).toByte() }

    private fun assertStateEquals(expected: DoubleRatchet.RatchetState, actual: DoubleRatchet.RatchetState) {
        assertArrayEquals(expected.rootKey, actual.rootKey)
        assertArrayEquals(expected.sendingRatchet.publicKey, actual.sendingRatchet.publicKey)
        assertArrayEquals(expected.sendingRatchet.secretKey, actual.sendingRatchet.secretKey)
        assertEquals(expected.remoteRatchetKey == null, actual.remoteRatchetKey == null)
        expected.remoteRatchetKey?.let { assertArrayEquals(it, actual.remoteRatchetKey) }
        assertEquals(expected.previousRemoteRatchetKeys.size, actual.previousRemoteRatchetKeys.size)
        expected.previousRemoteRatchetKeys.indices.forEach { index ->
            assertArrayEquals(expected.previousRemoteRatchetKeys[index], actual.previousRemoteRatchetKeys[index])
        }
        assertChainEquals(expected.sendingChain, actual.sendingChain)
        assertChainEquals(expected.receivingChain, actual.receivingChain)
        assertEquals(expected.previousCounter, actual.previousCounter)
        assertEquals(expected.skipped.size, actual.skipped.size)
        expected.skipped.indices.forEach { index ->
            val left = expected.skipped[index]
            val right = actual.skipped[index]
            assertArrayEquals(left.ratchetKey, right.ratchetKey)
            assertEquals(left.index, right.index)
            assertArrayEquals(left.messageKey, right.messageKey)
        }
        assertArrayEquals(expected.associatedData, actual.associatedData)
        assertArrayEquals(expected.remoteIdentityKey, actual.remoteIdentityKey)
        assertArrayEquals(expected.baseKey, actual.baseKey)
        assertEquals(expected.pendingPreKey, actual.pendingPreKey)
    }

    private fun assertChainEquals(expected: DoubleRatchet.ChainState?, actual: DoubleRatchet.ChainState?) {
        assertEquals(expected == null, actual == null)
        if (expected != null && actual != null) {
            assertArrayEquals(expected.key, actual.key)
            assertEquals(expected.index, actual.index)
        }
    }

    private class PersistentDaoHarness {
        private val rows = ConcurrentHashMap<Pair<ChatCryptoNamespace, String>, ByteArray>()

        fun open(): ChatCryptoValueDao = object : ChatCryptoValueDao {
            override fun get(namespace: ChatCryptoNamespace, key: String): ByteArray? = rows[namespace to key]?.copyOf()
            override fun set(namespace: ChatCryptoNamespace, key: String, ciphertext: ByteArray) {
                rows[namespace to key] = ciphertext.copyOf()
            }
            override fun delete(namespace: ChatCryptoNamespace, key: String) {
                rows.remove(namespace to key)
            }
            override fun applyBatch(mutations: List<ChatCryptoValueMutation>) {
                synchronized(rows) {
                    val staged = rows.mapValues { (_, value) -> value.copyOf() }.toMutableMap()
                    mutations.forEach { mutation ->
                        when (mutation) {
                            is ChatCryptoValueMutation.Set -> staged[mutation.namespace to mutation.key] = mutation.ciphertext.copyOf()
                            is ChatCryptoValueMutation.Delete -> staged.remove(mutation.namespace to mutation.key)
                        }
                    }
                    rows.clear()
                    rows.putAll(staged)
                }
            }
            override fun keys(namespace: ChatCryptoNamespace, prefix: String): List<String> = rows.keys
                .asSequence()
                .filter { (storedNamespace, storedKey) -> storedNamespace == namespace && storedKey.startsWith(prefix) }
                .map { it.second }
                .sorted()
                .toList()
        }
    }

    private object FixedTestKeyProvider : ChatCryptoStorageKeyProvider {
        private val key: SecretKey = SecretKeySpec(ByteArray(32) { (it * 5 + 17).toByte() }, "AES")
        override fun getOrCreate(): SecretKey = key
    }
}
