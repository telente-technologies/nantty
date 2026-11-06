package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

private const val CHAT_SETTINGS_PATH = "/api/v1/chat/settings"

data class ChatNotificationSettings(
    val messages: Boolean,
    val requests: Boolean,
    val groups: Boolean,
    val streakReminders: Boolean,
    val showMessagePreview: Boolean,
)

data class ChatSettings(
    val messageRequestsFrom: MessageRequestAudience,
    val preventDirectGroupAdds: Boolean,
    val notifications: ChatNotificationSettings,
)

enum class MessageRequestAudience(val wireValue: String, val label: String) {
    EVERYONE("everyone", "Everyone"),
    FOLLOWING("following", "People I follow"),
    FOLLOWERS("followers", "Followers"),
    NOBODY("nobody", "Nobody");

    companion object {
        fun fromWireValue(value: String): MessageRequestAudience? = entries.firstOrNull { it.wireValue == value }
    }
}

sealed interface ChatSettingsResult {
    data class Success(val settings: ChatSettings) : ChatSettingsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ChatSettingsResult
}

interface ChatSettingsTransport {
    fun getSettings(accessToken: String): JSONObject
    fun updateSettings(accessToken: String, fields: JSONObject): JSONObject
}

class ChatNotificationSettingsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: ChatSettingsTransport = JdkChatSettingsTransport(baseUrl),
) {
    fun load(): ChatSettingsResult = execute { token -> parse(transport.getSettings(token)) }

    /** Matches React Native: each toggle submits the complete notifications object. */
    fun updateNotifications(notifications: ChatNotificationSettings): ChatSettingsResult = execute { token ->
        val body = JSONObject().put("notifications", JSONObject()
            .put("messages", notifications.messages)
            .put("requests", notifications.requests)
            .put("groups", notifications.groups)
            .put("streakReminders", notifications.streakReminders)
            .put("showMessagePreview", notifications.showMessagePreview))
        parse(transport.updateSettings(token, body))
    }

    fun updateMessageRequestsFrom(audience: MessageRequestAudience): ChatSettingsResult = execute { token ->
        val body = JSONObject().put("messageRequestsFrom", audience.wireValue)
        parse(transport.updateSettings(token, body))
    }

    fun updatePreventDirectGroupAdds(enabled: Boolean): ChatSettingsResult = execute { token ->
        parse(transport.updateSettings(token, JSONObject().put("preventDirectGroupAdds", enabled)))
    }

    private inline fun execute(request: (String) -> ChatSettings): ChatSettingsResult = try {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw ChatSettingsHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to manage chat notification settings.")
        val settings = try {
            request(token)
        } catch (error: ChatSettingsHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshedToken = runCatching { refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank) }.getOrNull()
                ?: throw ChatSettingsHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Your session has expired. Sign in again.")
            request(refreshedToken)
        }
        ChatSettingsResult.Success(settings)
    } catch (error: Exception) {
        val status = (error as? ChatSettingsHttpException)?.statusCode
        ChatSettingsResult.Failure(
            error.message ?: "Could not load chat notification settings. Try again.",
            authenticationRequired = status == HttpURLConnection.HTTP_UNAUTHORIZED || status == HttpURLConnection.HTTP_FORBIDDEN,
        )
    }

    private fun parse(payload: JSONObject): ChatSettings {
        val settings = payload.optJSONObject("data") ?: payload
        val notifications = settings.optJSONObject("notifications")
            ?: error("Nantty returned incomplete chat notification settings.")
        require(settings.has("messageRequestsFrom")) { "Nantty returned incomplete chat settings." }
        require(settings.has("preventDirectGroupAdds") && !settings.isNull("preventDirectGroupAdds")) {
            "Nantty returned incomplete chat privacy settings."
        }
        val audience = MessageRequestAudience.fromWireValue(settings.getString("messageRequestsFrom"))
            ?: error("Nantty returned an invalid message-request audience.")
        return ChatSettings(
            messageRequestsFrom = audience,
            preventDirectGroupAdds = settings.getBoolean("preventDirectGroupAdds"),
            notifications = ChatNotificationSettings(
                messages = notifications.requiredBoolean("messages"),
                requests = notifications.requiredBoolean("requests"),
                groups = notifications.requiredBoolean("groups"),
                streakReminders = notifications.requiredBoolean("streakReminders"),
                showMessagePreview = notifications.requiredBoolean("showMessagePreview"),
            ),
        )
    }

    private fun JSONObject.requiredBoolean(key: String): Boolean {
        require(has(key) && !isNull(key)) { "Nantty returned incomplete chat notification settings." }
        return getBoolean(key)
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

private class JdkChatSettingsTransport(private val baseUrl: String) : ChatSettingsTransport {
    override fun getSettings(accessToken: String): JSONObject = request("GET", accessToken)

    override fun updateSettings(accessToken: String, fields: JSONObject): JSONObject = request("PATCH", accessToken, fields)

    private fun request(method: String, accessToken: String, fields: JSONObject? = null): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to manage chat notification settings." }
        val origin = trustedApiOrigin(baseUrl)
            ?: error("Configure an HTTPS Nantty API URL to manage chat notification settings.")
        val connection = (URL("$origin$CHAT_SETTINGS_PATH").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            fields?.let {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            fields?.let { body -> connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw ChatSettingsHttpException(status, "Chat settings request failed (HTTP $status). Try again.")
            require(body.isNotBlank()) { "Nantty returned an empty chat settings response." }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large chat settings response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

class ChatSettingsHttpException(val statusCode: Int, message: String) : IllegalStateException(message)
