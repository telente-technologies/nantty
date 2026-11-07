package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ChatStreak

@Composable
internal fun ConversationStreakDialog(
    peerName: String,
    streak: ChatStreak,
    restorePending: Boolean,
    restoreError: String?,
    onRestore: () -> Unit,
    onDismiss: () -> Unit,
) {
    val canRestore = streak.state == "broken" && streak.restorableUntil != null && streak.restoresRemaining > 0
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                when (streak.state) {
                    "broken" -> "Streak lost"
                    else -> "${streak.count} day streak with $peerName"
                },
            )
        },
        text = {
            Column(
                Modifier.fillMaxWidth().semantics { contentDescription = "Streak details with $peerName" },
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(when {
                    streak.state == "broken" && streak.restorableUntil != null ->
                        "Bring back your ${streak.countBeforeBreak}-day streak for both of you before the restore window closes."
                    streak.state == "broken" -> "The restore window has passed. You can start a new streak by messaging each other."
                    streak.hourglass -> "Your local day is nearly over. Send a message today to keep the streak going."
                    else -> "Both of you need to send a message on your own local day. ${if (streak.sentTodayMe) "You sent today." else "You have not sent today."} ${if (streak.sentTodayPeer) "$peerName sent today." else "$peerName has not sent today."}"
                })
                if (streak.hourglass && streak.state == "active") {
                    Text("Time left today: ${formatStreakTime(streak.secondsUntilMyDayEnds)}", color = MaterialTheme.colorScheme.error)
                }
                Text("${streak.restoresRemaining} of ${streak.restoresPerMonth} restores left this month.", style = MaterialTheme.typography.bodySmall)
                streak.milestoneDays?.takeIf { streak.milestoneCelebrationPending }?.let {
                    Text("You reached a $it-day milestone together!", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                }
                restoreError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                if (restorePending) CircularProgressIndicator(Modifier.padding(top = 4.dp).semantics { contentDescription = "Restoring streak" })
            }
        },
        confirmButton = {
            if (streak.state == "broken") {
                TextButton(onClick = onRestore, enabled = canRestore && !restorePending) { Text("Restore streak") }
            } else {
                TextButton(onClick = onDismiss) { Text("Keep chatting") }
            }
        },
        dismissButton = {
            if (streak.state == "broken") TextButton(onClick = onDismiss) { Text("Close") }
        },
    )
}

private fun formatStreakTime(seconds: Int): String {
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    return "${hours}h ${minutes}m"
}
