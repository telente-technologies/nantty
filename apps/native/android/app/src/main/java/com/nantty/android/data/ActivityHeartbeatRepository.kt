package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.TimeZone

fun interface ActivityHeartbeatTransport {
    fun post(path: String, accessToken: String, body: JSONObject): Int
}

/** Sends an authenticated foreground activity heartbeat without placing identity in the request body. */
class ActivityHeartbeatRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: ActivityHeartbeatTransport = JdkActivityHeartbeatTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun recordCurrentActivity(timeZone: String = TimeZone.getDefault().id): Result<Unit> = runCatching {
        require(timeZone.isNotBlank()) { "A device time zone is required." }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to record activity.")
        val body = JSONObject().put(TIME_ZONE_FIELD, timeZone)
        var status = transport.post(ACTIVITY_PATH, session.accessToken, body)
        if (status == HttpURLConnection.HTTP_UNAUTHORIZED || status == HttpURLConnection.HTTP_FORBIDDEN) {
            val refreshed = refreshSessionProvider()?.takeIf { it.accessToken.isNotBlank() }
                ?: error("Your session has expired. Sign in again.")
            status = transport.post(ACTIVITY_PATH, refreshed.accessToken, body)
        }
        require(status in 200..299) { "Could not record activity (HTTP $status)." }
    }

    companion object {
        /** Kept in one place so the path can follow the backend contract without lifecycle/UI changes. */
        const val ACTIVITY_PATH = "/api/v1/notifications/activity"
        const val TIME_ZONE_FIELD = "timeZone"
    }
}

private class JdkActivityHeartbeatTransport(private val baseUrl: String) : ActivityHeartbeatTransport {
    override fun post(path: String, accessToken: String, body: JSONObject): Int {
        require(accessToken.isNotBlank()) { "Sign in to record activity." }
        val origin = trustedApiOrigin(baseUrl)
            ?: error("Configure an HTTPS Nantty API URL to record activity.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            stream?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(2_048)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= MAX_RESPONSE_BYTES) {
                        "Nantty returned an unexpectedly large response."
                    }
                    output.write(buffer, 0, count)
                }
            }
            return status
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 128 * 1024
    }
}
