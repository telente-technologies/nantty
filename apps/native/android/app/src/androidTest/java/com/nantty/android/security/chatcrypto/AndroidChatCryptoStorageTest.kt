package com.nantty.android.security.chatcrypto

import android.database.sqlite.SQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore
import java.util.UUID
import javax.crypto.AEADBadTagException

@RunWith(AndroidJUnit4::class)
class AndroidChatCryptoStorageTest {
    @Test
    fun keystoreAndSqlitePersistEncryptedValuesAcrossStoreInstances() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val suffix = UUID.randomUUID().toString().replace("-", "")
        val databaseName = "chat_crypto_test_$suffix.db"
        val keyAlias = "${AndroidKeystoreChatCryptoKeyProvider.DEFAULT_KEY_ALIAS}.test.$suffix"
        val identity = "device-identity-secret-$suffix"
        val record = "ratchet-record-secret-$suffix"

        try {
            AndroidChatCryptoStorage(
                SqliteChatCryptoValueDao(context, databaseName),
                AndroidKeystoreChatCryptoKeyProvider(keyAlias),
            ).use { storage ->
                storage.secrets.set("identity", identity)
                storage.records.set("session:user:device", record)
                assertTrue(storage.secrets.keys("ident") == listOf("identity"))
                assertTrue(storage.records.keys("session:user:") == listOf("session:user:device"))
            }

            val rawDatabase = SQLiteDatabase.openDatabase(context.getDatabasePath(databaseName).path, null, SQLiteDatabase.OPEN_READONLY)
            rawDatabase.use { database ->
                database.rawQuery("SELECT ciphertext FROM chat_crypto_values", null).use { cursor ->
                    assertTrue(cursor.count == 2)
                    while (cursor.moveToNext()) {
                        val bytes = cursor.getBlob(0)
                        assertFalse(String(bytes, Charsets.UTF_8).contains(identity))
                        assertFalse(String(bytes, Charsets.UTF_8).contains(record))
                    }
                }
            }

            AndroidChatCryptoStorage(
                SqliteChatCryptoValueDao(context, databaseName),
                AndroidKeystoreChatCryptoKeyProvider(keyAlias),
            ).use { reopened ->
                assertTrue(reopened.secrets.get("identity") == identity)
                assertTrue(reopened.records.get("session:user:device") == record)
            }
        } finally {
            context.deleteDatabase(databaseName)
            KeyStore.getInstance("AndroidKeyStore").apply {
                load(null)
                if (containsAlias(keyAlias)) deleteEntry(keyAlias)
            }
        }
    }

    @Test
    fun sqliteCiphertextAuthenticationFailureIsNotReturnedAsPlaintextOrMissing() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val suffix = UUID.randomUUID().toString().replace("-", "")
        val databaseName = "chat_crypto_corrupt_test_$suffix.db"
        val keyAlias = "${AndroidKeystoreChatCryptoKeyProvider.DEFAULT_KEY_ALIAS}.test.$suffix"

        try {
            AndroidChatCryptoStorage(
                SqliteChatCryptoValueDao(context, databaseName),
                AndroidKeystoreChatCryptoKeyProvider(keyAlias),
            ).use { storage -> storage.records.set("session:tamper", "not-plaintext-fallback") }

            val database = SQLiteDatabase.openDatabase(context.getDatabasePath(databaseName).path, null, SQLiteDatabase.OPEN_READWRITE)
            database.use {
                it.execSQL("UPDATE chat_crypto_values SET ciphertext = zeroblob(length(ciphertext)) WHERE namespace = ? AND logical_key = ?", arrayOf("records", "session:tamper"))
            }

            AndroidChatCryptoStorage(
                SqliteChatCryptoValueDao(context, databaseName),
                AndroidKeystoreChatCryptoKeyProvider(keyAlias),
            ).use { storage ->
                assertThrows(AEADBadTagException::class.java) { storage.records.get("session:tamper") }
                assertTrue(storage.records.keys("session:") == listOf("session:tamper"))
            }
        } finally {
            context.deleteDatabase(databaseName)
            KeyStore.getInstance("AndroidKeyStore").apply {
                load(null)
                if (containsAlias(keyAlias)) deleteEntry(keyAlias)
            }
        }
    }

    @Test
    fun sqliteBatchRollsBackSessionWriteWhenOneTimePrekeyDeleteFailsAndCanRetry() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val suffix = UUID.randomUUID().toString().replace("-", "")
        val databaseName = "chat_crypto_batch_test_$suffix.db"
        val keyAlias = "${AndroidKeystoreChatCryptoKeyProvider.DEFAULT_KEY_ALIAS}.test.$suffix"
        val before = ProtocolSessionRecord(mapOf("state" to "before"), emptyList())
        val after = ProtocolSessionRecord(mapOf("state" to "after"), emptyList())

        try {
            AndroidChatCryptoStorage(
                SqliteChatCryptoValueDao(context, databaseName),
                AndroidKeystoreChatCryptoKeyProvider(keyAlias),
            ).use { storage ->
                val store = ProtocolStore(storage)
                store.saveSession("user", "device", before)
                store.saveOneTimePreKey(mapOf("keyId" to 500, "keyPair" to mapOf("secretKey" to byteArrayOf(1, 2, 3))))
            }

            SQLiteDatabase.openDatabase(context.getDatabasePath(databaseName).path, null, SQLiteDatabase.OPEN_READWRITE).use { database ->
                database.execSQL(
                    """CREATE TRIGGER reject_one_time_prekey_delete BEFORE DELETE ON chat_crypto_values
                        WHEN OLD.logical_key = 'opk:500'
                        BEGIN SELECT RAISE(ABORT, 'injected batch failure'); END""".trimIndent(),
                )
            }

            AndroidChatCryptoStorage(
                SqliteChatCryptoValueDao(context, databaseName),
                AndroidKeystoreChatCryptoKeyProvider(keyAlias),
            ).use { storage ->
                val store = ProtocolStore(storage)
                assertThrows(RuntimeException::class.java) {
                    store.saveSessionAndConsumeOneTimePreKey("user", "device", after, 500)
                }
                assertEquals(before, store.loadSession("user", "device"))
                assertTrue(store.loadOneTimePreKey(500) != null)
            }

            SQLiteDatabase.openDatabase(context.getDatabasePath(databaseName).path, null, SQLiteDatabase.OPEN_READWRITE).use { database ->
                database.execSQL("DROP TRIGGER reject_one_time_prekey_delete")
            }
            AndroidChatCryptoStorage(
                SqliteChatCryptoValueDao(context, databaseName),
                AndroidKeystoreChatCryptoKeyProvider(keyAlias),
            ).use { storage ->
                val store = ProtocolStore(storage)
                store.saveSessionAndConsumeOneTimePreKey("user", "device", after, 500)
                assertEquals(after, store.loadSession("user", "device"))
                assertEquals(null, store.loadOneTimePreKey(500))
            }
        } finally {
            context.deleteDatabase(databaseName)
            KeyStore.getInstance("AndroidKeyStore").apply {
                load(null)
                if (containsAlias(keyAlias)) deleteEntry(keyAlias)
            }
        }
    }
}
