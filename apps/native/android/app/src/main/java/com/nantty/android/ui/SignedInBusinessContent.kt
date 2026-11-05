package com.nantty.android.ui

import androidx.compose.runtime.Composable
import com.nantty.android.data.AdsWorkspaceRepository
import com.nantty.android.data.BrandProfilesRepository
import com.nantty.android.data.CreatorWorkspaceRepository
import com.nantty.android.data.SellerWorkspaceRepository
import com.nantty.android.data.SellerOrdersRepository
import com.nantty.android.data.SellerShipmentRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.StartConversationResult
import androidx.compose.runtime.snapshots.Snapshot
import java.util.concurrent.Executor

internal fun buildSignedInBusinessContent(
    repositories: SignedInRepositories,
    executor: Executor,
    onReauthenticate: () -> Unit,
    onConversationStarted: (InboxConversation) -> Unit,
    onMessageFailure: (String, Boolean) -> Unit,
    onOpenBuyerProfile: (String) -> Unit,
    onBack: () -> Unit,
): @Composable () -> Unit = {
    SignedInBusinessContent(
        sellerRepository = repositories.sellerWorkspace,
        creatorRepository = repositories.creatorWorkspace,
        brandRepository = repositories.brandProfiles,
        adsRepository = repositories.adsWorkspace,
        sellerOrdersRepository = repositories.sellerOrders,
        sellerShipmentRepository = repositories.sellerShipment,
        disputeRepository = repositories.disputes,
        executor = executor,
        onReauthenticate = onReauthenticate,
        onMessageBuyer = { buyerId ->
            startSellerBuyerConversation(
                buyerId = buyerId,
                repository = repositories.messages,
                executor = executor,
                onStarted = onConversationStarted,
                onFailed = onMessageFailure,
            )
        },
        onOpenBuyerProfile = onOpenBuyerProfile,
        onBack = onBack,
    )
}

internal fun startSellerBuyerConversation(
    buyerId: String,
    repository: MessagesRepository,
    executor: Executor,
    onStarted: (InboxConversation) -> Unit,
    onFailed: (String, Boolean) -> Unit,
) {
    executor.execute {
        when (val started = repository.startConversationWithPerson(buyerId)) {
            is StartConversationResult.Success -> Snapshot.withMutableSnapshot { onStarted(started.conversation) }
            is StartConversationResult.Failure -> Snapshot.withMutableSnapshot {
                onFailed(started.message, started.authenticationRequired)
            }
        }
    }
}

/** Signed-in business destinations grouped behind the business-tools entry point. */
@Composable
internal fun SignedInBusinessContent(
    sellerRepository: SellerWorkspaceRepository,
    creatorRepository: CreatorWorkspaceRepository,
    brandRepository: BrandProfilesRepository,
    adsRepository: AdsWorkspaceRepository,
    sellerOrdersRepository: SellerOrdersRepository,
    sellerShipmentRepository: SellerShipmentRepository,
    disputeRepository: DisputeRepository,
    executor: Executor,
    onReauthenticate: () -> Unit,
    onMessageBuyer: (String) -> Unit,
    onOpenBuyerProfile: (String) -> Unit = {},
    onBack: () -> Unit,
) {
    BusinessWorkspaceScreen(
        sellerContent = {
            SellerWorkspaceScreen(
                repository = sellerRepository,
                sellerOrdersRepository = sellerOrdersRepository,
                sellerShipmentRepository = sellerShipmentRepository,
                disputeRepository = disputeRepository,
                executor = executor,
                onAuthenticationRequired = onReauthenticate,
                onMessageBuyer = onMessageBuyer,
                onOpenBuyerProfile = onOpenBuyerProfile,
            )
        },
        creatorContent = {
            CreatorWorkspaceScreen(
                repository = creatorRepository,
                executor = executor,
                onReauthenticate = onReauthenticate,
            )
        },
        brandContent = {
            BrandProfilesScreen(
                repository = brandRepository,
                executor = executor,
                onReauthenticate = onReauthenticate,
            )
        },
        adsContent = {
            AdsWorkspaceScreen(
                repository = adsRepository,
                executor = executor,
                onReauthenticate = onReauthenticate,
            )
        },
        onBack = onBack,
    )
}
