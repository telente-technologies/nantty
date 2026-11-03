package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

enum class NotificationFilter(val apiValue: String, val label: String) {
    ALL("all", "All"), MENTIONS("mentions", "Mentions"),
}

data class NotificationActor(val id: String, val name: String, val avatarUrl: String?)
data class ActivityNotification(
    val id: String,
    val category: String,
    val kind: String?,
    val title: String,
    val body: String,
    val createdAt: String,
    val read: Boolean,
    val actor: NotificationActor?,
    val postId: String?,
    val conversationId: String? = null,
)

sealed interface NotificationDestination {
    data class Post(val postId: String) : NotificationDestination
    data class Profile(val userId: String) : NotificationDestination
    data object Messages : NotificationDestination
    data object Orders : NotificationDestination
}

fun resolveNotificationDestination(notification: ActivityNotification): NotificationDestination? {
    notification.postId?.takeIf(::isSafeNotificationId)?.let { return NotificationDestination.Post(it) }
    if (notification.category.equals("orders", ignoreCase = true)) return NotificationDestination.Orders
    if (notification.category.equals("messages", ignoreCase = true) ||
        notification.conversationId != null ||
        notification.kind in setOf("message", "newMessage", "chatMessage")
    ) return NotificationDestination.Messages
    notification.actor?.id?.takeIf(::isSafeNotificationId)?.let { return NotificationDestination.Profile(it) }
    return null
}

private fun isSafeNotificationId(value: String): Boolean =
    value.length in 1..200 && value.all { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '_' || it == '-' }
data class NotificationPage(val items: List<ActivityNotification>, val nextCursor: String?)

sealed interface NotificationsResult {
    data class Success(val page: NotificationPage) : NotificationsResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : NotificationsResult
}

fun interface NotificationsTransport {
    fun request(method: String, path: String, accessToken: String?): JSONObject
}

class NotificationsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: NotificationsTransport = JdkNotificationsTransport(baseUrl),
) {
    fun load(filter: NotificationFilter, cursor: String? = null): NotificationsResult = try {
        val session = sessionProvider() ?: error("Sign in to view notifications.")
        val path = buildString {
            append("/api/v1/notifications?filter=${filter.apiValue}")
            cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${encode(it)}") }
        }
        NotificationsResult.Success(parsePage(transport.request("GET", path, session.accessToken)))
    } catch (error: Exception) {
        NotificationsResult.Failure(error.message ?: "Could not load notifications. Check your connection and try again.", error is NotificationsHttpException && error.statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN))
    }

    fun markRead(id: String): Result<Unit> = write("/api/v1/notifications/${encode(id)}/read")
    fun markAllRead(): Result<Unit> = write("/api/v1/notifications/read-all")

    private fun write(path: String) = runCatching {
        val session = sessionProvider() ?: error("Sign in to update notifications.")
        transport.request("POST", path, session.accessToken)
        Unit
    }

    internal fun parsePage(payload: JSONObject): NotificationPage {
        val rows = payload.optJSONArray("data") ?: error("Nantty returned an incomplete notifications response.")
        val items = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(String::isNotBlank) ?: continue
                val actor = row.optJSONObject("actor")?.let {
                    val actorId = it.optString("id").takeIf(String::isNotBlank)
                    val name = it.optString("name").takeIf(String::isNotBlank)
                    if (actorId != null && name != null) NotificationActor(actorId, name, safeMediaUrl(it.optString("avatarUrl").takeIf { url -> url.isNotBlank() && url != "null" })) else null
                }
                val postId = row.optJSONObject("data")?.optString("postId")?.takeIf { it.isNotBlank() && it != "null" }
                val conversationId = row.optJSONObject("data")?.optString("conversationId")?.takeIf { it.isNotBlank() && it != "null" }
                add(ActivityNotification(id, row.optString("category"), row.optString("kind").takeIf { it.isNotBlank() && it != "null" }, row.optString("title"), row.optString("body"), row.optString("createdAt"), row.optBoolean("read"), actor, postId, conversationId))
            }
        }
        return NotificationPage(items, payload.optString("nextCursor").takeIf { it.isNotBlank() && it != "null" })
    }

    private fun encode(value: String) = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
}

private class JdkNotificationsTransport(private val baseUrl: String) : NotificationsTransport {
    override fun request(method: String, path: String, accessToken: String?): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use notifications.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        try {
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw NotificationsHttpException(status)
            if (status == HttpURLConnection.HTTP_NO_CONTENT || body.isBlank()) return JSONObject()
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= 1_048_576) { "Nantty returned an unexpectedly large notifications response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

internal class NotificationsHttpException(val statusCode: Int) : Exception("Notifications request failed (HTTP $statusCode). Please try again.")
