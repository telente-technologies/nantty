package com.nantty.android.security.chatcrypto

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.File

class GroupAttributesTest {
    @Test
    fun sealsAndOpensTheSharedReactNativeFixture() {
        val fixture = fixture()
        val keyBytes = ByteArray(32) { it.toByte() }
        val nonceBytes = ByteArray(12) { (it + 32).toByte() }
        val key = ChatCryptoPrimitives.encodeBase64(keyBytes)
        val sealed = GroupAttributes.seal(
            ChatGroupAttributes("Nantty Makers", "Designing together"),
            key,
        ) { size ->
            when (size) {
                32 -> keyBytes
                12 -> nonceBytes
                else -> error("Unexpected random byte request: $size")
            }
        }

        assertEquals(fixture.getString("groupKey"), key)
        assertEquals(fixture.getString("encryptedAttributes"), sealed)
        assertEquals(
            ChatGroupAttributes("Nantty Makers", "Designing together"),
            GroupAttributes.open(sealed, listOf(key)),
        )
    }

    @Test
    fun rejectsWrongKeysMalformedCiphertextAndInvalidNames() {
        val fixture = fixture()
        val key = fixture.getString("groupKey")
        assertNull(GroupAttributes.open(fixture.getString("encryptedAttributes"), listOf("AA==", "${key.dropLast(4)}AAAA")))
        assertNull(GroupAttributes.open("not base64", listOf(key)))
        assertNull(GroupAttributes.open(ChatCryptoPrimitives.encodeBase64(ByteArray(8)), listOf(key)))
        assertThrows(IllegalArgumentException::class.java) {
            GroupAttributes.seal(ChatGroupAttributes("  "), key) { ByteArray(it) }
        }
    }

    private fun fixture(): JSONObject {
        val path = requireNotNull(System.getProperty("nanttyGroupAttributesFixture"))
        return JSONObject(File(path).readText())
    }
}
