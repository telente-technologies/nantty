package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.LiveCoinTipRepository
import com.nantty.android.data.LiveCommentsRepository
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.LiveStageRepository
import com.nantty.android.data.ProductReportRepository

/** Session-bound API clients for the ordinary Live experience. */
internal data class SignedInLiveRepositories(
    val sessions: LiveSessionsRepository,
    val coinTips: LiveCoinTipRepository,
    val comments: LiveCommentsRepository,
    val stage: LiveStageRepository,
    val reports: ProductReportRepository,
)

@Composable
internal fun rememberSignedInLiveRepositories(sessionRepository: AccountSessionRepository): SignedInLiveRepositories {
    val sessions = remember(sessionRepository) {
        LiveSessionsRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val coinTips = remember(sessionRepository) {
        LiveCoinTipRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val comments = remember(sessionRepository) {
        LiveCommentsRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val stage = remember(sessionRepository) {
        LiveStageRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val reports = remember(sessionRepository) {
        ProductReportRepository(accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken })
    }
    return remember(sessions, coinTips, comments, stage, reports) {
        SignedInLiveRepositories(sessions, coinTips, comments, stage, reports)
    }
}
