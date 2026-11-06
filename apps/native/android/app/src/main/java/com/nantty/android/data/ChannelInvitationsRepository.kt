package com.nantty.android.data

import org.json.JSONObject
import java.net.URLEncoder

data class ChannelInvitation(
    val id: String,
    val channelId: String,
    val channelTitle: String?,
    val status: ChannelInvitationStatus,
    val createdAt: String,
    val expiresAt: String,
)

enum class ChannelInvitationStatus(val apiValue: String) {
    PENDING("pending"), ACCEPTED("accepted"), DECLINED("declined"), EXPIRED("expired");
    companion object { fun from(value: String) = entries.firstOrNull { it.apiValue == value } }
}

data class ChannelInvitationPage(val invitations: List<ChannelInvitation>, val nextCursor: String?)
data class ChannelInvitationLink(val id: String, val channelId: String, val token: String, val expiresAt: String)
data class ChannelInvitationLinkPreview(val title: String?, val subscriberCount: Int, val expiresAt: String)
data class ChannelInvitationLinkRecord(
    val id: String,
    val channelId: String,
    val createdAt: String,
    val expiresAt: String,
    val revokedAt: String?,
)
data class ChannelInvitationLinkPage(val links: List<ChannelInvitationLinkRecord>, val nextCursor: String?)
data class RevokedChannelInvitationLink(val id: String, val channelId: String, val revokedAt: String)

sealed interface ChannelInvitationResult<out T> {
    data class Success<T>(val value: T) : ChannelInvitationResult<T>
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ChannelInvitationResult<Nothing>
}

/** Authenticated Social API client. Link claims only create pending requests; accept is a separate action. */
class ChannelInvitationsRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: ChatThreadTransport,
    private val refreshSessionProvider: () -> AccountSession? = { null },
) {
    fun createLink(channelId: String, expiresInHours: Int = DEFAULT_LINK_EXPIRY_HOURS): ChannelInvitationResult<ChannelInvitationLink> = runRequest("Could not create a channel invite link.") {
        require(MessagesRepository.isUuid(channelId)) { "This channel is invalid." }
        require(expiresInHours in ALLOWED_LINK_EXPIRY_HOURS) { "Choose a valid link expiry." }
        parseCreatedLink(request("POST", "/api/v1/channels/$channelId/invitation-links", JSONObject().put("expiresInHours", expiresInHours)))
    }

    fun listLinks(channelId: String, cursor: String? = null, limit: Int = DEFAULT_PAGE_SIZE): ChannelInvitationResult<ChannelInvitationLinkPage> = runRequest("Could not load channel invite links.") {
        require(MessagesRepository.isUuid(channelId)) { "This channel is invalid." }
        require(limit in 1..MAX_PAGE_SIZE) { "Choose a valid page size." }
        val path = buildString {
            append("/api/v1/channels/$channelId/invitation-links?limit=$limit")
            cursor?.takeIf(String::isNotBlank)?.let {
                require(MessagesRepository.isUuid(it)) { "This invitation cursor is invalid." }
                append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name())}")
            }
        }
        parseLinkPage(request("GET", path, null), channelId)
    }

    fun revokeLink(channelId: String, linkId: String): ChannelInvitationResult<RevokedChannelInvitationLink> = runRequest("Could not revoke this channel invite link.") {
        require(MessagesRepository.isUuid(channelId) && MessagesRepository.isUuid(linkId)) { "This channel invite link is invalid." }
        parseRevokedLink(request("DELETE", "/api/v1/channels/$channelId/invitation-links/$linkId", null))
    }

    fun previewLink(token: String): ChannelInvitationResult<ChannelInvitationLinkPreview> = runRequest("This channel invitation link is unavailable. Ask for a new link.") {
        require(token.matches(TOKEN_PATTERN)) { "This channel invitation link is invalid." }
        parsePreview(request("GET", "/api/v1/channels/invitation-links/$token/preview", null))
    }

    fun claimLink(token: String): ChannelInvitationResult<ChannelInvitation> = runRequest("Could not request to join this channel.") {
        require(token.matches(TOKEN_PATTERN)) { "This channel invitation link is invalid." }
        parseInvitation(request("POST", "/api/v1/channels/invitation-links/$token/claim", JSONObject()))
    }

    fun listPending(cursor: String? = null, limit: Int = DEFAULT_PAGE_SIZE): ChannelInvitationResult<ChannelInvitationPage> = runRequest("Could not load channel invitations.") {
        require(limit in 1..MAX_PAGE_SIZE) { "Choose a valid page size." }
        val path = buildString {
            append("/api/v1/channel-invitations?status=pending&limit=$limit")
            cursor?.takeIf(String::isNotBlank)?.let {
                require(MessagesRepository.isUuid(it)) { "This invitation cursor is invalid." }
                append("&cursor=${URLEncoder.encode(it, Charsets.UTF_8.name())}")
            }
        }
        parseInvitationPage(request("GET", path, null))
    }

    fun accept(invitationId: String): ChannelInvitationResult<ChannelInvitation> = respond(invitationId, "accept")
    fun decline(invitationId: String): ChannelInvitationResult<ChannelInvitation> = respond(invitationId, "decline")

    private fun respond(invitationId: String, action: String): ChannelInvitationResult<ChannelInvitation> = runRequest("Could not $action this channel invitation.") {
        require(MessagesRepository.isUuid(invitationId)) { "This channel invitation is invalid." }
        parseInvitation(request("POST", "/api/v1/channel-invitations/$invitationId/$action", null))
    }

    private fun request(method: String, path: String, body: JSONObject?): JSONObject {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: error("Sign in to manage channel invitations.")
        return try {
            transport.request(method, path, token, body)
        } catch (error: MessagesHttpException) {
            if (error.statusCode != 401) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw MessagesHttpException(401)
            transport.request(method, path, refreshed, body)
        }
    }

    private inline fun <T> runRequest(fallback: String, block: () -> T): ChannelInvitationResult<T> = try {
        ChannelInvitationResult.Success(block())
    } catch (error: Exception) {
        ChannelInvitationResult.Failure(
            error.message?.takeIf(String::isNotBlank) ?: fallback,
            authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
        )
    }

    private fun parseCreatedLink(payload: JSONObject): ChannelInvitationLink {
        val row = payload.optJSONObject("data") ?: payload
        return ChannelInvitationLink(
            row.string("id").uuid("channel invite link"),
            row.string("channelId").uuid("channel invite link"),
            row.string("token").also { require(it.matches(TOKEN_PATTERN)) { "Nantty returned an invalid channel invite token." } },
            row.string("expiresAt"),
        )
    }

    private fun parsePreview(payload: JSONObject): ChannelInvitationLinkPreview {
        val row = payload.optJSONObject("data") ?: payload
        val channel = row.optJSONObject("channel") ?: error("Nantty returned an incomplete channel invitation preview.")
        val count = channel.optInt("subscriberCount", -1)
        require(count >= 0) { "Nantty returned an invalid channel subscriber count." }
        return ChannelInvitationLinkPreview(channel.optNullable("title"), count, row.string("expiresAt"))
    }

    private fun parseInvitation(payload: JSONObject): ChannelInvitation {
        val row = payload.optJSONObject("data") ?: payload
        val status = ChannelInvitationStatus.from(row.string("status"))
            ?: error("Nantty returned an unknown channel invitation status.")
        return ChannelInvitation(
            row.string("id").uuid("channel invitation"),
            (row.optNullable("channelId") ?: row.optNullable("conversationId")).orEmpty().uuid("channel invitation"),
            row.optNullable("channelTitle"), status, row.optNullable("createdAt").orEmpty(), row.string("expiresAt"),
        )
    }

    private fun parseInvitationPage(payload: JSONObject): ChannelInvitationPage {
        val page = payload.optJSONObject("data") ?: payload
        val rows = page.optJSONArray("data") ?: page.optJSONArray("items")
            ?: error("Nantty returned an incomplete channel invitations page.")
        val items = buildList {
            for (index in 0 until rows.length()) rows.optJSONObject(index)?.let { row ->
                runCatching { parseInvitation(row) }.getOrNull()?.let(::add)
            }
        }.distinctBy(ChannelInvitation::id)
        return ChannelInvitationPage(items, page.optNullable("nextCursor")?.also { it.uuid("channel invitation cursor") })
    }

    private fun parseLinkPage(payload: JSONObject, expectedChannelId: String): ChannelInvitationLinkPage {
        val page = payload.optJSONObject("data") ?: payload
        val rows = page.optJSONArray("data") ?: page.optJSONArray("items")
            ?: error("Nantty returned an incomplete channel invite links page.")
        val links = buildList {
            for (index in 0 until rows.length()) rows.optJSONObject(index)?.let { row ->
                runCatching {
                    ChannelInvitationLinkRecord(
                        row.string("id").uuid("channel invite link"),
                        row.string("channelId").uuid("channel invite link"),
                        row.string("createdAt"), row.string("expiresAt"), row.optNullable("revokedAt"),
                    ).takeIf { it.channelId == expectedChannelId }
                }.getOrNull()?.let(::add)
            }
        }.distinctBy(ChannelInvitationLinkRecord::id)
        return ChannelInvitationLinkPage(links, page.optNullable("nextCursor")?.also { it.uuid("channel invite links cursor") })
    }

    private fun parseRevokedLink(payload: JSONObject): RevokedChannelInvitationLink {
        val row = payload.optJSONObject("data") ?: payload
        return RevokedChannelInvitationLink(
            row.string("id").uuid("channel invite link"), row.string("channelId").uuid("channel invite link"), row.string("revokedAt"),
        )
    }

    companion object {
        const val DEFAULT_PAGE_SIZE = 20
        const val MAX_PAGE_SIZE = 100
        const val DEFAULT_LINK_EXPIRY_HOURS = 168
        val ALLOWED_LINK_EXPIRY_HOURS = setOf(24, 168, 720)
        private val TOKEN_PATTERN = Regex("[A-Za-z0-9_-]{43}")
    }
}

private fun JSONObject.string(key: String): String = optNullable(key)?.takeIf(String::isNotBlank)
    ?: error("Nantty returned an incomplete channel invitation response.")
private fun JSONObject.optNullable(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
private fun String.uuid(label: String): String = takeIf(MessagesRepository::isUuid)
    ?: error("Nantty returned an invalid $label.")
