package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.nantty.android.data.FeedType

/** Keeps account-entry feed selection and followed-topic loading out of the app composition root. */
@Composable
internal fun SignedInFeedStartupEffects(
    accountId: String?,
    isGuest: Boolean,
    initialFollowingAfterSignIn: Boolean,
    accessToken: String?,
    onSelectFeed: (FeedType) -> Unit,
    onInitialFollowingHandled: () -> Unit,
    onLoadTopics: (String?) -> Unit,
) {
    LaunchedEffect(accountId, isGuest, initialFollowingAfterSignIn) {
        if (!isGuest && initialFollowingAfterSignIn) {
            onSelectFeed(FeedType.FOLLOWING)
            onInitialFollowingHandled()
        }
    }
    LaunchedEffect(accountId) {
        if (!isGuest) onLoadTopics(accessToken)
    }
}
