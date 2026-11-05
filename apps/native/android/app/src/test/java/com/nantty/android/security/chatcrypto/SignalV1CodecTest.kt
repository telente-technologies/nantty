package com.nantty.android.security.chatcrypto

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class SignalV1CodecTest {
    private val serializationFixture by lazy {
        val path = requireNotNull(System.getProperty("nanttySignalV1SerializationFixture")) {
            "Gradle must provide the shared signal-v1 serialization fixture path"
        }
        JSONObject(File(path).readText())
    }

    @Test
    fun directEnvelopeMatchesSharedReactNativeWireFixture() {
        val fixture = serializationFixture.getJSONObject("directEnvelope")
        val model = fixture.getJSONObject("value")
        val recipient = model.getJSONArray("r").getJSONObject(0)
        val value = SignalV1Envelope.Direct(
            senderDeviceId = model.getString("s"),
            payloadCiphertext = model.getString("p"),
            nonce = model.getString("n"),
            recipients = listOf(SignalV1PairwiseEntry(recipient.getString("u"), recipient.getString("d"), recipient.getString("b"))),
        )
        val wire = fixture.getString("wire")

        assertEquals(canonicalJson(JSONObject(wire)), canonicalJson(JSONObject(SignalV1EnvelopeCodec.encode(value))))
        assertEquals(value, SignalV1EnvelopeCodec.decode(wire))
    }

    @Test
    fun groupEnvelopeMatchesSharedReactNativeWireFixture() {
        val fixture = serializationFixture.getJSONObject("groupEnvelope")
        val model = fixture.getJSONObject("value")
        val recipient = model.getJSONArray("r").getJSONObject(0)
        val value = SignalV1Envelope.Group(
            senderDeviceId = model.getString("s"),
            ciphertext = model.getString("g"),
            recipients = listOf(SignalV1PairwiseEntry(recipient.getString("u"), recipient.getString("d"), recipient.getString("b"))),
        )
        val wire = fixture.getString("wire")

        assertEquals(canonicalJson(JSONObject(wire)), canonicalJson(JSONObject(SignalV1EnvelopeCodec.encode(value))))
        assertEquals(value, SignalV1EnvelopeCodec.decode(wire))
    }

    @Test
    fun innerPayloadMatchesSharedReactNativeWireFixture() {
        val fixture = serializationFixture.getJSONObject("innerPayload")
        val input = fixture.getJSONObject("input")
        val value = SignalV1Payload(
            text = input.getString("text"),
            sentAt = input.getString("sentAt"),
            conversationId = input.getString("conversationId"),
        )
        val wire = fixture.getString("wire")
        val decodedFixture = fixture.getJSONObject("decoded")
        val expectedDecoded = SignalV1Payload(
            text = decodedFixture.getString("text"),
            sentAt = decodedFixture.getString("sentAt"),
            conversationId = decodedFixture.getString("conversationId"),
            linkPreviewKey = decodedFixture.optString("linkPreviewKey").takeIf(String::isNotEmpty),
            groupKey = decodedFixture.optString("groupKey").takeIf(String::isNotEmpty),
        )

        assertEquals(canonicalJson(JSONObject(wire)), canonicalJson(JSONObject(SignalV1PayloadCodec.encode(value).toString(Charsets.UTF_8))))
        assertEquals(expectedDecoded, SignalV1PayloadCodec.decode(wire.toByteArray(Charsets.UTF_8)))
    }

    @Test
    fun directEnvelopeRoundTripsWithReactNativeFieldNames() {
        val rnFixture = """{"v":1,"t":"p","s":"device-sender","p":"payload-ciphertext","n":"nonce","r":[{"u":"user-1","d":"device-1","b":"entry-ciphertext"}]}"""
        val value = SignalV1Envelope.Direct("device-sender", "payload-ciphertext", "nonce", listOf(SignalV1PairwiseEntry("user-1", "device-1", "entry-ciphertext")))
        assertEquals(value, SignalV1EnvelopeCodec.decode(rnFixture))
        val encoded = SignalV1EnvelopeCodec.encode(value)
        assertEquals(value, SignalV1EnvelopeCodec.decode(encoded))
        assertEquals("p", JSONObject(encoded).getString("t"))
        assertEquals("payload-ciphertext", JSONObject(encoded).getString("p"))
    }

    @Test
    fun groupEnvelopeRoundTripsWithReactNativeFieldNames() {
        val rnFixture = """{"v":1,"t":"g","s":"device-sender","g":"group-ciphertext","r":[{"u":"user-1","d":"device-1","b":"entry-ciphertext"}]}"""
        val value = SignalV1Envelope.Group("device-sender", "group-ciphertext", listOf(SignalV1PairwiseEntry("user-1", "device-1", "entry-ciphertext")))
        assertEquals(value, SignalV1EnvelopeCodec.decode(rnFixture))
        val encoded = SignalV1EnvelopeCodec.encode(value)
        assertEquals(value, SignalV1EnvelopeCodec.decode(encoded))
        assertEquals("g", JSONObject(encoded).getString("t"))
        assertEquals("group-ciphertext", JSONObject(encoded).getString("g"))
    }

    @Test
    fun envelopeRejectsMalformedMissingFieldsAndCoercibleTypes() {
        val invalid = listOf(
            "not-json",
            "[]",
            "{\"v\":\"1\",\"t\":\"p\",\"s\":\"s\",\"p\":\"p\",\"n\":\"n\",\"r\":[]}",
            "{\"v\":4294967297,\"t\":\"p\",\"s\":\"s\",\"p\":\"p\",\"n\":\"n\",\"r\":[]}",
            "{\"v\":1,\"t\":1,\"s\":\"s\",\"p\":\"p\",\"n\":\"n\",\"r\":[]}",
            "{\"v\":1,\"t\":\"p\",\"s\":\"s\",\"p\":\"p\",\"n\":\"n\",\"r\":[{\"u\":\"u\",\"d\":\"d\"}]}",
        )
        invalid.forEach { input -> assertThrows(IllegalArgumentException::class.java) { SignalV1EnvelopeCodec.decode(input) } }
    }

    @Test
    fun envelopeEnforcesMaximumEncodedAndDecodedLength() {
        assertThrows(IllegalArgumentException::class.java) {
            SignalV1EnvelopeCodec.decode(" ".repeat(MAXIMUM_SIGNAL_V1_ENVELOPE_LENGTH + 1))
        }
        val tooLarge = SignalV1Envelope.Direct("sender", "x".repeat(MAXIMUM_SIGNAL_V1_ENVELOPE_LENGTH), "n", emptyList())
        assertThrows(IllegalArgumentException::class.java) { SignalV1EnvelopeCodec.encode(tooLarge) }
    }

    @Test
    fun payloadRoundTripsAndSanitizesOptionalFieldsAndLimits() {
        val raw = """{"v":1,"text":"${"x".repeat(4_010)}","sentAt":"2026-11-05T12:00:00.000Z","conversationId":7,"storyId":"story","linkPreviewKey":"${"k".repeat(44)}","groupKey":"short","linkPreview":{"url":"http://example.com/${"u".repeat(2_100)}","domain":"${"d".repeat(300)}","title":"${"t".repeat(350)}","description":"${"d".repeat(550)}","imageUrl":"http://insecure.test/a","siteName":"${"s".repeat(130)}","imageMediaId":"${"m".repeat(70)}"},"sharedContent":{"kind":"post","id":"p-1"},"attachment":{"key":"${"k".repeat(44)}","digest":"${"d".repeat(44)}","sizeBytes":2,"contentType":"${"c".repeat(130)}","fileName":"${"f".repeat(310)}","width":-2,"height":10,"thumbnail":"bad?"},"location":{"latitude":91,"longitude":4,"label":"invalid"},"poll":{"question":"?","options":[]},"control":{"type":"groupUpdate"}}"""
        val result = SignalV1PayloadCodec.decode(raw.toByteArray())

        assertEquals(SignalV1PayloadCodec.MAXIMUM_TEXT_LENGTH, result.text.length)
        assertNull(result.conversationId)
        assertEquals("story", result.storyId)
        assertEquals("k".repeat(44), result.linkPreviewKey)
        assertNull(result.groupKey)
        assertEquals(2_048, result.linkPreview?.url?.length)
        assertEquals(255, result.linkPreview?.domain?.length)
        assertEquals(300, result.linkPreview?.title?.length)
        assertEquals(500, result.linkPreview?.description?.length)
        assertNull(result.linkPreview?.imageUrl)
        assertEquals(120, result.linkPreview?.siteName?.length)
        assertEquals(64, result.linkPreview?.imageMediaId?.length)
        assertEquals(SignalV1SharedContent("post", "p-1"), result.sharedContent)
        assertEquals(120, result.attachment?.contentType?.length)
        assertEquals(300, result.attachment?.fileName?.length)
        assertNull(result.attachment?.width)
        assertNull(result.attachment?.thumbnail)
        assertNull(result.location)
        assertNull(result.poll)
        assertEquals(SignalV1Control.GroupUpdate, result.control)
        assertEquals(result, SignalV1PayloadCodec.decode(SignalV1PayloadCodec.encode(result)))
    }

    @Test
    fun payloadRejectsMalformedAndCoercibleVersionAndSanitizesBadOptionalFields() {
        listOf("not-json", "[]", "{\"v\":\"1\",\"text\":\"x\",\"sentAt\":\"now\"}", "{\"v\":4294967297,\"text\":\"x\",\"sentAt\":\"now\"}", "{\"v\":1,\"text\":2,\"sentAt\":\"now\"}")
            .forEach { raw -> assertThrows(IllegalArgumentException::class.java) { SignalV1PayloadCodec.decode(raw.toByteArray()) } }

        val clean = SignalV1PayloadCodec.decode("""{"v":1,"text":"ok","sentAt":"now","sharedContent":{"kind":"","id":"x"},"location":{"latitude":1,"longitude":2,"label":"  hello  "}}""".toByteArray())
        assertEquals(SignalV1SharedContent("", "x"), clean.sharedContent)
        assertEquals("hello", clean.location?.label)
        assertTrue(clean.location?.latitude == 1.0)
    }

    @Test
    fun locationSanitizerAcceptsJavascriptDateParseIsoDateOnlyForm() {
        val payload = SignalV1PayloadCodec.decode(
            """{"v":1,"text":"","sentAt":"now","location":{"latitude":6.5,"longitude":3.4,"label":"","liveUntil":"2026-11-05"}}""".toByteArray(),
        )
        assertEquals("2026-11-05", payload.location?.liveUntil)
        assertNull(payload.location?.label)
    }

    @Test
    fun locationSanitizerAcceptsIsoLocalDateTimeLikeReactNativeDateParse() {
        val timestamp = "2026-11-05T12:30:45"
        val payload = SignalV1PayloadCodec.decode(
            """{"v":1,"text":"","sentAt":"now","location":{"latitude":6.5,"longitude":3.4,"liveUntil":"$timestamp"}}""".toByteArray(),
        )

        assertEquals(timestamp, payload.location?.liveUntil)
    }

    private fun canonicalJson(value: Any?): String = when (value) {
        is JSONObject -> value.keys().asSequence().toList().sorted().joinToString(prefix = "{", postfix = "}") { key ->
            "${JSONObject.quote(key)}:${canonicalJson(value.get(key))}"
        }
        is org.json.JSONArray -> (0 until value.length()).joinToString(prefix = "[", postfix = "]") { index -> canonicalJson(value.get(index)) }
        JSONObject.NULL -> "null"
        is String -> JSONObject.quote(value)
        is Number -> value.toString()
        is Boolean -> value.toString()
        null -> "null"
        else -> error("Unsupported JSON fixture value: ${value::class.java.name}")
    }
}
