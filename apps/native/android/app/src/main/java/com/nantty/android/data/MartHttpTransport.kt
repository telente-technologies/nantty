package com.nantty.android.data

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

internal data class MartHttpResponse(val status: Int, val body: String)

internal object MartHttpTransport {
    fun get(
        url: URL,
        accessToken: String?,
        openConnection: (URL) -> HttpURLConnection,
    ): MartHttpResponse {
        val connection = openConnection(url).apply {
            requestMethod = "GET"
            connectTimeout = MART_CONNECT_TIMEOUT_MILLIS
            readTimeout = MART_READ_TIMEOUT_MILLIS
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        return connection.useMartConnection {
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedMartResponse).orEmpty()
            MartHttpResponse(status, body)
        }
    }

    fun postJson(
        url: URL,
        accessToken: String,
        payload: JSONObject,
        openConnection: (URL) -> HttpURLConnection,
    ): Int = postJsonResponse(url, accessToken, payload, openConnection).status

    fun postJsonResponse(
        url: URL,
        accessToken: String?,
        payload: JSONObject,
        openConnection: (URL) -> HttpURLConnection,
    ): MartHttpResponse {
        val connection = openConnection(url).apply {
            requestMethod = "POST"
            connectTimeout = MART_CONNECT_TIMEOUT_MILLIS
            readTimeout = MART_READ_TIMEOUT_MILLIS
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        return connection.useMartConnection {
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedMartResponse).orEmpty()
            MartHttpResponse(status, body)
        }
    }
}

private fun readBoundedMartResponse(input: InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        require(output.size() + read <= MAX_MART_RESPONSE_BYTES) { "Mart response exceeded the size limit." }
        output.write(buffer, 0, read)
    }
    return output.toString(Charsets.UTF_8.name())
}

private const val MART_CONNECT_TIMEOUT_MILLIS = 10_000
private const val MART_READ_TIMEOUT_MILLIS = 15_000
private const val MAX_MART_RESPONSE_BYTES = 1_000_000

private inline fun <T> HttpURLConnection.useMartConnection(block: () -> T): T = try {
    block()
} finally {
    disconnect()
}
