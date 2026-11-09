package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.nantty.android.data.ClipWatchTrackingRepository
import com.nantty.android.data.ClipsRepository
import com.nantty.android.data.LiveCommentsRepository
import com.nantty.android.data.LiveCoinTipRepository
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.LiveStageRepository
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.SpacesRepository
import java.util.concurrent.Executor

/** Routes media destinations whose lifecycle and data dependencies are independent of the feed. */
@Composable
internal fun MainRealtimeDestination(
    destination: Destination,
    liveSessionsRepository: LiveSessionsRepository?,
    liveCoinTipRepository: LiveCoinTipRepository?,
    liveCommentsRepository: LiveCommentsRepository?,
    liveStageRepository: LiveStageRepository?,
    liveReportRepository: ProductReportRepository?,
    initialLiveId: String?,
    clipsRepository: ClipsRepository?,
    postDetailRepository: PostDetailRepository?,
    publicProfileRepository: PublicProfileRepository?,
    ioExecutor: Executor?,
    clipWatchTrackingRepository: ClipWatchTrackingRepository,
    canViewFollowing: Boolean,
    onSignInRequired: () -> Unit,
    onSignInRequiredWithAction: ((() -> Unit) -> Unit),
    onReauthenticate: () -> Unit,
    onClipReauthenticate: () -> Unit,
    onOpenSearch: () -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenClipComments: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    initialClipId: String?,
    onInitialClipHandled: () -> Unit,
    spacesRepository: SpacesRepository?,
    spacesAccessToken: String?,
    spacesViewerId: String?,
    initialSpaceId: String?,
    onInitialSpaceHandled: () -> Unit,
    onBackFromLive: () -> Unit,
    modifier: Modifier,
): Boolean {
    val executor = ioExecutor
    if (destination == Destination.Live && liveSessionsRepository != null && liveCoinTipRepository != null && liveCommentsRepository != null && liveStageRepository != null && executor != null && initialLiveId != null) {
        com.nantty.android.ui.live.LiveWatchScreen(
            liveId = initialLiveId,
            sessions = liveSessionsRepository,
            coinTips = liveCoinTipRepository,
            comments = liveCommentsRepository,
            stage = liveStageRepository,
            reports = liveReportRepository,
            executor = executor,
            onBack = onBackFromLive,
            onReauthenticate = onReauthenticate,
            modifier = modifier,
        )
        return true
    }
    if (destination == Destination.Clips && clipsRepository != null && postDetailRepository != null && publicProfileRepository != null && executor != null) {
        com.nantty.android.ui.clips.ClipsScreen(
            repository = clipsRepository,
            postRepository = postDetailRepository,
            profileRepository = publicProfileRepository,
            executor = executor,
            watchTrackingRepository = clipWatchTrackingRepository,
            isGuest = !canViewFollowing,
            onSignInRequiredWithAction = onSignInRequiredWithAction,
            onReauthenticate = onClipReauthenticate,
            onOpenSearch = onOpenSearch,
            onOpenPost = onOpenPost,
            onOpenClipComments = onOpenClipComments,
            onOpenProfile = onOpenProfile,
            initialClipId = initialClipId,
            onInitialClipHandled = onInitialClipHandled,
            modifier = modifier,
        )
        return true
    }
    if (destination == Destination.Spaces && spacesRepository != null && executor != null) {
        com.nantty.android.ui.spaces.SpacesScreen(
            repository = spacesRepository,
            accessToken = spacesAccessToken,
            viewerId = spacesViewerId,
            executor = executor,
            onSignInRequired = onSignInRequired,
            initialSpaceId = initialSpaceId,
            onInitialSpaceHandled = onInitialSpaceHandled,
            modifier = modifier,
        )
        return true
    }
    return false
}
