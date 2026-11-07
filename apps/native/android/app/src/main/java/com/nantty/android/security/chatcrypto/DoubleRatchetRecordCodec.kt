package com.nantty.android.security.chatcrypto

/**
 * Typed bridge between the RN SessionRecord JSON shape and Android's existing
 * map-based ProtocolStore. This codec deliberately does not create or activate
 * a chat session; callers must keep ratchet state behind the existing trust and
 * session lifecycle until the complete protocol is interoperable.
 */
internal object DoubleRatchetRecordCodec {
    private const val UINT32_MAX = 0xffff_ffffL
    private const val MAX_REMEMBERED_RATCHET_KEYS = 8
    private const val MAX_SKIPPED_KEYS = DoubleRatchet.MAXIMUM_STORED_SKIPPED_KEYS
    private const val MAX_RECORD_BYTES = 1 shl 20

    fun encode(state: DoubleRatchet.RatchetState): Map<String, Any?> {
        validate(state)
        return linkedMapOf(
            "rootKey" to state.rootKey.copyOf(),
            "sendingRatchet" to linkedMapOf(
                "publicKey" to state.sendingRatchet.publicKey.copyOf(),
                "secretKey" to state.sendingRatchet.secretKey.copyOf(),
            ),
            "remoteRatchetKey" to state.remoteRatchetKey?.copyOf(),
            "previousRemoteRatchetKeys" to state.previousRemoteRatchetKeys.map(ByteArray::copyOf),
            "sendingChain" to state.sendingChain?.let(::encodeChain),
            "receivingChain" to state.receivingChain?.let(::encodeChain),
            "previousCounter" to state.previousCounter,
            "skipped" to state.skipped.map { skipped ->
                linkedMapOf(
                    "ratchetKey" to skipped.ratchetKey.copyOf(),
                    "index" to skipped.index,
                    "messageKey" to skipped.messageKey.copyOf(),
                )
            },
            "associatedData" to state.associatedData.copyOf(),
            "remoteIdentityKey" to state.remoteIdentityKey.copyOf(),
            "baseKey" to state.baseKey.copyOf(),
            "pendingPreKey" to state.pendingPreKey?.let { pending ->
                linkedMapOf(
                    "signedPreKeyId" to pending.signedPreKeyId,
                    "oneTimePreKeyId" to pending.oneTimePreKeyId,
                )
            },
        )
    }

    fun decode(value: Map<String, Any?>): DoubleRatchet.RatchetState {
        value.requireKeys(STATE_KEYS, "ratchet state")
        val sendingRatchet = value.requiredObject("sendingRatchet")
        sendingRatchet.requireKeys(KEY_PAIR_KEYS, "sendingRatchet")
        val pendingValue = value.requiredNullable("pendingPreKey")
        val pending = pendingValue?.let { raw ->
            val item = raw.asObject("pendingPreKey")
            item.requireKeys(PENDING_PREKEY_KEYS, "pendingPreKey")
            DoubleRatchet.PendingPreKey(
                signedPreKeyId = item.requiredUInt32("signedPreKeyId"),
                oneTimePreKeyId = item.requiredNullableUInt32("oneTimePreKeyId"),
            )
        }

        val state = DoubleRatchet.RatchetState(
            rootKey = value.requiredBytes("rootKey", KEY_BYTES),
            sendingRatchet = DoubleRatchet.AgreementKeyPair(
                publicKey = sendingRatchet.requiredBytes("publicKey", KEY_BYTES),
                secretKey = sendingRatchet.requiredBytes("secretKey", KEY_BYTES),
            ),
            remoteRatchetKey = value.requiredNullableBytes("remoteRatchetKey", KEY_BYTES),
            previousRemoteRatchetKeys = value.requiredArray("previousRemoteRatchetKeys").also {
                require(it.size <= MAX_REMEMBERED_RATCHET_KEYS) { "Too many previous remote ratchet keys" }
            }.mapIndexed { index, entry -> entry.asBytes("previousRemoteRatchetKeys[$index]", KEY_BYTES) },
            sendingChain = value.requiredNullable("sendingChain")?.let { decodeChain(it, "sendingChain") },
            receivingChain = value.requiredNullable("receivingChain")?.let { decodeChain(it, "receivingChain") },
            previousCounter = value.requiredUInt32("previousCounter"),
            skipped = value.requiredArray("skipped").also {
                require(it.size <= MAX_SKIPPED_KEYS) { "Too many skipped message keys" }
            }.mapIndexed { index, raw ->
                val item = raw.asObject("skipped[$index]")
                item.requireKeys(SKIPPED_KEYS, "skipped[$index]")
                DoubleRatchet.SkippedMessageKey(
                    ratchetKey = item.requiredBytes("ratchetKey", KEY_BYTES),
                    index = item.requiredUInt32("index"),
                    messageKey = item.requiredBytes("messageKey", KEY_BYTES),
                )
            },
            associatedData = value.requiredBytes("associatedData"),
            remoteIdentityKey = value.requiredBytes("remoteIdentityKey", KEY_BYTES),
            baseKey = value.requiredBytes("baseKey", KEY_BYTES),
            pendingPreKey = pending,
        )
        validate(state)
        return state
    }

    private fun encodeChain(chain: DoubleRatchet.ChainState) = linkedMapOf<String, Any?>(
        "key" to chain.key.copyOf(),
        "index" to chain.index,
    )

    private fun decodeChain(raw: Any?, name: String): DoubleRatchet.ChainState {
        val chain = raw.asObject(name)
        chain.requireKeys(CHAIN_KEYS, name)
        return DoubleRatchet.ChainState(
            key = chain.requiredBytes("key", KEY_BYTES),
            index = chain.requiredUInt32("index"),
        )
    }

    private fun validate(state: DoubleRatchet.RatchetState) {
        state.rootKey.checkBytes("rootKey", KEY_BYTES)
        state.sendingRatchet.publicKey.checkBytes("sendingRatchet.publicKey", KEY_BYTES)
        state.sendingRatchet.secretKey.checkBytes("sendingRatchet.secretKey", KEY_BYTES)
        state.remoteRatchetKey?.checkBytes("remoteRatchetKey", KEY_BYTES)
        require(state.previousRemoteRatchetKeys.size <= MAX_REMEMBERED_RATCHET_KEYS) { "Too many previous remote ratchet keys" }
        state.previousRemoteRatchetKeys.forEachIndexed { index, key -> key.checkBytes("previousRemoteRatchetKeys[$index]", KEY_BYTES) }
        state.sendingChain?.let { validateChain(it, "sendingChain") }
        state.receivingChain?.let { validateChain(it, "receivingChain") }
        state.previousCounter.checkUInt32("previousCounter")
        require(state.skipped.size <= MAX_SKIPPED_KEYS) { "Too many skipped message keys" }
        state.skipped.forEachIndexed { index, skipped ->
            skipped.ratchetKey.checkBytes("skipped[$index].ratchetKey", KEY_BYTES)
            skipped.index.checkUInt32("skipped[$index].index")
            skipped.messageKey.checkBytes("skipped[$index].messageKey", KEY_BYTES)
        }
        state.associatedData.checkBytes("associatedData")
        state.remoteIdentityKey.checkBytes("remoteIdentityKey", KEY_BYTES)
        state.baseKey.checkBytes("baseKey", KEY_BYTES)
        state.pendingPreKey?.let {
            it.signedPreKeyId.checkUInt32("pendingPreKey.signedPreKeyId")
            it.oneTimePreKeyId?.checkUInt32("pendingPreKey.oneTimePreKeyId")
        }
    }

    private fun validateChain(chain: DoubleRatchet.ChainState, name: String) {
        chain.key.checkBytes("$name.key", KEY_BYTES)
        chain.index.checkUInt32("$name.index")
    }

    private fun ByteArray.checkBytes(name: String, expectedLength: Int? = null) {
        require(size <= MAX_RECORD_BYTES) { "$name exceeds the record size limit" }
        if (expectedLength != null) require(size == expectedLength) { "$name must be $expectedLength bytes" }
    }

    private fun Long.checkUInt32(name: String) {
        require(this in 0..UINT32_MAX) { "$name must be an unsigned 32-bit integer" }
    }

    private fun Map<String, Any?>.requireKeys(expected: Set<String>, name: String) {
        require(keys == expected) { "$name has missing or unexpected fields" }
    }

    private fun Map<String, Any?>.requiredNullable(name: String): Any? {
        require(containsKey(name)) { "Missing $name" }
        return this[name]
    }

    private fun Map<String, Any?>.requiredObject(name: String) = required(name).asObject(name)
    private fun Map<String, Any?>.requiredArray(name: String) = required(name).asArray(name)
    private fun Map<String, Any?>.requiredBytes(name: String, expectedLength: Int? = null) = required(name).asBytes(name, expectedLength)
    private fun Map<String, Any?>.requiredNullableBytes(name: String, expectedLength: Int? = null) =
        requiredNullable(name)?.asBytes(name, expectedLength)
    private fun Map<String, Any?>.requiredUInt32(name: String) = required(name).asUInt32(name)
    private fun Map<String, Any?>.requiredNullableUInt32(name: String) = requiredNullable(name)?.asUInt32(name)
    private fun Map<String, Any?>.required(name: String) = this[name] ?: throw IllegalArgumentException("Missing $name")

    private fun Any?.asObject(name: String): Map<String, Any?> {
        val map = this as? Map<*, *> ?: throw IllegalArgumentException("$name must be an object")
        require(map.keys.all { it is String }) { "$name object keys must be strings" }
        return map.entries.associate { (key, value) -> (key as String) to value }
    }

    private fun Any?.asArray(name: String): List<Any?> =
        (this as? List<*>)?.toList() ?: throw IllegalArgumentException("$name must be an array")

    private fun Any?.asBytes(name: String, expectedLength: Int? = null): ByteArray {
        val bytes = this as? ByteArray ?: throw IllegalArgumentException("$name must be a byte array")
        bytes.checkBytes(name, expectedLength)
        return bytes.copyOf()
    }

    private fun Any?.asUInt32(name: String): Long {
        val number = this as? Number ?: throw IllegalArgumentException("$name must be an unsigned 32-bit integer")
        val value = number.toLong()
        require(number.toDouble() == value.toDouble() && value in 0..UINT32_MAX) {
            "$name must be an unsigned 32-bit integer"
        }
        return value
    }

    private val STATE_KEYS = setOf(
        "rootKey", "sendingRatchet", "remoteRatchetKey", "previousRemoteRatchetKeys",
        "sendingChain", "receivingChain", "previousCounter", "skipped", "associatedData",
        "remoteIdentityKey", "baseKey", "pendingPreKey",
    )
    private val KEY_PAIR_KEYS = setOf("publicKey", "secretKey")
    private val CHAIN_KEYS = setOf("key", "index")
    private val SKIPPED_KEYS = setOf("ratchetKey", "index", "messageKey")
    private val PENDING_PREKEY_KEYS = setOf("signedPreKeyId", "oneTimePreKeyId")
    private const val KEY_BYTES = 32
}
