package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ConversationThreadScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun rendersHeaderTimelineAndInjectedSecurityState() {
        setThread(
            timeline = listOf(item(id = "m1", text = "Display-safe message")),
            secureChatStatus = SecureChatStatus.AVAILABLE,
            secureChatStatusLabel = "Secure chat available",
            keyTrustState = ConversationKeyTrustState.TRUSTED,
            keyTrustStatusLabel = "Peer key trusted",
            safetyCodeLabel = "1234 5678",
        )

        compose.onNodeWithText("Ari Oyinlola").assertIsDisplayed()
        compose.onNodeWithText("Display-safe message").assertIsDisplayed()
        compose.onNodeWithText("Secure chat available").assertIsDisplayed()
        compose.onNodeWithText("Peer key trusted").assertIsDisplayed()
        compose.onNodeWithText("View safety code").assertIsDisplayed().performClick()
        compose.onNodeWithText("1234 5678").assertIsDisplayed()
    }

    @Test
    fun notificationTargetScrollsIntoViewAndIsHighlighted() {
        val targetId = "target-message"
        val timeline = (1..30).map { index -> item("message-$index", "Safe message $index") } + item(targetId, "Target content")

        setThread(timeline = timeline, targetMessageId = targetId)

        compose.onNodeWithContentDescription("Target message from notification").assertIsDisplayed()
        compose.onNodeWithText("Opened from notification").assertIsDisplayed()
        compose.onNodeWithText("Target content").assertIsDisplayed()
    }

    @Test
    fun neverRendersContentForDecryptFailureAndShowsRetrySeparately() {
        setThread(
            timeline = listOf(
                ConversationTimelineItem(
                    id = "bad-message",
                    author = "Ari",
                    displayText = "ciphertext-must-not-render",
                    timeLabel = "10:30 AM",
                    isOutgoing = false,
                    state = ConversationMessageState.DECRYPTION_ERROR,
                    errorLabel = "Message couldn’t be decrypted.",
                    retryable = true,
                ),
            ),
            retryingMessageIds = setOf("bad-message"),
        )

        compose.onNodeWithText("Message couldn’t be decrypted.").assertIsDisplayed()
        compose.onNodeWithText("ciphertext-must-not-render").assertDoesNotExist()
        compose.onNodeWithContentDescription("Retrying message").assertIsDisplayed().assertIsNotEnabled()
    }

    @Test
    fun messageRetryInvokesTheInjectedCallback() {
        var retried: String? = null
        setThread(
            timeline = listOf(
                ConversationTimelineItem(
                    id = "m-retry",
                    author = "Ari",
                    displayText = null,
                    timeLabel = "10:30 AM",
                    isOutgoing = false,
                    state = ConversationMessageState.DECRYPTION_ERROR,
                    errorLabel = "Could not display this message.",
                    retryable = true,
                ),
            ),
            onRetryMessage = { retried = it },
        )
        compose.onNodeWithContentDescription("Retry message").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals("m-retry", retried) }
    }

    @Test
    fun loadingEmptyAndErrorStatesAreDistinctAndErrorCanRefresh() {
        setThread(timelineState = ConversationTimelineState.LOADING)
        compose.onNodeWithContentDescription("Loading conversation").assertIsDisplayed()

        setThread(timelineState = ConversationTimelineState.EMPTY)
        compose.onNodeWithText("No messages yet").assertIsDisplayed()

        var refreshes = 0
        setThread(timelineState = ConversationTimelineState.ERROR, timelineError = "Offline", onRefresh = { refreshes++ })
        compose.onNodeWithText("Offline").assertIsDisplayed()
        compose.onNodeWithText("Try again").performClick()
        compose.runOnIdle { assertEquals(1, refreshes) }
    }

    @Test
    fun olderHistoryActionIsShownOnlyWhenAnotherPageExistsAndCallsHost() {
        var pageRequests = 0
        setThread(hasOlderMessages = true, onLoadOlderMessages = { pageRequests++ })

        compose.onNodeWithText("Load older messages").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(1, pageRequests) }

        setThread()
        compose.onNodeWithText("Load older messages").assertDoesNotExist()
    }

    @Test
    fun headerActionsAreExplicitCallbacks() {
        var backs = 0
        var infos = 0
        var reads = 0
        var refreshes = 0
        setThread(
            onBack = { backs++ },
            onOpenPeerOrInfo = { infos++ },
            onMarkRead = { reads++ },
            onRefresh = { refreshes++ },
        )

        compose.onNodeWithContentDescription("Back to messages").performClick()
        compose.onNodeWithContentDescription("Conversation info").performClick()
        compose.onNodeWithContentDescription("Mark conversation as read").performClick()
        compose.onNodeWithContentDescription("Refresh conversation").performClick()
        compose.runOnIdle {
            assertEquals(1, backs)
            assertEquals(1, infos)
            assertEquals(1, reads)
            assertEquals(1, refreshes)
        }
    }

    @Test
    fun composerUsesCallerStateAndSendsOnlyEnabledNonBlankDraft() {
        val composer = mutableStateOf(ConversationComposerState(draft = "", enabled = true, sendEnabled = true))
        val sent = mutableListOf<String>()
        compose.setContent {
            MaterialTheme {
                ConversationThreadScreen(
                    peerName = "Ari",
                    subtitle = null,
                    timeline = emptyList(),
                    timelineState = ConversationTimelineState.EMPTY,
                    timelineError = null,
                    composer = composer.value,
                    secureChatStatus = SecureChatStatus.NOT_PROVIDED,
                    secureChatStatusLabel = null,
                    keyTrustState = ConversationKeyTrustState.NOT_PROVIDED,
                    keyTrustStatusLabel = null,
                    safetyCodeAvailable = false,
                    safetyCodeLabel = null,
                    retryingMessageIds = emptySet(),
                    onBack = {},
                    onOpenPeerOrInfo = {},
                    onOpenSafetyCode = {},
                    onMarkRead = {},
                    onRefresh = {},
                    onDraftChange = { composer.value = composer.value.copy(draft = it) },
                    onSendText = { sent += it },
                    onRetryMessage = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Send message").assertIsNotEnabled()
        compose.onNodeWithText("Write a message").performTextInput("  Hello  ")
        compose.runOnIdle { composer.value = composer.value.copy(sendEnabled = false) }
        compose.onNodeWithContentDescription("Send message").assertIsNotEnabled()
        compose.runOnIdle { composer.value = composer.value.copy(sendEnabled = true) }
        compose.onNodeWithContentDescription("Send message").performClick()
        compose.runOnIdle { assertEquals(listOf("Hello"), sent) }
    }

    private fun setThread(
        timeline: List<ConversationTimelineItem> = emptyList(),
        timelineState: ConversationTimelineState = ConversationTimelineState.READY,
        timelineError: String? = null,
        secureChatStatus: SecureChatStatus = SecureChatStatus.NOT_PROVIDED,
        secureChatStatusLabel: String? = null,
        keyTrustState: ConversationKeyTrustState = ConversationKeyTrustState.NOT_PROVIDED,
        keyTrustStatusLabel: String? = null,
        safetyCodeLabel: String? = null,
        safetyCodeAvailable: Boolean = safetyCodeLabel != null,
        retryingMessageIds: Set<String> = emptySet(),
        targetMessageId: String? = null,
        hasOlderMessages: Boolean = false,
        onLoadOlderMessages: () -> Unit = {},
        onBack: () -> Unit = {},
        onOpenPeerOrInfo: () -> Unit = {},
        onMarkRead: () -> Unit = {},
        onRefresh: () -> Unit = {},
        onRetryMessage: (String) -> Unit = {},
    ) {
        compose.setContent {
            MaterialTheme {
                ConversationThreadScreen(
                    peerName = "Ari Oyinlola",
                    subtitle = "Active now",
                    timeline = timeline,
                    targetMessageId = targetMessageId,
                    timelineState = timelineState,
                    timelineError = timelineError,
                    composer = ConversationComposerState("", enabled = true, sendEnabled = true),
                    secureChatStatus = secureChatStatus,
                    secureChatStatusLabel = secureChatStatusLabel,
                    keyTrustState = keyTrustState,
                    keyTrustStatusLabel = keyTrustStatusLabel,
                    safetyCodeAvailable = safetyCodeAvailable,
                    safetyCodeLabel = safetyCodeLabel,
                    retryingMessageIds = retryingMessageIds,
                    hasOlderMessages = hasOlderMessages,
                    onBack = onBack,
                    onOpenPeerOrInfo = onOpenPeerOrInfo,
                    onOpenSafetyCode = {},
                    onMarkRead = onMarkRead,
                    onRefresh = onRefresh,
                    onDraftChange = {},
                    onSendText = {},
                    onRetryMessage = onRetryMessage,
                    onLoadOlderMessages = onLoadOlderMessages,
                )
            }
        }
    }

    private fun item(id: String, text: String) = ConversationTimelineItem(
        id = id,
        author = "Ari",
        displayText = text,
        timeLabel = "10:30 AM",
        isOutgoing = false,
    )
}
