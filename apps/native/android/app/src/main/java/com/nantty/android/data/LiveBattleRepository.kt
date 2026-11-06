package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

fun interface LiveBattleTransport {
    fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject
}

sealed interface LiveBattleContributionResult {
    data class Success(val stage: LiveStageResponse) : LiveBattleContributionResult
    data class Failure(val message: String, val statusCode: Int? = null) : LiveBattleContributionResult
}

/** Data-only battle contribution seam. UI and navigation intentionally remain absent until Android has a live surface. */
class LiveBattleRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val accessTokenProvider: () -> String?,
    private val transport: LiveBattleTransport = JdkLiveBattleTransport(baseUrl),
) {
    fun contributeCoins(
        battleId: String,
        contribution: LiveBattleCoinContribution,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): LiveBattleContributionResult {
        if (!isSafeLiveBattleId(battleId) || !isSafeLiveBattleId(contribution.recipientUserId)) {
            return LiveBattleContributionResult.Failure("This live battle contribution is invalid.")
        }
        if (contribution.coins <= 0L) {
            return LiveBattleContributionResult.Failure("Enter a positive coin contribution.")
        }
        if (!idempotencyKey.matches(IDEMPOTENCY_KEY_PATTERN)) {
            return LiveBattleContributionResult.Failure("Could not safely prepare this contribution. Try again.")
        }
        val token = accessTokenProvider()?.trim()?.takeIf(String::isNotEmpty)
            ?: return LiveBattleContributionResult.Failure("Sign in to contribute coins.", HttpURLConnection.HTTP_UNAUTHORIZED)

        return try {
            val response = transport.post(
                path = "/api/v1/battles/${battleId}/coins",
                accessToken = token,
                idempotencyKey = idempotencyKey,
                body = JSONObject()
                    .put("recipientUserId", contribution.recipientUserId)
                    .put("coins", contribution.coins),
            )
            LiveBattleContributionResult.Success(parseLiveStageResponse(response))
        } catch (error: LiveBattleHttpException) {
            LiveBattleContributionResult.Failure(error.message ?: "Could not contribute coins.", error.statusCode)
        } catch (error: Exception) {
            LiveBattleContributionResult.Failure(error.message ?: "Could not reach Nantty. Try again.")
        }
    }

    private companion object {
        val IDEMPOTENCY_KEY_PATTERN = Regex("^[A-Za-z0-9_-]{8,128}$")
    }
}

internal fun parseLiveStageResponse(payload: JSONObject): LiveStageResponse {
    val root = payload.optJSONObject("data") ?: payload
    val liveId = root.optString("liveId").takeIf(::isSafeLiveBattleId)
        ?: error("Nantty returned an invalid live-stage ID.")
    val activeBattle = root.optJSONObject("activeBattle")?.let { battle ->
        val battleId = battle.optString("id").takeIf(::isSafeLiveBattleId)
            ?: error("Nantty returned an invalid active battle.")
        val rows = battle.optJSONArray("participants") ?: error("Nantty returned an incomplete active battle.")
        val participants = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val userId = row.optString("userId").takeIf(::isSafeLiveBattleId)
                    ?: error("Nantty returned an invalid battle participant.")
                val score = row.optLong("score", -1L)
                val rank = row.optInt("rank", -1)
                require(score >= 0L && rank > 0) { "Nantty returned an invalid battle score." }
                add(LiveBattleParticipantSnapshot(userId, score, rank, row.optString("state")))
            }
        }
        LiveBattleSnapshot(battleId, battle.optString("state"), participants)
    }
    return LiveStageResponse(
        liveId = liveId,
        layout = root.optString("layout"),
        phase = root.optString("phase"),
        serverNow = root.optString("serverNow"),
        myRole = root.optString("myRole"),
        activeBattle = activeBattle,
    )
}

private fun isSafeLiveBattleId(value: String): Boolean = value.matches(LIVE_BATTLE_ID_PATTERN)

private val LIVE_BATTLE_ID_PATTERN = Regex("^[A-Za-z0-9_-]{1,80}$")

private class JdkLiveBattleTransport(private val baseUrl: String) : LiveBattleTransport {
    override fun post(path: String, accessToken: String, idempotencyKey: String, body: JSONObject): JSONObject {
        require(path.startsWith("/api/v1/battles/") && !path.contains("..")) { "Invalid battle endpoint." }
        require(idempotencyKey.matches(Regex("^[A-Za-z0-9_-]{8,128}$"))) { "Invalid idempotency key." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use live battles.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Idempotency-Key", idempotencyKey)
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readLiveBattleResponse).orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(response).optString("message") }.getOrNull()
                    ?.takeIf(String::isNotBlank) ?: "Live battle request failed (HTTP $status)."
                throw LiveBattleHttpException(status, message)
            }
            require(response.isNotBlank()) { "Nantty returned an empty live-stage response." }
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readLiveBattleResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large live-stage response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}

class LiveBattleHttpException(val statusCode: Int, message: String) : IllegalStateException(message)
