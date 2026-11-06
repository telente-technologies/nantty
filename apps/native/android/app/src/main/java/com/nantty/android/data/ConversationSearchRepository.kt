package com.nantty.android.data

import org.json.JSONObject
import java.net.URLEncoder

data class ChatSearchPerson(
    val id: String,
    val name: String,
    val avatarUrl: String?,
    val username: String? = null,
    val verified: Boolean = false,
)
data class ChatSearchConversation(val id: String, val peer: ChatSearchPerson)
data class ChatSearchResults(val conversations: List<ChatSearchConversation>, val people: List<ChatSearchPerson>)

sealed interface ChatSearchResult {
    data class Success(val results: ChatSearchResults) : ChatSearchResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : ChatSearchResult
}

sealed interface MessagePeopleResult {
    data class Success(val people: List<ChatSearchPerson>) : MessagePeopleResult
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : MessagePeopleResult
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
    companion object {
        const val MAX_SEARCH_QUERY_LENGTH = 100
        private const val PEOPLE_TO_MESSAGE_PAGE_SIZE = 20
    }

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

    /** People-only picker contract used by React Native's New message screen. */
    fun searchPeopleToMessage(query: String): MessagePeopleResult = try {
        val cleanQuery = query.trim()
        require(cleanQuery.length in 1..MAX_SEARCH_QUERY_LENGTH) {
            "Enter a search between 1 and $MAX_SEARCH_QUERY_LENGTH characters."
        }
        val session = sessionProvider() ?: error("Sign in to search for people to message.")
        val path = buildPeopleToMessageSearchPath(cleanQuery)
        val payload = requestWithRefresh("GET", path, requireToken(session.accessToken), null)
        val people = parseSpaceInvitePeople(payload, PEOPLE_TO_MESSAGE_PAGE_SIZE).map { person ->
            ChatSearchPerson(person.id, person.name, person.avatarUrl, person.username, person.verified)
        }
        MessagePeopleResult.Success(people)
    } catch (error: Exception) {
        MessagePeopleResult.Failure(
            error.message ?: "Could not search people. Check your connection and try again.",
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

    fun startConversationWithStore(storeId: String): StartConversationResult = try {
        require(MessagesRepository.isUuid(storeId)) { "This Nantty store is unavailable." }
        val session = sessionProvider() ?: error("Sign in to contact this store.")
        val payload = requestWithRefresh(
            "POST",
            "/api/v1/conversations/stores/$storeId",
            requireToken(session.accessToken),
            null,
        )
        StartConversationResult.Success(parseStartedStoreConversation(payload, storeId))
    } catch (error: Exception) {
        StartConversationResult.Failure(
            error.message ?: "Could not contact this store. Please try again.",
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

    private fun parseStartedStoreConversation(payload: JSONObject, expectedStoreId: String): InboxConversation {
        val row = payload.optJSONObject("data") ?: payload
        val id = row.optNullable("id")?.takeIf(MessagesRepository::isUuid)
            ?: error("Nantty returned an invalid store conversation.")
        require(row.optNullable("kind") == "business") { "Nantty returned an invalid store conversation." }
        val store = row.optJSONObject("store") ?: error("Nantty returned an incomplete store conversation.")
        val storeId = store.optNullable("id")?.takeIf(MessagesRepository::isUuid)
            ?: error("Nantty returned an incomplete store conversation.")
        require(storeId == expectedStoreId) { "Nantty returned a conversation for a different store." }
        val storeName = store.optNullable("name")?.takeIf(String::isNotBlank)
            ?: error("Nantty returned an incomplete store conversation.")
        val avatarUrl = store.optNullable("avatarUrl")?.takeIf(::isSecureImageUrl)
        return InboxConversation(
            id = id,
            title = storeName,
            peerName = storeName,
            avatarUrl = avatarUrl,
            type = ConversationType.BUSINESS,
            lastMessageAt = row.optNullable("lastMessageAt").orEmpty(),
            unreadCount = row.optInt("unread").coerceAtLeast(0),
        )
    }

    private fun parsePerson(row: JSONObject?): ChatSearchPerson? {
        row ?: return null
        val id = row.optNullable("id")?.takeIf { MessagesRepository.isUuid(it) } ?: return null
        val name = row.optNullable("name")?.takeIf(String::isNotBlank) ?: return null
        return ChatSearchPerson(
            id = id,
            name = name,
            avatarUrl = row.optNullable("avatarUrl")?.takeIf(::isSecureImageUrl),
            username = row.optNullable("username")?.trim()?.trimStart('@')?.takeIf(String::isNotBlank),
            verified = row.optBoolean("verified"),
        )
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

internal fun buildPeopleToMessageSearchPath(query: String): String {
    val term = query.trim()
    require(term.length in 1..100) { "Enter a search between 1 and 100 characters." }
    return "/api/v1/search/people?q=${URLEncoder.encode(term, Charsets.UTF_8.name()).replace("+", "%20")}&limit=20"
}

private fun JSONObject.optNullable(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }

