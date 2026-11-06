package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

fun interface PushDeviceTokenTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject?): Int
}

/** Authenticated FCM-token registration for the Android native client. */
class PushDeviceTokenRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val transport: PushDeviceTokenTransport = JdkPushDeviceTokenTransport(baseUrl),
) {
    fun register(token: String): Result<Unit> = mutate(token) { accessToken ->
        val body = JSONObject()
            .put("token", token)
            .put("platform", ANDROID_PLATFORM)
            .put("provider", FCM_PROVIDER)
        transport.request("POST", DEVICE_TOKENS_PATH, accessToken, body)
    }

    fun unregister(token: String): Result<Unit> = mutate(token) { accessToken ->
        transport.request("DELETE", DEVICE_TOKENS_PATH, accessToken, JSONObject().put("token", token))
    }

    private inline fun mutate(token: String, request: (String) -> Int): Result<Unit> = runCatching {
        require(token.isNotBlank() && token.length <= MAX_TOKEN_LENGTH) { "The push token is invalid." }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to manage push notifications.")
        var status = request(session.accessToken)
        if (status == HttpURLConnection.HTTP_UNAUTHORIZED || status == HttpURLConnection.HTTP_FORBIDDEN) {
            val refreshed = refreshSessionProvider()?.takeIf { it.accessToken.isNotBlank() }
                ?: error("Your session has expired. Sign in again.")
            status = request(refreshed.accessToken)
        }
        require(status in 200..299) { "Could not update push notification registration (HTTP $status)." }
    }

    companion object {
        const val DEVICE_TOKENS_PATH = "/api/v1/notifications/device-tokens"
        const val ANDROID_PLATFORM = "android"
        const val FCM_PROVIDER = "fcm"
        const val MAX_TOKEN_LENGTH = 300
    }
}

private class JdkPushDeviceTokenTransport(private val baseUrl: String) : PushDeviceTokenTransport {
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): Int {
        require(accessToken.isNotBlank()) { "Sign in to manage push notifications." }
        val origin = trustedApiOrigin(baseUrl)
            ?: error("Configure an HTTPS Nantty API URL to manage push notifications.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            body?.let {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            body?.let { connection.outputStream.use { stream -> stream.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            stream?.use(::drainBounded)
            return status
        } finally {
            connection.disconnect()
        }
    }

    private fun drainBounded(input: java.io.InputStream) {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(4_096)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large response." }
            output.write(buffer, 0, read)
        }
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 256 * 1024
    }
}
