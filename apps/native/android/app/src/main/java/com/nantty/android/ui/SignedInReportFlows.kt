package com.nantty.android.ui

import androidx.compose.runtime.Composable
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.FeedPost
import com.nantty.android.ui.clips.ClipCommentReportFlow
import com.nantty.android.ui.clips.rememberClipCommentReportFlow

internal data class SignedInReportFlows(
    val post: (FeedPost) -> Unit,
    val clipComments: ClipCommentReportFlow,
)

@Composable
internal fun rememberSignedInReportFlows(
    sessionRepository: AccountSessionRepository,
    isGuest: Boolean,
    onRequireSignIn: () -> Unit,
    onAuthenticationRequired: () -> Unit,
): SignedInReportFlows = SignedInReportFlows(
    post = rememberFeedPostReportFlow(sessionRepository, isGuest, onRequireSignIn, onAuthenticationRequired),
    clipComments = rememberClipCommentReportFlow(sessionRepository, isGuest, onRequireSignIn, onAuthenticationRequired),
)
