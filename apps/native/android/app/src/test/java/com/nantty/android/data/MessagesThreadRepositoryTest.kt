package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MessagesThreadRepositoryTest {
    private val conversationId = "11111111-1111-4111-8111-111111111111"
    private val senderId = "22222222-2222-4222-8222-222222222222"
    private val messageId = "33333333-3333-4333-8333-333333333333"

    @Test
    fun historyKeepsCiphertextOpaqueAndNeverReadsPlaintext() {
        var requestedPath: String? = null
        val repository = repository { method, path, token, body ->
            assertEquals("GET", method)
            assertEquals("session-access", token)
            assertNull(body)
            requestedPath = path
            JSONObject("""{"data":[{"id":"$messageId","conversationId":"$conversationId","senderId":"$senderId","createdAt":"2026-10-01T12:00:00.000Z","kind":"text","text":"must never display","encryption":{"deviceId":"device-a","ciphertext":"opaque-envelope","protocol":"signal-v1"}}],"nextCursor":null}""")
        }

        val page = (repository.loadMessages(conversationId) as ChatHistoryResult.Success).page
        assertEquals("/api/v1/conversations/$conversationId/messages?limit=30", requestedPath)
        assertEquals("opaque-envelope", page.messages.single().ciphertext)
        assertEquals("signal-v1", page.messages.single().protocol)
        assertFalse(page.messages.toString().contains("must never display"))
    }

    @Test
    fun historyRequestsOlderPageWithBackendCursorAndReturnsNextCursor() {
        val cursor = "55555555-5555-4555-8555-555555555555"
        var requestedPath: String? = null
        val repository = repository { method, path, _, _ ->
            assertEquals("GET", method)
            requestedPath = path
            JSONObject("""{"data":[],"nextCursor":null}""")
        }

        val page = (repository.loadMessages(conversationId, cursor) as ChatHistoryResult.Success).page

        assertEquals("/api/v1/conversations/$conversationId/messages?limit=30&cursor=$cursor", requestedPath)
        assertTrue(page.messages.isEmpty())
        assertNull(page.nextCursor)
    }

    @Test
    fun incrementalHistoryUsesVerifiedAfterContractAndKeepsEnvelopeOpaque() {
        val newerId = "33333333-3333-4333-8333-333333333334"
        var requestedPath: String? = null
        val repository = repository { method, path, _, body ->
            assertEquals("GET", method)
            assertNull(body)
            requestedPath = path
            JSONObject("""{"data":[{"id":"$newerId","conversationId":"$conversationId","senderId":"$senderId","createdAt":"2026-10-01T12:01:00.000Z","kind":"text","text":"must never display","encryption":{"deviceId":"device-a","ciphertext":"opaque-envelope","protocol":"signal-v1"}}],"nextCursor":null}""")
        }

        val page = (repository.loadMessagesAfter(conversationId, messageId) as ChatHistoryResult.Success).page

        assertEquals("/api/v1/conversations/$conversationId/messages?limit=30&after=$messageId", requestedPath)
        assertEquals(listOf(newerId), page.messages.map(EncryptedChatMessage::id))
        assertEquals("opaque-envelope", page.messages.single().ciphertext)
        assertFalse(page.messages.toString().contains("must never display"))
        assertNull(page.nextCursor)
    }

    @Test
    fun incrementalHistoryRejectsInvalidOrConflictingCursorsBeforeNetwork() {
        var requests = 0
        val repository = repository { _, _, _, _ -> requests++; JSONObject("{\"data\":[]}") }

        assertTrue((repository.loadMessagesAfter(conversationId, "invalid") as ChatHistoryResult.Failure).message.contains("sync cursor"))
        assertTrue((repository.loadMessages(conversationId, messageId, messageId) as ChatHistoryResult.Failure).message.contains("either"))
        assertEquals(0, requests)
    }

    @Test
    fun initialHistoryMergesNewestToOldestAndDeduplicatesBoundaryMessages() {
        val newestId = messageUuid(3)
        val boundaryId = messageUuid(2)
        val oldestId = messageUuid(1)
        val paths = mutableListOf<String>()
        val emittedPages = mutableListOf<List<String>>()
        val repository = repository { method, path, _, _ ->
            assertEquals("GET", method)
            paths += path
            if (path.endsWith("?limit=30")) {
                JSONObject(
                    """{"data":[${messageRow(newestId)},${messageRow(boundaryId)}],"nextCursor":"$boundaryId"}""",
                )
            } else {
                JSONObject(
                    """{"data":[${messageRow(boundaryId)},${messageRow(oldestId)}],"nextCursor":null}""",
                )
            }
        }

        val loaded = repository.loadInitialHistory(conversationId) { page -> emittedPages += page.messages.map(EncryptedChatMessage::id) }
        val page = (loaded as ChatHistoryResult.Success).page

        assertEquals(
            listOf(
                "/api/v1/conversations/$conversationId/messages?limit=30",
                "/api/v1/conversations/$conversationId/messages?limit=30&cursor=$boundaryId",
            ),
            paths,
        )
        assertEquals(listOf(newestId, boundaryId, oldestId), page.messages.map(EncryptedChatMessage::id))
        assertEquals(listOf(listOf(newestId, boundaryId), listOf(newestId, boundaryId, oldestId)), emittedPages)
        assertNull(page.nextCursor)
    }

    @Test
    fun initialHistoryStopsAfterTenPagesAndKeepsContinuationCursor() {
        var requests = 0
        val repository = repository { method, _, _, _ ->
            assertEquals("GET", method)
            requests += 1
            val id = messageUuid(requests)
            val next = messageUuid(requests + 1)
            JSONObject("""{"data":[${messageRow(id)}],"nextCursor":"$next"}""")
        }

        val page = (repository.loadInitialHistory(conversationId) as ChatHistoryResult.Success).page

        assertEquals(MessagesRepository.MAX_INITIAL_HISTORY_PAGES, requests)
        assertEquals(MessagesRepository.MAX_INITIAL_HISTORY_PAGES, page.messages.size)
        assertEquals(messageUuid(MessagesRepository.MAX_INITIAL_HISTORY_PAGES + 1), page.nextCursor)
    }

    @Test
    fun notificationHistoryLoadsOlderAuthenticatedPagesUntilTargetIsFound() {
        val newestId = messageUuid(2)
        val targetId = messageUuid(1)
        val paths = mutableListOf<String>()
        val repository = repository { _, path, _, _ ->
            paths += path
            if (paths.size == 1) JSONObject("""{"data":[${messageRow(newestId)}],"nextCursor":"$targetId"}""")
            else JSONObject("""{"data":[${messageRow(targetId)}],"nextCursor":null}""")
        }

        val loaded = repository.loadHistoryUntilMessage(conversationId, targetId) as ChatHistoryResult.Success

        assertEquals(listOf(
            "/api/v1/conversations/$conversationId/messages?limit=30",
            "/api/v1/conversations/$conversationId/messages?limit=30&cursor=$targetId",
        ), paths)
        assertEquals(listOf(newestId, targetId), loaded.page.messages.map(EncryptedChatMessage::id))
        assertEquals(true, loaded.targetMessageFound)
    }

    @Test
    fun notificationHistoryPreservesPartialHistoryAndReportsPageFailure() {
        var requests = 0
        val repository = repository { _, _, _, _ ->
            requests += 1
            if (requests == 1) JSONObject("""{"data":[${messageRow(messageUuid(2))}],"nextCursor":"${messageUuid(1)}"}""")
            else throw IllegalStateException("History temporarily unavailable")
        }

        val loaded = repository.loadHistoryUntilMessage(conversationId, messageUuid(1)) as ChatHistoryResult.Success

        assertEquals(1, loaded.page.messages.size)
        assertEquals("History temporarily unavailable", loaded.continuationError)
        assertEquals(false, loaded.targetMessageFound)
    }

    @Test
    fun notificationHistoryRejectsUnsafeTargetsBeforeNetwork() {
        var requests = 0
        val repository = repository { _, _, _, _ -> requests++; JSONObject("{\"data\":[]}") }

        assertTrue((repository.loadHistoryUntilMessage(conversationId, "../message") as ChatHistoryResult.Failure).message.contains("message link"))
        assertEquals(0, requests)
    }

    @Test
    fun initialHistoryKeepsLoadedPagesAndExposesLaterPageFailureForRetry() {
        var requests = 0
        val repository = repository { _, _, _, _ ->
            requests += 1
            if (requests == 1) JSONObject("""{"data":[${messageRow(messageUuid(1))}],"nextCursor":"${messageUuid(2)}"}""")
            else throw IllegalStateException("Network unavailable")
        }

        val loaded = repository.loadInitialHistory(conversationId) as ChatHistoryResult.Success

        assertEquals(2, requests)
        assertEquals(listOf(messageUuid(1)), loaded.page.messages.map(EncryptedChatMessage::id))
        assertEquals(messageUuid(2), loaded.page.nextCursor)
        assertEquals("Network unavailable", loaded.continuationError)
    }

    @Test
    fun malformedOrCrossConversationRowsAreDroppedAndMissingEnvelopeIsUnavailable() {
        val otherConversationId = "44444444-4444-4444-8444-444444444444"
        val repository = repository { _, _, _, _ ->
            JSONObject("""{"data":[{"id":"$messageId","conversationId":"$otherConversationId","senderId":"$senderId","createdAt":"now","text":"plaintext"},{"id":"$messageId","conversationId":"$conversationId","senderId":"$senderId","createdAt":"now","text":"plaintext"}],"nextCursor":null}""")
        }

        val message = (repository.loadMessages(conversationId) as ChatHistoryResult.Success).page.messages.single()
        assertNull(message.ciphertext)
    }

    @Test
    fun invalidConversationAndCursorAreRejectedBeforeNetwork() {
        var requests = 0
        val repository = repository { _, _, _, _ -> requests++; JSONObject("{\"data\":[]}") }

        assertTrue((repository.loadMessages("not-a-uuid") as ChatHistoryResult.Failure).message.contains("invalid"))
        assertTrue((repository.loadMessages(conversationId, "bad-cursor") as ChatHistoryResult.Failure).message.contains("cursor"))
        assertEquals(0, requests)
    }

    @Test
    fun marksReadWithAuthenticatedPostAndEmptyBody() {
        var method: String? = null
        var path: String? = null
        var token: String? = null
        var body: JSONObject? = null
        val repository = repository { requestMethod, requestPath, accessToken, requestBody ->
            method = requestMethod; path = requestPath; token = accessToken; body = requestBody
            JSONObject()
        }

        assertTrue(repository.markConversationRead(conversationId).isSuccess)
        assertEquals("POST", method)
        assertEquals("/api/v1/conversations/$conversationId/read", path)
        assertEquals("session-access", token)
        assertEquals("{}", body.toString())
    }

    @Test
    fun conversationSearchUsesAuthenticatedServerResultsAndIgnoresMessageSnippets() {
        val peerId = "66666666-6666-4666-8666-666666666666"
        var requestedMethod: String? = null
        var requestedPath: String? = null
        var requestedToken: String? = null
        val repository = repository { method, path, token, body ->
            requestedMethod = method
            requestedPath = path
            requestedToken = token
            assertNull(body)
            JSONObject("""{"data":{"conversations":[{"id":"$conversationId","peer":{"id":"$peerId","name":"Ari Oyinlola","username":"ari","avatarUrl":"http://unsafe.example/avatar.png"},"snippet":"must not be displayed"}],"people":[{"id":"$peerId","name":"Ari Oyinlola","username":"ari","avatarUrl":"https://cdn.nantty.com/avatar.png"}]}}""")
        }

        val result = repository.search("  ari oy  ") as ChatSearchResult.Success

        assertEquals("GET", requestedMethod)
        assertEquals("/api/v1/conversations/search?q=ari+oy", requestedPath)
        assertEquals("session-access", requestedToken)
        assertEquals(listOf("Ari Oyinlola"), result.results.conversations.map { it.peer.name })
        assertNull(result.results.conversations.single().peer.avatarUrl)
        assertEquals("https://cdn.nantty.com/avatar.png", result.results.people.single().avatarUrl)
        assertFalse(result.results.toString().contains("must not be displayed"))
    }

    @Test
    fun startingConversationWithPersonUsesAuthenticatedBackendContract() {
        val peerId = "66666666-6666-4666-8666-666666666666"
        var requestedMethod: String? = null
        var requestedPath: String? = null
        var requestBody: JSONObject? = null
        val repository = repository { method, path, token, body ->
            requestedMethod = method
            requestedPath = path
            requestBody = body
            assertEquals("session-access", token)
            JSONObject("""{"data":{"id":"$conversationId","kind":"direct","peer":{"id":"$peerId","name":"Ari Oyinlola","username":"ari","avatarUrl":null},"lastMessageAt":"","unread":0}}""")
        }

        val result = repository.startConversationWithPerson(peerId) as StartConversationResult.Success

        assertEquals("POST", requestedMethod)
        assertEquals("/api/v1/conversations", requestedPath)
        assertEquals(JSONObject().put("userId", peerId).toString(), requestBody.toString())
        assertEquals(conversationId, result.conversation.id)
        assertEquals("Ari Oyinlola", result.conversation.title)
    }

    @Test
    fun newMessagePeoplePickerUsesSharedPeopleSearchContractAndMapsProfiles() {
        val peerId = "66666666-6666-4666-8666-666666666666"
        var requestedPath: String? = null
        var requestedToken: String? = null
        val repository = repository { method, path, token, body ->
            assertEquals("GET", method)
            assertNull(body)
            requestedPath = path
            requestedToken = token
            JSONObject("""{"data":[{"id":"$peerId","name":"Ari Oyinlola","username":"ari","avatarUrl":"https://cdn.nantty.com/avatar.png","verified":true}],"nextCursor":null}""")
        }

        val result = repository.searchPeopleToMessage(" ari oy ") as MessagePeopleResult.Success

        assertEquals("/api/v1/search/people?q=ari%20oy&limit=20", requestedPath)
        assertEquals("session-access", requestedToken)
        assertEquals(peerId, result.people.single().id)
        assertEquals("ari", result.people.single().username)
        assertEquals(true, result.people.single().verified)
    }

    @Test
    fun newMessagePeoplePickerDoesNotRequestEmptyQuery() {
        var requests = 0
        val repository = repository { _, _, _, _ -> requests++; JSONObject() }

        assertTrue(repository.searchPeopleToMessage("  ") is MessagePeopleResult.Failure)
        assertEquals(0, requests)
        assertEquals("/api/v1/search/people?q=ari%20%26%20co&limit=20", buildPeopleToMessageSearchPath(" ari & co "))
    }

    @Test
    fun createChannelUsesAuthenticatedSocialContractAndMapsCreatedConversation() {
        var requestedMethod: String? = null
        var requestedPath: String? = null
        var requestedToken: String? = null
        var requestedBody: JSONObject? = null
        val repository = repository { method, path, token, body ->
            requestedMethod = method
            requestedPath = path
            requestedToken = token
            requestedBody = body
            JSONObject(
                """{"data":{"id":"$conversationId","peer":{"id":"$conversationId","name":"Maker Notes","username":"","avatarUrl":null},"lastMessage":"","lastMessageKind":null,"lastMessageAt":"2026-11-05T12:00:00Z","unread":0,"isFriend":false,"kind":"channel","title":"Maker Notes","description":"Updates","encryptedAttributes":null,"photoUrl":null,"photoMediaId":null,"memberCount":1,"myRole":"owner","disappearingMessagesSeconds":null,"onlyAdminsCanMentionAll":true,"store":null,"inboxFolder":"chats","spamReason":null,"streak":null,"mutedUntil":null}}""",
            )
        }

        val result = repository.createChannel("  Maker Notes  ", " Updates ") as ConversationLookupResult.Success

        assertEquals("POST", requestedMethod)
        assertEquals("/api/v1/channels", requestedPath)
        assertEquals("session-access", requestedToken)
        assertEquals(JSONObject().put("name", "Maker Notes").put("description", "Updates").toString(), requestedBody.toString())
        assertEquals(conversationId, result.conversation.id)
        assertEquals("Maker Notes", result.conversation.title)
        assertEquals(ConversationType.CHANNEL, result.conversation.type)
    }

    @Test
    fun createChannelOmitsBlankDescriptionAndRejectsInvalidInputBeforeNetwork() {
        var requests = 0
        var requestedBody: JSONObject? = null
        val repository = repository { _, _, _, body ->
            requests += 1
            requestedBody = body
            JSONObject(
                """{"data":{"id":"$conversationId","peer":{"id":"$conversationId","name":"Channel","username":"","avatarUrl":null},"lastMessageAt":"2026-11-05T12:00:00Z","kind":"channel","title":"Channel"}}""",
            )
        }

        assertTrue(repository.createChannel("  ", null) is ConversationLookupResult.Failure)
        assertTrue(repository.createChannel("x".repeat(81), null) is ConversationLookupResult.Failure)
        assertTrue(repository.createChannel("Channel", "x".repeat(501)) is ConversationLookupResult.Failure)
        assertEquals(0, requests)

        assertTrue(repository.createChannel(" Channel ", "   ") is ConversationLookupResult.Success)
        assertEquals(JSONObject().put("name", "Channel").toString(), requestedBody.toString())
        assertEquals(1, requests)
    }

    @Test
    fun startingConversationWithStoreUsesAuthenticatedStoreContractAndCanonicalStoreIdentity() {
        val storeId = "77777777-7777-4777-8777-777777777777"
        var requestedMethod: String? = null
        var requestedPath: String? = null
        var requestedToken: String? = null
        var requestBody: JSONObject? = JSONObject()
        val repository = repository { method, path, token, body ->
            requestedMethod = method
            requestedPath = path
            requestedToken = token
            requestBody = body
            JSONObject("""{"data":{"id":"$conversationId","peer":{"id":"$storeId","name":"Ari Fabrics","username":"","avatarUrl":null},"lastMessage":"","lastMessageKind":null,"lastMessageAt":"2026-11-04T12:00:00Z","unread":0,"isFriend":false,"kind":"business","title":null,"description":null,"encryptedAttributes":null,"photoUrl":null,"photoMediaId":null,"memberCount":2,"myRole":"member","disappearingMessagesSeconds":null,"onlyAdminsCanMentionAll":false,"store":{"id":"$storeId","name":"Ari Fabrics","avatarUrl":"https://cdn.nantty.com/store.png"},"inboxFolder":"chats","spamReason":null,"streak":null,"mutedUntil":null}}""")
        }

        val result = repository.startConversationWithStore(storeId) as StartConversationResult.Success

        assertEquals("POST", requestedMethod)
        assertEquals("/api/v1/conversations/stores/$storeId", requestedPath)
        assertEquals("session-access", requestedToken)
        assertNull(requestBody)
        assertEquals(conversationId, result.conversation.id)
        assertEquals("Ari Fabrics", result.conversation.title)
        assertEquals("Ari Fabrics", result.conversation.peerName)
        assertEquals("https://cdn.nantty.com/store.png", result.conversation.avatarUrl)
        assertEquals(ConversationType.BUSINESS, result.conversation.type)
    }

    @Test
    fun storeConversationRejectsInvalidOrMismatchedStoreIdentityBeforeOpening() {
        var requests = 0
        val expectedStoreId = "77777777-7777-4777-8777-777777777777"
        val otherStoreId = "88888888-8888-4888-8888-888888888888"
        val repository = repository { _, _, _, _ ->
            requests++
            JSONObject("""{"data":{"id":"$conversationId","peer":{"id":"$otherStoreId","name":"Other Store"},"lastMessage":"","lastMessageAt":"2026-11-04T12:00:00Z","unread":0,"kind":"business","store":{"id":"$otherStoreId","name":"Other Store","avatarUrl":null}}}""")
        }
        assertTrue(repository.startConversationWithStore("not-a-uuid") is StartConversationResult.Failure)
        assertTrue(repository.startConversationWithStore(expectedStoreId) is StartConversationResult.Failure)
        assertEquals(1, requests)
    }

    @Test
    fun conversationSearchRefreshesAnExpiredSessionOnce() {
        val tokens = mutableListOf<String>()
        var requests = 0
        val refreshedSession = AccountSession("refreshed-access", "rotated-refresh", AccountUser(senderId, "Ari", "ari", null, null, emptyList()))
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { AccountSession("session-access", "refresh", AccountUser(senderId, "Ari", "ari", null, null, emptyList())) },
            refreshSessionProvider = { refreshedSession },
            threadTransport = ChatThreadTransport { _, _, token, _ ->
                tokens += token
                requests += 1
                if (requests == 1) throw MessagesHttpException(401)
                JSONObject("""{"data":{"conversations":[],"people":[]}}""")
            },
        )

        assertTrue(repository.search("ari") is ChatSearchResult.Success)
        assertEquals(listOf("session-access", "refreshed-access"), tokens)
        assertEquals(2, requests)
    }

    @Test
    fun conversationSearchRejectsBlankOrOverlongQueryBeforeNetwork() {
        var requests = 0
        val repository = repository { _, _, _, _ -> requests++; JSONObject() }

        assertTrue(repository.search("   ") is ChatSearchResult.Failure)
        assertTrue(repository.search("x".repeat(ConversationSearchRepository.MAX_SEARCH_QUERY_LENGTH + 1)) is ChatSearchResult.Failure)
        assertEquals(0, requests)
        assertEquals("/api/v1/conversations/search?q=hello+world", buildConversationSearchPath(" hello world "))
    }

    private fun repository(transport: ChatThreadTransport) = MessagesRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = { AccountSession("session-access", "refresh", AccountUser(senderId, "Ari", "ari", null, null, emptyList())) },
        threadTransport = transport,
    )

    private fun messageUuid(index: Int) = "00000000-0000-4000-8000-${index.toString().padStart(12, '0')}"

    private fun messageRow(id: String) =
        """{"id":"$id","conversationId":"$conversationId","senderId":"$senderId","createdAt":"2026-10-01T12:00:00.000Z","kind":"text","encryption":{"ciphertext":"opaque-envelope","protocol":"signal-v1"}}"""
}
