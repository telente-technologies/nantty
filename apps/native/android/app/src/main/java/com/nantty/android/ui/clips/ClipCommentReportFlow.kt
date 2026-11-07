package com.nantty.android.ui.clips

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.ui.FeedPostReportDialog

internal data class ClipCommentReportFlow(
    val reportablePostId: String?,
    val openComments: (String) -> Unit,
    val leaveClipPost: () -> Unit,
    val reportComment: (String) -> Unit,
)

@Composable
internal fun rememberClipCommentReportFlow(
    sessionRepository: AccountSessionRepository,
    isGuest: Boolean,
    onRequireSignIn: () -> Unit,
    onAuthenticationRequired: () -> Unit,
): ClipCommentReportFlow {
    var reportablePostId by rememberSaveable { mutableStateOf<String?>(null) }
    var reportingCommentId by rememberSaveable { mutableStateOf<String?>(null) }
    val repository = remember(sessionRepository) {
        ProductReportRepository(accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken })
    }
    FeedPostReportDialog(
        postId = reportingCommentId,
        repository = repository,
        onDismiss = { reportingCommentId = null },
        onAuthenticationRequired = onAuthenticationRequired,
        targetType = "comment",
    )
    return remember(reportablePostId, isGuest, onRequireSignIn) {
        ClipCommentReportFlow(
            reportablePostId = reportablePostId,
            openComments = { reportablePostId = it },
            leaveClipPost = { reportablePostId = null },
            reportComment = { commentId ->
                if (isGuest) onRequireSignIn() else reportingCommentId = commentId
            },
        )
    }
}
