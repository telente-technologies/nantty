package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MessagesRepositoryTest {
    @Test
    fun loadsAuthenticatedConversationPageAndNeverParsesLastMessageContent() {
        var seenPath: String? = null
        var seenToken: String? = null
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = MessagesTransport { path, token ->
                seenPath = path
                seenToken = token
                JSONObject(
                    """{"data":[{"id":"11111111-1111-4111-8111-111111111111","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"Ari","avatarUrl":"https://cdn.nantty.com/ari.jpg"},"lastMessage":"DO NOT DISPLAY","lastMessageKind":"text","lastMessageAt":"2026-10-01T12:00:00.000Z","unread":2}],"nextCursor":"33333333-3333-4333-8333-333333333333"}""",
                )
            },
        )

        val result = repository.load() as MessagesResult.Success
        assertEquals("/api/v1/conversations?filter=all&limit=20", seenPath)
        assertEquals("session-access", seenToken)
        assertEquals("Ari", result.page.conversations.single().title)
        assertEquals("https://cdn.nantty.com/ari.jpg", result.page.conversations.single().avatarUrl)
        assertEquals(ConversationType.DIRECT, result.page.conversations.single().type)
        assertEquals("2026-10-01T12:00:00.000Z", result.page.conversations.single().lastMessageAt)
        assertEquals(2, result.page.conversations.single().unreadCount)
        assertEquals("33333333-3333-4333-8333-333333333333", result.page.nextCursor)
        assertFalse(result.page.conversations.single().toString().contains("DO NOT DISPLAY"))
    }

    @Test
    fun mapsGroupAndBusinessTitlesWithoutDecryptingEncryptedAttributes() {
        val repository = repositoryWithPayload(
            """{"data":[{"id":"11111111-1111-4111-8111-111111111111","kind":"group","peer":{"id":"11111111-1111-4111-8111-111111111111","name":""},"encryptedAttributes":"opaque","lastMessage":"secret","lastMessageAt":"2026-10-01T12:00:00.000Z","unread":0},{"id":"22222222-2222-4222-8222-222222222222","kind":"business","peer":{"id":"33333333-3333-4333-8333-333333333333","name":"Merchant"},"store":{"id":"44444444-4444-4444-8444-444444444444","name":"Nantty Store"},"lastMessage":"secret","lastMessageAt":"2026-10-01T11:00:00.000Z","unread":1}],"nextCursor":null}""",
        )

        val page = (repository.load() as MessagesResult.Success).page
        assertEquals("Group", page.conversations[0].title)
        assertEquals("Nantty Store", page.conversations[1].title)
        assertEquals(1, page.conversations[1].unreadCount)
        assertFalse(page.conversations.joinToString().contains("secret"))
    }

    @Test
    fun requiresAuthenticatedSessionAndRejectsInvalidCursorBeforeNetwork() {
        var requests = 0
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = MessagesTransport { _, _ -> requests += 1; JSONObject() },
        )
        val result = repository.load() as MessagesResult.Failure
        assertTrue(result.message.contains("Sign in"))
        assertEquals(0, requests)

        val signedIn = makeRepository(session = ::signedInSession, onRequest = { requests += 1 })
        assertTrue((signedIn.load("not-a-uuid") as MessagesResult.Failure).message.contains("cursor"))
        assertEquals(0, requests)
    }

    @Test
    fun reportsExpiredAuthenticationAndDoesNotLeakResponseBody() {
        val repository = makeRepository(onRequest = { throw MessagesHttpException(401) })
        val result = repository.load() as MessagesResult.Failure
        assertTrue(result.authenticationRequired)
    }

    @Test
    fun rejectsInsecureOrCredentialBearingAvatarUrls() {
        val repository = repositoryWithPayload(
            """{"data":[{"id":"11111111-1111-4111-8111-111111111111","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"Ari","avatarUrl":"http://cdn.nantty.com/ari.jpg"},"lastMessageAt":"2026-10-01T12:00:00.000Z","unread":0}],"nextCursor":null}""",
        )

        val result = repository.load() as MessagesResult.Success
        assertEquals(null, result.page.conversations.single().avatarUrl)
    }

    @Test
    fun requestsNextPageUsingBackendUuidCursor() {
        var requestedPath: String? = null
        val cursor = "33333333-3333-4333-8333-333333333333"
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = MessagesTransport { path, _ ->
                requestedPath = path
                JSONObject("{\"data\":[],\"nextCursor\":null}")
            },
        )

        repository.load(cursor)
        assertEquals("/api/v1/conversations?filter=all&limit=20&cursor=$cursor", requestedPath)
    }

    @Test
    fun requestsDirectFilterWithExactApiQuery() {
        var requestedPath: String? = null
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            transport = MessagesTransport { path, _ ->
                requestedPath = path
                JSONObject("{\"data\":[],\"nextCursor\":null}")
            },
        )

        repository.load(filter = MessagesFilter.DIRECT)

        assertEquals("/api/v1/conversations?filter=direct&limit=20", requestedPath)
        assertEquals("/api/v1/conversations?filter=all&limit=20", buildConversationPath())
    }

    @Test
    fun requestsMessageRequestAndSpamFoldersAndParsesFolderMetadata() {
        val repository = repositoryWithPayload(
            """{"data":[{"id":"11111111-1111-4111-8111-111111111111","kind":"direct","peer":{"id":"22222222-2222-4222-8222-222222222222","name":"Ari"},"inboxFolder":"spam","spamReason":"Automated sending pattern","lastMessageAt":"2026-10-01T12:00:00Z","unread":1}],"nextCursor":null}""",
        )

        val spam = repository.load(folder = MessagesInboxFolder.SPAM) as MessagesResult.Success

        assertEquals("/api/v1/conversations?folder=spam&limit=20", buildConversationPath(folder = MessagesInboxFolder.SPAM))
        assertEquals(MessagesInboxFolder.SPAM, spam.page.conversations.single().inboxFolder)
        assertEquals("Automated sending pattern", spam.page.conversations.single().spamReason)
        assertEquals("/api/v1/conversations?folder=requests&limit=20", buildConversationPath(folder = MessagesInboxFolder.REQUESTS))
    }

    @Test
    fun executesInboxActionsOnlyForValidatedConversationAndRetriesOnceAfterRefresh() {
        val conversationId = "11111111-1111-4111-8111-111111111111"
        val calls = mutableListOf<String>()
        var refreshes = 0
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            refreshSessionProvider = {
                refreshes += 1
                signedInSession().copy(accessToken = "rotated-token")
            },
            transport = MessagesTransport { _, _ -> JSONObject("""{"data":[],"nextCursor":null}""") },
            threadTransport = ChatThreadTransport { method, path, token, body ->
                assertEquals(null, body)
                calls += "$method $path $token"
                if (calls.size == 1) throw MessagesHttpException(401)
                JSONObject()
            },
        )

        assertTrue(repository.acceptMessageRequest(conversationId).isSuccess)
        assertTrue(repository.deleteMessageRequest("bad-id").isFailure)
        assertEquals(
            listOf("POST /api/v1/conversations/$conversationId/accept session-access", "POST /api/v1/conversations/$conversationId/accept rotated-token"),
            calls,
        )
        assertEquals(1, refreshes)
    }

    @Test
    fun refreshesExpiredAccessTokenOnceAndRetriesInboxRequest() {
        val requestedTokens = mutableListOf<String>()
        var refreshes = 0
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            refreshSessionProvider = {
                refreshes += 1
                signedInSession().copy(accessToken = "refreshed-access")
            },
            transport = MessagesTransport { _, token ->
                requestedTokens += token
                if (requestedTokens.size == 1) throw MessagesHttpException(401)
                JSONObject("{\"data\":[],\"nextCursor\":null}")
            },
        )

        assertTrue(repository.load() is MessagesResult.Success)
        assertEquals(listOf("session-access", "refreshed-access"), requestedTokens)
        assertEquals(1, refreshes)
    }

    @Test
    fun failedTokenRefreshDoesNotRetryAndRequestsReauthentication() {
        var requests = 0
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            refreshSessionProvider = { null },
            transport = MessagesTransport { _, _ -> requests += 1; throw MessagesHttpException(401) },
        )

        val result = repository.load() as MessagesResult.Failure

        assertTrue(result.authenticationRequired)
        assertEquals(1, requests)
    }

    @Test
    fun transientRefreshFailureDoesNotMisclassifySessionAsRevoked() {
        val repository = MessagesRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::signedInSession,
            refreshSessionProvider = { throw IllegalStateException("Network unavailable") },
            transport = MessagesTransport { _, _ -> throw MessagesHttpException(401) },
        )

        val result = repository.load() as MessagesResult.Failure

        assertFalse(result.authenticationRequired)
        assertEquals("Network unavailable", result.message)
    }

    private fun repositoryWithPayload(payload: String) = makeRepository(response = { JSONObject(payload) })

    private fun makeRepository(
        session: () -> AccountSession? = ::signedInSession,
        onRequest: () -> Unit = {},
        response: () -> JSONObject = { JSONObject("{\"data\":[],\"nextCursor\":null}") },
    ) = MessagesRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = session,
        transport = MessagesTransport { _, _ -> onRequest(); response() },
    )

    private fun signedInSession() = AccountSession(
        "session-access",
        "session-refresh",
        AccountUser("22222222-2222-4222-8222-222222222222", "Ari", "ari", null, null, emptyList()),
    )
}
