package com.nantty.android.data

import org.json.JSONObject
import java.net.URLEncoder

enum class GroupInvitationDirection(val apiValue: String, val label: String) {
    RECEIVED("received", "Received"), SENT("sent", "Sent"),
}

enum class GroupInvitationStatus(val apiValue: String) {
    PENDING("pending"), ACCEPTED("accepted"), DECLINED("declined"), REVOKED("revoked"), EXPIRED("expired");

    companion object {
        fun from(value: String): GroupInvitationStatus? = entries.firstOrNull { it.apiValue == value }
    }
}

data class GroupInvitationCounterpart(
    val id: String,
    val name: String,
    val username: String,
    val avatarUrl: String?,
    val verified: Boolean,
)

/** A consent record is not a group membership; secure key handoff is a separate, unsupported step. */
data class GroupInvitation(
    val id: String,
    val conversationId: String,
    val status: GroupInvitationStatus,
    val createdAt: String,
    val expiresAt: String,
    val counterpart: GroupInvitationCounterpart?,
    val membershipStatus: GroupInvitationMembershipStatus,
)

enum class GroupInvitationMembershipStatus { NOT_JOINED, AWAITING_SECURE_KEY_HANDOFF }

data class GroupInvitationPage(val invitations: List<GroupInvitation>, val nextCursor: String?)

data class GroupInvitationLink(
    val id: String,
    val conversationId: String,
    val token: String,
    val expiresAt: String,
)

data class GroupInvitationLinkPreview(
    val title: String?,
    val memberCount: Int,
    val expiresAt: String,
)

data class RevokedGroupInvitationLink(val id: String, val conversationId: String, val revokedAt: String)

data class GroupInvitationLinkRecord(
    val id: String,
    val conversationId: String,
    val createdAt: String,
    val expiresAt: String,
    val revokedAt: String?,
)

data class GroupInvitationLinkPage(val links: List<GroupInvitationLinkRecord>, val nextCursor: String?)

sealed interface GroupInvitationResult<out T> {
    data class Success<T>(val value: T) : GroupInvitationResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : GroupInvitationResult<Nothing>
}

/** Authenticated client for the Social API group-invitation routes. */
class GroupInvitationsRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: ChatThreadTransport,
    private val refreshSessionProvider: () -> AccountSession? = { null },
) {
    fun list(direction: GroupInvitationDirection, cursor: String? = null, limit: Int = DEFAULT_PAGE_SIZE): GroupInvitationResult<GroupInvitationPage> = try {
        require(limit in 1..MAX_PAGE_SIZE) { "Choose a valid invitation page size." }
        require(cursor == null || MessagesRepository.isUuid(cursor)) { "This invitation page cursor is invalid. Refresh and try again." }
        val path = buildGroupInvitationsPath(direction, cursor, limit)
        val payload = authenticatedRequest("GET", path, null)
        GroupInvitationResult.Success(parsePage(payload))
    } catch (error: Exception) {
        failure(error, "Could not load group invitations. Check your connection and try again.")
    }

    fun create(conversationId: String, inviteeId: String): GroupInvitationResult<GroupInvitation> = try {
        require(MessagesRepository.isUuid(conversationId)) { "This group link is invalid." }
        require(MessagesRepository.isUuid(inviteeId)) { "Choose a valid Nantty member." }
        val payload = authenticatedRequest(
            "POST",
            "/api/v1/conversations/$conversationId/invitations",
            JSONObject().put("inviteeId", inviteeId),
        )
        GroupInvitationResult.Success(parseInvitation(payload))
    } catch (error: Exception) {
        failure(error, "Could not send the group invitation. Check your connection and try again.")
    }

    fun accept(invitationId: String): GroupInvitationResult<GroupInvitation> = respond(invitationId, "accept")
    fun decline(invitationId: String): GroupInvitationResult<GroupInvitation> = respond(invitationId, "decline")

    fun revoke(conversationId: String, invitationId: String): GroupInvitationResult<GroupInvitation> = try {
        require(MessagesRepository.isUuid(conversationId) && MessagesRepository.isUuid(invitationId)) { "This group invitation is invalid." }
        val payload = authenticatedRequest("DELETE", "/api/v1/conversations/$conversationId/invitations/$invitationId", null)
        GroupInvitationResult.Success(parseInvitation(payload))
    } catch (error: Exception) {
        failure(error, "Could not revoke the group invitation. Check your connection and try again.")
    }

    fun createLink(conversationId: String, expiresInHours: Int = DEFAULT_LINK_EXPIRY_HOURS): GroupInvitationResult<GroupInvitationLink> = try {
        require(MessagesRepository.isUuid(conversationId)) { "This group link is invalid." }
        require(expiresInHours in ALLOWED_LINK_EXPIRY_HOURS) { "Choose a valid group link expiry." }
        val payload = authenticatedRequest(
            "POST",
            "/api/v1/conversations/$conversationId/invitation-links",
            JSONObject().put("expiresInHours", expiresInHours),
        )
        GroupInvitationResult.Success(parseCreatedLink(payload))
    } catch (error: Exception) {
        failure(error, "Could not create a group invitation link. Check your connection and try again.")
    }

    fun listLinks(conversationId: String, cursor: String? = null, limit: Int = DEFAULT_PAGE_SIZE): GroupInvitationResult<GroupInvitationLinkPage> = try {
        require(MessagesRepository.isUuid(conversationId)) { "This group link is invalid." }
        require(limit in 1..MAX_PAGE_SIZE) { "Choose a valid invitation link page size." }
        require(cursor == null || MessagesRepository.isUuid(cursor)) { "This invitation link cursor is invalid. Refresh and try again." }
        val payload = authenticatedRequest("GET", buildGroupInvitationLinksPath(conversationId, cursor, limit), null)
        GroupInvitationResult.Success(parseLinkPage(payload, conversationId))
    } catch (error: Exception) {
        failure(error, "Could not load group invitation links. Check your connection and try again.")
    }

    fun previewLink(token: String): GroupInvitationResult<GroupInvitationLinkPreview> = try {
        require(token.matches(INVITATION_LINK_TOKEN)) { "This group invitation link is invalid." }
        val payload = authenticatedRequest("GET", "/api/v1/conversations/invitation-links/$token/preview", null)
        GroupInvitationResult.Success(parseLinkPreview(payload))
    } catch (error: Exception) {
        failure(error, "This group invitation link is unavailable. Ask the sender for a new link.")
    }

    /** Claiming creates a pending invitation only; the recipient must explicitly accept it. */
    fun claimLink(token: String): GroupInvitationResult<GroupInvitation> = try {
        require(token.matches(INVITATION_LINK_TOKEN)) { "This group invitation link is invalid." }
        val payload = authenticatedRequest("POST", "/api/v1/conversations/invitation-links/$token/claim", JSONObject())
        GroupInvitationResult.Success(parseInvitation(payload))
    } catch (error: Exception) {
        failure(error, "Could not request to join this group. Check your connection and try again.")
    }

    fun revokeLink(conversationId: String, linkId: String): GroupInvitationResult<RevokedGroupInvitationLink> = try {
        require(MessagesRepository.isUuid(conversationId) && MessagesRepository.isUuid(linkId)) { "This group invitation link is invalid." }
        val payload = authenticatedRequest("DELETE", "/api/v1/conversations/$conversationId/invitation-links/$linkId", null)
        GroupInvitationResult.Success(parseRevokedLink(payload))
    } catch (error: Exception) {
        failure(error, "Could not revoke the group invitation link. Check your connection and try again.")
    }

    private fun respond(invitationId: String, action: String): GroupInvitationResult<GroupInvitation> = try {
        require(MessagesRepository.isUuid(invitationId)) { "This group invitation is invalid." }
        val payload = authenticatedRequest("POST", "/api/v1/group-invitations/$invitationId/$action", null)
        GroupInvitationResult.Success(parseInvitation(payload))
    } catch (error: Exception) {
        failure(error, "Could not $action this group invitation. Check your connection and try again.")
    }

    private fun authenticatedRequest(method: String, path: String, body: JSONObject?): JSONObject {
        val session = sessionProvider() ?: error("Sign in to manage group invitations.")
        val token = session.accessToken.takeIf(String::isNotBlank) ?: error("Sign in to manage group invitations.")
        return try {
            transport.request(method, path, token, body)
        } catch (error: MessagesHttpException) {
            if (error.statusCode != 401) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw MessagesHttpException(401)
            transport.request(method, path, refreshed, body)
        }
    }

    internal fun parsePage(payload: JSONObject): GroupInvitationPage {
        val page = payload.optJSONObject("data") ?: payload
        val rows = page.optJSONArray("data") ?: page.optJSONArray("items")
            ?: error("Nantty returned an incomplete group invitations response.")
        val invitations = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                runCatching { parseInvitation(row) }.getOrNull()?.let(::add)
            }
        }.distinctBy(GroupInvitation::id)
        val cursor = page.optGroupNullable("nextCursor")?.also {
            require(MessagesRepository.isUuid(it)) { "Nantty returned an invalid group invitation cursor." }
        }
        return GroupInvitationPage(invitations, cursor)
    }

    internal fun parseInvitation(payload: JSONObject): GroupInvitation {
        val row = payload.optJSONObject("data") ?: payload
        val status = GroupInvitationStatus.from(row.optGroupNullable("status") ?: "")
            ?: error("Nantty returned an unknown group invitation status.")
        val acceptedAwaitingHandoff = status == GroupInvitationStatus.ACCEPTED ||
            row.optGroupNullable("membershipStatus") == "awaiting_secure_key_handoff"
        return GroupInvitation(
            id = row.optGroupNullable("id")?.takeIf(MessagesRepository::isUuid)
                ?: error("Nantty returned an invalid group invitation."),
            conversationId = row.optGroupNullable("conversationId")?.takeIf(MessagesRepository::isUuid)
                ?: error("Nantty returned an invalid group invitation."),
            status = status,
            createdAt = row.optGroupNullable("createdAt").orEmpty(),
            expiresAt = row.optGroupNullable("expiresAt").orEmpty(),
            counterpart = parseCounterpart(row.optJSONObject("counterpart")),
            membershipStatus = if (acceptedAwaitingHandoff) GroupInvitationMembershipStatus.AWAITING_SECURE_KEY_HANDOFF
                else GroupInvitationMembershipStatus.NOT_JOINED,
        )
    }

    internal fun parseCreatedLink(payload: JSONObject): GroupInvitationLink {
        val row = payload.optJSONObject("data") ?: payload
        return GroupInvitationLink(
            id = row.optGroupNullable("id")?.takeIf(MessagesRepository::isUuid)
                ?: error("Nantty returned an invalid group invitation link."),
            conversationId = row.optGroupNullable("conversationId")?.takeIf(MessagesRepository::isUuid)
                ?: error("Nantty returned an invalid group invitation link."),
            token = row.optGroupNullable("token")?.takeIf { it.matches(INVITATION_LINK_TOKEN) }
                ?: error("Nantty returned an invalid group invitation link."),
            expiresAt = row.optGroupNullable("expiresAt")?.takeIf(String::isNotBlank)
                ?: error("Nantty returned an incomplete group invitation link."),
        )
    }

    internal fun parseLinkPreview(payload: JSONObject): GroupInvitationLinkPreview {
        val row = payload.optJSONObject("data") ?: payload
        val group = row.optJSONObject("group") ?: error("Nantty returned an incomplete group invitation preview.")
        val memberCount = group.optInt("memberCount", -1)
        require(memberCount >= 0) { "Nantty returned an invalid group invitation preview." }
        return GroupInvitationLinkPreview(
            title = group.optGroupNullable("title")?.takeIf(String::isNotBlank),
            memberCount = memberCount,
            expiresAt = row.optGroupNullable("expiresAt")?.takeIf(String::isNotBlank)
                ?: error("Nantty returned an incomplete group invitation preview."),
        )
    }

    internal fun parseRevokedLink(payload: JSONObject): RevokedGroupInvitationLink {
        val row = payload.optJSONObject("data") ?: payload
        return RevokedGroupInvitationLink(
            id = row.optGroupNullable("id")?.takeIf(MessagesRepository::isUuid)
                ?: error("Nantty returned an invalid group invitation link."),
            conversationId = row.optGroupNullable("conversationId")?.takeIf(MessagesRepository::isUuid)
                ?: error("Nantty returned an invalid group invitation link."),
            revokedAt = row.optGroupNullable("revokedAt")?.takeIf(String::isNotBlank)
                ?: error("Nantty returned an incomplete group invitation link response."),
        )
    }

    internal fun parseLinkPage(payload: JSONObject, conversationId: String): GroupInvitationLinkPage {
        val page = payload.optJSONObject("data") ?: payload
        val rows = page.optJSONArray("data") ?: page.optJSONArray("items")
            ?: error("Nantty returned an incomplete group invitation links response.")
        val links = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                runCatching {
                    GroupInvitationLinkRecord(
                        id = row.optGroupNullable("id")?.takeIf(MessagesRepository::isUuid)
                            ?: error("invalid link id"),
                        conversationId = row.optGroupNullable("conversationId")?.takeIf(MessagesRepository::isUuid)
                            ?: error("invalid conversation id"),
                        createdAt = row.optGroupNullable("createdAt")?.takeIf(String::isNotBlank)
                            ?: error("invalid creation time"),
                        expiresAt = row.optGroupNullable("expiresAt")?.takeIf(String::isNotBlank)
                            ?: error("invalid expiry time"),
                        revokedAt = row.optGroupNullable("revokedAt"),
                    ).takeIf { it.conversationId == conversationId }
                }.getOrNull()?.let(::add)
            }
        }.distinctBy(GroupInvitationLinkRecord::id)
        val cursor = page.optGroupNullable("nextCursor")?.also {
            require(MessagesRepository.isUuid(it)) { "Nantty returned an invalid group invitation links cursor." }
        }
        return GroupInvitationLinkPage(links, cursor)
    }

    private fun parseCounterpart(row: JSONObject?): GroupInvitationCounterpart? {
        row ?: return null
        val id = row.optGroupNullable("id")?.takeIf(MessagesRepository::isUuid) ?: return null
        val name = row.optGroupNullable("name")?.takeIf(String::isNotBlank) ?: return null
        return GroupInvitationCounterpart(
            id = id,
            name = name,
            username = row.optGroupNullable("username")?.trim()?.trimStart('@').orEmpty(),
            avatarUrl = row.optGroupNullable("avatarUrl")?.takeIf(::isSecureImageUrl),
            verified = row.optBoolean("verified"),
        )
    }

    private fun failure(error: Exception, fallback: String) = GroupInvitationResult.Failure(
        error.message?.takeIf(String::isNotBlank) ?: fallback,
        authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
    )

    companion object {
        const val DEFAULT_PAGE_SIZE = 20
        const val MAX_PAGE_SIZE = 100
        const val DEFAULT_LINK_EXPIRY_HOURS = 168
        val ALLOWED_LINK_EXPIRY_HOURS = setOf(24, 168, 720)
        private val INVITATION_LINK_TOKEN = Regex("[A-Za-z0-9_-]{43}")
    }
}

fun MessagesRepository.createGroupInvitationLink(conversationId: String, expiresInHours: Int = GroupInvitationsRepository.DEFAULT_LINK_EXPIRY_HOURS) =
    groupInvitationsRepository.createLink(conversationId, expiresInHours)

fun MessagesRepository.listGroupInvitationLinks(conversationId: String, cursor: String? = null, limit: Int = GroupInvitationsRepository.DEFAULT_PAGE_SIZE) =
    groupInvitationsRepository.listLinks(conversationId, cursor, limit)

fun MessagesRepository.previewGroupInvitationLink(token: String) = groupInvitationsRepository.previewLink(token)

fun MessagesRepository.claimGroupInvitationLink(token: String) = groupInvitationsRepository.claimLink(token)

fun MessagesRepository.revokeGroupInvitationLink(conversationId: String, linkId: String) =
    groupInvitationsRepository.revokeLink(conversationId, linkId)

internal fun buildGroupInvitationsPath(direction: GroupInvitationDirection, cursor: String? = null, limit: Int = GroupInvitationsRepository.DEFAULT_PAGE_SIZE): String = buildString {
    append("/api/v1/group-invitations?direction=${direction.apiValue}&limit=$limit")
    cursor?.takeIf(String::isNotBlank)?.let {
        require(MessagesRepository.isUuid(it)) { "This invitation page cursor is invalid. Refresh and try again." }
        append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name())}")
    }
}

internal fun buildGroupInvitationLinksPath(conversationId: String, cursor: String? = null, limit: Int = GroupInvitationsRepository.DEFAULT_PAGE_SIZE): String = buildString {
    require(MessagesRepository.isUuid(conversationId)) { "This group link is invalid." }
    require(limit in 1..GroupInvitationsRepository.MAX_PAGE_SIZE) { "Choose a valid invitation link page size." }
    append("/api/v1/conversations/$conversationId/invitation-links?limit=$limit")
    cursor?.takeIf(String::isNotBlank)?.let {
        require(MessagesRepository.isUuid(it)) { "This invitation link cursor is invalid. Refresh and try again." }
        append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name())}")
    }
}

private fun JSONObject.optGroupNullable(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
