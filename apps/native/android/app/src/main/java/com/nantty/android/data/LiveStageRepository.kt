package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.URI
import java.util.UUID

const val LIVE_STAGE_MAXIMUM_STREAMERS = 10

data class LiveStageViewerSnapshot(
    val liveId: String,
    val myRole: String,
    val invitationId: String?,
    val joinRequestState: String?,
    val streamers: List<LiveStageStreamerSummary> = emptyList(),
    val invitations: List<LiveStageGuestInvitation> = emptyList(),
    val joinRequests: List<LiveStageJoinRequestSummary> = emptyList(),
)

data class LiveStageUserSummary(val id: String, val name: String, val username: String, val avatarUrl: String?, val verified: Boolean)
data class LiveStageStreamerSummary(val slotId: String, val user: LiveStageUserSummary, val role: String, val state: String, val audioMuted: Boolean, val videoMuted: Boolean)
data class LiveStageGuestInvitation(val id: String, val user: LiveStageUserSummary, val state: String)
data class LiveStageJoinRequestSummary(val id: String, val user: LiveStageUserSummary, val state: String)

data class LiveStageInvitationResponse(
    val stage: LiveStageViewerSnapshot,
    val mediaGrant: LiveMediaGrant?,
)

/** Authenticated audience request and invitation-response contracts for ordinary Live stages. */
class LiveStageRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: LiveSessionsTransport = JdkLiveSessionsTransport(BuildConfig.NANTTY_API_BASE_URL),
) {
    fun load(liveId: String): LiveSessionsResult<LiveStageViewerSnapshot> = stageRequest(liveId, "GET", "/stage")

    fun requestToJoin(liveId: String): LiveSessionsResult<LiveStageViewerSnapshot> =
        stageRequest(liveId, "POST", "/guests/requests")

    fun respondToInvitation(
        liveId: String,
        invitationId: String,
        accept: Boolean,
    ): LiveSessionsResult<LiveStageInvitationResponse> {
        if (!SAFE_ID.matches(liveId) || !SAFE_ID.matches(invitationId)) return invalid()
        val response = if (accept) "accept" else "decline"
        return authenticated { token ->
            val payload = transport.request("POST", "$LIVE_PATH/${segment(liveId)}/guests/invitations/${segment(invitationId)}/$response", token)
            val root = payload.optJSONObject("data") ?: payload
            val stage = parseStage(root, liveId)
            LiveStageInvitationResponse(stage, if (accept) root.optJSONObject("livekit")?.let(::parseMediaGrant) else null)
        }
    }

    fun leaveStage(liveId: String): LiveSessionsResult<LiveStageViewerSnapshot> =
        stageRequest(liveId, "POST", "/guests/me/leave")

    fun searchViewers(liveId: String, query: String): LiveSessionsResult<List<LiveStageUserSummary>> {
        if (!SAFE_ID.matches(liveId)) return invalid()
        val term = query.trim().take(80)
        return authenticated { token ->
            val payload = transport.request("GET", "$LIVE_PATH/${segment(liveId)}/viewers?q=${segment(term)}", token)
            val root = payload.optJSONObject("data") ?: payload
            val rows = root.optJSONArray("data") ?: error("Nantty returned an incomplete viewer search.")
            buildList {
                for (index in 0 until rows.length()) {
                    val row = rows.optJSONObject(index) ?: continue
                    runCatching { parseStageUser(row) }.getOrNull()?.let(::add)
                }
            }
        }
    }

    fun inviteViewer(liveId: String, userId: String): LiveSessionsResult<LiveStageViewerSnapshot> =
        stageAction(liveId, userId, "/guests/invitations", JSONObject().put("userId", userId))

    fun decideJoinRequest(liveId: String, requestId: String, approve: Boolean): LiveSessionsResult<LiveStageViewerSnapshot> {
        if (!SAFE_ID.matches(liveId) || !SAFE_ID.matches(requestId)) return invalid()
        return authenticated { token ->
            val decision = if (approve) "approve" else "decline"
            val payload = transport.request("POST", "$LIVE_PATH/${segment(liveId)}/guests/requests/${segment(requestId)}/$decision", token)
            parseStage(payload.optJSONObject("data") ?: payload, liveId)
        }
    }

    fun removeGuest(liveId: String, userId: String): LiveSessionsResult<LiveStageViewerSnapshot> =
        stageAction(liveId, userId, "/guests/${segment(userId)}/remove")

    fun muteStreamer(liveId: String, userId: String, audio: Boolean? = null, video: Boolean? = null): LiveSessionsResult<LiveStageViewerSnapshot> {
        if (!SAFE_ID.matches(liveId) || !SAFE_ID.matches(userId) || (audio == null && video == null)) return invalid()
        val body = JSONObject().apply { audio?.let { put("audio", it) }; video?.let { put("video", it) } }
        return stageAction(liveId, userId, "/guests/${segment(userId)}/mute", body)
    }

    private fun stageAction(liveId: String, pathId: String, suffix: String, body: JSONObject? = null): LiveSessionsResult<LiveStageViewerSnapshot> {
        if (!SAFE_ID.matches(liveId) || !SAFE_ID.matches(pathId)) return invalid()
        return authenticated { token ->
            val payload = transport.request("POST", "$LIVE_PATH/${segment(liveId)}$suffix", token, body)
            parseStage(payload.optJSONObject("data") ?: payload, liveId)
        }
    }

    private fun stageRequest(liveId: String, method: String, suffix: String): LiveSessionsResult<LiveStageViewerSnapshot> {
        if (!SAFE_ID.matches(liveId)) return invalid()
        return authenticated { token ->
            val payload = transport.request(method, "$LIVE_PATH/${segment(liveId)}$suffix", token)
            parseStage(payload.optJSONObject("data") ?: payload, liveId)
        }
    }

    private fun <T> authenticated(request: (String) -> T): LiveSessionsResult<T> {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return LiveSessionsResult.Failure("Sign in to continue to Live.", 401, authenticationRequired = true)
        return try {
            LiveSessionsResult.Success(request(token))
        } catch (error: LiveSessionsHttpException) {
            if (error.statusCode != 401) failure(error)
            else {
                val fresh = runCatching { refreshSessionProvider()?.accessToken }.getOrNull()?.takeIf(String::isNotBlank)
                    ?: return LiveSessionsResult.Failure("Your session has expired. Sign in again to continue.", 401, authenticationRequired = true)
                try { LiveSessionsResult.Success(request(fresh)) }
                catch (retry: LiveSessionsHttpException) { failure(retry) }
                catch (_: Exception) { LiveSessionsResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true) }
            }
        } catch (_: Exception) {
            LiveSessionsResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true)
        }
    }

    private fun <T> failure(error: LiveSessionsHttpException): LiveSessionsResult<T> = LiveSessionsResult.Failure(
        message = when (error.statusCode) {
            401 -> "Your session has expired. Sign in again to continue."
            403 -> "You can’t access this Live stage."
            404 -> "This Live stage is no longer available."
            409, 410 -> "This stage request or invitation is no longer active."
            422 -> "This Live stage action is not available right now."
            429 -> "Too many requests. Wait a moment and try again."
            else -> "Nantty couldn’t complete this stage action. Please try again."
        },
        statusCode = error.statusCode,
        authenticationRequired = error.statusCode == 401,
        retryable = error.statusCode == 408 || error.statusCode == 429 || error.statusCode >= 500,
    )

    private fun invalid() = LiveSessionsResult.Failure("This Live stage invitation is invalid.")

    private companion object {
        const val LIVE_PATH = "/api/v1/lives"
        val SAFE_ID = Regex("^[A-Za-z0-9_-]{1,80}$")
        fun segment(value: String) = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
    }
}

private fun parseStage(row: JSONObject, expectedLiveId: String): LiveStageViewerSnapshot {
    val liveId = row.optString("liveId").takeIf { it == expectedLiveId }
        ?: error("Nantty returned a stage for a different Live.")
    val role = row.optString("myRole").takeIf { it in LIVE_STAGE_ROLES }
        ?: error("Nantty returned an invalid Live stage role.")
    val invitation = row.optJSONObject("invitationForMe")
    val invitationId = invitation?.optString("id")?.takeIf { SAFE_STAGE_ID.matches(it) }
    if (invitation != null && invitationId == null) error("Nantty returned an invalid stage invitation.")
    val joinRequest = row.optJSONObject("myJoinRequest")
    val joinRequestState = joinRequest?.optString("state")?.takeIf { it in LIVE_STAGE_JOIN_STATES }
    if (joinRequest != null && joinRequestState == null) error("Nantty returned an invalid stage request.")
    return LiveStageViewerSnapshot(
        liveId = liveId,
        myRole = role,
        invitationId = invitationId,
        joinRequestState = joinRequestState,
        streamers = parseRows(row.optJSONArray("streamers")) { value ->
            LiveStageStreamerSummary(
                slotId = value.optString("slotId").takeIf(SAFE_STAGE_ID::matches) ?: error("Invalid stage seat."),
                user = parseStageUser(value.optJSONObject("user") ?: error("Stage user is missing.")),
                role = value.optString("role").takeIf { it in setOf("host", "guest") } ?: error("Invalid stage role."),
                state = value.optString("state").takeIf { it in LIVE_GUEST_STATES } ?: error("Invalid guest state."),
                audioMuted = value.optBoolean("audioMuted"),
                videoMuted = value.optBoolean("videoMuted"),
            )
        },
        invitations = parseRows(row.optJSONArray("invitations")) { value ->
            LiveStageGuestInvitation(
                id = value.optString("id").takeIf(SAFE_STAGE_ID::matches) ?: error("Invalid stage invitation."),
                user = parseStageUser(value.optJSONObject("user") ?: error("Invitation user is missing.")),
                state = value.optString("state").takeIf { it in LIVE_GUEST_STATES } ?: error("Invalid invitation state."),
            )
        },
        joinRequests = parseRows(row.optJSONArray("joinRequests")) { value ->
            LiveStageJoinRequestSummary(
                id = value.optString("id").takeIf(SAFE_STAGE_ID::matches) ?: error("Invalid stage request."),
                user = parseStageUser(value.optJSONObject("user") ?: error("Request user is missing.")),
                state = value.optString("state").takeIf { it in LIVE_STAGE_JOIN_STATES } ?: error("Invalid request state."),
            )
        },
    )
}

private fun <T> parseRows(rows: org.json.JSONArray?, parse: (JSONObject) -> T): List<T> = buildList {
    if (rows == null) return@buildList
    for (index in 0 until rows.length()) {
        val row = rows.optJSONObject(index) ?: continue
        runCatching { parse(row) }.getOrNull()?.let(::add)
    }
}

private fun parseStageUser(row: JSONObject): LiveStageUserSummary {
    val id = row.optString("id").takeIf(SAFE_STAGE_ID::matches) ?: error("Nantty returned an invalid stage user.")
    val username = row.optString("username").trim().removePrefix("@").takeIf { it.isNotBlank() && it.length <= 80 }
        ?: error("Nantty returned an invalid username.")
    val avatar = row.optString("avatarUrl").takeIf(String::isNotBlank)?.takeIf { value -> runCatching { URI(value).let { it.scheme in setOf("https", "http") && !it.host.isNullOrBlank() && it.rawUserInfo == null } }.getOrDefault(false) }
    return LiveStageUserSummary(id, row.optString("name").ifBlank { username }.take(120), username, avatar, row.optBoolean("verified"))
}

private fun parseMediaGrant(row: JSONObject): LiveMediaGrant {
    val url = row.optString("url").takeIf {
        runCatching { URI(it).let { uri -> uri.scheme.equals("wss", true) && !uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.fragment == null } }.getOrDefault(false)
    } ?: error("Nantty returned an invalid Live media URL.")
    val token = row.optString("token").takeIf(String::isNotBlank) ?: error("Nantty returned no Live media token.")
    val role = row.optString("role").takeIf { it in LIVE_STAGE_ROLES }
        ?: error("Nantty returned an invalid Live media role.")
    return LiveMediaGrant(url, token, row.optBoolean("canPublish"), role)
}

private val SAFE_STAGE_ID = Regex("^[A-Za-z0-9_-]{1,80}$")
private val LIVE_STAGE_ROLES = setOf("host", "guest", "viewer")
private val LIVE_STAGE_JOIN_STATES = setOf("pending", "approved", "declined")
private val LIVE_GUEST_STATES = setOf("invited", "joining", "onStage", "reconnecting", "left", "removed", "declined", "expired", "cancelled", "failed")
