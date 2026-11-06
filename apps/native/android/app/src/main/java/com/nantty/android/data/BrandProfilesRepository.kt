package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class BrandActingProfile(
    val id: String,
    val kind: String,
    val name: String,
    val handle: String,
    val avatarUrl: String?,
    val active: Boolean,
    val onHold: Boolean,
)

data class BrandProfilesState(
    val profiles: List<BrandActingProfile>,
    val activeProfile: BrandActingProfile,
)

sealed interface BrandProfilesResult {
    data class Success(val state: BrandProfilesState) : BrandProfilesResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : BrandProfilesResult
}

sealed interface ActingProfileSwitchResult {
    data class Success(val profile: BrandActingProfile) : ActingProfileSwitchResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ActingProfileSwitchResult
}

interface BrandProfilesTransport {
    fun get(path: String, accessToken: String): JSONObject
    fun put(path: String, accessToken: String, body: JSONObject): JSONObject
}

class BrandProfilesRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val transport: BrandProfilesTransport = JdkBrandProfilesTransport(baseUrl),
    private val sessionProvider: () -> AccountSession? = { null },
) {
    @Volatile private var cachedActiveProfileId: String? = null

    /** Reuses the existing acting-profile endpoint so interaction tracking can exclude owned posts. */
    fun activeProfileIdOrNull(): String? {
        cachedActiveProfileId?.let { return it }
        return runCatching {
            val token = requireSessionToken()
            parseProfile(transport.get(ACTING_PROFILE_PATH, token)).id.also { cachedActiveProfileId = it }
        }.getOrNull()
    }

    fun load(): BrandProfilesResult = try {
        val token = requireSessionToken()
        val profiles = parseProfiles(transport.get(PROFILES_PATH, token))
        val active = parseProfile(transport.get(ACTING_PROFILE_PATH, token))
        require(profiles.any { it.id == active.id }) { "Nantty returned a current profile that is not in your profile list." }
        cachedActiveProfileId = active.id
        BrandProfilesResult.Success(BrandProfilesState(
            profiles = profiles.map { it.copy(active = it.id == active.id) },
            activeProfile = active,
        ))
    } catch (error: Exception) {
        BrandProfilesResult.Failure(
            error.message ?: "Could not load your profiles. Check your connection and try again.",
            authenticationRequired = error is BrandProfilesHttpException && error.statusCode in AUTH_REQUIRED_STATUS,
        )
    }

    fun switchActingProfile(profileId: String): ActingProfileSwitchResult = try {
        require(isSafeProfileId(profileId)) { "This profile is invalid. Refresh your profiles and try again." }
        val token = requireSessionToken()
        val switched = parseProfile(transport.put(ACTING_PROFILE_PATH, token, JSONObject().put("profileId", profileId)))
        require(switched.id == profileId) { "Nantty returned a different profile than the one selected." }
        cachedActiveProfileId = switched.id
        ActingProfileSwitchResult.Success(switched)
    } catch (error: Exception) {
        ActingProfileSwitchResult.Failure(
            error.message ?: "Could not switch profiles. Please try again.",
            authenticationRequired = error is BrandProfilesHttpException && error.statusCode in AUTH_REQUIRED_STATUS,
        )
    }

    internal fun parseProfiles(payload: JSONObject): List<BrandActingProfile> {
        val rows = payload.optJSONArray("data")
            ?: payload.optJSONObject("data")?.optJSONArray("items")
            ?: error("Nantty returned an incomplete profile list.")
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                add(parseProfile(row))
            }
        }.also { require(it.isNotEmpty()) { "Nantty did not return any profiles for this account." } }
    }

    internal fun parseProfile(payload: JSONObject): BrandActingProfile {
        val profile = payload.optJSONObject("data") ?: payload
        val id = profile.optString("id").takeIf(::isSafeProfileId)
            ?: error("Nantty returned an invalid profile.")
        val kind = profile.optString("kind").takeIf { it in PROFILE_KINDS }
            ?: error("Nantty returned an unsupported profile type.")
        val handle = profile.optString("handle").takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete profile.")
        val name = profile.optString("name").takeIf(String::isNotBlank) ?: handle
        return BrandActingProfile(
            id = id,
            kind = kind,
            name = name,
            handle = handle,
            avatarUrl = safeMediaUrl(profile.optNullableString("avatarUrl")),
            active = profile.optBoolean("active"),
            onHold = profile.optBoolean("onHold"),
        )
    }

    private fun requireSessionToken(): String = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
        ?: error("Sign in to view and switch profiles.")

    companion object {
        const val PROFILES_PATH = "/api/v1/users/me/profiles"
        const val ACTING_PROFILE_PATH = "/api/v1/users/me/acting-profile"
        private val PROFILE_KINDS = setOf("person", "creator", "business", "brand", "store", "government")
        private val AUTH_REQUIRED_STATUS = setOf(401, 403)
        private val PROFILE_ID_PATTERN = Regex("[A-Za-z0-9_-]{1,200}")
        private fun isSafeProfileId(value: String): Boolean = PROFILE_ID_PATTERN.matches(value)
    }
}

class BrandProfilesHttpException(val statusCode: Int) : Exception("Profile request failed (HTTP $statusCode). Please try again.")

private fun JSONObject.optNullableString(key: String): String? = optString(key)
    .takeIf { it.isNotBlank() && it != "null" }

private class JdkBrandProfilesTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : BrandProfilesTransport {
    override fun get(path: String, accessToken: String): JSONObject = request("GET", path, accessToken, null)

    override fun put(path: String, accessToken: String, body: JSONObject): JSONObject =
        request("PUT", path, accessToken, body)

    private fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        require(accessToken.isNotBlank()) { "Sign in to view and switch profiles." }
        val origin = trustedApiOrigin(baseUrl)
            ?: error("Configure an HTTPS Nantty API URL to manage profiles.")
        val connection = openConnection(URL(origin + path)).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            body?.let { payload -> connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw BrandProfilesHttpException(status)
            require(response.isNotBlank()) { "Nantty returned an empty profile response." }
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large profile response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}
