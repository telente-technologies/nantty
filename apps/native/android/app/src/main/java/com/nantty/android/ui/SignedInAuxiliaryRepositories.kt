package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.ContentPreferencesRepository
import com.nantty.android.data.EncryptedProductAdEventStore
import com.nantty.android.data.PostAnalyticsRepository
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.ProductAdsRepository
import com.nantty.android.data.PublicBrandRepository
import com.nantty.android.data.SoundsRepository
import com.nantty.android.data.SpacesRepository
import com.nantty.android.data.StoriesRepository
import java.util.concurrent.Executor

/** Session-owned repositories that are not part of the broad shared feature repository bundle. */
internal data class SignedInAuxiliaryRepositories(
    val publicBrand: PublicBrandRepository,
    val spaces: SpacesRepository,
    val contentPreferences: ContentPreferencesRepository,
    val productAds: ProductAdsRepository,
    val live: SignedInLiveRepositories,
    val stories: StoriesRepository,
    val sounds: SoundsRepository,
    val postDetails: PostDetailRepository,
    val postAnalytics: PostAnalyticsRepository,
    val chatPasscode: ChatPasscodeRepository,
)

@Composable
internal fun rememberSignedInAuxiliaryRepositories(
    sessionRepository: AccountSessionRepository,
    executor: Executor,
): SignedInAuxiliaryRepositories {
    val appContext = LocalContext.current.applicationContext
    val adEventStore = remember(appContext) { EncryptedProductAdEventStore(appContext) }
    val productAds = remember(sessionRepository, adEventStore) {
        ProductAdsRepository(
            accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken },
            accountIdProvider = { sessionRepository.sessionOrNull()?.user?.id },
            pendingEventStore = adEventStore,
        )
    }
    ProductAdEventFlushEffect(productAds, executor)
    val publicBrand = rememberPublicBrandRepository(sessionRepository)
    val spaces = remember { SpacesRepository() }
    val contentPreferences = remember(sessionRepository) {
        ContentPreferencesRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val live = rememberSignedInLiveRepositories(sessionRepository)
    val stories = remember(sessionRepository) { StoriesRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val sounds = remember(sessionRepository) { SoundsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val postDetails = remember(sessionRepository) { PostDetailRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val postAnalytics = remember(sessionRepository) { PostAnalyticsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val chatPasscode = remember(appContext) { ChatPasscodeRepository(appContext) }
    return remember(
        publicBrand,
        spaces,
        contentPreferences,
        productAds,
        live,
        stories,
        sounds,
        postDetails,
        postAnalytics,
        chatPasscode,
    ) {
        SignedInAuxiliaryRepositories(
            publicBrand,
            spaces,
            contentPreferences,
            productAds,
            live,
            stories,
            sounds,
            postDetails,
            postAnalytics,
            chatPasscode,
        )
    }
}
