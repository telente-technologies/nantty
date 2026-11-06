package com.nantty.android.notifications

import android.content.Intent
import com.nantty.android.data.ActivityNotification
import com.nantty.android.data.NotificationActor
import com.nantty.android.data.NotificationDestination
import com.nantty.android.data.resolveNotificationDestination
import org.json.JSONObject

enum class PushTapRoute(val key: String) {
    POST("post"), PROFILE("profile"), CONVERSATION("conversation"), MESSAGES("messages"),
    ORDERS("orders"), FOLLOW_REQUESTS("follow_requests"), GROUP_INVITATIONS("group_invitations"), SPACES("spaces"), LIVE("live"),
    CHANNEL_INVITATIONS("channel_invitations"), SUPPORT_TICKET("support_ticket"), DISPUTE("dispute"), CLIP("clip"),
}

data class PushTapTarget(
    val route: PushTapRoute,
    val id: String? = null,
    val secondaryId: String? = null,
)

internal fun resolvePushTapTarget(data: Map<String, String>): PushTapTarget? {
    val url = data["url"]
    if (data["screen"] == "SpaceInvitations") return PushTapTarget(PushTapRoute.SPACES)
    if (data["screen"] == "Live") return PushTapTarget(PushTapRoute.LIVE, data["liveId"]).takeIf(::isValidPushTapTarget)
    resolvePushPath(url)?.let { return it.takeIf(::isValidPushTapTarget) }
    if (data["screen"] == "ChannelInvitations" || url?.substringBefore('?') == "/channels/invitations") {
        return PushTapTarget(PushTapRoute.CHANNEL_INVITATIONS)
    }
    val actor = data["actor"]?.let { raw ->
        runCatching { JSONObject(raw) }.getOrNull()?.let { value ->
            value.optString("id").takeIf(String::isNotBlank)?.let { id ->
                NotificationActor(
                    id = id,
                    name = value.optString("name").takeIf(String::isNotBlank).orEmpty(),
                    avatarUrl = value.optString("avatarUrl").takeIf(String::isNotBlank),
                )
            }
        }
    } ?: data["actorId"]?.takeIf(String::isNotBlank)?.let { id ->
        NotificationActor(id, data["actorName"].orEmpty(), data["actorAvatarUrl"])
    }
    val notification = ActivityNotification(
        id = data["notificationId"].orEmpty(),
        category = data["category"].orEmpty(),
        kind = data["kind"],
        title = data["title"].orEmpty(),
        body = data["body"].orEmpty(),
        createdAt = data["createdAt"].orEmpty(),
        read = false,
        actor = actor,
        postId = data["postId"],
        conversationId = data["conversationId"],
        messageId = data["messageId"],
        screen = data["screen"],
        ticketId = data["ticketId"],
        disputeId = data["disputeId"],
        clipId = data["clipId"],
        commentId = data["commentId"],
        url = url,
    )
    return when (val destination = resolveNotificationDestination(notification)) {
        is NotificationDestination.Post -> PushTapTarget(PushTapRoute.POST, destination.postId, destination.commentId)
        is NotificationDestination.Profile -> PushTapTarget(PushTapRoute.PROFILE, destination.userId)
        is NotificationDestination.Conversation -> PushTapTarget(PushTapRoute.CONVERSATION, destination.conversationId, destination.messageId)
        NotificationDestination.Messages -> PushTapTarget(PushTapRoute.MESSAGES)
        NotificationDestination.Orders -> PushTapTarget(PushTapRoute.ORDERS, data["orderId"])
        NotificationDestination.FollowRequests -> PushTapTarget(PushTapRoute.FOLLOW_REQUESTS)
        NotificationDestination.GroupInvitations -> PushTapTarget(PushTapRoute.GROUP_INVITATIONS)
        NotificationDestination.Spaces -> PushTapTarget(PushTapRoute.SPACES)
        is NotificationDestination.SupportTicket -> PushTapTarget(PushTapRoute.SUPPORT_TICKET, destination.ticketId)
        is NotificationDestination.Dispute -> PushTapTarget(PushTapRoute.DISPUTE, destination.disputeId)
        is NotificationDestination.Clip -> PushTapTarget(PushTapRoute.CLIP, destination.clipId)
        null -> data["orderId"]?.let { PushTapTarget(PushTapRoute.ORDERS, it) }
    }?.takeIf(::isValidPushTapTarget)
}

private fun resolvePushPath(rawUrl: String?): PushTapTarget? {
    if (rawUrl.isNullOrBlank() || rawUrl.length > 2_048 || rawUrl.contains('\\') || rawUrl.contains(Regex("(?i)%2f|%5c"))) return null
    val uri = runCatching { java.net.URI(rawUrl) }.getOrNull() ?: return null
    val path = if (uri.isAbsolute) {
        if (!uri.scheme.equals("https", ignoreCase = true) || uri.rawUserInfo != null || uri.port != -1 ||
            uri.host?.lowercase() !in TRUSTED_PUSH_HOSTS
        ) return null
        uri.path
    } else {
        if (uri.rawAuthority != null || !rawUrl.startsWith('/') || rawUrl.startsWith("//")) return null
        uri.path
    }.orEmpty()
    if (path.isBlank() || path.any { it.code < 0x20 || it.code == 0x7f }) return null
    val segments = path.split('/').filter(String::isNotEmpty)
    return when {
        path == "/me/follow-requests" -> PushTapTarget(PushTapRoute.FOLLOW_REQUESTS)
        path == "/chats/invitations" -> PushTapTarget(PushTapRoute.GROUP_INVITATIONS)
        path == "/channels/invitations" -> PushTapTarget(PushTapRoute.CHANNEL_INVITATIONS)
        path == "/spaces" -> PushTapTarget(PushTapRoute.SPACES)
        segments.size == 2 && segments[0] == "live" -> PushTapTarget(PushTapRoute.LIVE, segments[1])
        segments.size == 2 && segments[0] == "lives" -> PushTapTarget(PushTapRoute.LIVE, segments[1])
        segments.size == 2 && segments[0] == "user" -> PushTapTarget(PushTapRoute.PROFILE, segments[1])
        segments.size == 2 && segments[0] == "chats" -> PushTapTarget(PushTapRoute.CONVERSATION, segments[1])
        segments.size == 2 && segments[0] in setOf("post", "posts") -> PushTapTarget(PushTapRoute.POST, segments[1])
        segments.size == 4 && segments[0] == "post" && segments[2] == "comments" ->
            PushTapTarget(PushTapRoute.POST, segments[1], segments[3])
        segments.size == 2 && segments[0] == "clips" -> PushTapTarget(PushTapRoute.CLIP, segments[1])
        segments.size == 3 && segments[0] == "help" && segments[1] == "tickets" -> PushTapTarget(PushTapRoute.SUPPORT_TICKET, segments[2])
        segments.size == 2 && segments[0] == "disputes" -> PushTapTarget(PushTapRoute.DISPUTE, segments[1])
        segments.size == 3 && segments[0] == "chats" && segments[1] == "invitations" ->
            PushTapTarget(PushTapRoute.GROUP_INVITATIONS, segments[2])
        segments.size == 3 && segments[0] == "channels" && segments[1] == "invitations" ->
            PushTapTarget(PushTapRoute.CHANNEL_INVITATIONS, segments[2])
        segments.size == 1 && segments[0] == "orders" -> PushTapTarget(PushTapRoute.ORDERS)
        segments.size == 2 && segments[0] == "orders" -> PushTapTarget(PushTapRoute.ORDERS, segments[1])
        else -> null
    }
}

internal fun PushTapTarget.putOn(intent: Intent): Intent = intent
    .putExtra(PUSH_TAP_ROUTE_EXTRA, route.key)
    .putExtra(PUSH_TAP_ID_EXTRA, id)
    .putExtra(PUSH_TAP_SECONDARY_ID_EXTRA, secondaryId)

internal fun pushTapTargetFromIntent(intent: Intent?): PushTapTarget? {
    return parsePushTapTarget(
        intent?.getStringExtra(PUSH_TAP_ROUTE_EXTRA),
        intent?.getStringExtra(PUSH_TAP_ID_EXTRA),
        intent?.getStringExtra(PUSH_TAP_SECONDARY_ID_EXTRA),
    )
}

internal fun parsePushTapTarget(routeKey: String?, id: String?, secondaryId: String?): PushTapTarget? {
    val route = routeKey?.let { key -> PushTapRoute.entries.firstOrNull { it.key == key } } ?: return null
    return PushTapTarget(route, id, secondaryId).takeIf(::isValidPushTapTarget)
}

private fun isValidPushTapTarget(target: PushTapTarget): Boolean {
    val id = target.id
    val secondaryId = target.secondaryId
    return when (target.route) {
        PushTapRoute.POST -> id.isSafePushId() && (secondaryId == null || secondaryId.isSafePushId())
        PushTapRoute.PROFILE, PushTapRoute.CLIP -> id.isSafePushId()
        PushTapRoute.CONVERSATION -> id.isUuidPushId() && (secondaryId == null || secondaryId.isUuidPushId())
        PushTapRoute.SUPPORT_TICKET, PushTapRoute.DISPUTE -> id.isUuidPushId()
        PushTapRoute.ORDERS -> (id == null && secondaryId == null) || (id.isSafePushId() && secondaryId == null)
        PushTapRoute.GROUP_INVITATIONS, PushTapRoute.CHANNEL_INVITATIONS ->
            (id == null || id.matches(INVITATION_TOKEN_PATTERN)) && secondaryId == null
        PushTapRoute.LIVE -> id.isSafePushId() && secondaryId == null
        PushTapRoute.MESSAGES, PushTapRoute.FOLLOW_REQUESTS, PushTapRoute.SPACES -> id == null && secondaryId == null
    }
}

private fun String?.isSafePushId(): Boolean = this != null && length in 1..200 && all {
    it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '_' || it == '-'
}

private fun String?.isUuidPushId(): Boolean = this != null &&
    matches(Regex("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"))

internal const val PUSH_TAP_ROUTE_EXTRA = "com.nantty.android.notifications.tap_route"
internal const val PUSH_TAP_ID_EXTRA = "com.nantty.android.notifications.tap_id"
internal const val PUSH_TAP_SECONDARY_ID_EXTRA = "com.nantty.android.notifications.tap_secondary_id"

private val TRUSTED_PUSH_HOSTS = setOf("nantty.com", "www.nantty.com", "nantty.app", "www.nantty.app", "web.nantty.com")
private val INVITATION_TOKEN_PATTERN = Regex("^[A-Za-z0-9_-]{43}$")
