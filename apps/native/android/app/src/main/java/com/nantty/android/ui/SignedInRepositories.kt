package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.AdsWorkspaceRepository
import com.nantty.android.data.BrandProfilesRepository
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.CartRepository
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.CreatorWorkspaceRepository
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.ExploreRepository
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.MartRepository
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.ProfileImageRepository
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SellerWorkspaceRepository
import com.nantty.android.data.SellerOrdersRepository
import com.nantty.android.data.SellerShipmentRepository
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.WalletRepository

/** Session-scoped data dependencies shared by the signed-in app destinations. */
internal data class SignedInRepositories(
    val wallet: WalletRepository,
    val cart: CartRepository,
    val checkout: CheckoutRepository,
    val buyerOrders: BuyerOrdersRepository,
    val disputes: DisputeRepository,
    val notifications: NotificationsRepository,
    val accountNotificationSettings: AccountNotificationSettingsRepository,
    val messages: MessagesRepository,
    val search: SearchRepository,
    val explore: ExploreRepository,
    val savedPosts: SavedPostsRepository,
    val mart: MartRepository,
    val publicProfile: PublicProfileRepository,
    val store: StoreRepository,
    val currentProfile: CurrentProfileRepository,
    val followRequests: FollowRequestsRepository,
    val sellerWorkspace: SellerWorkspaceRepository,
    val creatorWorkspace: CreatorWorkspaceRepository,
    val brandProfiles: BrandProfilesRepository,
    val adsWorkspace: AdsWorkspaceRepository,
    val profileImages: ProfileImageRepository,
    val privateMediaUploads: CreatorSampleMediaRepository,
    val sellerOrders: SellerOrdersRepository,
    val sellerShipment: SellerShipmentRepository,
)

@Composable
internal fun rememberSignedInRepositories(sessionRepository: AccountSessionRepository): SignedInRepositories {
    val wallet = remember(sessionRepository) { WalletRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val cart = remember(sessionRepository) { CartRepository(accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken }) }
    val checkout = remember(sessionRepository) { CheckoutRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val buyerOrders = remember(sessionRepository) { BuyerOrdersRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val disputes = remember(sessionRepository) { DisputeRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val notifications = remember(sessionRepository) { NotificationsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val accountNotificationSettings = remember(sessionRepository) { AccountNotificationSettingsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val messages = remember(sessionRepository) {
        MessagesRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val search = remember(sessionRepository) { SearchRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val explore = remember(sessionRepository) { ExploreRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val savedPosts = remember(sessionRepository) { SavedPostsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val mart = remember(sessionRepository) { MartRepository(accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken }) }
    val publicProfile = remember(sessionRepository) { PublicProfileRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val store = remember(sessionRepository) {
        StoreRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val currentProfile = remember(sessionRepository) { CurrentProfileRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val followRequests = remember(sessionRepository) { FollowRequestsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val sellerWorkspace = remember(sessionRepository) { SellerWorkspaceRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val creatorWorkspace = remember(sessionRepository) {
        CreatorWorkspaceRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val brandProfiles = remember(sessionRepository) { BrandProfilesRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val adsWorkspace = remember(sessionRepository) {
        AdsWorkspaceRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val profileImages = remember(sessionRepository) { ProfileImageRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val privateMediaUploads = remember(sessionRepository) {
        CreatorSampleMediaRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val sellerOrders = remember(sessionRepository) { SellerOrdersRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val sellerShipment = remember(sessionRepository) { SellerShipmentRepository(sessionProvider = sessionRepository::sessionOrNull) }

    return remember(
        wallet,
        cart,
        checkout,
        buyerOrders,
        disputes,
        notifications,
        accountNotificationSettings,
        messages,
        search,
        explore,
        savedPosts,
        mart,
        publicProfile,
        store,
        currentProfile,
        followRequests,
        sellerWorkspace,
        creatorWorkspace,
        brandProfiles,
        adsWorkspace,
        profileImages,
        privateMediaUploads,
        sellerOrders,
        sellerShipment,
    ) {
        SignedInRepositories(
            wallet,
            cart,
            checkout,
            buyerOrders,
            disputes,
            notifications,
            accountNotificationSettings,
            messages,
            search,
            explore,
            savedPosts,
            mart,
            publicProfile,
            store,
            currentProfile,
            followRequests,
            sellerWorkspace,
            creatorWorkspace,
            brandProfiles,
            adsWorkspace,
            profileImages,
            privateMediaUploads,
            sellerOrders,
            sellerShipment,
        )
    }
}
