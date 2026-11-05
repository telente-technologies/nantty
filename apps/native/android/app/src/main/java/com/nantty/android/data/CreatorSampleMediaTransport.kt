package com.nantty.android.data

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URI
import java.net.URL
import java.util.UUID

internal fun JSONObject.dataObject(): JSONObject = optJSONObject("data") ?: this

internal fun JSONObject.requiredUuid(key: String): String {
    val value = optString(key).takeIf(String::isNotBlank) ?: error("Nantty returned an incomplete media response.")
    return runCatching { UUID.fromString(value).toString() }.getOrElse { error("Nantty returned an invalid media identifier.") }
}

internal fun creatorSampleSafeFileName(value: String): String {
    val leafName = value.substringAfterLast('/').substringAfterLast('\\')
    val baseName = leafName.substringBeforeLast('.', missingDelimiterValue = leafName)
    val cleaned = buildString {
        var previousWasSeparator = false
        for (character in baseName) {
            when {
                character.isLetterOrDigit() -> { append(character); previousWasSeparator = false }
                character == '-' || character == '_' -> { append(character); previousWasSeparator = false }
                character.isWhitespace() && !previousWasSeparator -> { append('-'); previousWasSeparator = true }
            }
            if (length >= 200) break
        }
    }.trim('-')
    return "${cleaned.ifBlank { "creator-sample" }}.jpg"
}

internal fun isSafeCreatorSampleSignedObjectUrl(value: String): Boolean = runCatching {
    val uri = URI(value)
    val host = uri.host?.lowercase()?.trimEnd('.') ?: return@runCatching false
    uri.isAbsolute && uri.scheme.equals("https", ignoreCase = true) && uri.userInfo == null && uri.fragment == null &&
        uri.port in listOf(-1, 443) && isPublicCreatorSampleHost(host)
}.getOrDefault(false)

internal fun isSafeCreatorSampleMediaUrl(value: String): Boolean = runCatching {
    val uri = URI(value)
    uri.isAbsolute && uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.fragment == null
}.getOrDefault(false)

private fun isPublicCreatorSampleHost(host: String): Boolean {
    if (host == "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false
    val appearsToBeIpLiteral = ':' in host || host.all { it.isDigit() || it == '.' }
    if (!appearsToBeIpLiteral) return true
    val address = runCatching { InetAddress.getByName(host) }.getOrNull() ?: return false
    return !address.isAnyLocalAddress && !address.isLoopbackAddress && !address.isLinkLocalAddress && !address.isSiteLocalAddress
}

internal class JdkCreatorSampleMediaTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : CreatorSampleMediaTransport {
    override fun createUploadSession(path: String, accessToken: String, body: JSONObject, cancellation: CreatorSampleCancellation): JSONObject =
        apiRequest(path, "POST", accessToken, cancellation, body.toString())

    override fun getChunkUploadUrl(path: String, accessToken: String, cancellation: CreatorSampleCancellation): JSONObject =
        apiRequest(path, "GET", accessToken, cancellation)

    override fun putSignedChunk(url: String, bytes: ByteArray, cancellation: CreatorSampleCancellation) {
        require(isSafeCreatorSampleSignedObjectUrl(url)) { "Nantty returned an unsafe signed upload URL." }
        val connection = openConnection(URL(url)).apply {
            requestMethod = "PUT"
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = CHUNK_READ_TIMEOUT_MS
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setFixedLengthStreamingMode(bytes.size)
        }
        val cancelRegistration = cancellation.onCancel { connection.disconnect() }
        try {
            cancellation.throwIfCancelled()
            connection.outputStream.use { it.write(bytes) }
            val status = connection.responseCode
            if (status !in 200..299) throw CreatorSampleMediaHttpException(status, "Signed image upload failed (HTTP $status).")
        } finally {
            cancelRegistration.close()
            connection.disconnect()
        }
    }

    override fun completeUpload(path: String, accessToken: String, cancellation: CreatorSampleCancellation): JSONObject =
        apiRequest(path, "POST", accessToken, cancellation, "{}")

    override fun getMediaAsset(path: String, accessToken: String, cancellation: CreatorSampleCancellation): JSONObject =
        apiRequest(path, "GET", accessToken, cancellation)

    override fun abortUpload(path: String, accessToken: String, cancellation: CreatorSampleCancellation) {
        apiRequest(path, "DELETE", accessToken, cancellation, acceptedEmpty = true)
    }

    private fun apiRequest(
        path: String,
        method: String,
        accessToken: String,
        cancellation: CreatorSampleCancellation,
        requestBody: String? = null,
        acceptedEmpty: Boolean = false,
    ): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to upload creator samples." }
        require(path.startsWith("/api/v1/media/") && !path.contains("..")) { "Unsupported Nantty media request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure a trusted HTTPS Nantty API URL to upload creator samples.")
        val connection = openConnection(URL(origin + path)).apply {
            requestMethod = method
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = API_READ_TIMEOUT_MS
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (requestBody != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        val cancelRegistration = cancellation.onCancel { connection.disconnect() }
        try {
            cancellation.throwIfCancelled()
            if (requestBody != null) connection.outputStream.use { it.write(requestBody.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            if (status !in 200..299) throw CreatorSampleMediaHttpException(status, "Nantty media request failed (HTTP $status).")
            val text = (if (status == HttpURLConnection.HTTP_NO_CONTENT) null else connection.inputStream)
                ?.use(::readBoundedResponse).orEmpty()
            if (acceptedEmpty && text.isBlank()) return JSONObject()
            require(text.isNotBlank()) { "Nantty returned an empty media response." }
            return JSONObject(text)
        } finally {
            cancelRegistration.close()
            connection.disconnect()
        }
    }

    private fun readBoundedResponse(input: InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large media response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val CONNECT_TIMEOUT_MS = 10_000
        const val API_READ_TIMEOUT_MS = 20_000
        const val CHUNK_READ_TIMEOUT_MS = 60_000
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}
