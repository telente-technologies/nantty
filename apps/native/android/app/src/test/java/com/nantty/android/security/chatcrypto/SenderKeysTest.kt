package com.nantty.android.security.chatcrypto

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class SenderKeysTest {
    private val fixture by lazy {
        val path = requireNotNull(System.getProperty("nanttySenderKeysFixture")) {
            "Gradle must provide the shared sender-key fixture path"
        }
        JSONObject(File(path).readText())
    }

    @Test
    fun deterministicCreateEncodeDecodeApplyAndMessagesMatchReactNativeFixture() {
        val data = fixture
        val random = seededRandom(data.getString("seed"))
        var own = SenderKeys.createOwn(random, data.getLong("createdAt"))
        val conversationId = data.getString("conversationId")
        assertEquals(data.getString("distributionHex"), own.let { SenderKeys.encodeDistribution(conversationId, it).toHex() })

        val distribution = SenderKeys.decodeDistribution(hex(data.getString("distributionHex")))
        assertEquals(conversationId, distribution.conversationId)
        assertEquals(own.keyId, distribution.keyId)
        assertEquals(0L, distribution.iteration)
        var peer: SenderKeys.PeerRecord? = SenderKeys.applyDistribution(null, distribution)

        val messages = data.getJSONArray("messages")
        for (index in 0 until messages.length()) {
            val expected = messages.getJSONObject(index)
            val encrypted = SenderKeys.groupEncrypt(
                own,
                conversationId,
                data.getString("senderUserId"),
                data.getString("senderDeviceId"),
                expected.getString("plaintext").toByteArray(Charsets.UTF_8),
            )
            own = encrypted.own
            assertEquals(expected.getString("messageHex"), encrypted.message.toHex())
            assertEquals(own.keyId, SenderKeys.readGroupMessageKeyId(encrypted.message))
            val decrypted = SenderKeys.groupDecrypt(
                peer,
                conversationId,
                data.getString("senderUserId"),
                data.getString("senderDeviceId"),
                hex(expected.getString("messageHex")),
            )
            peer = decrypted.record
            assertEquals(expected.getString("plaintext"), decrypted.plaintext.toString(Charsets.UTF_8))
        }
    }

    @Test
    fun decryptsOutOfOrderMessagesAndConsumesSkippedKeysOnce() {
        val (messages, peer) = groupFixture("out-of-order")
        var current = peer
        val order = listOf(2, 0, 3, 1)
        order.forEach { index ->
            val result = SenderKeys.groupDecrypt(current, CONVERSATION, SENDER, DEVICE, messages[index])
            assertEquals("message-$index", result.plaintext.toString(Charsets.UTF_8))
            current = result.record
        }
        assertCode(SenderKeys.CryptoException.Code.DUPLICATE_MESSAGE) {
            SenderKeys.groupDecrypt(current, CONVERSATION, SENDER, DEVICE, messages[0])
        }
    }

    @Test
    fun rejectsReplayAndConversationOrSenderDeviceSignatureBinding() {
        val (messages, peer) = groupFixture("binding")
        val message = messages.first()
        val accepted = SenderKeys.groupDecrypt(peer, CONVERSATION, SENDER, DEVICE, message)
        assertCode(SenderKeys.CryptoException.Code.DUPLICATE_MESSAGE) {
            SenderKeys.groupDecrypt(accepted.record, CONVERSATION, SENDER, DEVICE, message)
        }
        assertCode(SenderKeys.CryptoException.Code.INVALID_SIGNATURE) {
            SenderKeys.groupDecrypt(peer, "$CONVERSATION-other", SENDER, DEVICE, message)
        }
        assertCode(SenderKeys.CryptoException.Code.INVALID_SIGNATURE) {
            SenderKeys.groupDecrypt(peer, CONVERSATION, "other-user", DEVICE, message)
        }
        assertCode(SenderKeys.CryptoException.Code.INVALID_SIGNATURE) {
            SenderKeys.groupDecrypt(peer, CONVERSATION, SENDER, "other-device", message)
        }
    }

    @Test
    fun rejectsTamperingMissingDistributionMalformedInputAndExcessiveSkip() {
        val (messages, peer) = groupFixture("rejections")
        val tampered = messages.first().copyOf().also { it[12] = (it[12].toInt() xor 1).toByte() }
        assertCode(SenderKeys.CryptoException.Code.INVALID_SIGNATURE) {
            SenderKeys.groupDecrypt(peer, CONVERSATION, SENDER, DEVICE, tampered)
        }
        assertCode(SenderKeys.CryptoException.Code.NO_SENDER_KEY) {
            SenderKeys.groupDecrypt(null, CONVERSATION, SENDER, DEVICE, messages.first())
        }
        assertCode(SenderKeys.CryptoException.Code.INVALID_MESSAGE) { SenderKeys.decodeDistribution(byteArrayOf()) }

        val tooFarOwn = generateOwn("skip-bound").let { initial ->
            var own = initial
            repeat(SenderKeys.MAXIMUM_SKIP + 2) {
                own = SenderKeys.groupEncrypt(own, CONVERSATION, SENDER, DEVICE, byteArrayOf()).own
            }
            own
        }
        val zeroIterationPeer = SenderKeys.applyDistribution(null, SenderKeys.decodeDistribution(SenderKeys.encodeDistribution(CONVERSATION, generateOwn("skip-bound"))))
        val tooFar = SenderKeys.groupEncrypt(tooFarOwn, CONVERSATION, SENDER, DEVICE, byteArrayOf()).message
        assertCode(SenderKeys.CryptoException.Code.TOO_MANY_SKIPPED) {
            SenderKeys.groupDecrypt(zeroIterationPeer, CONVERSATION, SENDER, DEVICE, tooFar)
        }
    }

    @Test
    fun distributionDeduplicatesAndRetainsAtMostFourSenderStates() {
        var record: SenderKeys.PeerRecord? = null
        repeat(5) { index ->
            val distribution = SenderKeys.decodeDistribution(SenderKeys.encodeDistribution(CONVERSATION, generateOwn("state-$index")))
            record = SenderKeys.applyDistribution(record, distribution)
        }
        assertEquals(4, record?.states?.size)
        val duplicate = requireNotNull(record).states.first()
        val unchanged = SenderKeys.applyDistribution(record, duplicate.toDistribution())
        assertEquals(record?.states?.map { it.keyId }, unchanged.states.map { it.keyId })
    }

    private fun groupFixture(seed: String): Pair<List<ByteArray>, SenderKeys.PeerRecord> {
        var own = generateOwn(seed)
        val peer = SenderKeys.applyDistribution(null, SenderKeys.decodeDistribution(SenderKeys.encodeDistribution(CONVERSATION, own)))
        val messages = (0..3).map { index ->
            val encrypted = SenderKeys.groupEncrypt(own, CONVERSATION, SENDER, DEVICE, "message-$index".toByteArray())
            own = encrypted.own
            encrypted.message
        }
        return messages to peer
    }

    private fun generateOwn(seed: String): SenderKeys.OwnKey = SenderKeys.createOwn(seededRandom(seed), 1L)

    private fun seededRandom(seed: String): (Int) -> ByteArray {
        var counter = 0
        return { length ->
            val output = ByteArray(length)
            var offset = 0
            while (offset < length) {
                val block = MessageDigest.getInstance("SHA-256").digest("$seed:${counter++}".toByteArray(Charsets.UTF_8))
                val count = minOf(block.size, length - offset)
                block.copyInto(output, offset, 0, count)
                offset += count
            }
            output
        }
    }

    private fun assertCode(code: SenderKeys.CryptoException.Code, block: () -> Unit) {
        val error = assertThrows(SenderKeys.CryptoException::class.java, block)
        assertEquals(code, error.code)
    }

    private fun SenderKeys.PeerState.toDistribution() = SenderKeys.Distribution(CONVERSATION, keyId, iteration, chainKey, signingPublicKey)

    private fun hex(value: String) = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    private fun ByteArray.toHex() = joinToString("") { "%02x".format(it.toInt() and 0xff) }

    companion object {
        private const val CONVERSATION = "0190f0a0-0000-7000-8000-000000000001"
        private const val SENDER = "alice"
        private const val DEVICE = "deviceA"
    }
}
