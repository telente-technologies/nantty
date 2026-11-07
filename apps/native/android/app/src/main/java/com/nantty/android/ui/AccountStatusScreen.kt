package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AccountHealthActionResult
import com.nantty.android.data.AccountHealthNotice
import com.nantty.android.data.AccountHealthRepository
import com.nantty.android.data.AccountHealthResult
import com.nantty.android.data.AccountHealthStrike
import java.util.concurrent.Executor

@Composable
internal fun AccountStatusScreen(
    repository: AccountHealthRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    var result by remember(repository) { mutableStateOf<AccountHealthResult?>(null) }
    var retry by remember(repository) { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var appealTarget by remember { mutableStateOf<AccountHealthStrike?>(null) }
    var noticeTarget by remember { mutableStateOf<AccountHealthNotice?>(null) }
    var appealText by remember { mutableStateOf("") }
    var counterStatement by remember { mutableStateOf("") }
    var counterEmail by remember { mutableStateOf("") }
    var goodFaith by remember { mutableStateOf(false) }
    BackHandler(onBack = onBack)

    LaunchedEffect(repository, executor, retry) {
        result = null
        executor.execute {
            val loaded = repository.load()
            Snapshot.withMutableSnapshot { result = loaded }
        }
    }
    LaunchedEffect(result) {
        if ((result as? AccountHealthResult.Failure)?.authenticationRequired == true) onReauthenticate()
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val horizontal = if (maxWidth >= 700.dp) 32.dp else 16.dp
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = horizontal, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            item("header") {
                Column(Modifier.fillMaxWidth().widthIn(max = 760.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = onBack) { Text("Back") }
                        Text("Account status", Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            when (val current = result) {
                null -> item("loading") { CircularProgressIndicator(Modifier.padding(24.dp).testTag("account-status-loading")) }
                is AccountHealthResult.Failure -> item("error") {
                    AccountStatusCard(title = "Couldn't load account status", body = current.message) {
                        if (current.authenticationRequired) onReauthenticate() else retry++
                    }
                }
                is AccountHealthResult.Success -> {
                    val health = current.health
                    item("standing") {
                        AccountStatusCard(
                            title = when (health.status) {
                                "GOOD_STANDING" -> "Good standing"
                                "AT_RISK" -> "Your account needs attention"
                                else -> "Some account features are restricted"
                            },
                            body = "${health.activeStrikeCount} active strikes · ${health.pendingTakedownCount} pending copyright notices. " +
                                (if (health.canMonetise) "Monetisation is available." else "Monetisation is currently unavailable."),
                        )
                    }
                    item("summary") {
                        AccountStatusCard(
                            title = "Account features",
                            body = "${if (health.canGoLive) "Going live is available" else "Going live is unavailable"}. " +
                                "${health.copyrightStrikesInWindow} copyright strikes in the current ${health.strikeWindowDays}-day window.",
                        )
                    }
                    item("notices-heading") { SectionHeading("Copyright notices") }
                    if (health.notices.isEmpty()) item("notices-empty") { BodyNote("No copyright claims against your content.") }
                    else items(health.notices, key = { "notice-${it.claimId}" }) { notice ->
                        AccountStatusCard(
                            title = notice.workTitle.ifBlank { "Copyright notice" },
                            body = buildString {
                                append(notice.claimantName.ifBlank { "A rights holder" })
                                if (notice.reason.isNotBlank()) append(" · ${notice.reason}")
                                append("\nStatus: ${notice.state.lowercase().replace('_', ' ')}")
                            },
                            actionLabel = when {
                                notice.canCounterNotice -> "Submit counter-notice"
                                notice.counterNoticeStatus != null -> "Counter-notice ${notice.counterNoticeStatus.lowercase().replace('_', ' ')}"
                                else -> null
                            },
                            enabled = notice.canCounterNotice,
                        ) { if (notice.canCounterNotice) { noticeTarget = notice; counterStatement = ""; counterEmail = ""; goodFaith = false } }
                    }
                    item("strikes-heading") { SectionHeading("Active strikes") }
                    if (health.strikes.isEmpty()) item("strikes-empty") { BodyNote("You have no active strikes.") }
                    else items(health.strikes, key = { "strike-${it.id}" }) { strike ->
                        AccountStatusCard(
                            title = strike.policy.ifBlank { "Account strike" },
                            body = strike.reason.ifBlank { "${strike.kind.lowercase()} · ${strike.status.lowercase()}" },
                            actionLabel = if (strike.canAppeal) "Appeal" else null,
                        ) { if (strike.canAppeal) { appealTarget = strike; appealText = "" } }
                    }
                    item("warnings-heading") { SectionHeading("Warnings on record") }
                    if (health.warnings.isEmpty()) item("warnings-empty") { BodyNote("No warnings on record.") }
                    else items(health.warnings, key = { "warning-${it.id}" }) { warning ->
                        AccountStatusCard(title = warning.policy.ifBlank { "Warning" }, body = warning.reason.ifBlank { warning.status.lowercase() })
                    }
                    item("bottom") { BodyNote("Account rules and appeal guidance are available in Nantty Help.") }
                }
            }
        }
    }

    appealTarget?.let { strike ->
        AlertDialog(
            onDismissRequest = { if (!busy) appealTarget = null },
            title = { Text("Appeal this strike") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Explain why this decision should be reviewed.")
                    OutlinedTextField(appealText, { appealText = it.take(2_000) }, label = { Text("Appeal statement") }, minLines = 3, maxLines = 6)
                    message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(enabled = !busy && appealText.isNotBlank(), onClick = {
                    busy = true
                    executor.execute {
                        val outcome = repository.appeal(strike.id, appealText)
                        Snapshot.withMutableSnapshot {
                            busy = false
                            when (outcome) {
                                AccountHealthActionResult.Success -> { appealTarget = null; message = "Appeal submitted."; retry++ }
                                is AccountHealthActionResult.Failure -> { message = outcome.message; if (outcome.authenticationRequired) onReauthenticate() }
                            }
                        }
                    }
                }) { Text(if (busy) "Submitting…" else "Submit appeal") }
            },
            dismissButton = { TextButton(enabled = !busy, onClick = { appealTarget = null; message = null }) { Text("Cancel") } },
        )
    }

    noticeTarget?.let { notice ->
        AlertDialog(
            onDismissRequest = { if (!busy) noticeTarget = null },
            title = { Text("Submit a counter-notice") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Only submit this legal notice if you believe the copyright claim is mistaken. Your contact details may be shared with the claimant as required by law.")
                    OutlinedTextField(counterStatement, { counterStatement = it.take(5_000) }, label = { Text("Why the claim is mistaken") }, minLines = 3, maxLines = 6)
                    OutlinedTextField(counterEmail, { counterEmail = it.take(254) }, label = { Text("Contact email") }, singleLine = true)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(goodFaith, { goodFaith = it })
                        Text("I submit this statement in good faith.", style = MaterialTheme.typography.bodySmall)
                    }
                    message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(enabled = !busy && goodFaith && counterStatement.trim().length >= 20 && counterEmail.contains('@'), onClick = {
                    busy = true
                    executor.execute {
                        val outcome = repository.submitCounterNotice(notice.claimId, counterStatement, counterEmail, goodFaith)
                        Snapshot.withMutableSnapshot {
                            busy = false
                            when (outcome) {
                                AccountHealthActionResult.Success -> { noticeTarget = null; message = "Counter-notice submitted."; retry++ }
                                is AccountHealthActionResult.Failure -> { message = outcome.message; if (outcome.authenticationRequired) onReauthenticate() }
                            }
                        }
                    }
                }) { Text(if (busy) "Submitting…" else "Submit") }
            },
            dismissButton = { TextButton(enabled = !busy, onClick = { noticeTarget = null; message = null }) { Text("Cancel") } },
        )
    }
    message?.takeIf { appealTarget == null && noticeTarget == null }?.let { Text(it, Modifier.padding(12.dp), color = MaterialTheme.colorScheme.primary) }
}

@Composable
private fun AccountStatusCard(title: String, body: String, actionLabel: String? = null, enabled: Boolean = true, onAction: () -> Unit = {}) {
    Card(Modifier.fillMaxWidth().widthIn(max = 760.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (actionLabel != null) TextButton(onClick = onAction, enabled = enabled) { Text(actionLabel) }
        }
    }
}

@Composable private fun SectionHeading(text: String) { Text(text, Modifier.fillMaxWidth().widthIn(max = 760.dp).padding(top = 8.dp), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) }
@Composable private fun BodyNote(text: String) { Text(text, Modifier.fillMaxWidth().widthIn(max = 760.dp).padding(horizontal = 4.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
