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
    val messageId: String? = null,
    val screen: String? = null,
    val ticketId: String? = null,
    val disputeId: String? = null,
    val clipId: String? = null,
    val commentId: String? = null,
    val url: String? = null,
    val orderId: String? = null,
)

sealed interface NotificationDestination {
    data class Post(val postId: String, val commentId: String? = null) : NotificationDestination
    data class Profile(val userId: String) : NotificationDestination
    data class Conversation(val conversationId: String, val messageId: String? = null) : NotificationDestination
    data object Messages : NotificationDestination
    data object Orders : NotificationDestination
    data class OrderDetail(val orderId: String) : NotificationDestination
    data object FollowRequests : NotificationDestination
    data object GroupInvitations : NotificationDestination
    data object Spaces : NotificationDestination
    data class SupportTicket(val ticketId: String) : NotificationDestination
    data class Dispute(val disputeId: String) : NotificationDestination
    data class Clip(val clipId: String) : NotificationDestination
}

fun resolveNotificationDestination(notification: ActivityNotification): NotificationDestination? {
    // Match the React Native route precedence: a request notification opens its inbox.
    if (notification.kind == "followRequest") return NotificationDestination.FollowRequests
    if (notification.screen == "GroupInvitations" || isGroupInvitationsPath(notification.url)) {
        return NotificationDestination.GroupInvitations
    }
    if (notification.screen == "SpaceInvitations" || isSpaceInvitationsPath(notification.url)) {
        return NotificationDestination.Spaces
    }
    resolveDisputeNotificationUrl(notification.url)?.let { return NotificationDestination.Dispute(it) }
    if (notification.kind == "followRequestAccepted") {
        notification.actor?.id?.takeIf(::isSafeNotificationId)?.let { return NotificationDestination.Profile(it) }
    }
    val commentId = notification.commentId?.takeIf(::isSafeNotificationId)
    val postId = notification.postId?.takeIf(::isSafeNotificationId)
    val clipId = notification.clipId?.takeIf(::isSafeNotificationId)
    val commentPostId = postId ?: clipId
    if (commentId != null && commentPostId != null) {
        return NotificationDestination.Post(commentPostId, commentId)
    }
    clipId?.let { return NotificationDestination.Clip(it) }
    notification.conversationId?.takeIf(MessagesRepository::isUuid)?.let {
        return NotificationDestination.Conversation(it, notification.messageId?.takeIf(MessagesRepository::isUuid))
    }
    postId?.let { return NotificationDestination.Post(it) }
    notification.disputeId?.takeIf(MessagesRepository::isUuid)?.let { return NotificationDestination.Dispute(it) }
    if (notification.category.equals("messages", ignoreCase = true) ||
        notification.conversationId != null ||
        notification.kind in setOf("message", "newMessage", "chatMessage")
    ) return NotificationDestination.Messages
    notification.ticketId?.takeIf(MessagesRepository::isUuid)?.let { return NotificationDestination.SupportTicket(it) }
    (notification.orderId?.takeIf(::isSafeNotificationId) ?: resolveOrderNotificationUrl(notification.url))
        ?.let { return NotificationDestination.OrderDetail(it) }
    if (notification.category.equals("orders", ignoreCase = true)) return NotificationDestination.Orders
    notification.actor?.id?.takeIf(::isSafeNotificationId)?.let { return NotificationDestination.Profile(it) }
    return null
}

private fun isGroupInvitationsPath(rawUrl: String?): Boolean {
    if (rawUrl.isNullOrBlank()) return false
    val path = runCatching {
        val uri = java.net.URI(if (rawUrl.startsWith("/")) "https://nantty.com$rawUrl" else rawUrl)
        val allowedHost = uri.host?.lowercase() in setOf("nantty.com", "www.nantty.com", "nantty.app", "www.nantty.app", "web.nantty.com")
        if (allowedHost && uri.scheme.equals("https", ignoreCase = true)) uri.path else null
    }.getOrNull()
    return path == "/chats/invitations"
}

private fun isSpaceInvitationsPath(rawUrl: String?): Boolean {
    if (rawUrl.isNullOrBlank()) return false
    val path = runCatching {
        val uri = java.net.URI(if (rawUrl.startsWith("/")) "https://nantty.com$rawUrl" else rawUrl)
        val allowedHost = uri.host?.lowercase() in setOf("nantty.com", "www.nantty.com", "nantty.app", "www.nantty.app", "web.nantty.com")
        if (allowedHost && uri.scheme.equals("https", ignoreCase = true)) uri.path else null
    }.getOrNull()
    return path == "/spaces"
}

private fun resolveDisputeNotificationUrl(rawUrl: String?): String? {
    if (rawUrl.isNullOrBlank() || rawUrl.length > 2_048 || rawUrl.contains('\\')) return null
    val uri = runCatching {
        java.net.URI(if (rawUrl.startsWith("/")) "https://nantty.com$rawUrl" else rawUrl)
    }.getOrNull() ?: return null
    val trustedHost = uri.host?.lowercase() in setOf("nantty.com", "www.nantty.com", "nantty.app", "www.nantty.app", "web.nantty.com")
    if (!trustedHost || !uri.scheme.equals("https", ignoreCase = true) || uri.rawUserInfo != null || uri.port != -1) return null
    val segments = uri.path.split('/').filter(String::isNotEmpty)
    if (segments.size != 2 || segments[0] != "disputes") return null
    return segments[1].takeIf(MessagesRepository::isUuid)
}

private fun resolveOrderNotificationUrl(rawUrl: String?): String? {
    if (rawUrl.isNullOrBlank() || rawUrl.length > 2_048 || rawUrl.contains('\\')) return null
    val uri = runCatching {
        java.net.URI(if (rawUrl.startsWith("/")) "https://nantty.com$rawUrl" else rawUrl)
    }.getOrNull() ?: return null
    val trustedHost = uri.host?.lowercase() in setOf("nantty.com", "www.nantty.com", "nantty.app", "www.nantty.app", "web.nantty.com")
    if (!trustedHost || !uri.scheme.equals("https", ignoreCase = true) || uri.rawUserInfo != null || uri.port != -1) return null
    val segments = uri.path.split('/').filter(String::isNotEmpty)
    if (segments.size != 2 || segments[0] !in setOf("order", "orders")) return null
    return segments[1].takeIf(::isSafeNotificationId)
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
                val data = row.optJSONObject("data")
                fun dataText(key: String) = data?.optString(key)?.takeIf { it.isNotBlank() && it != "null" }
                val postId = dataText("postId")
                val conversationId = dataText("conversationId")
                val messageId = dataText("messageId")
                val disputeId = dataText("disputeId")
                val orderId = dataText("orderId")
                add(ActivityNotification(
                    id = id,
                    category = row.optString("category"),
                    kind = row.optString("kind").takeIf { it.isNotBlank() && it != "null" },
                    title = row.optString("title"),
                    body = row.optString("body"),
                    createdAt = row.optString("createdAt"),
                    read = row.optBoolean("read"),
                    actor = actor,
                    postId = postId,
                    conversationId = conversationId,
                    messageId = messageId,
                    screen = dataText("screen"),
                    ticketId = dataText("ticketId"),
                    disputeId = disputeId,
                    clipId = dataText("clipId"),
                    commentId = dataText("commentId"),
                    url = dataText("url") ?: row.optString("url").takeIf { it.isNotBlank() && it != "null" },
                    orderId = orderId,
                ))
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
