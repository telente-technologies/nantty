package com.nantty.android.data

import org.json.JSONObject
import java.net.HttpURLConnection

data class ChatStreak(
    val count: Int,
    val state: String,
    val hourglass: Boolean,
    val secondsUntilMyDayEnds: Int,
    val sentTodayMe: Boolean,
    val sentTodayPeer: Boolean,
    val restoresRemaining: Int,
    val restoresPerMonth: Int,
    val restorableUntil: String?,
    val countBeforeBreak: Int,
    val milestoneDays: Int?,
    val milestoneCelebrationPending: Boolean,
)

sealed interface StreakRestoreResult {
    data class Success(val streak: ChatStreak) : StreakRestoreResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StreakRestoreResult
}

class ConversationStreakRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: ChatThreadTransport,
    private val refreshSessionProvider: () -> AccountSession? = { null },
) {
    fun acknowledge(conversationId: String): Result<Unit> = runCatching {
        require(MessagesRepository.isUuid(conversationId)) { "This conversation link is invalid." }
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: error("Sign in to acknowledge this streak celebration.")
        val path = "/api/v1/conversations/$conversationId/streak/celebrated"
        try {
            transport.request("POST", path, token, null)
        } catch (error: MessagesHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw MessagesHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
            transport.request("POST", path, refreshed, null)
        }
        Unit
    }

    fun restore(conversationId: String): StreakRestoreResult = try {
        require(MessagesRepository.isUuid(conversationId)) { "This conversation link is invalid." }
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: error("Sign in to restore this streak.")
        val path = "/api/v1/conversations/$conversationId/streak/restore"
        val payload = try {
            transport.request("POST", path, token, null)
        } catch (error: MessagesHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: return StreakRestoreResult.Failure("Your session has expired. Sign in again.", true)
            transport.request("POST", path, refreshed, null)
        }
        val data = payload.optJSONObject("data") ?: payload
        val streak = parseChatStreak(data.optJSONObject("streak") ?: data)
            ?: error("Nantty returned an incomplete streak response.")
        StreakRestoreResult.Success(streak)
    } catch (error: Exception) {
        StreakRestoreResult.Failure(
            error.message ?: "Could not restore the streak. Try again.",
            authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
        )
    }
}

internal fun parseChatStreak(value: JSONObject?): ChatStreak? {
    value ?: return null
    val state = value.optString("state").takeIf { it in setOf("none", "active", "broken") } ?: return null
    val sentToday = value.optJSONObject("sentToday") ?: return null
    return ChatStreak(
        count = value.optInt("count").coerceAtLeast(0),
        state = state,
        hourglass = value.optBoolean("hourglass"),
        secondsUntilMyDayEnds = value.optInt("secondsUntilMyDayEnds").coerceAtLeast(0),
        sentTodayMe = sentToday.optBoolean("me"),
        sentTodayPeer = sentToday.optBoolean("peer"),
        restoresRemaining = value.optInt("restoresRemaining").coerceAtLeast(0),
        restoresPerMonth = value.optInt("restoresPerMonth").coerceAtLeast(0),
        restorableUntil = value.optString("restorableUntil").takeIf { it.isNotBlank() && it != "null" },
        countBeforeBreak = value.optInt("countBeforeBreak").coerceAtLeast(0),
        milestoneDays = value.optInt("milestoneDays").takeIf { !value.isNull("milestoneDays") && it > 0 },
        milestoneCelebrationPending = value.optBoolean("milestoneCelebrationPending"),
    )
}
