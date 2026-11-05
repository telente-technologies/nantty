package com.nantty.android.data

import org.json.JSONObject
import java.net.URLEncoder

data class ChatSearchPerson(val id: String, val name: String, val avatarUrl: String?)
data class ChatSearchConversation(val id: String, val peer: ChatSearchPerson)
data class ChatSearchResults(val conversations: List<ChatSearchConversation>, val people: List<ChatSearchPerson>)

sealed interface ChatSearchResult {
    data class Success(val results: ChatSearchResults) : ChatSearchResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ChatSearchResult
}

sealed interface StartConversationResult {
    data class Success(val conversation: InboxConversation) : StartConversationResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : StartConversationResult
}

/** Server-backed inbox search and direct-conversation start contracts. Message bodies stay opaque. */
internal class ConversationSearchRepository(
    private val sessionProvider: () -> AccountSession?,
    private val transport: ChatThreadTransport,
    private val refreshSessionProvider: () -> AccountSession? = { null },
) {
    companion object { const val MAX_SEARCH_QUERY_LENGTH = 100 }

    fun search(query: String): ChatSearchResult = try {
        val path = buildConversationSearchPath(query)
        val session = sessionProvider() ?: error("Sign in to search your messages.")
        val payload = requestWithRefresh("GET", path, requireToken(session.accessToken), null)
        ChatSearchResult.Success(parseSearchResults(payload))
    } catch (error: Exception) {
        ChatSearchResult.Failure(
            error.message ?: "Could not search messages. Check your connection and try again.",
            authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
        )
    }

    fun startConversationWithPerson(personId: String): StartConversationResult = try {
        require(MessagesRepository.isUuid(personId)) { "This Nantty member is unavailable." }
        val session = sessionProvider() ?: error("Sign in to start a conversation.")
        val payload = requestWithRefresh(
            "POST",
            "/api/v1/conversations",
            requireToken(session.accessToken),
            JSONObject().put("userId", personId),
        )
        StartConversationResult.Success(parseStartedConversation(payload))
    } catch (error: Exception) {
        StartConversationResult.Failure(
            error.message ?: "Could not start a conversation. Please try again.",
            authenticationRequired = error is MessagesHttpException && error.statusCode in setOf(401, 403),
        )
    }

    private fun requestWithRefresh(method: String, path: String, token: String, body: JSONObject?): JSONObject = try {
        transport.request(method, path, token, body)
    } catch (error: MessagesHttpException) {
        if (error.statusCode != 401) throw error
        val refreshed = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw MessagesHttpException(401)
        transport.request(method, path, refreshed, body)
    }

    private fun parseSearchResults(payload: JSONObject): ChatSearchResults {
        val envelope = payload.optJSONObject("data") ?: payload
        val conversations = buildList {
            val rows = envelope.optJSONArray("conversations") ?: return@buildList
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optNullable("id")?.takeIf { MessagesRepository.isUuid(it) } ?: continue
                val peer = parsePerson(row.optJSONObject("peer")) ?: continue
                add(ChatSearchConversation(id, peer))
            }
        }.distinctBy(ChatSearchConversation::id)
        val people = buildList {
            val rows = envelope.optJSONArray("people") ?: return@buildList
            for (index in 0 until rows.length()) parsePerson(rows.optJSONObject(index))?.let(::add)
        }.distinctBy(ChatSearchPerson::id)
        return ChatSearchResults(conversations, people)
    }

    private fun parseStartedConversation(payload: JSONObject): InboxConversation {
        val row = payload.optJSONObject("data") ?: payload
        val id = row.optNullable("id")?.takeIf { MessagesRepository.isUuid(it) } ?: error("Nantty returned an invalid conversation.")
        val peer = parsePerson(row.optJSONObject("peer")) ?: error("Nantty returned an incomplete conversation.")
        return InboxConversation(
            id = id,
            title = peer.name,
            peerName = peer.name,
            avatarUrl = peer.avatarUrl,
            type = ConversationType.from(row.optNullable("kind") ?: "direct"),
            lastMessageAt = row.optNullable("lastMessageAt").orEmpty(),
            unreadCount = row.optInt("unread").coerceAtLeast(0),
        )
    }

    private fun parsePerson(row: JSONObject?): ChatSearchPerson? {
        row ?: return null
        val id = row.optNullable("id")?.takeIf { MessagesRepository.isUuid(it) } ?: return null
        val name = row.optNullable("name")?.takeIf(String::isNotBlank) ?: return null
        return ChatSearchPerson(id, name, row.optNullable("avatarUrl")?.takeIf(::isSecureImageUrl))
    }

    private fun requireToken(token: String) = token.takeIf(String::isNotBlank) ?: error("Sign in to search your messages.")
}

internal fun buildConversationSearchPath(query: String): String {
    val term = query.trim()
    require(term.length in 1..ConversationSearchRepository.MAX_SEARCH_QUERY_LENGTH) {
        "Enter a search between 1 and ${ConversationSearchRepository.MAX_SEARCH_QUERY_LENGTH} characters."
    }
    return "/api/v1/conversations/search?q=${URLEncoder.encode(term, Charsets.UTF_8.name())}"
}

private fun JSONObject.optNullable(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

