package com.nantty.android.security.chatcrypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

class ProtocolStoreTest {
    private val daoHarness = PersistentDaoHarness()
    private val keys = FixedTestKeyProvider

    @Test
    fun protocolKeySemanticsMatchReactNativeAndKeepNamespacesSeparate() {
        val storage = AndroidChatCryptoStorage(daoHarness.open(), keys)
        val store = ProtocolStore(storage)
        val identity = mapOf("userId" to "u-1", "deviceId" to "d-1", "signing" to mapOf("secretKey" to byteArrayOf(1, 2, 3)))
        store.saveIdentity(identity)
        store.saveCounters(ProtocolPreKeyCounters(21, 8, listOf(6, 7)))
        store.saveSignedPreKey(mapOf("keyId" to 8, "keyPair" to mapOf("secretKey" to byteArrayOf(4))))
        store.saveOneTimePreKey(mapOf("keyId" to 21, "keyPair" to mapOf("secretKey" to byteArrayOf(5))))
        store.saveSession("u-1", "device:a", ProtocolSessionRecord(mapOf("rootKey" to byteArrayOf(6)), listOf(mapOf("rootKey" to byteArrayOf(7)))))
        store.saveSession("u-1", "device:b", ProtocolSessionRecord(null, emptyList()))
        store.saveSession("u-2", "device:c", ProtocolSessionRecord(null, emptyList()))
        store.saveOwnSenderKey("c-1", mapOf("keyId" to 3))
        store.savePeerSenderKey("c-1", "u-2", "device:c", mapOf("states" to listOf(mapOf("keyId" to 4))))
        store.saveTrust("u-2", mapOf("devices" to mapOf("device:c" to "identity-key"), "changedAt" to null, "acknowledgedAt" to null))
        store.savePlaintext("m-1", ProtocolCachedPlaintext(mapOf("text" to "hello", "body" to byteArrayOf(8, 9)), null, "2030-01-01T00:00:00.000Z"))

        assertEquals("u-1", store.loadIdentity()?.get("userId"))
        assertArrayEquals(byteArrayOf(1, 2, 3), ((store.loadIdentity()?.get("signing") as Map<*, *>)["secretKey"] as ByteArray))
        assertEquals(ProtocolPreKeyCounters(21, 8, listOf(6, 7)), store.loadCounters())
        assertEquals(byteArrayOf(4).toList(), ((store.loadSignedPreKey(8)?.get("keyPair") as Map<*, *>)["secretKey"] as ByteArray).toList())
        assertEquals(listOf("device:a", "device:b"), store.sessionDeviceIds("u-1"))
        assertEquals(listOf("device:c"), store.sessionDeviceIds("u-2"))
        assertEquals(ProtocolSessionRecord(null, emptyList()), store.loadSession("unknown", "device"))
        assertEquals("identity-key", ((store.loadTrust("u-2")?.get("devices") as Map<*, *>)["device:c"]))
        assertEquals("2030-01-01T00:00:00.000Z", store.loadPlaintext("m-1")?.expiresAt)
        assertEquals(listOf("m-1"), store.plaintextMessageIds())

        store.removeSignedPreKey(8)
        store.removeOneTimePreKey(21)
        store.deleteSession("u-1", "device:a")
        store.deleteOwnSenderKey("c-1")
        store.deletePlaintext("m-1")
        assertNull(store.loadSignedPreKey(8))
        assertNull(store.loadOneTimePreKey(21))
        assertEquals(listOf("device:b"), store.sessionDeviceIds("u-1"))
        assertNull(store.loadOwnSenderKey("c-1"))
        assertNull(store.loadPlaintext("m-1"))
        storage.close()
    }

    @Test
    fun groupKeysDeduplicateSortNewestFirstAndEnforceEightRecordCap() {
        val storage = AndroidChatCryptoStorage(daoHarness.open(), keys)
        val store = ProtocolStore(storage)
        assertTrue(store.addGroupKey("g", ProtocolStoredGroupKey("key-0", "2026-01-01T00:00:00Z")))
        assertFalse(store.addGroupKey("g", ProtocolStoredGroupKey("key-0", "2027-01-01T00:00:00Z")))
        repeat(10) { index ->
            store.addGroupKey("g", ProtocolStoredGroupKey("key-${index + 1}", "2026-01-${(index + 2).toString().padStart(2, '0')}T00:00:00Z"))
        }
        val keys = store.loadGroupKeys("g")
        assertEquals(8, keys.size)
        assertEquals("key-10", keys.first().key)
        assertEquals(keys.sortedByDescending { it.at }, keys)
        storage.close()
    }

    @Test
    fun valuesSurviveStorageRestartThroughPersistentDaoHarness() {
        val firstStorage = AndroidChatCryptoStorage(daoHarness.open(), keys)
        ProtocolStore(firstStorage).saveSession("user", "device", ProtocolSessionRecord(mapOf("chain" to byteArrayOf(1, 3, 5)), emptyList()))
        firstStorage.close()

        val reopenedStorage = AndroidChatCryptoStorage(daoHarness.open(), keys)
        val restored = ProtocolStore(reopenedStorage).loadSession("user", "device")
        assertArrayEquals(byteArrayOf(1, 3, 5), (restored.current?.get("chain") as ByteArray))
        reopenedStorage.close()
    }

    @Test
    fun clearEverythingRemovesAllNamespacesButNotByPrefixAccident() {
        val storage = AndroidChatCryptoStorage(daoHarness.open(), keys)
        val store = ProtocolStore(storage)
        storage.secrets.set("identity", "s")
        storage.records.set("identity", "r")
        storage.records.set("unrelated:identity", "r2")
        store.clearEverything()
        assertEquals(emptyList<String>(), storage.secrets.keys(""))
        assertEquals(emptyList<String>(), storage.records.keys(""))
        assertNull(storage.secrets.get("identity"))
        storage.close()
    }

    @Test
    fun malformedSerializedProtocolRecordsFailClosed() {
        val storage = AndroidChatCryptoStorage(daoHarness.open(), keys)
        val store = ProtocolStore(storage)
        storage.records.set("prekeys:counters", "{not-json")
        assertThrows(IllegalStateException::class.java) { store.loadCounters() }
        storage.records.set("prekeys:counters", "{\"nextOneTimePreKeyId\":\"bad\",\"currentSignedPreKeyId\":1,\"previousSignedPreKeyIds\":[]}")
        assertThrows(IllegalStateException::class.java) { store.loadCounters() }
        storage.records.set("session:user:device", "{\"current\":null,\"archived\":{}}")
        assertThrows(IllegalStateException::class.java) { store.loadSession("user", "device") }
        storage.records.set("plain:message", "{\"payload\":null,\"failure\":null,\"expiresAt\":17}")
        assertThrows(IllegalStateException::class.java) { store.loadPlaintext("message") }
        storage.records.set("plain:bytes", "{\"payload\":{\"text\":{\"\$b64\":\"%%%\"}},\"failure\":null,\"expiresAt\":null}")
        assertThrows(IllegalStateException::class.java) { store.loadPlaintext("bytes") }
        storage.close()
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
            override fun keys(namespace: ChatCryptoNamespace, prefix: String): List<String> = rows.keys
                .asSequence()
                .filter { (storedNamespace, storedKey) -> storedNamespace == namespace && storedKey.startsWith(prefix) }
                .map { it.second }
                .sorted()
                .toList()
        }
    }

    private object FixedTestKeyProvider : ChatCryptoStorageKeyProvider {
        private val testKey: SecretKey = SecretKeySpec(ByteArray(32) { (it * 7 + 11).toByte() }, "AES")
        override fun getOrCreate(): SecretKey = testKey
    }
}
