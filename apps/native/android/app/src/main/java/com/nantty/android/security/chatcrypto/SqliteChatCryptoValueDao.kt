package com.nantty.android.security.chatcrypto

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/** SQLite-backed value metadata and ciphertext. Plaintext values and key material are never stored here. */
class SqliteChatCryptoValueDao(
    context: Context,
    databaseName: String = DEFAULT_DATABASE_NAME,
) : ChatCryptoValueDao {
    private val helper = ChatCryptoDatabaseHelper(context.applicationContext, databaseName)

    init {
        require(databaseName.isNotBlank()) { "Chat crypto database name must not be blank" }
    }

    @Synchronized
    override fun get(namespace: ChatCryptoNamespace, key: String): ByteArray? =
        helper.readableDatabase.query(
            TABLE_NAME,
            arrayOf(COLUMN_CIPHERTEXT),
            "$COLUMN_NAMESPACE = ? AND $COLUMN_KEY = ?",
            arrayOf(namespace.databaseValue, key),
            null,
            null,
            null,
            "1",
        ).use { cursor ->
            if (!cursor.moveToFirst()) null
            else cursor.getBlob(0) ?: throw IllegalStateException("Encrypted chat storage row has no ciphertext")
        }

    @Synchronized
    override fun set(namespace: ChatCryptoNamespace, key: String, ciphertext: ByteArray) {
        val values = ContentValues(3).apply {
            put(COLUMN_NAMESPACE, namespace.databaseValue)
            put(COLUMN_KEY, key)
            put(COLUMN_CIPHERTEXT, ciphertext)
        }
        check(helper.writableDatabase.insertWithOnConflict(TABLE_NAME, null, values, SQLiteDatabase.CONFLICT_REPLACE) != -1L) {
            "Could not persist encrypted chat value"
        }
    }

    @Synchronized
    override fun delete(namespace: ChatCryptoNamespace, key: String) {
        helper.writableDatabase.delete(
            TABLE_NAME,
            "$COLUMN_NAMESPACE = ? AND $COLUMN_KEY = ?",
            arrayOf(namespace.databaseValue, key),
        )
    }

    @Synchronized
    override fun keys(namespace: ChatCryptoNamespace, prefix: String): List<String> =
        helper.readableDatabase.query(
            TABLE_NAME,
            arrayOf(COLUMN_KEY),
            "$COLUMN_NAMESPACE = ? AND substr($COLUMN_KEY, 1, length(?)) = ?",
            arrayOf(namespace.databaseValue, prefix, prefix),
            null,
            null,
            "$COLUMN_KEY COLLATE BINARY ASC",
        ).use { cursor ->
            buildList(cursor.count) { while (cursor.moveToNext()) add(cursor.getString(0)) }
        }

    @Synchronized
    override fun close() = helper.close()

    private class ChatCryptoDatabaseHelper(context: Context, name: String) : SQLiteOpenHelper(context, name, null, DATABASE_VERSION) {
        override fun onConfigure(database: SQLiteDatabase) {
            super.onConfigure(database)
            database.setForeignKeyConstraintsEnabled(true)
        }

        override fun onCreate(database: SQLiteDatabase) {
            database.execSQL(
                """CREATE TABLE $TABLE_NAME (
                    $COLUMN_NAMESPACE TEXT NOT NULL CHECK ($COLUMN_NAMESPACE IN ('secrets', 'records')),
                    $COLUMN_KEY TEXT NOT NULL,
                    $COLUMN_CIPHERTEXT BLOB NOT NULL,
                    PRIMARY KEY ($COLUMN_NAMESPACE, $COLUMN_KEY)
                ) WITHOUT ROWID""".trimIndent(),
            )
        }

        override fun onUpgrade(database: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            throw IllegalStateException("Unsupported chat crypto database schema upgrade: $oldVersion to $newVersion")
        }
    }

    companion object {
        const val DEFAULT_DATABASE_NAME = "nantty_chat_crypto_v1.db"
        private const val DATABASE_VERSION = 1
        private const val TABLE_NAME = "chat_crypto_values"
        private const val COLUMN_NAMESPACE = "namespace"
        private const val COLUMN_KEY = "logical_key"
        private const val COLUMN_CIPHERTEXT = "ciphertext"
    }
}
