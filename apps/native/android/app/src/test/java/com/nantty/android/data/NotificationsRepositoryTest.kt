package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationsRepositoryTest {
    @Test
    fun loadsAuthenticatedPageAndEncodesCursor() {
        val transport = RecordingTransport(page())
        val repository = NotificationsRepository("https://api.nantty.com", ::signedInSession, transport)

        val result = repository.load(NotificationFilter.MENTIONS, "cursor value/+=") as NotificationsResult.Success

        assertEquals("GET", transport.method)
        assertEquals("/api/v1/notifications?filter=mentions&cursor=cursor%20value%2F%2B%3D", transport.path)
        assertEquals("notifications-access", transport.token)
        assertEquals("notification-1", result.page.items.single().id)
        assertEquals("Ari", result.page.items.single().actor?.name)
        assertEquals("post-123", result.page.items.single().postId)
        assertEquals("next-token", result.page.nextCursor)
    }

    @Test
    fun resolvesOnlyValidatedStructuredPostTargets() {
        val valid = ActivityNotification("n1", "social", null, "Title", "Body", "now", false, null, "post_123-abc")
        val invalid = valid.copy(postId = "../admin")
        val urlOnly = valid.copy(postId = null)

        assertEquals(NotificationDestination.Post("post_123-abc"), resolveNotificationDestination(valid))
        assertNull(resolveNotificationDestination(invalid))
        assertNull(resolveNotificationDestination(urlOnly))
        assertNull(resolveNotificationDestination(valid.copy(postId = "x".repeat(201))))
    }

    @Test
    fun resolvesNotificationRoutesForSupportedMessagesOrdersAndProfiles() {
        val base = ActivityNotification("n1", "social", null, "Title", "Body", "now", false, null, null)

        assertEquals(NotificationDestination.Messages, resolveNotificationDestination(base.copy(category = "messages")))
        assertEquals(NotificationDestination.Messages, resolveNotificationDestination(base.copy(conversationId = "conversation-1")))
        assertEquals(NotificationDestination.Orders, resolveNotificationDestination(base.copy(category = "orders")))
        assertEquals(
            NotificationDestination.FollowRequests,
            resolveNotificationDestination(base.copy(kind = "followRequest", postId = "post-123")),
        )
        assertEquals(
            NotificationDestination.Profile("user-123"),
            resolveNotificationDestination(base.copy(kind = "followRequestAccepted", actor = NotificationActor("user-123", "Ari", null))),
        )
        assertEquals(NotificationDestination.Profile("user-123"), resolveNotificationDestination(base.copy(actor = NotificationActor("user-123", "Ari", null))))
        assertNull(resolveNotificationDestination(base.copy(actor = NotificationActor("../settings", "Ari", null))))
    }

    @Test
    fun conversationTargetTakesPrecedenceOverPostTargetLikeReactNative() {
        val notification = ActivityNotification(
            id = "n1",
            category = "messages",
            kind = null,
            title = "Ari sent you a message",
            body = "Open your chat",
            createdAt = "now",
            read = false,
            actor = null,
            postId = "post-123",
            conversationId = "11111111-1111-4111-8111-111111111111",
        )

        assertEquals(
            NotificationDestination.Conversation("11111111-1111-4111-8111-111111111111", null),
            resolveNotificationDestination(notification),
        )
    }

    @Test
    fun notificationCarriesOnlySafeMessageTargetIntoConversationDestination() {
        val conversationId = "11111111-1111-4111-8111-111111111111"
        val messageId = "33333333-3333-4333-8333-333333333333"
        val payload = JSONObject("""{"data":[{"id":"n1","category":"messages","title":"Notice","body":"Body","createdAt":"now","read":false,"data":{"conversationId":"$conversationId","messageId":"$messageId"}}]}""")
        val notification = NotificationsRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(payload)).parsePage(payload).items.single()

        assertEquals(messageId, notification.messageId)
        assertEquals(NotificationDestination.Conversation(conversationId, messageId), resolveNotificationDestination(notification))
        assertEquals(NotificationDestination.Conversation(conversationId, null), resolveNotificationDestination(notification.copy(messageId = "../message")))
    }

    @Test
    fun requiresSessionBeforeMakingAnyRequest() {
        val transport = RecordingTransport(page())

        val result = NotificationsRepository("https://api.nantty.com", { null }, transport).load(NotificationFilter.ALL) as NotificationsResult.Failure

        assertTrue(result.message.contains("Sign in"))
        assertNull(transport.path)
    }

    @Test
    fun readActionsUseAuthenticatedNoContentContracts() {
        val transport = RecordingTransport(JSONObject())
        val repository = NotificationsRepository("https://api.nantty.com", ::signedInSession, transport)

        assertTrue(repository.markRead("id/with space").isSuccess)
        assertEquals("POST", transport.method)
        assertEquals("/api/v1/notifications/id%2Fwith%20space/read", transport.path)
        assertEquals("notifications-access", transport.token)
        assertTrue(repository.markAllRead().isSuccess)
        assertEquals("POST", transport.method)
        assertEquals("/api/v1/notifications/read-all", transport.path)
    }

    @Test
    fun parsesNullableActorAndEmptyCursor() {
        val payload = JSONObject("""{"data":[{"id":"n1","category":"messages","title":"Notice","body":"Body","createdAt":"now","read":true,"actor":null,"data":{"conversationId":"conversation-1"}}],"nextCursor":null}""")

        val page = NotificationsRepository("https://api.nantty.com", ::signedInSession, RecordingTransport(payload)).parsePage(payload)

        assertNull(page.nextCursor)
        assertNull(page.items.single().actor)
        assertEquals("conversation-1", page.items.single().conversationId)
        assertTrue(page.items.single().read)
    }

    private fun page() = JSONObject("""{"data":[{"id":"notification-1","category":"social","kind":"mention","title":"Ari mentioned you","body":"Hello","createdAt":"2026-10-01T12:00:00.000Z","read":false,"actor":{"id":"user-1","name":"Ari","avatarUrl":"https://cdn.nantty.com/ari.jpg"},"url":"https://evil.example/post/forged","data":{"postId":"post-123"}}],"nextCursor":"next-token"}""")
    private fun signedInSession() = AccountSession("notifications-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))

    private class RecordingTransport(private val response: JSONObject) : NotificationsTransport {
        var method: String? = null
        var path: String? = null
        var token: String? = null
        override fun request(method: String, path: String, accessToken: String?): JSONObject {
            this.method = method
            this.path = path
            this.token = accessToken
            return response
        }
    }
}
