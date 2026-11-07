package com.nantty.android.security.chatcrypto

import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RecipientResolverTest {
    @Test
    fun trustReplacementAndRemovalInvalidateAffectedSessions() {
        val now = 1_700_000_000_123L
        val store = ProtocolStore(MemoryStorage())
        val removed = ChatDirectoryDevice("removed", 2, "removed-key")
        val replaced = ChatDirectoryDevice("replaced", 1, "old-key")
        store.saveTrust(
            "peer",
            mapOf("devices" to mapOf("removed" to removed.identityKey, "replaced" to replaced.identityKey), "changedAt" to "old-change", "acknowledgedAt" to "ack"),
        )
        store.saveSession("peer", "removed", sessionRecord())
        store.saveSession("peer", "replaced", sessionRecord())
        val directory = TestDirectory().apply {
            deviceLists = listOf(ChatUserDeviceList("peer", listOf(replaced.copy(identityKey = "new-key"))))
        }

        val resolved = RecipientResolver(store, directory) { now }.resolve(listOf("peer"))

        assertEquals(listOf(ResolvedDevice("peer", "replaced", "new-key")), resolved)
        assertNull(store.loadSession("peer", "removed").current)
        assertNull(store.loadSession("peer", "replaced").current)
        assertEquals("ack", store.loadTrust("peer")?.get("acknowledgedAt"))
        assertEquals("2023-11-14T22:13:20.123Z", store.loadTrust("peer")?.get("changedAt"))
    }

    @Test
    fun identityChangeAdvancesTimestampAndPreservesAcknowledgement() {
        val now = 1_700_000_000_987L
        val store = ProtocolStore(MemoryStorage())
        store.saveTrust(
            "peer",
            mapOf("devices" to mapOf("phone" to "identity-before"), "changedAt" to "previous-change", "acknowledgedAt" to "prior-ack"),
        )
        val directory = TestDirectory().apply {
            deviceLists = listOf(ChatUserDeviceList("peer", listOf(ChatDirectoryDevice("phone", 1, "identity-after"))))
        }

        RecipientResolver(store, directory) { now }.resolve(listOf("peer"))

        val trust = requireNotNull(store.loadTrust("peer"))
        assertEquals("identity-after", (trust["devices"] as Map<*, *>)["phone"])
        assertEquals("2023-11-14T22:13:20.987Z", trust["changedAt"])
        assertEquals("prior-ack", trust["acknowledgedAt"])
    }

    @Test
    fun deviceListUsesThirtySecondCacheAndFreshForcesRequeryAndFiltersUnrequestedRows() {
        var now = 10_000L
        val store = ProtocolStore(MemoryStorage())
        val directory = TestDirectory().apply {
            deviceLists = listOf(
                ChatUserDeviceList("requested", listOf(ChatDirectoryDevice("first", 1, "identity"))),
                ChatUserDeviceList("not-requested", listOf(ChatDirectoryDevice("stray", 1, "stray-identity"))),
            )
        }
        val resolver = RecipientResolver(store, directory) { now }

        assertEquals(listOf(ResolvedDevice("requested", "first", "identity")), resolver.resolve(listOf("requested")))
        assertEquals(listOf("requested"), directory.listCalls.single())
        assertNull(store.loadTrust("requested")?.get("changedAt"))
        assertNull(store.loadTrust("requested")?.get("acknowledgedAt"))
        now += 30_000L
        assertEquals(listOf(ResolvedDevice("requested", "first", "identity")), resolver.resolve(listOf("requested")))
        assertEquals(1, directory.listCalls.size)

        now++
        directory.deviceLists = listOf(ChatUserDeviceList("requested", listOf(ChatDirectoryDevice("second", 2, "next-identity"))))
        assertEquals(listOf(ResolvedDevice("requested", "second", "next-identity")), resolver.resolve(listOf("requested")))
        assertEquals(2, directory.listCalls.size)

        directory.deviceLists = listOf(ChatUserDeviceList("requested", emptyList()))
        assertTrue(resolver.resolve(listOf("requested"), fresh = true).isEmpty())
        assertEquals(3, directory.listCalls.size)
        assertNull(store.loadTrust("not-requested"))
    }

    @Test
    fun ensureSessionsRejectsIdentityMismatchAndReturnsOnlyDevicesWithSessions() {
        val local = testIdentity("local", "local-device", "local-seed")
        val store = ProtocolStore(MemoryStorage())
        val cipher = SessionCipher(store, local.identity, ChatCryptoRandomSource(local.random))
        val readyBundle = testBundle("ready-user", "ready-device", "ready-seed")
        cipher.initiateFromBundle(readyBundle)

        val expectedMismatchBundle = testBundle("mismatch-user", "mismatch-device", "expected-identity-seed")
        val actuallyClaimedMismatch = testBundle("mismatch-user", "mismatch-device", "different-identity-seed")
        val validBundle = testBundle("valid-user", "valid-device", "valid-seed")
        val directory = TestDirectory().apply {
            claimedBundles = listOf(actuallyClaimedMismatch, validBundle, testBundle("unexpected-user", "unexpected-device", "unexpected-seed"))
        }
        val resolver = RecipientResolver(store, directory)
        val requested = listOf(
            ResolvedDevice("ready-user", "ready-device", readyBundle.identityKey),
            ResolvedDevice("mismatch-user", "mismatch-device", expectedMismatchBundle.identityKey),
            ResolvedDevice("valid-user", "valid-device", validBundle.identityKey),
        )

        val ready = resolver.ensureSessions(cipher, requested)

        assertEquals(listOf(ChatDeviceAddress("mismatch-user", "mismatch-device"), ChatDeviceAddress("valid-user", "valid-device")), directory.claimCalls.single())
        assertEquals(listOf(requested[0], requested[2]), ready)
        assertFalse(cipher.hasSession("mismatch-user", "mismatch-device"))
        assertTrue(cipher.hasSession("valid-user", "valid-device"))
        assertFalse(cipher.hasSession("unexpected-user", "unexpected-device"))
    }

    private class TestDirectory : ChatDeviceKeyDirectory {
        var deviceLists: List<ChatUserDeviceList> = emptyList()
        var claimedBundles: List<ChatPreKeyBundle> = emptyList()
        val listCalls = mutableListOf<List<String>>()
        val claimCalls = mutableListOf<List<ChatDeviceAddress>>()

        override fun registerDevice(deviceId: String, request: ChatDeviceRegistrationRequest) = error("Not used in resolver tests")
        override fun fetchDeviceStatus(deviceId: String): ChatDeviceKeyStatus? = error("Not used in resolver tests")
        override fun uploadOneTimePreKeys(deviceId: String, keys: List<ChatWireOneTimePreKey>) = error("Not used in resolver tests")
        override fun rotateSignedPreKey(deviceId: String, key: ChatWireSignedPreKey) = error("Not used in resolver tests")
        override fun listDevices(userIds: List<String>): List<ChatUserDeviceList> {
            listCalls += userIds.toList()
            return deviceLists
        }
        override fun claimPreKeyBundles(devices: List<ChatDeviceAddress>): List<ChatPreKeyBundle> {
            claimCalls += devices.toList()
            return claimedBundles
        }
        override fun removeDevice(deviceId: String) = error("Not used in resolver tests")
    }

    private data class TestIdentity(val identity: ChatDeviceIdentity, val random: (Int) -> ByteArray)

    private fun testIdentity(userId: String, deviceId: String, seed: String): TestIdentity {
        val random = seededRandom(seed)
        val signingSeed = random(32)
        return TestIdentity(
            ChatDeviceIdentity(userId, deviceId, 1, signingSeed, ChatCryptoPrimitives.ed25519PublicKey(signingSeed)),
            random,
        )
    }

    private fun testBundle(userId: String, deviceId: String, seed: String): ChatPreKeyBundle {
        val peer = testIdentity(userId, deviceId, seed)
        val signedPreKeyId = 11
        val oneTimePreKeyId = 500
        val signedPrivate = peer.random(32)
        val signedPublic = ChatCryptoPrimitives.x25519PublicKey(signedPrivate)
        val signature = ChatCryptoPrimitives.ed25519Sign(
            peer.identity.signingSeed,
            SIGNED_PREKEY_DOMAIN + ChatCryptoPrimitives.writeUint32(signedPreKeyId.toLong()) + signedPublic,
        )
        val oneTimePublic = ChatCryptoPrimitives.x25519PublicKey(peer.random(32))
        return ChatPreKeyBundle(
            userId = userId,
            deviceId = deviceId,
            registrationId = peer.identity.registrationId,
            identityKey = ChatCryptoPrimitives.encodeBase64(peer.identity.signingPublicKey),
            signedPreKey = ChatWireSignedPreKey(
                signedPreKeyId,
                ChatCryptoPrimitives.encodeBase64(signedPublic),
                ChatCryptoPrimitives.encodeBase64(signature),
            ),
            oneTimePreKey = ChatWireOneTimePreKey(oneTimePreKeyId, ChatCryptoPrimitives.encodeBase64(oneTimePublic)),
        )
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

    private fun sessionRecord() = ProtocolSessionRecord(current = mapOf("test" to true), archived = emptyList())

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

    private companion object {
        val SIGNED_PREKEY_DOMAIN = "nantty-signed-prekey-v1".toByteArray(Charsets.UTF_8)
    }
}
