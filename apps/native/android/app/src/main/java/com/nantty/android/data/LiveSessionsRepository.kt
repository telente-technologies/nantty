package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

data class LiveHostSummary(
    val id: String,
    val name: String,
    val username: String,
    val avatarUrl: String?,
    val verified: Boolean,
    val followers: Int,
    val following: Int,
)

data class SuggestedLiveCard(
    val id: String,
    val host: LiveHostSummary,
    val title: String,
    val coverUrl: String?,
)

data class LiveSessionSnapshot(
    val id: String,
    val host: LiveHostSummary,
    val title: String,
    val category: String,
    val status: String,
    val visibility: String,
    val viewers: Int,
    val startedAt: String?,
    val coverUrl: String?,
    val liveKitUrl: String?,
    val coinSupportEnabled: Boolean,
    val hostIsCreator: Boolean,
    val isFollowingHost: Boolean,
    val accessAllowed: Boolean,
    val accessReason: String?,
)

data class LiveMediaGrant(val url: String, val token: String, val canPublish: Boolean, val role: String)
data class SuggestedLivePage(val items: List<SuggestedLiveCard>, val nextCursor: String?)

sealed interface LiveSessionsResult<out T> {
    data class Success<T>(val value: T) : LiveSessionsResult<T>
    data class Failure(
        val message: String,
        val statusCode: Int? = null,
        val authenticationRequired: Boolean = false,
        val retryable: Boolean = false,
    ) : LiveSessionsResult<Nothing>
}

interface LiveSessionsTransport {
    fun request(method: String, path: String, accessToken: String?, body: JSONObject? = null, idempotencyKey: String? = null): JSONObject
}

/** Session and media contracts for ordinary Lives; Spaces use their separate repository and API. */
class LiveSessionsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: LiveSessionsTransport = JdkLiveSessionsTransport(baseUrl),
) {
    fun suggested(): LiveSessionsResult<SuggestedLivePage> = authenticatedRequest { token ->
        val payload = transport.request("GET", "$LIVE_PATH/suggested", token)
        val root = payload.optJSONObject("data") ?: payload
        val rows = root.optJSONArray("data") ?: root.optJSONArray("items")
            ?: error("Nantty returned an incomplete Suggested Lives page.")
        val items = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                add(parseSuggestedLive(row))
            }
        }
        SuggestedLivePage(items, root.optNullableString("nextCursor") ?: payload.optNullableString("nextCursor"))
    }

    fun load(liveId: String): LiveSessionsResult<LiveSessionSnapshot> {
        if (!SAFE_ID.matches(liveId)) return LiveSessionsResult.Failure("This live link is invalid.")
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
        return requestWithOptionalRefresh("GET", "$LIVE_PATH/${segment(liveId)}", token, null, null, ::parseLiveSession)
    }

    fun join(liveId: String): LiveSessionsResult<Unit> = mutate(liveId, "/join") { Unit }

    fun leave(liveId: String): LiveSessionsResult<Unit> = mutate(liveId, "/leave") { Unit }

    fun issueMediaToken(liveId: String): LiveSessionsResult<LiveMediaGrant> = mutate(liveId, "/media-token") { payload ->
        val row = payload.optJSONObject("data") ?: payload
        val url = row.optString("url").takeIf(::isSecureLiveKitUrl)
            ?: error("Nantty returned an invalid Live media URL.")
        val token = row.optString("token").takeIf(String::isNotBlank)
            ?: error("Nantty returned no Live media token.")
        val role = row.optString("role").takeIf { it in LIVE_ROLES }
            ?: error("Nantty returned an invalid Live media role.")
        LiveMediaGrant(url, token, row.optBoolean("canPublish"), role)
    }

    fun setCoinSupport(liveId: String, enabled: Boolean, idempotencyKey: String = UUID.randomUUID().toString()): LiveSessionsResult<Boolean> {
        if (!SAFE_KEY.matches(idempotencyKey)) return LiveSessionsResult.Failure("This Live setting update is invalid.")
        return mutate(liveId, "/coin-support", "PATCH", JSONObject().put("enabled", enabled), idempotencyKey) { payload ->
            val row = payload.optJSONObject("data") ?: payload
            require(row.optString("liveId").let { it.isBlank() || it == liveId }) { "Nantty returned a different Live setting update." }
            row.optBoolean("giftsEnabled", !enabled).let { returned ->
                require(returned == enabled) { "Nantty did not confirm the Live coin-support setting." }
                returned
            }
        }
    }

    private fun <T> mutate(
        liveId: String,
        suffix: String,
        method: String = "POST",
        body: JSONObject? = null,
        idempotencyKey: String? = null,
        parse: (JSONObject) -> T,
    ): LiveSessionsResult<T> {
        if (!SAFE_ID.matches(liveId)) return LiveSessionsResult.Failure("This live link is invalid.")
        if (idempotencyKey != null && !SAFE_KEY.matches(idempotencyKey)) return LiveSessionsResult.Failure("This Live request is invalid.")
        val path = "$LIVE_PATH/${segment(liveId)}$suffix"
        return authenticatedRequest { token -> parse(transport.request(method, path, token, body, idempotencyKey)) }
    }

    private fun <T> authenticatedRequest(request: (String) -> T): LiveSessionsResult<T> {
        val token = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: return LiveSessionsResult.Failure("Sign in to continue to Live.", HttpURLConnection.HTTP_UNAUTHORIZED, authenticationRequired = true)
        return try {
            LiveSessionsResult.Success(request(token))
        } catch (error: LiveSessionsHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) failure(error)
            else {
                val refreshed = runCatching { refreshSessionProvider()?.accessToken }.getOrNull()?.takeIf(String::isNotBlank)
                    ?: return LiveSessionsResult.Failure("Your session has expired. Sign in again to continue.", error.statusCode, authenticationRequired = true)
                try {
                    LiveSessionsResult.Success(request(refreshed))
                } catch (retryError: LiveSessionsHttpException) {
                    failure(retryError)
                } catch (_: Exception) {
                    LiveSessionsResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true)
                }
            }
        } catch (_: Exception) {
            LiveSessionsResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true)
        }
    }

    private fun <T> requestWithOptionalRefresh(
        method: String,
        path: String,
        initialToken: String?,
        body: JSONObject?,
        idempotencyKey: String?,
        request: (JSONObject) -> T,
    ): LiveSessionsResult<T> = try {
        val payload = transport.request(method, path, initialToken, body, idempotencyKey)
        LiveSessionsResult.Success(request(payload))
    } catch (error: LiveSessionsHttpException) {
        if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED || initialToken.isNullOrBlank()) {
            failure(error)
        } else {
            val refreshed = runCatching { refreshSessionProvider()?.accessToken }.getOrNull()?.takeIf(String::isNotBlank)
                ?: return LiveSessionsResult.Failure("Your session has expired. Sign in again to continue.", error.statusCode, authenticationRequired = true)
            try {
                LiveSessionsResult.Success(request(transport.request(method, path, refreshed, body, idempotencyKey)))
            } catch (retryError: LiveSessionsHttpException) {
                failure(retryError)
            } catch (_: Exception) {
                LiveSessionsResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true)
            }
        }
    } catch (_: Exception) {
        LiveSessionsResult.Failure("Couldn't reach Nantty. Check your connection and try again.", retryable = true)
    }

    private fun <T> failure(error: LiveSessionsHttpException): LiveSessionsResult<T> = LiveSessionsResult.Failure(
        message = when (error.statusCode) {
            HttpURLConnection.HTTP_UNAUTHORIZED -> "Your session has expired. Sign in again to continue."
            403 -> "You can’t access this Live."
            404 -> "This Live is no longer available."
            409 -> "This Live has ended or is not accepting connections."
            422 -> "This Live action is not available right now."
            429 -> "Too many requests. Wait a moment and try again."
            else -> "Nantty couldn’t complete this Live action. Please try again."
        },
        statusCode = error.statusCode,
        authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED,
        retryable = error.statusCode == 408 || error.statusCode == 429 || error.statusCode >= 500,
    )

    private companion object {
        const val LIVE_PATH = "/api/v1/lives"
        val SAFE_ID = Regex("^[A-Za-z0-9_-]{1,80}$")
        val SAFE_KEY = Regex("^[A-Za-z0-9_-]{8,128}$")
        val LIVE_ROLES = setOf("host", "guest", "viewer")
    }
}

internal class JdkLiveSessionsTransport(private val baseUrl: String) : LiveSessionsTransport {
    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, idempotencyKey: String?): JSONObject {
        require(method in setOf("GET", "POST", "PATCH"))
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL before opening Live.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            idempotencyKey?.let { setRequestProperty("Idempotency-Key", it) }
        }
        try {
            body?.let { requestBody -> connection.outputStream.use { it.write(requestBody.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readLiveResponse).orEmpty()
            if (status !in 200..299) throw LiveSessionsHttpException(status)
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }
}

private fun parseSuggestedLive(row: JSONObject): SuggestedLiveCard {
    val id = row.optString("id").takeIf { SAFE_LIVE_ID.matches(it) }
        ?: error("Nantty returned an invalid Suggested Live ID.")
    val hostRow = row.optJSONObject("host") ?: error("Nantty returned no Suggested Live host.")
    return SuggestedLiveCard(id, parseLiveHost(hostRow), row.optString("title"), row.optNullableString("coverUrl")?.let(::safeMediaUrl))
}

private fun parseLiveSession(payload: JSONObject): LiveSessionSnapshot {
    val row = payload.optJSONObject("data") ?: payload
    val id = row.optString("id").takeIf { SAFE_LIVE_ID.matches(it) }
        ?: error("Nantty returned an invalid Live session.")
    val hostRow = row.optJSONObject("host") ?: error("Nantty returned no Live host.")
    val media = row.optJSONObject("media")
    val access = row.optJSONObject("access")
    val status = row.optString("status").takeIf { it in LIVE_STATUSES }
        ?: error("Nantty returned an invalid Live status.")
    return LiveSessionSnapshot(
        id = id,
        host = parseLiveHost(hostRow),
        title = row.optString("title"),
        category = row.optString("category"),
        status = status,
        visibility = row.optString("visibility"),
        viewers = row.optInt("viewers", -1).takeIf { it >= 0 } ?: error("Nantty returned an invalid Live viewer count."),
        startedAt = row.optNullableString("startedAt"),
        coverUrl = row.optNullableString("coverUrl")?.let(::safeMediaUrl),
        liveKitUrl = media?.optString("livekitUrl")?.takeIf(::isSecureLiveKitUrl),
        coinSupportEnabled = row.optBoolean("giftsEnabled"),
        hostIsCreator = row.optBoolean("hostIsCreator"),
        isFollowingHost = row.optBoolean("isFollowingHost"),
        accessAllowed = access?.optBoolean("allowed", true) ?: true,
        accessReason = access?.optNullableString("reason"),
    )
}

private fun parseLiveHost(row: JSONObject): LiveHostSummary {
    val id = row.optString("id").takeIf { SAFE_LIVE_ID.matches(it) }
        ?: error("Nantty returned an invalid Live host.")
    val username = row.optString("username").trim().removePrefix("@").takeIf(String::isNotBlank)
        ?: error("Nantty returned an invalid Live host username.")
    return LiveHostSummary(
        id = id,
        name = row.optString("name").ifBlank { username },
        username = username,
        avatarUrl = row.optNullableString("avatarUrl")?.let(::safeMediaUrl),
        verified = row.optBoolean("verified"),
        followers = row.optInt("followers", 0).coerceAtLeast(0),
        following = row.optInt("following", 0).coerceAtLeast(0),
    )
}

private fun isSecureLiveKitUrl(value: String): Boolean = runCatching {
    val uri = URI(value)
    uri.scheme.equals("wss", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.rawUserInfo == null && uri.fragment == null
}.getOrDefault(false)

private fun readLiveResponse(input: java.io.InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(8_192)
    while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        require(output.size() + read <= MAX_LIVE_RESPONSE_BYTES) { "Nantty returned an unexpectedly large Live response." }
        output.write(buffer, 0, read)
    }
    return output.toString(Charsets.UTF_8.name())
}

private fun JSONObject.optNullableString(key: String): String? = opt(key)?.let { value ->
    value.takeUnless { it == JSONObject.NULL }?.toString()?.takeIf(String::isNotBlank)
}

private fun segment(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
internal class LiveSessionsHttpException(val statusCode: Int) : Exception()

private const val MAX_LIVE_RESPONSE_BYTES = 512 * 1024
private val SAFE_LIVE_ID = Regex("^[A-Za-z0-9_-]{1,80}$")
private val LIVE_STATUSES = setOf("upcoming", "live", "ended")
