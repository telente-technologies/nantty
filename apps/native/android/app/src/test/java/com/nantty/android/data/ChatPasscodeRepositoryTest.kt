package com.nantty.android.data

import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatPasscodeRepositoryTest {
    @Test
    fun defaultsMatchReactNativeSettingsAndNoPasscodeIsConfigured() {
        val storage = MemoryStorage()
        val repository = repository(storage)

        val result = repository.load()

        assertEquals(ChatPasscodeResult.Success(ChatPasscodeSnapshot(false, ChatLockPreferences(60, false))), result)
        assertEquals(null, storage.value)
    }

    @Test
    fun savesOnlyEncryptedPasscodeRecordAndVerifiesSaltedSha256Digest() {
        val storage = MemoryStorage()
        val repository = repository(storage)

        assertEquals(ChatPasscodeResult.Success(Unit), repository.setPasscode("135790"))

        val ciphertext = requireNotNull(storage.value)
        assertFalse(ciphertext.contains("135790"))
        assertFalse(ciphertext.contains("salt"))
        assertEquals(ChatPasscodeResult.Success(true), repository.verifyPasscode("135790"))
        assertEquals(ChatPasscodeResult.Success(false), repository.verifyPasscode("135791"))
        val snapshot = repository.load() as ChatPasscodeResult.Success
        assertTrue(snapshot.value.isPasscodeSet)
    }

    @Test
    fun rejectsPasscodesOutsideFourToSixDigits() {
        val repository = repository(MemoryStorage())

        listOf("123", "1234567", "12a4", "１２３４").forEach { invalid ->
            assertFalse(isValidChatPasscode(invalid))
            assertTrue(repository.setPasscode(invalid) is ChatPasscodeResult.Failure)
        }
        listOf("1234", "12345", "123456").forEach { assertTrue(isValidChatPasscode(it)) }
    }

    @Test
    fun persistsSupportedLockPreferencesAcrossRepositoryInstances() {
        val storage = MemoryStorage()
        val keyProvider = MemoryKeyProvider()
        val repository = ChatPasscodeRepository.forTests(storage, keyProvider)
        repository.setPasscode("1234")

        CHAT_AUTO_LOCK_OPTIONS_SECONDS.forEach { seconds ->
            val expected = ChatLockPreferences(seconds, biometricsEnabled = seconds == 300)
            assertEquals(ChatPasscodeResult.Success(ChatPasscodeSnapshot(true, expected)), repository.updatePreferences(expected))
            assertEquals(ChatPasscodeResult.Success(ChatPasscodeSnapshot(true, expected)), ChatPasscodeRepository.forTests(storage, keyProvider).load())
        }
    }

    @Test
    fun rejectsUnsupportedAutoLockIntervalsWithoutOverwritingExistingPreferences() {
        val repository = repository(MemoryStorage())
        repository.setPasscode("1234")
        val invalid = repository.updatePreferences(ChatLockPreferences(autoLockSeconds = 30, biometricsEnabled = true))

        assertTrue(invalid is ChatPasscodeResult.Failure)
        assertEquals(ChatPasscodeResult.Success(ChatPasscodeSnapshot(true, ChatLockPreferences())), repository.load())
    }

    @Test
    fun removeClearsPasscodeAndAllPreferencesAndDeletesEncryptionKey() {
        val storage = MemoryStorage()
        val keyProvider = MemoryKeyProvider()
        val repository = ChatPasscodeRepository.forTests(storage, keyProvider)
        repository.setPasscode("1234")
        repository.updatePreferences(ChatLockPreferences(900, true))

        assertEquals(ChatPasscodeResult.Success(Unit), repository.removePasscode())

        assertEquals(null, storage.value)
        assertTrue(keyProvider.deleted)
        assertEquals(ChatPasscodeResult.Success(ChatPasscodeSnapshot(false, ChatLockPreferences())), repository.load())
    }

    @Test
    fun malformedCiphertextFailsSafelyWithoutReturningSensitiveData() {
        val storage = MemoryStorage().apply { value = "not-valid-base64-or-ciphertext" }
        val result = repository(storage).load()

        assertTrue(result is ChatPasscodeResult.Failure)
        assertFalse((result as ChatPasscodeResult.Failure).message.contains("passcode", ignoreCase = true))
    }

    private fun repository(storage: MemoryStorage) = ChatPasscodeRepository.forTests(storage, MemoryKeyProvider())

    private class MemoryStorage : ChatPasscodeStorage {
        var value: String? = null
        override fun read(): String? = value
        override fun write(value: String): Boolean { this.value = value; return true }
        override fun clear() { value = null }
    }

    private class MemoryKeyProvider : ChatPasscodeKeyProvider {
        private var key: SecretKey? = null
        var deleted = false
        override fun getOrCreateKey(): SecretKey = key ?: KeyGenerator.getInstance("AES").apply { init(256) }.generateKey().also { key = it }
        override fun deleteKey() { key = null; deleted = true }
    }
}
