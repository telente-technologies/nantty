package com.nantty.android.security.chatcrypto

import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class DoubleRatchetTest {
    private val fixture by lazy {
        val relative = "packages/chatCrypto/fixtures/double-ratchet-v1.json"
        val startingDirectory = File(System.getProperty("user.dir").orEmpty())
        val path = generateSequence(startingDirectory) { it.parentFile }
            .map { File(it, relative) }
            .firstOrNull(File::isFile)
        JSONObject(requireNotNull(path) { "Could not locate shared Double Ratchet fixture from ${startingDirectory.path}" }.readText())
    }

    @Test
    fun deterministicTypeScriptVectorMatchesKotlinAndDecrypts() {
        val data = fixture
        val initiator = createInitiator(data)
        val encrypted = DoubleRatchet.ratchetEncrypt(initiator, data.hex("plaintext"))
        val remotePrivate = data.hex("remoteSignedPreKeyPrivate")
        val remotePair = DoubleRatchet.AgreementKeyPair(
            ChatCryptoPrimitives.x25519PublicKey(remotePrivate),
            remotePrivate,
        )

        assertEquals(data.getString("header"), DoubleRatchet.encodeHeader(encrypted.header).toHex())
        assertEquals(data.getString("ciphertext"), encrypted.ciphertext.toHex())
        assertEquals(data.getString("nextSendingChainKey"), encrypted.state.sendingChain?.key?.toHex())
        val decoded = DoubleRatchet.decodeHeader(DoubleRatchet.encodeHeader(encrypted.header))
        assertArrayEquals(encrypted.header.ratchetKey, decoded.ratchetKey)
        assertEquals(encrypted.header.previousCounter, decoded.previousCounter)
        assertEquals(encrypted.header.index, decoded.index)

        val responder = DoubleRatchet.initializeResponder(
            X3dhResponse(data.hex("sharedSecret"), data.hex("associatedData")),
            remotePair,
            data.hex("remoteIdentityKey"),
            data.hex("baseKeyPublic"),
        )
        val received = DoubleRatchet.ratchetDecrypt(responder, encrypted.header, encrypted.ciphertext, seededRandom("double-ratchet-bob-next"))
        assertArrayEquals(data.hex("plaintext"), received.plaintext)

        val reply = DoubleRatchet.ratchetEncrypt(received.state, "reply".toByteArray())
        val replyReceived = DoubleRatchet.ratchetDecrypt(
            encrypted.state,
            reply.header,
            reply.ciphertext,
            seededRandom("double-ratchet-alice-next"),
        )
        assertArrayEquals("reply".toByteArray(), replyReceived.plaintext)
    }

    @Test
    fun decryptsSkippedMessagesOutOfOrderAndRejectsReplays() {
        val data = fixture
        val alice = createInitiator(data)
        val first = DoubleRatchet.ratchetEncrypt(alice, "first".toByteArray())
        val second = DoubleRatchet.ratchetEncrypt(first.state, "second".toByteArray())
        val third = DoubleRatchet.ratchetEncrypt(second.state, "third".toByteArray())
        val bob = createResponder(data)

        val receivedThird = DoubleRatchet.ratchetDecrypt(bob, third.header, third.ciphertext, seededRandom("order-bob-ratchet"))
        assertArrayEquals("third".toByteArray(), receivedThird.plaintext)
        assertEquals(listOf(0L, 1L), receivedThird.state.skipped.map { it.index })
        val receivedFirst = DoubleRatchet.ratchetDecrypt(receivedThird.state, first.header, first.ciphertext, seededRandom("unused-first"))
        assertArrayEquals("first".toByteArray(), receivedFirst.plaintext)
        val receivedSecond = DoubleRatchet.ratchetDecrypt(receivedFirst.state, second.header, second.ciphertext, seededRandom("unused-second"))
        assertArrayEquals("second".toByteArray(), receivedSecond.plaintext)

        val replay = assertThrows(DoubleRatchet.RatchetException::class.java) {
            DoubleRatchet.ratchetDecrypt(receivedSecond.state, first.header, first.ciphertext, seededRandom("unused-replay"))
        }
        assertEquals(DoubleRatchet.RatchetException.Code.DUPLICATE_MESSAGE, replay.code)
    }

    @Test
    fun rejectsTamperingWithoutMutatingTheCallerState() {
        val data = fixture
        val alice = createInitiator(data)
        val encrypted = DoubleRatchet.ratchetEncrypt(alice, "authenticated".toByteArray())
        val bob = createResponder(data)
        val changedCiphertext = encrypted.ciphertext.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
        val cipherFailure = assertThrows(DoubleRatchet.RatchetException::class.java) {
            DoubleRatchet.ratchetDecrypt(bob, encrypted.header, changedCiphertext, seededRandom("tamper-bob-ratchet"))
        }
        assertEquals(DoubleRatchet.RatchetException.Code.INVALID_MESSAGE, cipherFailure.code)

        val changedHeader = encrypted.header.copy(previousCounter = 1)
        val headerFailure = assertThrows(DoubleRatchet.RatchetException::class.java) {
            DoubleRatchet.ratchetDecrypt(bob, changedHeader, encrypted.ciphertext, seededRandom("tamper-bob-ratchet"))
        }
        assertEquals(DoubleRatchet.RatchetException.Code.INVALID_MESSAGE, headerFailure.code)

        val genuine = DoubleRatchet.ratchetDecrypt(bob, encrypted.header, encrypted.ciphertext, seededRandom("tamper-bob-ratchet"))
        assertArrayEquals("authenticated".toByteArray(), genuine.plaintext)
    }

    @Test
    fun rejectsExcessiveSkipAndUnavailableSendChain() {
        val data = fixture
        val first = DoubleRatchet.ratchetEncrypt(createInitiator(data), "skip limit".toByteArray())
        val tooFar = first.header.copy(index = DoubleRatchet.MAXIMUM_SKIPPED_PER_CHAIN.toLong() + 1)
        val failure = assertThrows(DoubleRatchet.RatchetException::class.java) {
            DoubleRatchet.ratchetDecrypt(createResponder(data), tooFar, first.ciphertext, seededRandom("skip-limit-ratchet"))
        }
        assertEquals(DoubleRatchet.RatchetException.Code.TOO_MANY_SKIPPED, failure.code)

        val sendFailure = assertThrows(DoubleRatchet.RatchetException::class.java) {
            DoubleRatchet.ratchetEncrypt(createResponder(data), byteArrayOf(1))
        }
        assertEquals(DoubleRatchet.RatchetException.Code.NO_SESSION, sendFailure.code)
        assertTrue(DoubleRatchet.MAXIMUM_STORED_SKIPPED_KEYS >= DoubleRatchet.MAXIMUM_SKIPPED_PER_CHAIN)
    }

    private fun createInitiator(data: JSONObject): DoubleRatchet.RatchetState {
        val remotePrivate = data.hex("remoteSignedPreKeyPrivate")
        return DoubleRatchet.initializeInitiator(
            X3dhInitiation(
                baseKeyPublic = data.hex("baseKeyPublic"),
                sharedSecret = data.hex("sharedSecret"),
                associatedData = data.hex("associatedData"),
            ),
            ChatCryptoPrimitives.x25519PublicKey(remotePrivate),
            data.hex("remoteIdentityKey"),
            DoubleRatchet.PendingPreKey(17, 23),
            random = { requested ->
                require(requested == 32)
                data.hex("sendingRatchetPrivate")
            },
        )
    }

    private fun createResponder(data: JSONObject): DoubleRatchet.RatchetState {
        val remotePrivate = data.hex("remoteSignedPreKeyPrivate")
        return DoubleRatchet.initializeResponder(
            X3dhResponse(data.hex("sharedSecret"), data.hex("associatedData")),
            DoubleRatchet.AgreementKeyPair(ChatCryptoPrimitives.x25519PublicKey(remotePrivate), remotePrivate),
            data.hex("remoteIdentityKey"),
            data.hex("baseKeyPublic"),
        )
    }

    private fun JSONObject.hex(name: String): ByteArray = getString(name).chunked(2).map { it.toInt(16).toByte() }.toByteArray()

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

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }
}
