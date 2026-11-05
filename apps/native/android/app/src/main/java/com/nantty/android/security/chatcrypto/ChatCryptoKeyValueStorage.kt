package com.nantty.android.security.chatcrypto

import android.content.Context
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.GeneralSecurityException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.SecretKey

/** The two logical stores exposed by the React Native ChatCryptoStorage contract. */
enum class ChatCryptoNamespace(internal val databaseValue: String) {
    SECRETS("secrets"),
    RECORDS("records"),
}

/** Ciphertext-only storage boundary. Keys remain metadata so prefix enumeration is possible. */
interface ChatCryptoValueDao : AutoCloseable {
    fun get(namespace: ChatCryptoNamespace, key: String): ByteArray?
    fun set(namespace: ChatCryptoNamespace, key: String, ciphertext: ByteArray)
    fun delete(namespace: ChatCryptoNamespace, key: String)
    fun keys(namespace: ChatCryptoNamespace, prefix: String): List<String>

    override fun close() = Unit
}

/** Mirrors packages/chatCrypto's string-key storage operations and prefix enumeration. */
interface ChatCryptoKeyValueStore {
    fun get(key: String): String?
    fun set(key: String, value: String)
    fun delete(key: String)
    fun keys(prefix: String): List<String>
}

interface ChatCryptoStorage : AutoCloseable {
    val secrets: ChatCryptoKeyValueStore
    val records: ChatCryptoKeyValueStore
}

fun interface ChatCryptoStorageKeyProvider {
    fun getOrCreate(): SecretKey
}

fun interface ChatCryptoCipherFactory {
    @Throws(GeneralSecurityException::class)
    fun create(): Cipher
}

/** One RN-compatible string KeyValueStore, bound to exactly one logical namespace. */
class EncryptedChatCryptoKeyValueStore internal constructor(
    private val namespace: ChatCryptoNamespace,
    private val dao: ChatCryptoValueDao,
    private val keyProvider: ChatCryptoStorageKeyProvider,
    private val cipherFactory: ChatCryptoCipherFactory = ChatCryptoCipherFactory { Cipher.getInstance(TRANSFORMATION) },
) : ChatCryptoKeyValueStore {
    private val key: SecretKey by lazy(LazyThreadSafetyMode.SYNCHRONIZED) { keyProvider.getOrCreate() }

    override fun get(key: String): String? {
        val stored = dao.get(namespace, key) ?: return null
        val decoded = decodeStoredValue(stored)
        val cipher = cipherFactory.create()
        cipher.init(Cipher.DECRYPT_MODE, this.key, GCMParameterSpec(TAG_LENGTH_BITS, decoded.nonce))
        cipher.updateAAD(associatedData(namespace, key))
        // Authentication and UTF-8 decoding errors intentionally propagate; never return ciphertext
        // or treat a corrupt entry as a missing/plaintext value.
        val plaintext = cipher.doFinal(decoded.ciphertext)
        return Charsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(plaintext))
            .toString()
    }

    override fun set(key: String, value: String) {
        val cipher = cipherFactory.create()
        cipher.init(Cipher.ENCRYPT_MODE, this.key)
        val nonce = requireNotNull(cipher.iv) { "AES-GCM provider did not return an encryption nonce" }
        require(nonce.size == NONCE_LENGTH_BYTES) { "AES-GCM provider returned an unsupported nonce length" }
        cipher.updateAAD(associatedData(namespace, key))
        val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val packed = ByteArray(STORAGE_VERSION.size + nonce.size + ciphertext.size)
        STORAGE_VERSION.copyInto(packed)
        nonce.copyInto(packed, STORAGE_VERSION.size)
        ciphertext.copyInto(packed, STORAGE_VERSION.size + nonce.size)
        dao.set(namespace, key, packed)
    }

    override fun delete(key: String) = dao.delete(namespace, key)

    override fun keys(prefix: String): List<String> = dao.keys(namespace, prefix)

    private fun decodeStoredValue(value: ByteArray): StoredValue {
        val minimumSize = STORAGE_VERSION.size + NONCE_LENGTH_BYTES + TAG_LENGTH_BYTES
        require(value.size >= minimumSize) { "Encrypted chat storage value is truncated" }
        require(STORAGE_VERSION.indices.all { value[it] == STORAGE_VERSION[it] }) {
            "Encrypted chat storage value has an unsupported format"
        }
        val nonceStart = STORAGE_VERSION.size
        val ciphertextStart = nonceStart + NONCE_LENGTH_BYTES
        return StoredValue(
            nonce = value.copyOfRange(nonceStart, ciphertextStart),
            ciphertext = value.copyOfRange(ciphertextStart, value.size),
        )
    }

    private data class StoredValue(val nonce: ByteArray, val ciphertext: ByteArray)

    companion object {
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val TAG_LENGTH_BITS = 128
        private const val TAG_LENGTH_BYTES = TAG_LENGTH_BITS / 8
        private const val NONCE_LENGTH_BYTES = 12
        private val STORAGE_VERSION = byteArrayOf(0x4e, 0x43, 0x4b, 0x56, 0x01)
        private val AAD_DOMAIN = "nantty.chatcrypto.key-value.v1".toByteArray(Charsets.UTF_8)

        /** Length-prefix both fields so distinct namespace/key pairs cannot share AAD encodings. */
        private fun associatedData(namespace: ChatCryptoNamespace, key: String): ByteArray {
            val namespaceBytes = namespace.databaseValue.toByteArray(Charsets.UTF_8)
            val keyBytes = key.toByteArray(Charsets.UTF_8)
            val output = ByteArrayOutputStream(AAD_DOMAIN.size + namespaceBytes.size + keyBytes.size + 8)
            DataOutputStream(output).use { data ->
                data.write(AAD_DOMAIN)
                data.writeInt(namespaceBytes.size)
                data.write(namespaceBytes)
                data.writeInt(keyBytes.size)
                data.write(keyBytes)
            }
            return output.toByteArray()
        }
    }
}

/** Namespace-separated, durable Android implementation of RN ChatCryptoStorage. */
class AndroidChatCryptoStorage internal constructor(
    private val dao: ChatCryptoValueDao,
    keyProvider: ChatCryptoStorageKeyProvider,
    cipherFactory: ChatCryptoCipherFactory = ChatCryptoCipherFactory { Cipher.getInstance("AES/GCM/NoPadding") },
) : ChatCryptoStorage {
    constructor(
        context: Context,
        databaseName: String = SqliteChatCryptoValueDao.DEFAULT_DATABASE_NAME,
        keyAlias: String = AndroidKeystoreChatCryptoKeyProvider.DEFAULT_KEY_ALIAS,
    ) : this(
        SqliteChatCryptoValueDao(context, databaseName),
        AndroidKeystoreChatCryptoKeyProvider(keyAlias),
    )

    override val secrets: ChatCryptoKeyValueStore = EncryptedChatCryptoKeyValueStore(ChatCryptoNamespace.SECRETS, dao, keyProvider, cipherFactory)
    override val records: ChatCryptoKeyValueStore = EncryptedChatCryptoKeyValueStore(ChatCryptoNamespace.RECORDS, dao, keyProvider, cipherFactory)

    override fun close() = dao.close()
}
