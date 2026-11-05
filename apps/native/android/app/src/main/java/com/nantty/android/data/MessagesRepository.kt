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

enum class MessagesFilter(val apiValue: String, val label: String) {
    ALL("all", "All Messages"),
    DIRECT("direct", "Direct Messages"),
}

enum class MessagesInboxFolder(val apiValue: String, val label: String) {
    CHATS("chats", "Chats"), REQUESTS("requests", "Requests"), SPAM("spam", "Spam"),
}

data class InboxConversation(
    val id: String,
    val title: String,
    val peerName: String,
    val avatarUrl: String?,
    val type: ConversationType,
    val lastMessageAt: String,
    val unreadCount: Int,
    val inboxFolder: MessagesInboxFolder = MessagesInboxFolder.CHATS,
    val spamReason: String? = null,
)

data class ConversationPage(val conversations: List<InboxConversation>, val nextCursor: String?)

/** The server exposes only the encrypted envelope. Plaintext is never accepted in this model. */
data class EncryptedChatMessage(
    val id: String,
    val conversationId: String,
    val senderId: String,
    val createdAt: String,
    val kind: String,
    val ciphertext: String?,
    val protocol: String?,
    val moderationHidden: Boolean,
)
data class ChatMessagePage(val messages: List<EncryptedChatMessage>, val nextCursor: String?)

sealed interface MessagesResult {
    data class Success(val page: ConversationPage) : MessagesResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : MessagesResult
}

sealed interface ConversationLookupResult {
    data class Success(val conversation: InboxConversation) : ConversationLookupResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ConversationLookupResult
}

sealed interface ChatHistoryResult {
    data class Success(val page: ChatMessagePage, val continuationError: String? = null) : ChatHistoryResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ChatHistoryResult
}

fun interface MessagesTransport {
    fun get(path: String, accessToken: String): JSONObject
}

fun interface ChatThreadTransport {
    fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject
}

class MessagesRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession?,
    private val transport: MessagesTransport = JdkMessagesTransport(baseUrl),
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val threadTransport: ChatThreadTransport = JdkChatThreadTransport(baseUrl),
) {
    private val conversationSearchRepository = ConversationSearchRepository(sessionProvider, threadTransport, refreshSessionProvider)

    fun search(query: String) = conversationSearchRepository.search(query)

    fun startConversationWithPerson(personId: String) = conversationSearchRepository.startConversationWithPerson(personId)

    fun loadConversationById(conversationId: String): ConversationLookupResult {
        return try {
            require(isUuid(conversationId)) { "This conversation link is invalid." }
            val session = sessionProvider() ?: error("Sign in to view this conversation.")
            val token = requireToken(session.accessToken)
            val path = "/api/v1/conversations/$conversationId"
            val payload = try {
                threadTransport.request("GET", path, token, null)
            } catch (error: MessagesHttpException) {
                if (error.statusCode != 401) throw error
                val refreshedToken = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                    ?: return ConversationLookupResult.Failure("Your session has expired. Sign in again to view messages.", true)
                threadTransport.request("GET", path, requireToken(refreshedToken), null)
            }
            val row = payload.optJSONObject("data") ?: payload
            val conversation = parsePage(JSONObject().put("data", org.json.JSONArray().put(row))).conversations.singleOrNull()
                ?: error("Nantty returned an incomplete conversation response.")
            ConversationLookupResult.Success(conversation)
        } catch (error: Exception) {
            ConversationLookupResult.Failure(
                error.message ?: "Could not open this conversation. Check your connection and try again.",
                authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
            )
        }
    }

    fun load(
        cursor: String? = null,
        filter: MessagesFilter = MessagesFilter.ALL,
        folder: MessagesInboxFolder = MessagesInboxFolder.CHATS,
    ): MessagesResult = try {
        val session = sessionProvider() ?: error("Sign in to view your messages.")
        val token = session.accessToken.takeIf(String::isNotBlank) ?: error("Sign in to view your messages.")
        require(cursor == null || (cursor.length <= MAX_CURSOR_LENGTH && cursor.matches(UUID_PATTERN))) {
            "This inbox page cursor is invalid. Refresh your messages and try again."
        }
        val path = buildConversationPath(filter, cursor, folder)
        val payload = try {
            transport.get(path, token)
        } catch (error: MessagesHttpException) {
            if (error.statusCode != 401) throw error
            val refreshedToken = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: return MessagesResult.Failure("Your session has expired. Sign in again to view messages.", authenticationRequired = true)
            transport.get(path, refreshedToken)
        }
        MessagesResult.Success(parsePage(payload))
    } catch (error: Exception) {
        MessagesResult.Failure(
            error.message ?: "Could not load messages. Check your connection and try again.",
            authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
        )
    }

    fun acceptMessageRequest(conversationId: String) = inboxAction(conversationId, "POST", "accept")
    fun markConversationNotSpam(conversationId: String) = inboxAction(conversationId, "POST", "not-spam")
    fun deleteMessageRequest(conversationId: String) = inboxAction(conversationId, "DELETE", "")
    fun blockConversationPeer(conversationId: String) = inboxAction(conversationId, "POST", "block")

    private fun inboxAction(conversationId: String, method: String, suffix: String): Result<Unit> = runCatching {
        require(isUuid(conversationId)) { "This conversation link is invalid." }
        val session = sessionProvider() ?: error("Sign in to manage message requests.")
        val path = "/api/v1/conversations/$conversationId" + if (suffix.isEmpty()) "" else "/$suffix"
        try {
            threadTransport.request(method, path, requireToken(session.accessToken), null)
        } catch (error: MessagesHttpException) {
            if (error.statusCode != 401) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw MessagesHttpException(401)
            threadTransport.request(method, path, refreshed, null)
        }
        Unit
    }

    fun loadMessages(conversationId: String, cursor: String? = null, after: String? = null): ChatHistoryResult = try {
        require(isUuid(conversationId)) { "This conversation link is invalid." }
        require(cursor == null || isUuid(cursor)) { "This message page cursor is invalid. Refresh the conversation and try again." }
        require(after == null || isUuid(after)) { "This message sync cursor is invalid. Refresh the conversation and try again." }
        require(cursor == null || after == null) { "Choose either an older-page cursor or a newer-message cursor." }
        val session = sessionProvider() ?: error("Sign in to view this conversation.")
        val path = buildMessageHistoryPath(conversationId, cursor, after)
        val payload = try {
            threadTransport.request("GET", path, requireToken(session.accessToken), null)
        } catch (error: MessagesHttpException) {
            if (error.statusCode != 401) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: return ChatHistoryResult.Failure("Your session has expired. Sign in again to view messages.", true)
            threadTransport.request("GET", path, refreshed, null)
        }
        ChatHistoryResult.Success(parseMessagePage(conversationId, payload))
    } catch (error: Exception) {
        ChatHistoryResult.Failure(
            error.message ?: "Could not load this conversation. Check your connection and try again.",
            authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
        )
    }

    /** Uses the verified Social API `after` contract for incremental conversation synchronization. */
    fun loadMessagesAfter(conversationId: String, messageId: String): ChatHistoryResult =
        loadMessages(conversationId, after = messageId)

    /** Loads the most recent page and follows older cursors, emitting each accumulated page as it arrives. */
    fun loadInitialHistory(
        conversationId: String,
        onPageLoaded: (ChatMessagePage) -> Unit = {},
    ): ChatHistoryResult {
        var cursor: String? = null
        var accumulated: ChatMessagePage? = null

        repeat(MAX_INITIAL_HISTORY_PAGES) {
            when (val loaded = loadMessages(conversationId, cursor)) {
                is ChatHistoryResult.Failure -> {
                    val existing = accumulated ?: return loaded
                    return ChatHistoryResult.Success(existing, continuationError = loaded.message)
                }
                is ChatHistoryResult.Success -> {
                    val previous = accumulated
                    val merged = if (previous == null) {
                        loaded.page
                    } else {
                        ChatMessagePage(
                            messages = (previous.messages + loaded.page.messages).distinctBy(EncryptedChatMessage::id),
                            nextCursor = loaded.page.nextCursor,
                        )
                    }
                    accumulated = merged
                    onPageLoaded(merged)
                    cursor = loaded.page.nextCursor ?: return ChatHistoryResult.Success(merged)
                }
            }
        }

        return ChatHistoryResult.Success(checkNotNull(accumulated))
    }

    fun markConversationRead(conversationId: String): Result<Unit> = runCatching {
        require(isUuid(conversationId)) { "This conversation link is invalid." }
        val session = sessionProvider() ?: error("Sign in to update this conversation.")
        val path = "/api/v1/conversations/$conversationId/read"
        try {
            threadTransport.request("POST", path, requireToken(session.accessToken), JSONObject())
        } catch (error: MessagesHttpException) {
            if (error.statusCode != 401) throw error
            val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw MessagesHttpException(401)
            threadTransport.request("POST", path, refreshed, JSONObject())
        }
        Unit
    }

    internal fun parseMessagePage(conversationId: String, payload: JSONObject): ChatMessagePage {
        val page = payload.optJSONObject("data") ?: payload
        val rows = page.optJSONArray("data") ?: page.optJSONArray("items")
            ?: error("Nantty returned an incomplete conversation response.")
        val messages = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id").takeIf(::isUuid) ?: continue
                if (row.optString("conversationId") != conversationId) continue
                val senderId = row.optString("senderId").takeIf(::isUuid) ?: continue
                val createdAt = row.optString("createdAt").takeIf(String::isNotBlank) ?: continue
                val envelope = row.optJSONObject("encryption")
                // A hidden/deleted item or missing envelope is represented as unavailable, never as plaintext.
                add(EncryptedChatMessage(
                    id = id,
                    conversationId = conversationId,
                    senderId = senderId,
                    createdAt = createdAt,
                    kind = row.optString("kind").takeIf(String::isNotBlank) ?: "text",
                    ciphertext = envelope?.optNullable("ciphertext"),
                    protocol = envelope?.optNullable("protocol"),
                    moderationHidden = row.optBoolean("moderationHidden"),
                ))
            }
        }
        val next = page.optNullable("nextCursor")?.also {
            require(isUuid(it)) { "Nantty returned an invalid message cursor." }
        }
        return ChatMessagePage(messages, next)
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
                val inboxFolder = MessagesInboxFolder.entries.firstOrNull { it.apiValue == row.optString("inboxFolder") }
                    ?: MessagesInboxFolder.CHATS
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
                        inboxFolder = inboxFolder,
                        spamReason = row.optNullable("spamReason"),
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
        const val MAX_INITIAL_HISTORY_PAGES = 10
        const val MAX_CURSOR_LENGTH = 36
        private val UUID_PATTERN = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}")
        internal fun isUuid(value: String) = UUID_PATTERN.matches(value)
        private fun requireToken(token: String) = token.takeIf(String::isNotBlank) ?: error("Sign in to view this conversation.")
    }
}

internal fun buildConversationPath(
    filter: MessagesFilter = MessagesFilter.ALL,
    cursor: String? = null,
    folder: MessagesInboxFolder = MessagesInboxFolder.CHATS,
): String = buildString {
    append("/api/v1/conversations?")
    if (folder == MessagesInboxFolder.CHATS) append("filter=${java.net.URLEncoder.encode(filter.apiValue, Charsets.UTF_8.name())}")
    else append("folder=${java.net.URLEncoder.encode(folder.apiValue, Charsets.UTF_8.name())}")
    append("&limit=${MessagesRepository.PAGE_SIZE}")
    cursor?.takeIf(String::isNotBlank)?.let { append("&cursor=${java.net.URLEncoder.encode(it, Charsets.UTF_8.name())}") }
}

private fun JSONObject.optNullable(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }


private class JdkMessagesTransport(private val baseUrl: String) : MessagesTransport {
    override fun get(path: String, accessToken: String): JSONObject {
        require(
            path.startsWith("/api/v1/conversations?filter=all&limit=20") ||
                path.startsWith("/api/v1/conversations?filter=direct&limit=20") ||
                path.startsWith("/api/v1/conversations?folder=requests&limit=20") ||
                path.startsWith("/api/v1/conversations?folder=spam&limit=20"),
        ) { "Unsupported messages request." }
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

private class JdkChatThreadTransport(private val baseUrl: String) : ChatThreadTransport {
    override fun request(method: String, path: String, accessToken: String, body: JSONObject?): JSONObject {
        val endpointPath = path.substringBefore('?')
        val supportedRequest = when {
            endpointPath.startsWith("/api/v1/conversations/") && endpointPath.endsWith("/messages") -> method == "GET"
            endpointPath.startsWith("/api/v1/conversations/") && endpointPath.endsWith("/read") -> method == "POST"
            endpointPath.matches(Regex("/api/v1/conversations/[0-9a-fA-F-]{36}(/(accept|block|not-spam))?")) -> method == "POST" || method == "DELETE"
            endpointPath == "/api/v1/conversations/search" -> method == "GET"
            endpointPath == "/api/v1/conversations" -> method == "POST"
            else -> false
        }
        require(supportedRequest) { "Unsupported conversation request." }
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to use messages.")
        val connection = (URL(origin + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            body?.let { connection.outputStream.use { out -> out.write(it.toString().toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            if (status !in 200..299) throw MessagesHttpException(status)
            val response = (if (status == HttpURLConnection.HTTP_NO_CONTENT) null else connection.inputStream)?.use(::readThreadResponse).orEmpty()
            return if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally { connection.disconnect() }
    }

    private fun readThreadResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= 1_048_576) { "Nantty returned an unexpectedly large conversation response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }
}

internal fun buildMessageHistoryPath(conversationId: String, cursor: String? = null, after: String? = null): String = buildString {
    require(MessagesRepository.isUuid(conversationId)) { "This conversation link is invalid." }
    require(cursor == null || after == null) { "Choose either an older-page cursor or a newer-message cursor." }
    append("/api/v1/conversations/$conversationId/messages?limit=30")
    cursor?.takeIf(String::isNotBlank)?.let {
        require(MessagesRepository.isUuid(it)) { "This message page cursor is invalid." }
        append("&cursor=${java.net.URLEncoder.encode(it, Charsets.UTF_8.name())}")
    }
    after?.takeIf(String::isNotBlank)?.let {
        require(MessagesRepository.isUuid(it)) { "This message sync cursor is invalid. Refresh the conversation and try again." }
        append("&after=${java.net.URLEncoder.encode(it, Charsets.UTF_8.name())}")
    }
}

internal class MessagesHttpException(val statusCode: Int) : Exception(
    if (statusCode == 401 || statusCode == 403) "Your session has expired. Sign in again to view messages."
    else "Messages request failed (HTTP $statusCode). Please try again.",
)

internal fun isSecureImageUrl(value: String): Boolean = runCatching {
    val uri = java.net.URI(value)
    uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.userInfo == null
}.getOrDefault(false)
