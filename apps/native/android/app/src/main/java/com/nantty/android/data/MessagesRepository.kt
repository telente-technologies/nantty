package com.nantty.android.data

import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

enum class ConversationType(val apiValue: String, val label: String) {
    DIRECT("direct", "Direct message"), GROUP("group", "Group"), CHANNEL("channel", "Channel"), BUSINESS("business", "Business");

    companion object {
        fun from(value: String) = entries.firstOrNull { it.apiValue == value } ?: DIRECT
    }
}

data class InboxConversation(
    val id: String,
    val title: String,
    val peerName: String,
    val avatarUrl: String?,
    val type: ConversationType,
    val lastMessageAt: String,
    val unreadCount: Int,
)

data class ConversationPage(val conversations: List<InboxConversation>, val nextCursor: String?)

sealed interface MessagesResult {
    data class Success(val page: ConversationPage) : MessagesResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : MessagesResult
}

fun interface MessagesTransport {
    fun get(path: String, accessToken: String): JSONObject
}

class MessagesRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: MessagesTransport = JdkMessagesTransport(baseUrl),
) {
    fun load(cursor: String? = null): MessagesResult = try {
        val session = sessionProvider() ?: error("Sign in to view your messages.")
        val token = session.accessToken.takeIf(String::isNotBlank) ?: error("Sign in to view your messages.")
        require(cursor == null || (cursor.length <= MAX_CURSOR_LENGTH && cursor.matches(UUID_PATTERN))) {
            "This inbox page cursor is invalid. Refresh your messages and try again."
        }
        MessagesResult.Success(parsePage(transport.get(buildConversationPath(cursor), token)))
    } catch (error: Exception) {
        MessagesResult.Failure(
            error.message ?: "Could not load messages. Check your connection and try again.",
            authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
        )
    }

    internal fun parsePage(payload: JSONObject): ConversationPage {
        val envelope = payload.optJSONObject("data")
        val page = envelope ?: payload
        val rows = page.optJSONArray("data") ?: envelope?.optJSONArray("items")
            ?: error("Nantty returned an incomplete messages response.")
        val conversations = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf { it.matches(UUID_PATTERN) } ?: continue
                val type = ConversationType.from(row.optString("kind"))
                val peer = row.optJSONObject("peer")
                val store = row.optJSONObject("store")
                val peerName = peer?.optNullable("name") ?: "Nantty member"
                val explicitTitle = row.optNullable("title")
                val title = when (type) {
                    ConversationType.GROUP -> explicitTitle ?: "Group"
                    ConversationType.CHANNEL -> explicitTitle ?: peerName
                    ConversationType.BUSINESS -> store?.optNullable("name") ?: explicitTitle ?: peerName
                    ConversationType.DIRECT -> peerName
                }
                val timestamp = row.optNullable("lastMessageAt") ?: continue
                add(
                    InboxConversation(
                        id = id,
                        title = title,
                        peerName = peerName,
                        avatarUrl = when (type) {
                            ConversationType.GROUP, ConversationType.CHANNEL -> row.optNullable("photoUrl")
                            ConversationType.BUSINESS -> store?.optNullable("avatarUrl")
                            ConversationType.DIRECT -> peer?.optNullable("avatarUrl")
                        }?.takeIf(::isSecureImageUrl),
                        type = type,
                        lastMessageAt = timestamp,
                        unreadCount = row.optInt("unread").coerceAtLeast(0),
                    ),
                )
            }
        }
        val cursor = page.optNullable("nextCursor")?.also {
            require(it.length <= MAX_CURSOR_LENGTH && it.matches(UUID_PATTERN)) { "Nantty returned an invalid messages cursor." }
        }
        return ConversationPage(conversations, cursor)
    }

    companion object {
        const val PAGE_SIZE = 20
        const val MAX_CURSOR_LENGTH = 36
        private val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}")
    }
}

internal fun buildConversationPath(cursor: String? = null): String = buildString {
    append("/api/v1/conversations?folder=chats&filter=all&limit=${MessagesRepository.PAGE_SIZE}")
    cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${java.net.URLEncoder.encode(it, Charsets.UTF_8.name())}") }
}

private fun JSONObject.optNullable(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun isSecureImageUrl(value: String): Boolean = runCatching {
    val uri = java.net.URI(value)
    uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.userInfo == null
}.getOrDefault(false)

private class JdkMessagesTransport(private val baseUrl: String) : MessagesTransport {
    override fun get(path: String, accessToken: String): JSONObject {
        require(path.startsWith("/api/v1/conversations?folder=chats&filter=all&limit=20")) { "Unsupported messages request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to view messages.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)?.use(::readBounded).orEmpty()
            if (status !in 200..299) throw MessagesHttpException(status)
            return JSONObject(body)
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
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large messages response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    companion object { private const val MAX_RESPONSE_BYTES = 1_048_576 }
}

internal class MessagesHttpException(val statusCode: Int) : Exception(
    if (statusCode == 401 || statusCode == 403) "Your session has expired. Sign in again to view messages."
    else "Messages request failed (HTTP $statusCode). Please try again.",
)
