package com.nantty.android.data

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/** HTTP transport restricted to routes explicitly supported by the Android messaging client. */
internal class JdkChatThreadTransport(private val baseUrl: String) : ChatThreadTransport {
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        val endpointPath = path.substringBefore('?')
        require(isSupportedChatThreadRequest(method, endpointPath)) { "Unsupported conversation request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use messages.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            body?.let { connection.outputStream.use { out -> out.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            if (status !in 200..299) throw MessagesHttpException(status)
            val response = (if (status == HttpURLConnection.HTTP_NO_CONTENT) null else connection.inputStream)
                ?.use(::readThreadResponse).orEmpty()
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readThreadResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large messages response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

internal fun isSupportedChatThreadRequest(method: String, endpointPath: String): Boolean = when {
    endpointPath.matches(CHAT_KEY_DEVICE_PATH) -> method in setOf("GET", "PUT", "DELETE")
    endpointPath.matches(CHAT_KEY_PREKEYS_PATH) -> method == "POST"
    endpointPath.matches(CHAT_KEY_SIGNED_PREKEY_PATH) -> method == "PUT"
    endpointPath == "/api/v1/chat/keys/devices/query" -> method == "POST"
    endpointPath == "/api/v1/chat/keys/bundles" -> method == "POST"
    endpointPath == "/api/v1/group-invitations" -> method == "GET"
    endpointPath.matches(Regex("/api/v1/group-invitations/[0-9a-fA-F-]{36}/(accept|decline)")) -> method == "POST"
    endpointPath.matches(Regex("/api/v1/conversations/[0-9a-fA-F-]{36}/invitations")) -> method == "POST"
    endpointPath.matches(Regex("/api/v1/conversations/[0-9a-fA-F-]{36}/invitations/[0-9a-fA-F-]{36}")) -> method == "DELETE"
    endpointPath.matches(Regex("/api/v1/conversations/[0-9a-fA-F-]{36}/invitation-links")) -> method in setOf("GET", "POST")
    endpointPath.matches(Regex("/api/v1/conversations/invitation-links/[A-Za-z0-9_-]{43}/preview")) -> method == "GET"
    endpointPath.matches(Regex("/api/v1/conversations/invitation-links/[A-Za-z0-9_-]{43}/claim")) -> method == "POST"
    endpointPath.matches(Regex("/api/v1/conversations/[0-9a-fA-F-]{36}/invitation-links/[0-9a-fA-F-]{36}")) -> method == "DELETE"
    endpointPath.startsWith("/api/v1/conversations/") && endpointPath.endsWith("/messages") -> method == "GET"
    endpointPath.startsWith("/api/v1/conversations/") && endpointPath.endsWith("/read") -> method == "POST"
    endpointPath.matches(Regex("/api/v1/conversations/[0-9a-fA-F-]{36}/streak/(restore|celebrated)")) -> method == "POST"
    endpointPath.matches(Regex("/api/v1/conversations/[0-9a-fA-F-]{36}(/(accept|block|not-spam))?")) -> method == "POST" || method == "DELETE"
    endpointPath == "/api/v1/conversations/search" -> method == "GET"
    endpointPath == "/api/v1/conversations" -> method == "POST"
    endpointPath == "/api/v1/channels" -> method == "POST"
    endpointPath.matches(Regex("/api/v1/conversations/stores/[0-9a-fA-F-]{36}")) -> method == "POST"
    else -> false
}

private val CHAT_KEY_DEVICE_PATH = Regex("/api/v1/chat/keys/devices/[A-Za-z0-9_-]{8,64}")
private val CHAT_KEY_PREKEYS_PATH = Regex("/api/v1/chat/keys/devices/[A-Za-z0-9_-]{8,64}/prekeys")
private val CHAT_KEY_SIGNED_PREKEY_PATH = Regex("/api/v1/chat/keys/devices/[A-Za-z0-9_-]{8,64}/signed-prekey")
