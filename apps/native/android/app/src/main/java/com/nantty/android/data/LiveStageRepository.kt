package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.net.URI
import java.util.UUID

data class LiveStageViewerSnapshot(
    val liveId: String,
    val myRole: String,
    val invitationId: String?,
    val joinRequestState: String?,
)

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
        val ROLES = setOf("host", "guest", "viewer")
        val JOIN_STATES = setOf("pending", "approved", "declined")
        fun segment(value: String) = java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
    }
}

private fun parseStage(row: JSONObject, expectedLiveId: String): LiveStageViewerSnapshot {
    val liveId = row.optString("liveId").takeIf { it == expectedLiveId }
        ?: error("Nantty returned a stage for a different Live.")
    val role = row.optString("myRole").takeIf { it in LiveStageRepository.ROLES }
        ?: error("Nantty returned an invalid Live stage role.")
    val invitation = row.optJSONObject("invitationForMe")
    val invitationId = invitation?.optString("id")?.takeIf { SAFE_STAGE_ID.matches(it) }
    if (invitation != null && invitationId == null) error("Nantty returned an invalid stage invitation.")
    val joinRequest = row.optJSONObject("myJoinRequest")
    val joinRequestState = joinRequest?.optString("state")?.takeIf { it in LiveStageRepository.JOIN_STATES }
    if (joinRequest != null && joinRequestState == null) error("Nantty returned an invalid stage request.")
    return LiveStageViewerSnapshot(liveId, role, invitationId, joinRequestState)
}

private fun parseMediaGrant(row: JSONObject): LiveMediaGrant {
    val url = row.optString("url").takeIf {
        runCatching { URI(it).let { uri -> uri.scheme.equals("wss", true) && !uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.fragment == null } }.getOrDefault(false)
    } ?: error("Nantty returned an invalid Live media URL.")
    val token = row.optString("token").takeIf(String::isNotBlank) ?: error("Nantty returned no Live media token.")
    val role = row.optString("role").takeIf { it in setOf("host", "guest", "viewer") }
        ?: error("Nantty returned an invalid Live media role.")
    return LiveMediaGrant(url, token, row.optBoolean("canPublish"), role)
}

private val SAFE_STAGE_ID = Regex("^[A-Za-z0-9_-]{1,80}$")
