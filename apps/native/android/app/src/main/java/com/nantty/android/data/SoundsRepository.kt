package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class SelectableSound(
    val id: String,
    val title: String,
    val ownerName: String,
    val ownerUsername: String,
    val isOriginal: Boolean,
    val allowReuse: Boolean,
    val status: String,
    val usageCount: Int,
)

enum class SoundLibraryScope { TRENDING, SAVED, SEARCH }

sealed interface SoundLibraryResult {
    data class Success(val sounds: List<SelectableSound>) : SoundLibraryResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SoundLibraryResult
}

fun interface SoundsTransport {
    fun get(path: String, accessToken: String?): JSONObject
}

/** Uses the existing Social sounds endpoints and leaves copyright/reuse policy authoritative on the server. */
class SoundsRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession? = { null },
    private val transport: SoundsTransport = JdkSoundsTransport(baseUrl),
) {
    fun list(scope: SoundLibraryScope, query: String? = null): SoundLibraryResult {
        val term = query?.trim().orEmpty()
        if (scope == SoundLibraryScope.SEARCH && term.isBlank()) return SoundLibraryResult.Success(emptyList())
        if (term.length > MAX_QUERY_LENGTH) return SoundLibraryResult.Failure("Sound search is too long. Shorten it and try again.")
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
        if (scope == SoundLibraryScope.SAVED && session == null) {
            return SoundLibraryResult.Failure("Sign in to view saved sounds.", authenticationRequired = true)
        }
        return try {
            SoundLibraryResult.Success(parseSounds(transport.get(buildSoundsPath(scope, term), session?.accessToken)))
        } catch (error: SoundsHttpException) {
            SoundLibraryResult.Failure(
                error.message ?: "Could not load sounds. Please try again.",
                authenticationRequired = error.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED || error.statusCode == HttpURLConnection.HTTP_FORBIDDEN,
            )
        } catch (error: Exception) {
            SoundLibraryResult.Failure(error.message ?: "Could not load sounds. Check your connection and try again.")
        }
    }

    internal fun parseSounds(payload: JSONObject): List<SelectableSound> {
        val envelope = payload.optJSONObject("data") ?: payload
        val rows = envelope.optJSONArray("data") ?: payload.optJSONArray("data") ?: JSONArray()
        val seenIds = mutableSetOf<String>()
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(::isUuid) ?: continue
                if (!seenIds.add(id)) continue
                val owner = row.optJSONObject("owner") ?: JSONObject()
                val status = row.optString("status").takeIf { it in SOUND_STATUSES } ?: "unavailable"
                val title = row.optString("title").takeUnless { it.isBlank() || it == "null" } ?: continue
                add(
                    SelectableSound(
                        id = id,
                        title = title,
                        ownerName = owner.optString("name").takeUnless { it == "null" }.orEmpty(),
                        ownerUsername = owner.optString("username").takeUnless { it == "null" }.orEmpty(),
                        isOriginal = row.optBoolean("isOriginal"),
                        allowReuse = row.optBoolean("allowReuse"),
                        status = status,
                        usageCount = row.optInt("usageCount").coerceAtLeast(0),
                    ),
                )
            }
        }
    }

    private companion object {
        const val MAX_QUERY_LENGTH = 80
        val SOUND_STATUSES = setOf("available", "under_copyright_review", "removed")
    }
}

internal fun buildSoundsPath(scope: SoundLibraryScope, query: String = ""): String = when (scope) {
    SoundLibraryScope.TRENDING -> "/api/v1/sounds/trending?limit=20"
    SoundLibraryScope.SAVED -> "/api/v1/sounds/saved?limit=20"
    SoundLibraryScope.SEARCH -> "/api/v1/sounds?q=${URLEncoder.encode(query.trim(), Charsets.UTF_8.name())}&limit=20"
}

private class JdkSoundsTransport(private val baseUrl: String) : SoundsTransport {
    override fun get(path: String, accessToken: String?): JSONObject {
        require(path.startsWith("/api/v1/sounds?limit=") || path.startsWith("/api/v1/sounds?q=") || path == "/api/v1/sounds/trending?limit=20" || path == "/api/v1/sounds/saved?limit=20") {
            "Unsupported sound-library request."
        }
        val origin = baseUrl.trim().trimEnd('/')
        val parsed = runCatching { URL(origin) }.getOrElse { error("Sounds unavailable: the configured API address is invalid.") }
        require(origin.isNotBlank() && (parsed.protocol == "https" || (parsed.protocol == "http" && parsed.host == "10.0.2.2"))) {
            "Sounds unavailable: the API address must use HTTPS (emulator development may use 10.0.2.2)."
        }
        val connection = URL("$origin$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
            accessToken?.takeIf(String::isNotBlank)?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(body).optString("message").takeIf(String::isNotBlank) }.getOrNull()
                throw SoundsHttpException(status, message ?: "Sound request failed (HTTP $status). Please try again.")
            }
            return JSONObject(body)
        } finally {
            connection.disconnect()
        }
    }
}

private class SoundsHttpException(val statusCode: Int, message: String) : Exception(message)

private fun isUuid(value: String): Boolean = runCatching { java.util.UUID.fromString(value).toString() == value.lowercase() }.getOrDefault(false)
