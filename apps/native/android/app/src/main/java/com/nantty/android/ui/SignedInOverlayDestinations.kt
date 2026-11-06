package com.nantty.android.ui

import androidx.compose.runtime.Composable
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.PublicBrandRepository
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoryAdsRepository
import com.nantty.android.data.StoryAdDestination
import com.nantty.android.data.SoundsRepository
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.FeedQuotedPost
import java.util.concurrent.Executor

/** Selection for full-screen destinations layered over the signed-in navigation shell. */
internal enum class SignedInComposerMode { CLOSED, POST, STORY }

internal data class SignedInOverlaySelection(
    val composerMode: SignedInComposerMode,
    val quotedPostForComposer: FeedQuotedPost?,
    val selectedPostId: String?,
    val selectedPostCommentId: String?,
    val selectedStoreId: String?,
    val selectedBrandId: String?,
    val isGuest: Boolean,
    val selectedProfileId: String?,
    val showingConnections: Boolean,
    val selectedConnectionsUserId: String?,
    val selectedConnectionsTab: String,
)

internal data class SignedInOverlayDependencies(
    val sessionRepository: AccountSessionRepository,
    val publicProfileRepository: PublicProfileRepository,
    val storeRepository: StoreRepository,
    val brandRepository: PublicBrandRepository,
    val messagesRepository: MessagesRepository,
    val storiesRepository: StoriesRepository,
    val storyAdsRepository: StoryAdsRepository,
    val soundsRepository: SoundsRepository,
    val storyMediaRepository: CreatorSampleMediaRepository,
    val executor: Executor,
)

internal data class SignedInOverlayActions(
    val cancelComposer: () -> Unit,
    val publishedPost: (String) -> Unit,
    val storyPublished: (String) -> Unit,
    val backFromPost: (String?) -> Unit,
    val backFromStore: () -> Unit,
    val searchStore: (String?, String?) -> Unit,
    val backFromBrand: () -> Unit,
    val openStore: (String) -> Unit,
    val openProduct: (String) -> Unit,
    val backFromProfile: () -> Unit,
    val openProfilePost: (String) -> Unit,
    val openStoryAdDestination: (StoryAdDestination) -> Unit,
    val searchProfile: (String, String) -> Unit,
    val openConnections: (String, String) -> Unit,
    val openConnectionProfile: (String) -> Unit,
    val backFromConnections: () -> Unit,
    val requireSignIn: () -> Unit,
    val requireSignInWithAction: ((() -> Unit) -> Unit),
    val openConversation: (InboxConversation) -> Unit,
)

/** Renders modal/full-screen profile and content destinations before the primary tab shell. */
@Composable
internal fun SignedInOverlayDestinations(
    selection: SignedInOverlaySelection,
    dependencies: SignedInOverlayDependencies,
    actions: SignedInOverlayActions,
): Boolean {
    if (selection.composerMode != SignedInComposerMode.CLOSED) {
        HingeSafeContent {
            PostComposerScreen(
                sessionProvider = dependencies.sessionRepository::sessionOrNull,
                executor = dependencies.executor,
                storiesRepository = dependencies.storiesRepository,
                soundsRepository = dependencies.soundsRepository,
                storyMediaRepository = dependencies.storyMediaRepository,
                startInStoryMode = selection.composerMode == SignedInComposerMode.STORY,
                quoteTarget = selection.quotedPostForComposer,
                onCancel = actions.cancelComposer,
                onPublished = actions.publishedPost,
                onStoryPublished = actions.storyPublished,
                onReauthenticate = actions.requireSignIn,
            )
        }
        return true
    }

    selection.selectedPostId?.let { postId ->
        HingeSafeContent {
            PostDetailScreen(
                postId = postId,
                initialCommentId = selection.selectedPostCommentId,
                sessionProvider = dependencies.sessionRepository::sessionOrNull,
                executor = dependencies.executor,
                onBack = { actions.backFromPost(null) },
                onOpenPost = { actions.backFromPost(it) },
            )
        }
        return true
    }

    selection.selectedStoreId?.let { storeId ->
        HingeSafeContent {
            PublicStoreScreen(
                storeId = storeId,
                repository = dependencies.storeRepository,
                executor = dependencies.executor,
                onBack = actions.backFromStore,
                onRequireSignIn = actions.requireSignIn,
                onOpenProduct = actions.openProduct,
                onSearchStore = actions.searchStore,
            )
        }
        return true
    }

    selection.selectedBrandId?.let { brandId ->
        HingeSafeContent {
            PublicBrandScreen(
                brandId = brandId,
                repository = dependencies.brandRepository,
                profileRepository = dependencies.publicProfileRepository,
                onBack = actions.backFromBrand,
                onOpenStore = actions.openStore,
                onOpenProduct = actions.openProduct,
                onOpenPost = actions.openProfilePost,
                onRequireSignIn = actions.requireSignIn,
                onRequireSignInWithAction = actions.requireSignInWithAction,
                isGuest = selection.isGuest,
            )
        }
        return true
    }

    selection.selectedProfileId?.takeIf { !selection.showingConnections }?.let { profileId ->
        PublicProfileDestination(
            userId = profileId,
            repository = dependencies.publicProfileRepository,
            storiesRepository = dependencies.storiesRepository,
            storyAdsRepository = dependencies.storyAdsRepository,
            executor = dependencies.executor,
            onBack = actions.backFromProfile,
            onOpenPost = actions.openProfilePost,
            onOpenStoryAdDestination = actions.openStoryAdDestination,
            onSearchProfile = actions.searchProfile,
            onOpenConnections = actions.openConnections,
            onReauthenticate = actions.requireSignIn,
        )
        return true
    }

    val connectionsUserId = selection.selectedConnectionsUserId
    if (selection.showingConnections && connectionsUserId != null) {
        ProfileConnectionsOverlay(
            userId = connectionsUserId,
            initialTab = selection.selectedConnectionsTab,
            repository = dependencies.publicProfileRepository,
            executor = dependencies.executor,
            messagesRepository = dependencies.messagesRepository,
            onBack = actions.backFromConnections,
            onOpenProfile = actions.openConnectionProfile,
            onRequireSignIn = actions.requireSignIn,
            onOpenConversation = actions.openConversation,
        )
        return true
    }

    return false
}
