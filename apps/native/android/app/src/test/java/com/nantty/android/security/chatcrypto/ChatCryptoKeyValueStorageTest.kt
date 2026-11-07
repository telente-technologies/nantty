package com.nantty.android.security.chatcrypto

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

class ChatCryptoKeyValueStorageTest {
    private val dao = InMemoryChatCryptoValueDao()
    private val storage = AndroidChatCryptoStorage(dao, TestChatCryptoKeyProvider)

    @Test
    fun namespacesKeepSameLogicalKeyIndependentAndCrudMatchesContract() {
        storage.secrets.set("identity", "secret identity")
        storage.records.set("identity", "record identity")

        assertNull(storage.secrets.get("missing"))
        assertTrue(storage.secrets.keys("").contains("identity"))
        assertTrue(storage.records.keys("").contains("identity"))
        assertTrue(storage.secrets.get("identity") == "secret identity")
        assertTrue(storage.records.get("identity") == "record identity")

        storage.secrets.delete("identity")
        storage.secrets.delete("already-missing")
        assertNull(storage.secrets.get("identity"))
        assertTrue(storage.records.get("identity") == "record identity")
    }

    @Test
    fun keysUsesLiteralPrefixAndSupportsEmptyAndUnicodeKeys() {
        storage.records.set("session:user:%_one", "first")
        storage.records.set("session:user:%_two", "second")
        storage.records.set("session:user:other", "third")
        storage.records.set("💬:conversation", "unicode key")
        storage.records.set("", "empty key")

        assertTrue(storage.records.keys("session:user:%_").toSet() == setOf("session:user:%_one", "session:user:%_two"))
        assertTrue(storage.records.keys("💬:") == listOf("💬:conversation"))
        assertTrue(storage.records.keys("").size == 5)
        assertTrue(storage.records.get("") == "empty key")
    }

    @Test
    fun storesOnlyAuthenticatedCiphertextAndUsesFreshNoncePerWrite() {
        val plaintext = "identity-secret-plaintext"
        storage.secrets.set("identity", plaintext)
        val first = requireNotNull(dao.get(ChatCryptoNamespace.SECRETS, "identity"))
        storage.secrets.set("identity", plaintext)
        val second = requireNotNull(dao.get(ChatCryptoNamespace.SECRETS, "identity"))

        assertFalse(String(first, StandardCharsets.UTF_8).contains(plaintext))
        assertFalse(String(second, StandardCharsets.UTF_8).contains(plaintext))
        assertFalse(first.contentEquals(second))
        assertTrue(storage.secrets.get("identity") == plaintext)
    }

    @Test
    fun ciphertextCannotMoveBetweenKeysOrNamespaces() {
        storage.secrets.set("identity", "secret")
        val ciphertext = requireNotNull(dao.get(ChatCryptoNamespace.SECRETS, "identity"))
        dao.set(ChatCryptoNamespace.SECRETS, "renamed", ciphertext)
        dao.set(ChatCryptoNamespace.RECORDS, "identity", ciphertext)

        assertThrows(AEADBadTagException::class.java) { storage.secrets.get("renamed") }
        assertThrows(AEADBadTagException::class.java) { storage.records.get("identity") }
    }

    @Test
    fun malformedOrTamperedCiphertextFailsClosed() {
        dao.set(ChatCryptoNamespace.RECORDS, "truncated", byteArrayOf(0x4e, 0x43, 0x4b, 0x56, 1))
        dao.set(ChatCryptoNamespace.RECORDS, "unknown-version", byteArrayOf(0x4e, 0x43, 0x4b, 0x56, 2) + ByteArray(28))
        storage.records.set("tampered", "original")
        val corrupted = requireNotNull(dao.get(ChatCryptoNamespace.RECORDS, "tampered")).also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
        dao.set(ChatCryptoNamespace.RECORDS, "tampered", corrupted)

        assertThrows(IllegalArgumentException::class.java) { storage.records.get("truncated") }
        assertThrows(IllegalArgumentException::class.java) { storage.records.get("unknown-version") }
        assertThrows(AEADBadTagException::class.java) { storage.records.get("tampered") }
        assertTrue(storage.records.keys("tampered") == listOf("tampered"))
    }

    @Test
    fun emptyAndMultibyteValuesRoundTripWithoutNormalization() {
        storage.secrets.set("empty", "")
        storage.records.set("message", "Nantty — 👋🏽 — 𐐷")

        assertTrue(storage.secrets.get("empty") == "")
        assertTrue(storage.records.get("message") == "Nantty — 👋🏽 — 𐐷")
    }

    @Test
    fun encryptedBatchCommitsSetAndDeleteAndStoresCiphertextOnly() {
        storage.records.set("session:user:device", "old-session")
        storage.records.set("opk:500", "one-time-private-key")

        storage.records.applyBatch(
            listOf(
                ChatCryptoKeyValueMutation.Set("session:user:device", "new-session"),
                ChatCryptoKeyValueMutation.Delete("opk:500"),
            ),
        )

        assertTrue(storage.records.get("session:user:device") == "new-session")
        assertNull(storage.records.get("opk:500"))
        val ciphertext = requireNotNull(dao.get(ChatCryptoNamespace.RECORDS, "session:user:device"))
        assertFalse(String(ciphertext, StandardCharsets.UTF_8).contains("new-session"))
    }

    @Test
    fun encryptionFailureBeforeDaoBatchLeavesExistingValuesUnchanged() {
        val cipherCount = intArrayOf(0)
        val failingStorage = AndroidChatCryptoStorage(
            dao,
            TestChatCryptoKeyProvider,
            ChatCryptoCipherFactory {
                cipherCount[0] += 1
                if (cipherCount[0] == 2) throw IllegalStateException("injected encryption failure")
                javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
            },
        )
        storage.records.set("session:user:device", "old-session")
        storage.records.set("opk:500", "one-time-private-key")

        assertThrows(IllegalStateException::class.java) {
            failingStorage.records.applyBatch(
                listOf(
                    ChatCryptoKeyValueMutation.Set("session:user:device", "new-session"),
                    ChatCryptoKeyValueMutation.Set("other", "other-value"),
                    ChatCryptoKeyValueMutation.Delete("opk:500"),
                ),
            )
        }

        assertTrue(failingStorage.records.get("session:user:device") == "old-session")
        assertNull(failingStorage.records.get("other"))
        assertTrue(failingStorage.records.get("opk:500") == "one-time-private-key")
    }

    private class InMemoryChatCryptoValueDao : ChatCryptoValueDao {
        private val values = ConcurrentHashMap<Pair<ChatCryptoNamespace, String>, ByteArray>()

        override fun get(namespace: ChatCryptoNamespace, key: String): ByteArray? = values[namespace to key]?.copyOf()
        override fun set(namespace: ChatCryptoNamespace, key: String, ciphertext: ByteArray) {
            values[namespace to key] = ciphertext.copyOf()
        }
        override fun delete(namespace: ChatCryptoNamespace, key: String) {
            values.remove(namespace to key)
        }
        override fun applyBatch(mutations: List<ChatCryptoValueMutation>) {
            synchronized(values) {
                val staged = values.mapValues { (_, value) -> value.copyOf() }.toMutableMap()
                mutations.forEach { mutation ->
                    when (mutation) {
                        is ChatCryptoValueMutation.Set -> staged[mutation.namespace to mutation.key] = mutation.ciphertext.copyOf()
                        is ChatCryptoValueMutation.Delete -> staged.remove(mutation.namespace to mutation.key)
                    }
                }
                values.clear()
                values.putAll(staged)
            }
        }
        override fun keys(namespace: ChatCryptoNamespace, prefix: String): List<String> =
            values.keys.asSequence().filter { (storedNamespace, key) -> storedNamespace == namespace && key.startsWith(prefix) }
                .map { it.second }.sorted().toList()
    }

    private object TestChatCryptoKeyProvider : ChatCryptoStorageKeyProvider {
        private val testKey = SecretKeySpec(ByteArray(32) { (it * 3 + 7).toByte() }, "AES")
        override fun getOrCreate() = testKey
    }
}
