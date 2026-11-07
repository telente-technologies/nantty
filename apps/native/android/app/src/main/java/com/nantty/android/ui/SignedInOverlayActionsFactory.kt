package com.nantty.android.ui

import androidx.compose.runtime.MutableState
import com.nantty.android.data.FeedQuotedPost
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.StoryAdDestination
import java.net.URI

/** Saveable and transient state mutated while an overlay destination is open. */
internal data class SignedInOverlayNavigationState(
    val destination: MutableState<Destination>,
    val composerMode: MutableState<SignedInComposerMode>,
    val quoteTarget: MutableState<FeedQuotedPost?>,
    val selectedPostId: MutableState<String?>,
    val selectedPostCommentId: MutableState<String?>,
    val selectedPostAnalyticsId: MutableState<String?>,
    val selectedStoreId: MutableState<String?>,
    val selectedBrandId: MutableState<String?>,
    val selectedProfileId: MutableState<String?>,
    val showingConnections: MutableState<Boolean>,
    val selectedConnectionsUserId: MutableState<String?>,
    val profileOpenedFromConnections: MutableState<Boolean>,
    val searchScope: MutableState<String>,
    val searchScopeLabel: MutableState<String>,
    val pendingMartProductId: MutableState<String?>,
    val pendingMessageConversation: MutableState<InboxConversation?>,
    val messagesRefreshGeneration: MutableState<Int>,
)

/** Non-stateful collaborators required to route overlay actions. */
internal data class SignedInOverlayActionEnvironment(
    val refresh: () -> Unit,
    val leaveClipPost: () -> Unit,
    val reportClipComment: (String) -> Unit,
    val openConnections: (String, String) -> Unit,
    val requireSignIn: () -> Unit,
    val requireSignInWithAction: ((() -> Unit) -> Unit),
    val openExternalStoryDestination: (URI) -> Unit,
)

internal fun createSignedInOverlayActions(
    navigation: SignedInOverlayNavigationState,
    environment: SignedInOverlayActionEnvironment,
): SignedInOverlayActions = with(navigation) {
    SignedInOverlayActions(
        cancelComposer = {
            composerMode.value = SignedInComposerMode.CLOSED
            quoteTarget.value = null
        },
        publishedPost = { postId ->
            composerMode.value = SignedInComposerMode.CLOSED
            quoteTarget.value = null
            selectedPostId.value = postId
            environment.refresh()
        },
        storyPublished = {
            composerMode.value = SignedInComposerMode.CLOSED
            quoteTarget.value = null
            messagesRefreshGeneration.value++
            destination.value = Destination.Messages
        },
        backFromPost = { nextPostId ->
            environment.leaveClipPost()
            if (nextPostId == null) {
                selectedPostId.value = null
                selectedPostCommentId.value = null
            } else {
                selectedPostId.value = nextPostId
                selectedPostCommentId.value = null
            }
            environment.refresh()
        },
        backFromPostAnalytics = { selectedPostAnalyticsId.value = null },
        reportClipComment = environment.reportClipComment,
        backFromStore = { selectedStoreId.value = null },
        searchStore = { storeId, storeName ->
            searchScope.value = storeId?.let { "store:$it" } ?: "mart"
            searchScopeLabel.value = storeName ?: "Mart"
            selectedStoreId.value = null
            destination.value = Destination.Discover
        },
        backFromBrand = { selectedBrandId.value = null },
        openStore = { storeId ->
            selectedBrandId.value = null
            selectedStoreId.value = storeId
        },
        openProduct = { productId ->
            selectedStoreId.value = null
            selectedBrandId.value = null
            pendingMartProductId.value = productId
            destination.value = Destination.Mart
        },
        backFromProfile = {
            selectedProfileId.value = null
            if (profileOpenedFromConnections.value) showingConnections.value = true
            profileOpenedFromConnections.value = false
        },
        openProfilePost = { selectedPostId.value = it },
        openStoryAdDestination = { adDestination ->
            dispatchStoryAdDestination(
                destination = adDestination,
                onProduct = { productId ->
                    selectedStoreId.value = null
                    selectedBrandId.value = null
                    pendingMartProductId.value = productId
                    destination.value = Destination.Mart
                },
                onStore = { selectedStoreId.value = it },
                onPost = { selectedPostId.value = it },
                onProfile = {
                    selectedProfileId.value = it
                    profileOpenedFromConnections.value = false
                },
                onMessages = { destination.value = Destination.Messages },
                onExternal = environment.openExternalStoryDestination,
            )
        },
        searchProfile = { userId, username ->
            selectedProfileId.value = null
            searchScope.value = "profile:$userId"
            searchScopeLabel.value = "@" + username.removePrefix("@")
            destination.value = Destination.Discover
        },
        openConnections = environment.openConnections,
        openConnectionProfile = { userId ->
            selectedProfileId.value = userId
            profileOpenedFromConnections.value = true
            showingConnections.value = false
        },
        backFromConnections = {
            showingConnections.value = false
            selectedConnectionsUserId.value = null
        },
        requireSignIn = environment.requireSignIn,
        requireSignInWithAction = environment.requireSignInWithAction,
        openConversation = { conversation ->
            pendingMessageConversation.value = conversation
            showingConnections.value = false
            selectedConnectionsUserId.value = null
            destination.value = Destination.Messages
        },
    )
}
