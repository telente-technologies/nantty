package com.nantty.android.security.chatcrypto

import org.json.JSONArray
import org.json.JSONObject

internal const val SIGNAL_V1_PROTOCOL = "signal-v1"
internal const val MAXIMUM_SIGNAL_V1_ENVELOPE_LENGTH = 65_536

internal data class SignalV1PairwiseEntry(val userId: String, val deviceId: String, val ciphertext: String)

internal sealed interface SignalV1Envelope {
    val senderDeviceId: String
    val recipients: List<SignalV1PairwiseEntry>

    data class Direct(
        override val senderDeviceId: String,
        val payloadCiphertext: String,
        val nonce: String,
        override val recipients: List<SignalV1PairwiseEntry>,
    ) : SignalV1Envelope

    data class Group(
        override val senderDeviceId: String,
        val ciphertext: String,
        override val recipients: List<SignalV1PairwiseEntry>,
    ) : SignalV1Envelope
}

/** JSON-only wire codec. It intentionally does not establish sessions or encrypt/decrypt messages. */
internal object SignalV1EnvelopeCodec {
    fun encode(envelope: SignalV1Envelope): String {
        val recipients = JSONArray()
        envelope.recipients.forEach { entry ->
            recipients.put(
                JSONObject()
                    .put("u", entry.userId)
                    .put("d", entry.deviceId)
                    .put("b", entry.ciphertext),
            )
        }
        val json = JSONObject()
            .put("v", 1)
            .put("t", if (envelope is SignalV1Envelope.Direct) "p" else "g")
            .put("s", envelope.senderDeviceId)
        when (envelope) {
            is SignalV1Envelope.Direct -> json.put("p", envelope.payloadCiphertext).put("n", envelope.nonce)
            is SignalV1Envelope.Group -> json.put("g", envelope.ciphertext)
        }
        val encoded = json.put("r", recipients).toString()
        require(encoded.length <= MAXIMUM_SIGNAL_V1_ENVELOPE_LENGTH) { "Encrypted envelope exceeds the signal-v1 size limit" }
        return encoded
    }

    fun decode(text: String): SignalV1Envelope {
        require(text.length <= MAXIMUM_SIGNAL_V1_ENVELOPE_LENGTH) { "Encrypted envelope exceeds the signal-v1 size limit" }
        try {
            val root = JSONObject(text)
            require(root.opt("v").strictInteger() == 1) { "Malformed signal-v1 envelope" }
            val kind = root.opt("t") as? String ?: error("Malformed signal-v1 envelope")
            val sender = root.requiredNonEmptyString("s")
            val rawRecipients = root.get("r") as? JSONArray ?: error("Malformed signal-v1 recipients")
            val recipients = buildList(rawRecipients.length()) {
                for (index in 0 until rawRecipients.length()) {
                    val row = rawRecipients.get(index) as? JSONObject ?: error("Malformed signal-v1 recipient")
                    add(SignalV1PairwiseEntry(row.requiredNonEmptyString("u"), row.requiredNonEmptyString("d"), row.requiredNonEmptyString("b")))
                }
            }
            return when (kind) {
                "p" -> SignalV1Envelope.Direct(sender, root.requiredNonEmptyString("p"), root.requiredNonEmptyString("n"), recipients)
                "g" -> SignalV1Envelope.Group(sender, root.requiredNonEmptyString("g"), recipients)
                else -> error("Malformed signal-v1 envelope")
            }
        } catch (error: Exception) {
            if (error is IllegalArgumentException) throw error
            throw IllegalArgumentException("Malformed signal-v1 envelope", error)
        }
    }
}

private fun JSONObject.requiredNonEmptyString(key: String): String =
    (opt(key) as? String)?.takeIf(String::isNotEmpty) ?: throw IllegalArgumentException("Malformed signal-v1 envelope")

private fun Any?.strictInteger(): Int? = (this as? Number)?.toDouble()
    ?.takeIf { it.isFinite() && it % 1.0 == 0.0 && it <= Int.MAX_VALUE && it >= Int.MIN_VALUE }
    ?.toInt()
