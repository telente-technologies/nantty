package com.nantty.android.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.MessageDigest
import java.util.UUID
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal const val MINIMUM_CHAT_PASSCODE_LENGTH = 4
internal const val MAXIMUM_CHAT_PASSCODE_LENGTH = 6
internal val CHAT_AUTO_LOCK_OPTIONS_SECONDS = listOf(0, 60, 300, 900, 3600)

internal data class ChatLockPreferences(
    val autoLockSeconds: Int = 60,
    val biometricsEnabled: Boolean = false,
)

internal data class ChatPasscodeSnapshot(
    val isPasscodeSet: Boolean,
    val preferences: ChatLockPreferences,
)

internal sealed interface ChatPasscodeResult<out T> {
    data class Success<T>(val value: T) : ChatPasscodeResult<T>
    data class Failure(val message: String) : ChatPasscodeResult<Nothing>
}

/** Device-local storage for chat lock data. The sole persisted value is AES-GCM ciphertext. */
internal class ChatPasscodeRepository private constructor(
    private val storage: ChatPasscodeStorage,
    private val keyProvider: ChatPasscodeKeyProvider,
) {
    constructor(context: Context) : this(
        AndroidChatPasscodeStorage(context.applicationContext),
        AndroidChatPasscodeKeyProvider(),
    )

    @Synchronized
    fun load(): ChatPasscodeResult<ChatPasscodeSnapshot> = safely {
        val record = readRecord()
        ChatPasscodeSnapshot(record.passcodeHash != null, record.preferences)
    }

    @Synchronized
    fun setPasscode(passcode: String): ChatPasscodeResult<Unit> = safely {
        require(isValidChatPasscode(passcode)) { "Use a passcode with 4 to 6 digits." }
        val salt = UUID.randomUUID().toString()
        val hash = hashPasscode(salt, passcode)
        val existing = readRecord()
        writeRecord(existing.copy(passcodeSalt = salt, passcodeHash = hash))
    }

    @Synchronized
    fun verifyPasscode(passcode: String): ChatPasscodeResult<Boolean> = safely {
        if (!isValidChatPasscode(passcode)) return@safely false
        val record = readRecord()
        val salt = record.passcodeSalt ?: return@safely false
        val savedHash = record.passcodeHash ?: return@safely false
        MessageDigest.isEqual(hashPasscode(salt, passcode), savedHash)
    }

    @Synchronized
    fun updatePreferences(preferences: ChatLockPreferences): ChatPasscodeResult<ChatPasscodeSnapshot> = safely {
        require(preferences.autoLockSeconds in CHAT_AUTO_LOCK_OPTIONS_SECONDS) { "Choose a supported auto-lock interval." }
        val current = readRecord()
        writeRecord(current.copy(preferences = preferences))
        ChatPasscodeSnapshot(current.passcodeHash != null, preferences)
    }

    @Synchronized
    fun removePasscode(): ChatPasscodeResult<Unit> = safely {
        storage.clear()
        keyProvider.deleteKey()
    }

    private fun readRecord(): StoredChatPasscode {
        val encoded = storage.read() ?: return StoredChatPasscode()
        val packed = Base64.getDecoder().decode(encoded)
        require(packed.size > GCM_IV_BYTES) { "Stored chat lock data is incomplete." }
        val iv = packed.copyOfRange(0, GCM_IV_BYTES)
        val ciphertext = packed.copyOfRange(GCM_IV_BYTES, packed.size)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, keyProvider.getOrCreateKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
        }
        val json = JSONObject(String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8))
        val autoLockSeconds = json.optInt("autoLockSeconds", DEFAULT_AUTO_LOCK_SECONDS)
            .takeIf { it in CHAT_AUTO_LOCK_OPTIONS_SECONDS } ?: DEFAULT_AUTO_LOCK_SECONDS
        return StoredChatPasscode(
            passcodeSalt = json.optString("salt").takeIf(String::isNotBlank),
            passcodeHash = json.optString("hash").takeIf(String::isNotBlank)?.let(::decodeDigest),
            preferences = ChatLockPreferences(
                autoLockSeconds = autoLockSeconds,
                biometricsEnabled = json.optBoolean("biometricsEnabled", false),
            ),
        )
    }

    private fun writeRecord(record: StoredChatPasscode) {
        val json = JSONObject().apply {
            put("salt", record.passcodeSalt)
            put("hash", record.passcodeHash?.let { Base64.getEncoder().encodeToString(it) })
            put("autoLockSeconds", record.preferences.autoLockSeconds)
            put("biometricsEnabled", record.preferences.biometricsEnabled)
        }
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, keyProvider.getOrCreateKey()) }
        val packed = cipher.iv + cipher.doFinal(json.toString().toByteArray(StandardCharsets.UTF_8))
        check(storage.write(Base64.getEncoder().encodeToString(packed))) { "Could not save chat lock settings." }
    }

    private fun decodeDigest(value: String): ByteArray = Base64.getDecoder().decode(value)

    private inline fun <T> safely(block: () -> T): ChatPasscodeResult<T> = try {
        ChatPasscodeResult.Success(block())
    } catch (error: IllegalArgumentException) {
        ChatPasscodeResult.Failure(error.message ?: "The chat passcode setting is invalid.")
    } catch (_: Exception) {
        ChatPasscodeResult.Failure("We couldn't access secure chat settings. Try again.")
    }

    private data class StoredChatPasscode(
        val passcodeSalt: String? = null,
        val passcodeHash: ByteArray? = null,
        val preferences: ChatLockPreferences = ChatLockPreferences(),
    )

    companion object {
        private const val DEFAULT_AUTO_LOCK_SECONDS = 60
        private const val GCM_IV_BYTES = 12
        private const val GCM_TAG_BITS = 128
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        internal fun forTests(storage: ChatPasscodeStorage, keyProvider: ChatPasscodeKeyProvider) =
            ChatPasscodeRepository(storage, keyProvider)
    }
}

internal fun isValidChatPasscode(value: String): Boolean =
    value.length in MINIMUM_CHAT_PASSCODE_LENGTH..MAXIMUM_CHAT_PASSCODE_LENGTH && value.all { it in '0'..'9' }

private fun hashPasscode(salt: String, passcode: String): ByteArray =
    MessageDigest.getInstance("SHA-256").digest("$salt:$passcode".toByteArray(StandardCharsets.UTF_8))

internal interface ChatPasscodeStorage {
    fun read(): String?
    fun write(value: String): Boolean
    fun clear()
}

internal interface ChatPasscodeKeyProvider {
    fun getOrCreateKey(): SecretKey
    fun deleteKey()
}

private class AndroidChatPasscodeStorage(context: Context) : ChatPasscodeStorage {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun read(): String? = preferences.getString(RECORD_KEY, null)

    override fun write(value: String): Boolean = preferences.edit().putString(RECORD_KEY, value).commit()

    override fun clear() {
        check(preferences.edit().remove(RECORD_KEY).commit()) { "Could not clear chat lock settings." }
    }

    private companion object {
        const val PREFERENCES_NAME = "nantty_chat_lock_v1"
        const val RECORD_KEY = "encrypted_chat_lock_record"
    }
}

private class AndroidChatPasscodeKeyProvider : ChatPasscodeKeyProvider {
    override fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    override fun deleteKey() {
        KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }.deleteEntry(KEY_ALIAS)
    }

    private companion object {
        const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        const val KEY_ALIAS = "com.nantty.android.chat-lock.v1"
    }
}
