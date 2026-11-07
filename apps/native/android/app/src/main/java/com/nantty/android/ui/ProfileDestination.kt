package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.ProfileImageRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.SupportTicketRepository
import java.util.concurrent.Executor

/** Owns profile and follow-request destinations as one feature-level route boundary. */
@Composable
internal fun ProfileDestination(
    destination: Destination,
    profileRepository: CurrentProfileRepository?,
    followRequestsRepository: FollowRequestsRepository?,
    executor: Executor?,
    modifier: Modifier,
    onOpenBusinessTools: () -> Unit,
    onOpenCountryPreferences: () -> Unit,
    onOpenContentPreferences: () -> Unit,
    onOpenConnections: (String, String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onSearchProfile: (String, String) -> Unit,
    publicProfileRepository: PublicProfileRepository?,
    profileImagesRepository: ProfileImageRepository?,
    onOpenPost: (String) -> Unit,
    supportTicketRepository: SupportTicketRepository?,
    supportMediaRepository: CreatorSampleMediaRepository?,
    buyerOrdersRepository: BuyerOrdersRepository?,
    onBackFromFollowRequests: () -> Unit,
    onReauthenticate: () -> Unit,
): Boolean {
    when (destination) {
        Destination.Profile -> {
            val repository = profileRepository ?: return false
            val backgroundExecutor = executor ?: return false
            CurrentProfileScreen(
                repository = repository,
                executor = backgroundExecutor,
                modifier = modifier,
                onOpenBusinessTools = onOpenBusinessTools,
                onOpenCountryPreferences = onOpenCountryPreferences,
                onOpenContentPreferences = onOpenContentPreferences,
                onOpenConnections = onOpenConnections,
                onOpenProfile = onOpenProfile,
                onSearchProfile = onSearchProfile,
                publicProfileRepository = publicProfileRepository,
                profileImagesRepository = profileImagesRepository,
                onOpenPost = onOpenPost,
                followRequestsRepository = followRequestsRepository,
                supportTicketRepository = supportTicketRepository,
                supportMediaRepository = supportMediaRepository,
                buyerOrdersRepository = buyerOrdersRepository,
                onReauthenticate = onReauthenticate,
            )
        }

        Destination.FollowRequests -> {
            val repository = followRequestsRepository ?: return false
            val backgroundExecutor = executor ?: return false
            FollowRequestsScreen(
                repository = repository,
                executor = backgroundExecutor,
                onBack = onBackFromFollowRequests,
                onReauthenticate = onReauthenticate,
                onOpenProfile = onOpenProfile,
                modifier = modifier,
            )
        }

        else -> return false
    }
    return true
}
