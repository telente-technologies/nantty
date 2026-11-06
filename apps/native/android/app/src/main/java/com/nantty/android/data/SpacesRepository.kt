package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

interface SpacesTransport {
    fun request(method: String, path: String, accessToken: String?, body: JSONObject? = null, idempotencyKey: String? = null): JSONObject
}

sealed interface SpacesResult<out T> {
    data class Success<T>(val value: T) : SpacesResult<T>
    data class Failure(val message: String, val statusCode: Int? = null) : SpacesResult<Nothing>
}

class SpacesRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val transport: SpacesTransport = JdkSpacesTransport(baseUrl),
) {
    fun list(accessToken: String? = null, cursor: String? = null): SpacesResult<SpacePage> = call {
        val query = buildList {
            add("state=live%2Cupcoming")
            add("limit=30")
            cursor?.takeIf(String::isNotBlank)?.let { add("cursor=${encode(it)}") }
        }.joinToString("&")
        val payload = transport.request("GET", "$SPACES_PATH?$query", accessToken?.takeIf(String::isNotBlank))
        val root = payload.optJSONObject("data") ?: payload
        val rows = root.optJSONArray("data") ?: root.optJSONArray("items")
            ?: payload.optJSONArray("items") ?: error("Nantty returned an incomplete Spaces list.")
        val items = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                add(parseSpaceSummary(row))
            }
        }
        SpacePage(items, root.optSpaceNullableString("nextCursor") ?: payload.optSpaceNullableString("nextCursor"))
    }

    fun listInvitations(accessToken: String, cursor: String? = null): SpacesResult<SpaceInvitationPage> = call {
        val token = requireToken(accessToken)
        val query = buildList {
            add("limit=30")
            cursor?.takeIf(String::isNotBlank)?.let { add("cursor=${encode(it)}") }
        }.joinToString("&")
        parseSpaceInvitationPage(transport.request("GET", "$SPACES_PATH/invitations?$query", token))
    }

    /** Search existing Nantty accounts using the social API contract shared with React Native. */
    fun searchInvitePeople(query: String, accessToken: String): SpacesResult<List<SpaceInvitePerson>> = call {
        val token = requireToken(accessToken)
        val cleanQuery = query.trim()
        require(cleanQuery.length in MIN_INVITE_SEARCH_QUERY_LENGTH..MAX_INVITE_SEARCH_QUERY_LENGTH) {
            "Enter at least $MIN_INVITE_SEARCH_QUERY_LENGTH characters to search people."
        }
        val path = "$PEOPLE_SEARCH_PATH?q=${encode(cleanQuery)}&limit=$SPACE_INVITE_PEOPLE_LIMIT"
        parseSpaceInvitePeople(transport.request("GET", path, token), SPACE_INVITE_PEOPLE_LIMIT)
    }

    fun acceptInvitation(
        spaceId: String,
        invitationId: String,
        accessToken: String,
        idempotencyKey: String = newKey(),
    ) = invitationAction(spaceId, invitationId, "accept", accessToken, idempotencyKey)

    fun declineInvitation(
        spaceId: String,
        invitationId: String,
        accessToken: String,
        idempotencyKey: String = newKey(),
    ) = invitationAction(spaceId, invitationId, "decline", accessToken, idempotencyKey)

    private fun invitationAction(spaceId: String, invitationId: String, action: String, token: String, key: String) = call {
        requireSpaceId(spaceId)
        require(invitationId.isNotBlank() && !invitationId.contains('/')) { "That Space invitation could not be found." }
        val access = requireToken(token)
        requireValidKey(key)
        transport.request("POST", "${pathFor(spaceId)}/invites/${segment(invitationId)}/$action", access, idempotencyKey = key)
        Unit
    }

    fun detail(spaceId: String, accessToken: String? = null): SpacesResult<SpaceDetails> = call {
        requireSpaceId(spaceId)
        val payload = transport.request("GET", pathFor(spaceId), accessToken?.takeIf(String::isNotBlank))
        parseSpaceDetails(payload.optJSONObject("data") ?: payload)
    }

    fun create(
        request: CreateSpaceRequest,
        accessToken: String,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): SpacesResult<SpaceSummary> = call {
        val token = requireToken(accessToken)
        require(request.title.trim().isNotEmpty()) { "Enter a title for your Space." }
        requireValidKey(idempotencyKey)
        val body = JSONObject()
            .put("title", request.title.trim())
            .put("description", request.description?.trim()?.takeIf(String::isNotEmpty) ?: JSONObject.NULL)
            .put("visibility", request.visibility.wireValue)
            .put("scheduledAt", request.scheduledAt?.takeIf(String::isNotBlank) ?: JSONObject.NULL)
            .put("giftsEnabled", request.giftsEnabled)
        val response = transport.request("POST", SPACES_PATH, token, body, idempotencyKey)
        parseSpaceSummary(response.optJSONObject("data") ?: response)
    }

    fun join(spaceId: String, accessToken: String, idempotencyKey: String = newKey()): SpacesResult<SpaceJoinGrant> = mutate(
        spaceId, "POST", "/join", accessToken, idempotencyKey = idempotencyKey,
    ) { payload ->
        val row = payload.optJSONObject("data") ?: payload
        SpaceJoinGrant(
            spaceId = row.optString("spaceId").ifBlank { spaceId },
            role = SpaceRole.fromWire(row.optString("role")),
            token = row.optString("token").takeIf(String::isNotBlank) ?: error("Nantty returned no Space access token."),
            url = row.optString("url").takeIf(String::isNotBlank) ?: error("Nantty returned no Space media URL."),
            canPublish = row.optBoolean("canPublish"),
            listeners = row.optInt("listeners", 0).coerceAtLeast(0),
        )
    }

    fun leave(spaceId: String, accessToken: String, idempotencyKey: String = newKey()) =
        mutate(spaceId, "POST", "/leave", accessToken, idempotencyKey = idempotencyKey) { Unit }

    fun requestSpeaker(spaceId: String, accessToken: String, idempotencyKey: String = newKey()): SpacesResult<SpaceSpeakerRequest> =
        mutate(spaceId, "POST", "/speaker-requests", accessToken, idempotencyKey = idempotencyKey) { payload ->
            val row = payload.optJSONObject("data") ?: payload
            SpaceSpeakerRequest(
                id = row.optString("id").takeIf(String::isNotBlank) ?: error("Nantty returned no speaker request ID."),
                state = row.optString("state").takeIf(String::isNotBlank) ?: error("Nantty returned no speaker request state."),
            )
        }

    fun approveSpeakerRequest(spaceId: String, requestId: String, accessToken: String, idempotencyKey: String = newKey()) =
        speakerRequestAction(spaceId, requestId, "approve", accessToken, idempotencyKey)

    fun declineSpeakerRequest(spaceId: String, requestId: String, accessToken: String, idempotencyKey: String = newKey()) =
        speakerRequestAction(spaceId, requestId, "decline", accessToken, idempotencyKey)

    fun muteSpeaker(spaceId: String, userId: String, muted: Boolean, accessToken: String, idempotencyKey: String = newKey()) =
        mutate(spaceId, "POST", "/speakers/${segment(userId)}/mute", accessToken, JSONObject().put("muted", muted), idempotencyKey) { Unit }

    fun removeSpeaker(spaceId: String, userId: String, accessToken: String, idempotencyKey: String = newKey()) =
        speakerAction(spaceId, userId, "remove", accessToken, idempotencyKey)

    fun demoteSpeaker(spaceId: String, userId: String, accessToken: String, idempotencyKey: String = newKey()) =
        speakerAction(spaceId, userId, "demote", accessToken, idempotencyKey)

    fun invite(
        spaceId: String,
        accountId: String,
        accessToken: String,
        idempotencyKey: String = newKey(),
        role: SpaceInviteRole = SpaceInviteRole.LISTENER,
        title: String? = null,
    ) = call {
        requireSpaceId(spaceId)
        val token = requireToken(accessToken)
        require(accountId.isNotBlank() && accountId.length <= 80) { "Choose a valid account to invite." }
        requireValidKey(idempotencyKey)
        val normalizedTitle = title?.trim().orEmpty()
        require(normalizedTitle.codePointCount(0, normalizedTitle.length) <= 60) { "Stage titles must be 60 characters or fewer." }
        require(normalizedTitle.none(Character::isISOControl)) { "Stage titles cannot contain control characters." }
        val body = JSONObject().put("accountId", accountId.trim()).put("role", role.wireValue)
        if (normalizedTitle.isNotEmpty()) body.put("title", normalizedTitle)
        transport.request("POST", "${pathFor(spaceId)}/invites", token, body, idempotencyKey)
    }

    fun setCoinDonations(spaceId: String, enabled: Boolean, accessToken: String, idempotencyKey: String = newKey()) =
        mutate(spaceId, "PATCH", "/coin-donations", accessToken, JSONObject().put("enabled", enabled), idempotencyKey) { payload ->
            val row = payload.optJSONObject("data") ?: payload
            row.optBoolean("giftsEnabled", enabled)
        }

    fun start(spaceId: String, accessToken: String, idempotencyKey: String = newKey()) =
        mutate(spaceId, "POST", "/start", accessToken, idempotencyKey = idempotencyKey) { Unit }

    fun end(spaceId: String, accessToken: String, idempotencyKey: String = newKey()) =
        mutate(spaceId, "POST", "/end", accessToken, idempotencyKey = idempotencyKey) { Unit }

    fun cancel(spaceId: String, accessToken: String, idempotencyKey: String = newKey()) =
        mutate(spaceId, "POST", "/cancel", accessToken, idempotencyKey = idempotencyKey) { Unit }

    fun sendCoinDonation(
        spaceId: String,
        coins: Long,
        accessToken: String,
        idempotencyKey: String,
    ): SpacesResult<SpaceDonationReceipt> = call {
        requireSpaceId(spaceId)
        val token = requireToken(accessToken)
        require(coins > 0) { "Enter a positive coin donation." }
        requireValidKey(idempotencyKey)
        val payload = transport.request(
            "POST", "${pathFor(spaceId)}/coin-donations", token,
            JSONObject().put("coins", coins), idempotencyKey,
        )
        val row = payload.optJSONObject("data") ?: payload
        SpaceDonationReceipt(
            id = row.optString("id").takeIf(String::isNotBlank) ?: error("Nantty returned no donation ID."),
            hostUserId = row.optString("hostUserId").takeIf(String::isNotBlank) ?: error("Nantty returned no donation recipient."),
            totalCoins = row.optLong("totalCoins", -1).takeIf { it >= 0 } ?: error("Nantty returned an invalid donation total."),
            senderCoinBalance = row.optLong("senderCoinBalance", -1).takeIf { it >= 0 } ?: error("Nantty returned an invalid coin balance."),
        )
    }

    private fun speakerRequestAction(spaceId: String, requestId: String, action: String, token: String, key: String) =
        mutate(spaceId, "POST", "/speaker-requests/${segment(requestId)}/$action", token, idempotencyKey = key) { Unit }

    private fun speakerAction(spaceId: String, userId: String, action: String, token: String, key: String) =
        mutate(spaceId, "POST", "/speakers/${segment(userId)}/$action", token, idempotencyKey = key) { Unit }

    private fun <T> mutate(
        spaceId: String,
        method: String,
        suffix: String,
        accessToken: String,
        body: JSONObject? = null,
        idempotencyKey: String,
        parse: (JSONObject) -> T,
    ): SpacesResult<T> = call {
        requireSpaceId(spaceId)
        val token = requireToken(accessToken)
        requireValidKey(idempotencyKey)
        parse(transport.request(method, "${pathFor(spaceId)}$suffix", token, body, idempotencyKey))
    }

    private inline fun <T> call(block: () -> T): SpacesResult<T> = try {
        SpacesResult.Success(block())
    } catch (error: SpacesHttpException) {
        SpacesResult.Failure(error.message ?: "Space request failed.", error.statusCode)
    } catch (error: Exception) {
        SpacesResult.Failure(error.message ?: "Space request failed. Please try again.")
    }

    private fun requireToken(token: String): String = token.trim().takeIf(String::isNotEmpty)
        ?: throw SpacesHttpException(HttpURLConnection.HTTP_UNAUTHORIZED, "Sign in to use Spaces.")

    private fun requireSpaceId(spaceId: String) {
        require(spaceId.isNotBlank() && !spaceId.contains('/')) { "That Space could not be found." }
    }

    private fun requireValidKey(key: String) {
        require(key.matches(IDEMPOTENCY_KEY_PATTERN)) { "Could not safely prepare this Space action. Try again." }
    }

    private fun pathFor(id: String) = "$SPACES_PATH/${segment(id)}"

    private fun segment(value: String) = encode(value)

    private fun encode(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")

    private companion object {
        const val SPACES_PATH = "/api/v1/spaces"
        const val PEOPLE_SEARCH_PATH = "/api/v1/search/people"
        const val MIN_INVITE_SEARCH_QUERY_LENGTH = 2
        const val MAX_INVITE_SEARCH_QUERY_LENGTH = 100
        val IDEMPOTENCY_KEY_PATTERN = Regex("^[A-Za-z0-9_-]{8,128}$")
        fun newKey() = UUID.randomUUID().toString()
    }
}

private class JdkSpacesTransport(private val baseUrl: String) : SpacesTransport {
    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, idempotencyKey: String?): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use Spaces.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
            idempotencyKey?.let { setRequestProperty("Idempotency-Key", it) }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBounded).orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(response).optString("message") }.getOrNull()
                    ?.takeIf(String::isNotBlank) ?: "Space request failed (HTTP $status)."
                throw SpacesHttpException(status, message)
            }
            if (response.isBlank()) return JSONObject()
            val trimmed = response.trimStart()
            return if (trimmed.startsWith("[")) JSONObject().put("data", JSONArray(response)) else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large Spaces response." }
            output.write(buffer, 0, count)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object { const val MAX_RESPONSE_BYTES = 1_048_576 }
}

class SpacesHttpException(val statusCode: Int, message: String) : IllegalStateException(message)
