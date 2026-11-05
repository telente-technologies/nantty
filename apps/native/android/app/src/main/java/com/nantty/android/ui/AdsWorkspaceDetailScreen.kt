package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AdsWorkspaceBoost
import com.nantty.android.data.AdsWorkspaceReport
import com.nantty.android.data.AdsWorkspaceRepository
import com.nantty.android.data.AdsWorkspaceResult
import com.nantty.android.data.AdsWorkspaceStatusAction
import java.util.concurrent.Executor
import java.util.UUID

@Composable
internal fun AdsWorkspaceDetailScreen(
    repository: AdsWorkspaceRepository,
    boostId: String,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onBack)
    var refreshVersion by androidx.compose.runtime.remember(boostId) { mutableIntStateOf(0) }
    var boostResult by androidx.compose.runtime.remember(boostId) { mutableStateOf<AdsWorkspaceResult<AdsWorkspaceBoost>?>(null) }
    var reportResult by androidx.compose.runtime.remember(boostId) { mutableStateOf<AdsWorkspaceResult<AdsWorkspaceReport>?>(null) }
    var loading by androidx.compose.runtime.remember(boostId) { mutableStateOf(true) }
    var statusAction by androidx.compose.runtime.remember(boostId) { mutableStateOf<AdsWorkspaceStatusAction?>(null) }
    var actionError by androidx.compose.runtime.remember(boostId) { mutableStateOf<AdsWorkspaceResult.Failure?>(null) }
    var confirmStop by androidx.compose.runtime.remember(boostId) { mutableStateOf(false) }
    LaunchedEffect(repository, boostId, refreshVersion) {
        loading = true
        executor.execute {
            val boost = repository.loadBoost(boostId)
            val report = if (boost is AdsWorkspaceResult.Success) repository.loadBoostReport(boostId) else null
            Snapshot.withMutableSnapshot {
                boostResult = boost
                reportResult = report
                loading = false
            }
        }
    }

    val boost = (boostResult as? AdsWorkspaceResult.Success)?.value
    fun changeStatus(action: AdsWorkspaceStatusAction) {
        if (statusAction != null) return
        statusAction = action
        actionError = null
        val idempotencyKey = UUID.randomUUID().toString()
        executor.execute {
            val result = repository.changeBoostStatus(boostId, action, idempotencyKey)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AdsWorkspaceResult.Success -> {
                        boostResult = result
                        statusAction = null
                        if (action == AdsWorkspaceStatusAction.STOP) refreshVersion += 1
                    }
                    is AdsWorkspaceResult.Failure -> {
                        actionError = result
                        statusAction = null
                    }
                }
            }
        }
    }

    if (confirmStop) {
        AlertDialog(
            onDismissRequest = { confirmStop = false },
            title = { Text("Stop this ad?") },
            text = { Text("It stops showing right away and can't be restarted. Unspent budget is returned according to the payment method; card payments stay in your ad balance.") },
            confirmButton = {
                TextButton(onClick = { confirmStop = false; changeStatus(AdsWorkspaceStatusAction.STOP) }) { Text("Stop ad") }
            },
            dismissButton = { TextButton(onClick = { confirmStop = false }) { Text("Keep running") } },
        )
    }
    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to ads" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text("Ad results", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            IconButton(onClick = { refreshVersion += 1 }, enabled = !loading, modifier = Modifier.semantics { contentDescription = "Refresh ad results" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (loading && boost == null) item { LoadingState("Loading ad results") }
            if (boostResult is AdsWorkspaceResult.Failure) item {
                val error = boostResult as AdsWorkspaceResult.Failure
                ErrorState(
                    title = "Ad could not load", message = error.message,
                    actionLabel = if (error.authenticationRequired) "Sign in again" else "Try again",
                    onAction = if (error.authenticationRequired) onReauthenticate else ({ refreshVersion += 1 }),
                )
            }
            boost?.let { details ->
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("${details.destinationType.replaceFirstChar(Char::uppercase)} promotion", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Text(details.status.label, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                            Text("Spent ${formatAdsMoney(details.spent)} of ${formatAdsMoney(details.totalBudget)}", style = MaterialTheme.typography.bodyMedium)
                            Text("${details.keyResultValue} ${details.keyResultLabel}", style = MaterialTheme.typography.bodyMedium)
                            details.endsAt?.let { Text("Ends $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            details.rejectionReason?.let { Text("Why it wasn't approved: $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                            if (details.actions.pause || details.actions.resume || details.actions.stop) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (details.actions.pause) TextButton(enabled = statusAction == null, onClick = { changeStatus(AdsWorkspaceStatusAction.PAUSE) }) {
                                        Text(if (statusAction == AdsWorkspaceStatusAction.PAUSE) "Pausing…" else "Pause")
                                    }
                                    if (details.actions.resume) TextButton(enabled = statusAction == null, onClick = { changeStatus(AdsWorkspaceStatusAction.RESUME) }) {
                                        Text(if (statusAction == AdsWorkspaceStatusAction.RESUME) "Resuming…" else "Resume")
                                    }
                                    if (details.actions.stop) TextButton(enabled = statusAction == null, onClick = { confirmStop = true }) {
                                        Text(if (statusAction == AdsWorkspaceStatusAction.STOP) "Stopping…" else "Stop ad", color = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            actionError?.let { error -> item {
                ErrorState(
                    title = "Ad could not be updated", message = error.message,
                    actionLabel = if (error.authenticationRequired) "Sign in again" else "Refresh ad",
                    onAction = if (error.authenticationRequired) onReauthenticate else ({ refreshVersion += 1 }),
                )
            } }
            val report = (reportResult as? AdsWorkspaceResult.Success)?.value
            if (reportResult is AdsWorkspaceResult.Failure) item {
                val error = reportResult as AdsWorkspaceResult.Failure
                ErrorState(
                    title = "Daily results could not load", message = error.message,
                    actionLabel = if (error.authenticationRequired) "Sign in again" else "Try again",
                    onAction = if (error.authenticationRequired) onReauthenticate else ({ refreshVersion += 1 }),
                )
            }
            report?.let { data ->
                item {
                    Text("Results", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                }
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            AdsMetric("Impressions", data.totals.impressions)
                            AdsMetric("People reached", data.totals.reach)
                            AdsMetric("Ad taps", data.totals.clicks)
                            AdsMetric(data.resultLabel, data.totals.results)
                            AdsMetric("Spent", formatAdsMoney(data.totals.spend))
                            AdsMetric("Cost per result", data.totals.costPerResult?.let(::formatAdsMoney) ?: "—")
                        }
                    }
                }
                if (data.series.isNotEmpty()) {
                    item { Text("Daily results", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold) }
                    items(data.series, key = { it.date }) { point ->
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(point.date, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Medium)
                                Text("${point.impressions} impressions · ${point.reach} reached · ${point.clicks} taps · ${point.results} ${data.resultLabel.lowercase()}", style = MaterialTheme.typography.bodySmall)
                                Text("Spent ${formatAdsMoney(point.spend)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdsMetric(label: String, value: Any) {
    Row(Modifier.fillMaxWidth().semantics { contentDescription = "$label: $value" }, horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Text(value.toString(), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}
