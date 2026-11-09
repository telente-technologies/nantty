package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.AccountHealthRepository
import com.nantty.android.data.IdentityVerificationRepository
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.ClipWatchTrackingRepository
import com.nantty.android.data.SharedPreferencesClipWatchPendingInteractionStore
import com.nantty.android.data.ClipsRepository
import com.nantty.android.data.AdsWorkspaceRepository
import com.nantty.android.data.BrandProfilesRepository
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerReturnsRepository
import com.nantty.android.data.CountryPreferenceRepository
import com.nantty.android.data.ChatNotificationSettingsRepository
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.ProductInteractionRepository
import com.nantty.android.data.CartRepository
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.ShippingAddressesRepository
import com.nantty.android.data.ProviderWalletPaymentRepository
import com.nantty.android.data.SavedCardCredentialStore
import com.nantty.android.data.AndroidSavedCardCredentialStore
import com.nantty.android.data.SavedCardRepository
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.CreatorWorkspaceRepository
import com.nantty.android.data.CreatorAffiliatesRepository
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.ExploreRepository
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.MartRepository
import com.nantty.android.data.MentionPrivacyRepository
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicBrandRepository
import com.nantty.android.data.ProfileImageRepository
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SellerWorkspaceRepository
import com.nantty.android.data.SellerOrdersRepository
import com.nantty.android.data.SellerReturnsRepository
import com.nantty.android.data.SellerCatalogRepository
import com.nantty.android.data.SellerShipmentRepository
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.SupportTicketRepository
import com.nantty.android.data.WalletRepository
import com.nantty.android.data.StoryAdsRepository

/** Session-scoped data dependencies shared by the signed-in app destinations. */
internal data class SignedInRepositories(
    val wallet: WalletRepository,
    val cart: CartRepository,
    val checkout: CheckoutRepository,
    val providerWalletPayments: ProviderWalletPaymentRepository,
    val buyerOrders: BuyerOrdersRepository,
    val buyerReturns: BuyerReturnsRepository,
    val productReviews: ProductReviewsRepository,
    val disputes: DisputeRepository,
    val notifications: NotificationsRepository,
    val accountNotificationSettings: AccountNotificationSettingsRepository,
    val countryPreference: CountryPreferenceRepository,
    val mentionPrivacy: MentionPrivacyRepository,
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
    val creatorAffiliates: CreatorAffiliatesRepository,
    val brandProfiles: BrandProfilesRepository,
    val adsWorkspace: AdsWorkspaceRepository,
    val profileImages: ProfileImageRepository,
    val privateMediaUploads: CreatorSampleMediaRepository,
    val sellerOrders: SellerOrdersRepository,
    val sellerCatalog: SellerCatalogRepository,
    val sellerShipment: SellerShipmentRepository,
    val chatNotificationSettings: ChatNotificationSettingsRepository,
    val supportTickets: SupportTicketRepository,
    val clipWatchTracking: ClipWatchTrackingRepository,
    val storyAds: StoryAdsRepository,
    val clips: ClipsRepository,
    val savedCards: SavedCardRepository,
    val savedCardCredentials: SavedCardCredentialStore,
    val accountHealth: AccountHealthRepository,
    val identityVerification: IdentityVerificationRepository,
    val shippingAddresses: ShippingAddressesRepository,
    val sellerReturns: SellerReturnsRepository,
)

@Composable
internal fun rememberSignedInRepositories(sessionRepository: AccountSessionRepository): SignedInRepositories {
    val appContext = LocalContext.current.applicationContext
    val wallet = remember(sessionRepository) {
        WalletRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val affiliateVisitorIds = remember(appContext) { com.nantty.android.data.AffiliateVisitorIdStore(appContext) }
    val productInteractions = remember(sessionRepository) {
        ProductInteractionRepository(
            accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken },
        )
    }
    val cart = remember(sessionRepository, productInteractions) {
        CartRepository(
            accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken },
            productInteractionRepository = productInteractions,
        )
    }
    val checkout = remember(sessionRepository) { CheckoutRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val providerWalletPayments = remember(sessionRepository) { ProviderWalletPaymentRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val savedCards = remember(sessionRepository) { SavedCardRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val savedCardCredentials = remember(appContext, sessionRepository) {
        AndroidSavedCardCredentialStore(appContext) { sessionRepository.sessionOrNull()?.user?.id }
    }
    val buyerOrders = remember(sessionRepository) { BuyerOrdersRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val buyerReturns = remember(sessionRepository) { BuyerReturnsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val productReviews = remember(sessionRepository) { ProductReviewsRepository(accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken }) }
    val disputes = remember(sessionRepository) { DisputeRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val notifications = remember(sessionRepository) { NotificationsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val accountNotificationSettings = remember(sessionRepository) { AccountNotificationSettingsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val accountHealth = remember(sessionRepository) { AccountHealthRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val identityVerification = remember(sessionRepository) {
        IdentityVerificationRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val shippingAddresses = remember(sessionRepository) {
        ShippingAddressesRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val countryPreference = remember(sessionRepository) {
        CountryPreferenceRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val mentionPrivacy = remember(sessionRepository) {
        MentionPrivacyRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val messages = remember(sessionRepository) {
        MessagesRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val search = remember(sessionRepository, productInteractions) {
        SearchRepository(sessionProvider = sessionRepository::sessionOrNull, productInteractionRepository = productInteractions)
    }
    val explore = remember(sessionRepository) { ExploreRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val savedPosts = remember(sessionRepository) { SavedPostsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val mart = remember(sessionRepository, affiliateVisitorIds) {
        MartRepository(
            accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken },
            accountIdProvider = { sessionRepository.sessionOrNull()?.user?.id },
            affiliateVisitorIdProvider = affiliateVisitorIds::getOrCreate,
        )
    }
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
    val creatorAffiliates = remember(sessionRepository) {
        CreatorAffiliatesRepository(
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
    val sellerReturns = remember(sessionRepository) { SellerReturnsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val sellerCatalog = remember(sessionRepository, privateMediaUploads) {
        SellerCatalogRepository(sessionProvider = sessionRepository::sessionOrNull, mediaUploads = privateMediaUploads)
    }
    val sellerShipment = remember(sessionRepository) { SellerShipmentRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val chatNotificationSettings = remember(sessionRepository) {
        ChatNotificationSettingsRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val supportTickets = remember(sessionRepository) {
        SupportTicketRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val clipWatchTracking = remember(sessionRepository, brandProfiles, appContext) {
        ClipWatchTrackingRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            actingProfileIdProvider = brandProfiles::activeProfileIdOrNull,
            pendingInteractionStore = SharedPreferencesClipWatchPendingInteractionStore(appContext),
        )
    }
    val clips = remember(sessionRepository) { ClipsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val storyAds = remember(sessionRepository) {
        StoryAdsRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }

    return remember(
        wallet,
        cart,
        checkout,
        providerWalletPayments,
        buyerOrders,
        buyerReturns,
        productReviews,
        disputes,
        notifications,
        accountNotificationSettings,
        countryPreference,
        mentionPrivacy,
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
        creatorAffiliates,
        brandProfiles,
        adsWorkspace,
        profileImages,
        privateMediaUploads,
        sellerOrders,
        sellerCatalog,
        sellerShipment,
        chatNotificationSettings,
        supportTickets,
        clipWatchTracking,
        storyAds,
        clips,
        savedCards,
        savedCardCredentials,
        accountHealth,
        identityVerification,
        shippingAddresses,
        sellerReturns,
    ) {
        SignedInRepositories(
            wallet,
            cart,
            checkout,
            providerWalletPayments,
            buyerOrders,
            buyerReturns,
            productReviews,
            disputes,
            notifications,
            accountNotificationSettings,
            countryPreference,
            mentionPrivacy,
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
            creatorAffiliates,
            brandProfiles,
            adsWorkspace,
            profileImages,
            privateMediaUploads,
            sellerOrders,
            sellerCatalog,
            sellerShipment,
            chatNotificationSettings,
            supportTickets,
            clipWatchTracking,
            storyAds,
            clips,
            savedCards,
            savedCardCredentials,
            accountHealth,
            identityVerification,
            shippingAddresses,
            sellerReturns,
        )
    }
}

@Composable
internal fun rememberPublicBrandRepository(sessionRepository: AccountSessionRepository): PublicBrandRepository =
    remember(sessionRepository) { PublicBrandRepository(sessionProvider = sessionRepository::sessionOrNull) }
