package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.LiveCoinTipRepository
import com.nantty.android.data.LiveCommentsRepository
import com.nantty.android.data.LiveSessionsRepository

/** Session-bound API clients for the ordinary Live experience. */
internal data class SignedInLiveRepositories(
    val sessions: LiveSessionsRepository,
    val coinTips: LiveCoinTipRepository,
    val comments: LiveCommentsRepository,
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
    return remember(sessions, coinTips, comments) {
        SignedInLiveRepositories(sessions, coinTips, comments)
    }
}
