package com.nantty.android.ui.live

import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import com.nantty.android.R
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.ui.stories.UserReportDialog
import java.util.concurrent.Executor

@Composable
internal fun LiveHostAccountReportAction(
    liveId: String,
    hostId: String,
    hostUsername: String,
    repository: ProductReportRepository,
    executor: Executor,
    onReauthenticate: () -> Unit,
) {
    var visible by remember(hostId) { mutableStateOf(false) }
    TextButton(onClick = { visible = true }, modifier = Modifier.testTag("live-host-report-open")) {
        Text(stringResource(R.string.live_report_host_action, hostUsername))
    }
    if (visible) {
        UserReportDialog(
            repository = repository,
            authorId = hostId,
            reportKey = "live-host-$liveId-$hostId",
            executor = executor,
            onDismiss = { visible = false },
            onReauthenticate = onReauthenticate,
        )
    }
}
