package com.nantty.android.security.chatcrypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

class DeviceKeyRegistrationTest {
    @Test
    fun registrationMatchesReactNativeWireVectorAndPersistsPrivateKeys() {
        val storage = MemoryCryptoStorage()
        val store = ProtocolStore(storage)
        val directory = RecordingDirectory()
        val registration = DeviceKeyRegistration(store, directory, seededRandom("device-registration-v1")) { NOW }

        val identity = registration.ensureReady(USER_ID)
        val request = requireNotNull(directory.registered).second

        assertEquals("72237208a23ee5712804cbf6e5bf3de7", identity.deviceId)
        assertEquals(13_322, identity.registrationId)
        assertEquals("pgd85rgQuuXfTh83TZcInfHw1tL01qUgCc956XmZUIM=", request.identityKey)
        assertEquals(589_761_549, request.signedPreKey.keyId)
        assertEquals("0rNLG1lnaqC+dibIHAERmGNUnIyVDzp8zA3J6XqB2VQ=", request.signedPreKey.publicKey)
        assertEquals("hNyMhOX7cioA5JXnfxDkIv3M6jhWQdL56KbeK8nEVkIfaLMs8rWMdhEHSaDnJmRGlI5aPQMhm8jW5AZAtMagBg==", request.signedPreKey.signature)
        assertEquals(100, request.oneTimePreKeys.size)
        assertEquals(1_926_222_711, request.oneTimePreKeys.first().keyId)
        assertEquals("bD1EATEmmZxZTThYVOF7OYKXXfGmCGNZRXrpjr1pqkI=", request.oneTimePreKeys.first().publicKey)
        assertEquals(1_926_222_810, request.oneTimePreKeys.last().keyId)
        assertEquals("newGXjpH8jKNEw0nPcaMZG50A5QB2fV8/lvs08fz1CM=", request.oneTimePreKeys.last().publicKey)
        assertTrue(ChatCryptoPrimitives.ed25519Verify(
            ChatCryptoPrimitives.decodeBase64(request.signedPreKey.signature),
            "nantty-signed-prekey-v1".toByteArray() + ChatCryptoPrimitives.writeUint32(request.signedPreKey.keyId.toLong()) + ChatCryptoPrimitives.decodeBase64(request.signedPreKey.publicKey),
            identity.signingPublicKey,
        ))
        assertEquals(USER_ID, store.loadIdentity()?.get("userId"))
        assertNotNull(store.loadCounters())
        request.oneTimePreKeys.forEach { wire ->
            val privateKey = (((store.loadOneTimePreKey(wire.keyId)?.get("keyPair") as? Map<*, *>)?.get("secretKey")) as? ByteArray)
            assertNotNull(privateKey)
            assertEquals(wire.publicKey, ChatCryptoPrimitives.encodeBase64(ChatCryptoPrimitives.x25519PublicKey(requireNotNull(privateKey))))
        }
    }

    @Test
    fun ensureReadyRechecksDirectoryAndReplenishesOnlyTheMissingPrekeys() {
        val store = ProtocolStore(MemoryCryptoStorage())
        val directory = RecordingDirectory()
        var now = NOW
        val registration = DeviceKeyRegistration(store, directory, seededRandom("maintenance")) { now }
        val identity = registration.ensureReady(USER_ID)
        assertEquals(100, requireNotNull(directory.registered).second.oneTimePreKeys.size)

        directory.status = directory.status!!.copy(oneTimePreKeyCount = 10)
        now += CHAT_DEVICE_KEY_RECHECK_MILLIS + 1
        assertEquals(identity.deviceId, registration.ensureReady(USER_ID).deviceId)
        assertEquals(90, directory.uploaded.single().size)
        assertEquals(100, directory.status?.oneTimePreKeyCount)
        assertEquals(1, directory.registrationCount)
    }

    @Test
    fun ensureReadyRotatesExpiredSignedPrekeyAndRetainsOnlyTheCurrentPreviousKey() {
        val store = ProtocolStore(MemoryCryptoStorage())
        val directory = RecordingDirectory()
        var now = NOW
        val registration = DeviceKeyRegistration(store, directory, seededRandom("rotation")) { now }
        registration.ensureReady(USER_ID)
        val firstId = store.loadCounters()!!.currentSignedPreKeyId

        now += CHAT_SIGNED_PREKEY_ROTATION_MILLIS + CHAT_DEVICE_KEY_RECHECK_MILLIS + 1
        registration.ensureReady(USER_ID)

        val updated = store.loadCounters()!!
        assertEquals(1, directory.rotated.size)
        assertEquals(updated.currentSignedPreKeyId, directory.rotated.single().keyId)
        assertTrue(updated.currentSignedPreKeyId != firstId)
        assertEquals(listOf(firstId), updated.previousSignedPreKeyIds)
        assertNotNull(store.loadSignedPreKey(firstId))
    }

    @Test
    fun changingSignedInAccountClearsPriorDeviceProtocolStateBeforeRegistration() {
        val storage = MemoryCryptoStorage()
        val store = ProtocolStore(storage)
        val directory = RecordingDirectory()
        val registration = DeviceKeyRegistration(store, directory, seededRandom("account-change")) { NOW }
        val first = registration.ensureReady(USER_ID)
        store.saveSession("another-user", "old-device", ProtocolSessionRecord(mapOf("secret" to byteArrayOf(1)), emptyList()))

        val second = registration.ensureReady(OTHER_USER_ID)

        assertTrue(first.deviceId != second.deviceId)
        assertEquals(OTHER_USER_ID, store.loadIdentity()?.get("userId"))
        assertTrue(store.sessionDeviceIds("another-user").isEmpty())
        assertEquals(2, directory.registrationCount)
        assertNull(store.loadTrust("some-peer"))
    }

    @Test
    fun signOutRemovesTheRegisteredPublicDeviceAndClearsLocalProtocolState() {
        val store = ProtocolStore(MemoryCryptoStorage())
        val directory = RecordingDirectory()
        val registration = DeviceKeyRegistration(store, directory, seededRandom("sign-out")) { NOW }
        val identity = registration.ensureReady(USER_ID)

        registration.signOut(USER_ID)

        assertEquals(listOf(identity.deviceId), directory.removed)
        assertNull(store.loadIdentity())
        assertNull(store.loadCounters())
        assertNull(directory.status)
    }

    private class RecordingDirectory : ChatDeviceKeyDirectory {
        var registered: Pair<String, ChatDeviceRegistrationRequest>? = null
        var status: ChatDeviceKeyStatus? = null
        val uploaded = mutableListOf<List<ChatWireOneTimePreKey>>()
        val rotated = mutableListOf<ChatWireSignedPreKey>()
        val removed = mutableListOf<String>()
        var registrationCount = 0

        override fun registerDevice(deviceId: String, request: ChatDeviceRegistrationRequest): ChatDeviceKeyStatus {
            registrationCount++
            registered = deviceId to request
            return ChatDeviceKeyStatus(deviceId, request.identityKey, request.signedPreKey.keyId, request.oneTimePreKeys.size).also { status = it }
        }

        override fun fetchDeviceStatus(deviceId: String): ChatDeviceKeyStatus? = status?.takeIf { it.deviceId == deviceId }

        override fun uploadOneTimePreKeys(deviceId: String, keys: List<ChatWireOneTimePreKey>): ChatDeviceKeyStatus {
            uploaded += keys
            return requireNotNull(status).copy(oneTimePreKeyCount = status!!.oneTimePreKeyCount + keys.size).also { status = it }
        }

        override fun rotateSignedPreKey(deviceId: String, key: ChatWireSignedPreKey): ChatDeviceKeyStatus {
            rotated += key
            return requireNotNull(status).copy(signedPreKeyId = key.keyId).also { status = it }
        }

        override fun listDevices(userIds: List<String>) = emptyList<ChatUserDeviceList>()

        override fun claimPreKeyBundles(devices: List<ChatDeviceAddress>) = emptyList<ChatPreKeyBundle>()

        override fun removeDevice(deviceId: String) {
            removed += deviceId
            if (status?.deviceId == deviceId) status = null
        }
    }

    private class MemoryCryptoStorage : ChatCryptoStorage {
        override val secrets = MemoryKeyValueStore()
        override val records = MemoryKeyValueStore()
        override fun close() = Unit
    }

    private class MemoryKeyValueStore : ChatCryptoKeyValueStore {
        private val values = linkedMapOf<String, String>()
        override fun get(key: String): String? = values[key]
        override fun set(key: String, value: String) { values[key] = value }
        override fun delete(key: String) { values.remove(key) }
        override fun applyBatch(mutations: List<ChatCryptoKeyValueMutation>) {
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
        override fun keys(prefix: String): List<String> = values.keys.filter { it.startsWith(prefix) }
    }

    private fun seededRandom(seed: String): ChatCryptoRandomSource {
        var counter = 0
        return ChatCryptoRandomSource { length ->
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

    private companion object {
        const val USER_ID = "0190f0a0-0000-7000-8000-00000000d001"
        const val OTHER_USER_ID = "0190f0a0-0000-7000-8000-00000000d002"
        const val NOW = 1_800_000_000_000L
    }
}
