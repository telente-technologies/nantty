package com.nantty.android.ui

import androidx.compose.runtime.mutableStateOf
import com.nantty.android.data.FeedQuotedPost
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SignedInOverlayActionsFactoryTest {
    @Test
    fun storyPublicationClosesComposerRefreshesMessagesAndNavigatesToInbox() {
        val navigation = navigationState().apply {
            composerMode.value = SignedInComposerMode.STORY
            messagesRefreshGeneration.value = 4
        }
        val actions = createSignedInOverlayActions(navigation, environment())

        actions.storyPublished("story-1")

        assertEquals(SignedInComposerMode.CLOSED, navigation.composerMode.value)
        assertEquals(5, navigation.messagesRefreshGeneration.value)
        assertEquals(Destination.Messages, navigation.destination.value)
        assertNull(navigation.quoteTarget.value)
    }

    @Test
    fun productNavigationClearsStoreAndBrandSelectionBeforeOpeningMart() {
        val navigation = navigationState().apply {
            selectedStoreId.value = "store-1"
            selectedBrandId.value = "brand-1"
        }
        val actions = createSignedInOverlayActions(navigation, environment())

        actions.openProduct("product-1")

        assertNull(navigation.selectedStoreId.value)
        assertNull(navigation.selectedBrandId.value)
        assertEquals("product-1", navigation.pendingMartProductId.value)
        assertEquals(Destination.Mart, navigation.destination.value)
    }

    private fun navigationState() = SignedInOverlayNavigationState(
        destination = mutableStateOf(Destination.Feed),
        composerMode = mutableStateOf(SignedInComposerMode.CLOSED),
        quoteTarget = mutableStateOf<FeedQuotedPost?>(null),
        selectedPostId = mutableStateOf(null),
        selectedPostCommentId = mutableStateOf(null),
        selectedPostAnalyticsId = mutableStateOf(null),
        selectedStoreId = mutableStateOf(null),
        selectedBrandId = mutableStateOf(null),
        selectedProfileId = mutableStateOf(null),
        showingConnections = mutableStateOf(false),
        selectedConnectionsUserId = mutableStateOf(null),
        profileOpenedFromConnections = mutableStateOf(false),
        searchScope = mutableStateOf("global"),
        searchScopeLabel = mutableStateOf("Everywhere"),
        pendingMartProductId = mutableStateOf(null),
        pendingMessageConversation = mutableStateOf(null),
        messagesRefreshGeneration = mutableStateOf(0),
    )

    private fun environment() = SignedInOverlayActionEnvironment(
        refresh = {},
        leaveClipPost = {},
        reportClipComment = {},
        openConnections = { _, _ -> },
        requireSignIn = {},
        requireSignInWithAction = { _ -> },
        openExternalStoryDestination = {},
    )
}
