package com.nantty.android.data

/** Server-backed Space visibility values. */
enum class SpaceVisibility(val wireValue: String) {
    PUBLIC("public"),
    FOLLOWERS("followers"),
    SUBSCRIBERS("subscribers"),
    INVITE_ONLY("invite_only"),
    UNKNOWN("unknown"),

    ; companion object {
        fun fromWire(value: String): SpaceVisibility = entries.firstOrNull { it.wireValue == value } ?: UNKNOWN
    }
}

enum class SpaceState(val wireValue: String) {
    LIVE("live"),
    SCHEDULED("scheduled"),
    ENDED("ended"),
    CANCELLED("cancelled"),
    UNKNOWN("unknown"),

    ; companion object {
        fun fromWire(value: String): SpaceState = entries.firstOrNull { it.wireValue == value } ?: UNKNOWN
    }
}

enum class SpaceRole(val wireValue: String) {
    HOST("host"),
    MODERATOR("moderator"),
    SPEAKER("speaker"),
    LISTENER("listener"),
    UNKNOWN("unknown"),

    ; companion object {
        fun fromWire(value: String): SpaceRole = entries.firstOrNull { it.wireValue == value } ?: UNKNOWN
    }
}

enum class SpaceInviteRole(val wireValue: String, val label: String) {
    LISTENER("listener", "Listener"),
    SPEAKER("speaker", "Speaker"),
    COHOST("cohost", "Co-host"),
}

data class SpacePerson(
    val id: String,
    val name: String?,
    val username: String?,
    val avatarUrl: String?,
    val role: SpaceRole,
    val muted: Boolean,
)

/** A safe, public account summary returned by the social people-search endpoint. */
data class SpaceInvitePerson(
    val id: String,
    val name: String,
    val username: String,
    val avatarUrl: String?,
    val verified: Boolean,
)

data class SpaceSummary(
    val id: String,
    val title: String,
    val description: String?,
    val state: SpaceState,
    val scheduledAt: String?,
    val startedAt: String?,
    val listenerCount: Int,
    val host: SpacePerson,
    val visibility: SpaceVisibility,
)

data class SpaceDetails(
    val summary: SpaceSummary,
    val giftsEnabled: Boolean,
    val announcementPostId: String?,
    val speakers: List<SpacePerson>,
    val viewerRole: SpaceRole?,
    val viewerJoined: Boolean?,
    val speakerRequestState: String?,
    val pendingSpeakerRequests: List<PendingSpaceSpeakerRequest>,
)

data class PendingSpaceSpeakerRequest(val id: String, val user: SpacePerson)

data class SpaceSpeakerRequest(val id: String, val state: String)

data class SpacePage(val items: List<SpaceSummary>, val nextCursor: String?)

data class SpaceInvitation(
    val spaceId: String,
    val invitationId: String,
    val role: String,
    val title: String?,
    val invitedAt: String,
    val inviterId: String,
    val space: SpaceSummary,
)

data class SpaceInvitationPage(val items: List<SpaceInvitation>, val nextCursor: String?)

data class SpaceJoinGrant(
    val spaceId: String,
    val role: SpaceRole,
    val token: String,
    val url: String,
    val canPublish: Boolean,
    val listeners: Int,
)

data class CreateSpaceRequest(
    val title: String,
    val description: String? = null,
    val visibility: SpaceVisibility,
    val scheduledAt: String? = null,
    val giftsEnabled: Boolean,
)

data class SpaceDonationReceipt(
    val id: String,
    val hostUserId: String,
    val totalCoins: Long,
    val senderCoinBalance: Long,
)

internal fun parseSpaceSummary(value: org.json.JSONObject): SpaceSummary {
    val person = value.optJSONObject("host") ?: error("Nantty returned a Space without a host.")
    val id = value.optString("id").trim().takeIf(String::isNotEmpty)
        ?: error("Nantty returned a Space without an ID.")
    val title = value.optString("title").trim().takeIf(String::isNotEmpty)
        ?: error("Nantty returned a Space without a title.")
    return SpaceSummary(
        id = id,
        title = title,
        description = value.optSpaceNullableString("description"),
        state = SpaceState.fromWire(value.optString("state")),
        scheduledAt = value.optSpaceNullableString("scheduledAt"),
        startedAt = value.optSpaceNullableString("startedAt"),
        listenerCount = value.optInt("listenerCount", 0).coerceAtLeast(0),
        host = parseSpacePerson(person),
        visibility = SpaceVisibility.fromWire(value.optString("visibility")),
    )
}

internal fun parseSpaceInvitationPage(value: org.json.JSONObject): SpaceInvitationPage {
    val envelope = value.optJSONObject("data") ?: value
    val rows = envelope.optJSONArray("data") ?: envelope.optJSONArray("items")
        ?: error("Nantty returned an incomplete Space invitations list.")
    val invitations = buildList {
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val invitation = runCatching {
                val spaceId = row.optSpaceNullableString("spaceId") ?: error("Missing Space ID")
                val invitationId = row.optSpaceNullableString("invitationId") ?: error("Missing invitation ID")
                val role = row.optSpaceNullableString("role") ?: error("Missing invitation role")
                val invitedAt = row.optSpaceNullableString("invitedAt") ?: error("Missing invitation date")
                val inviterId = row.optSpaceNullableString("inviterId") ?: error("Missing inviter ID")
                val space = parseSpaceSummary(row.optJSONObject("space") ?: error("Missing Space summary"))
                require(space.id == spaceId) { "Invitation Space ID does not match its summary." }
                SpaceInvitation(
                    spaceId = spaceId,
                    invitationId = invitationId,
                    role = role,
                    title = row.optSpaceNullableString("title"),
                    invitedAt = invitedAt,
                    inviterId = inviterId,
                    space = space,
                )
            }.getOrNull()
            if (invitation != null) add(invitation)
        }
    }
    return SpaceInvitationPage(invitations, envelope.optSpaceNullableString("nextCursor"))
}

internal fun parseSpaceInvitePeople(value: org.json.JSONObject, limit: Int): List<SpaceInvitePerson> {
    require(limit in 1..SPACE_INVITE_PEOPLE_LIMIT) { "Invalid Space invitation search limit." }
    val envelope = value.optJSONObject("data") ?: value
    val rows = value.optJSONArray("data") ?: envelope.optJSONArray("data") ?: envelope.optJSONArray("items")
        ?: error("Nantty returned an incomplete people-search response.")
    val seenIds = mutableSetOf<String>()
    return buildList {
        for (index in 0 until rows.length()) {
            if (size >= limit) break
            val row = rows.optJSONObject(index) ?: continue
            val id = row.optSpaceNullableString("id")?.takeIf { it.length <= MAX_SPACE_PERSON_ID_LENGTH } ?: continue
            val username = row.optSpaceNullableString("username")
                ?.filterNot(Char::isISOControl)
                ?.takeIf { it.isNotBlank() && it.length <= MAX_SPACE_USERNAME_LENGTH } ?: continue
            val name = row.optSpaceNullableString("name")
                ?.filterNot(Char::isISOControl)
                ?.trim()
                ?.take(120)
                ?.takeIf(String::isNotBlank)
                ?: username
            if (!seenIds.add(id)) continue
            add(
                SpaceInvitePerson(
                    id = id,
                    name = name,
                    username = username,
                    avatarUrl = row.optSpaceNullableString("avatarUrl")?.takeIf(::isSecureImageUrl),
                    verified = row.optBoolean("verified"),
                ),
            )
        }
    }.take(limit)
}

internal const val SPACE_INVITE_PEOPLE_LIMIT = 20
private const val MAX_SPACE_PERSON_ID_LENGTH = 80
private const val MAX_SPACE_USERNAME_LENGTH = 60

internal fun parseSpaceDetails(value: org.json.JSONObject): SpaceDetails {
    val speakersJson = value.optJSONArray("speakers")
    val speakers = buildList {
        if (speakersJson != null) for (index in 0 until speakersJson.length()) {
            speakersJson.optJSONObject(index)?.let { add(parseSpacePerson(it)) }
        }
    }
    val pendingJson = value.optJSONArray("pendingSpeakerRequests")
    val pending = buildList {
        if (pendingJson != null) for (index in 0 until pendingJson.length()) {
            val row = pendingJson.optJSONObject(index) ?: continue
            val user = row.optJSONObject("user") ?: continue
            val requestId = row.optString("id").trim()
            if (requestId.isNotEmpty()) add(PendingSpaceSpeakerRequest(requestId, parseSpacePerson(user)))
        }
    }
    return SpaceDetails(
        summary = parseSpaceSummary(value),
        giftsEnabled = value.optBoolean("giftsEnabled", false),
        announcementPostId = value.optSpaceNullableString("announcementPostId"),
        speakers = speakers,
        viewerRole = value.optSpaceNullableString("viewerRole")?.let(SpaceRole::fromWire),
        viewerJoined = if (value.has("viewerJoined") && !value.isNull("viewerJoined")) value.optBoolean("viewerJoined") else null,
        speakerRequestState = value.optSpaceNullableString("speakerRequestState"),
        pendingSpeakerRequests = pending,
    )
}

internal fun parseSpacePerson(value: org.json.JSONObject): SpacePerson {
    val id = value.optString("id").trim().takeIf(String::isNotEmpty)
        ?: error("Nantty returned a Space participant without an ID.")
    return SpacePerson(
        id = id,
        name = value.optSpaceNullableString("name"),
        username = value.optSpaceNullableString("username"),
        avatarUrl = value.optSpaceNullableString("avatarUrl"),
        role = SpaceRole.fromWire(value.optString("role")),
        muted = value.optBoolean("muted", false),
    )
}

internal fun org.json.JSONObject.optSpaceNullableString(key: String): String? =
    if (!has(key) || isNull(key)) null else optString(key).trim().takeIf(String::isNotEmpty)

