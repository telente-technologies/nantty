package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CreatorApplication
import com.nantty.android.data.CreatorDashboard
import com.nantty.android.data.CreatorDashboardPeriod
import com.nantty.android.data.CreatorEligibility
import com.nantty.android.data.CreatorWorkspaceRepository
import com.nantty.android.data.CreatorWorkspaceResult
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicInteger

/** Creator Studio overview and application entry; creator metrics remain read-only here. */
@Composable
internal fun CreatorWorkspaceScreen(
    repository: CreatorWorkspaceRepository,
    executor: Executor,
    modifier: Modifier = Modifier,
    onReauthenticate: () -> Unit = {},
) {
    var period by remember(repository) { mutableStateOf(CreatorDashboardPeriod.MONTH) }
    var refreshVersion by remember(repository) { mutableIntStateOf(0) }
    var loading by remember(repository) { mutableStateOf(true) }
    var eligibility by remember(repository) { mutableStateOf<CreatorWorkspaceResult<CreatorEligibility>?>(null) }
    var application by remember(repository) { mutableStateOf<CreatorWorkspaceResult<CreatorApplication?>?>(null) }
    var dashboard by remember(repository, period) { mutableStateOf<CreatorWorkspaceResult<CreatorDashboard>?>(null) }
    var showingApplicationForm by remember(repository) { mutableStateOf(false) }
    val requestGeneration = remember(repository) { AtomicInteger() }

    LaunchedEffect(repository, period, refreshVersion) {
        val generation = requestGeneration.incrementAndGet()
        loading = true
        executor.execute {
            val nextEligibility = repository.loadEligibility()
            val nextApplication = repository.loadApplication()
            val approved = (nextApplication as? CreatorWorkspaceResult.Success)?.value?.status == "approved"
            val nextDashboard = if (approved) repository.loadDashboard(period) else null
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation != requestGeneration.get()) return@withMutableSnapshot
                eligibility = nextEligibility
                application = nextApplication
                dashboard = nextDashboard
                loading = false
            }
        }
    }

    val authenticationRequired = listOfNotNull(
        (eligibility as? CreatorWorkspaceResult.Failure)?.authenticationRequired,
        (application as? CreatorWorkspaceResult.Failure)?.authenticationRequired,
        (dashboard as? CreatorWorkspaceResult.Failure)?.authenticationRequired,
    ).any { it }

    if (showingApplicationForm) {
        CreatorApplicationForm(
            repository = repository,
            executor = executor,
            onBack = { showingApplicationForm = false },
            onReauthenticate = onReauthenticate,
            onSubmitted = { submitted ->
                application = CreatorWorkspaceResult.Success(submitted)
                showingApplicationForm = false
                refreshVersion += 1
            },
            modifier = modifier,
        )
        return
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Creator Studio", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
                Text("Eligibility, application status and creator performance", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            TextButton(onClick = { refreshVersion += 1 }, enabled = !loading) { Text("Refresh") }
        }
        HorizontalDivider()

        when {
            loading && eligibility == null && application == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading Creator Studio" })
            }
            eligibility is CreatorWorkspaceResult.Failure || application is CreatorWorkspaceResult.Failure -> {
                val failure = (eligibility as? CreatorWorkspaceResult.Failure) ?: (application as? CreatorWorkspaceResult.Failure)
                WorkspaceError(failure?.message ?: "Creator Studio could not load.", authenticationRequired, onRetry = { refreshVersion += 1 }, onReauthenticate = onReauthenticate)
            }
            else -> {
                val eligibilityValue = (eligibility as? CreatorWorkspaceResult.Success)?.value
                val applicationValue = (application as? CreatorWorkspaceResult.Success)?.value
                val approved = applicationValue?.status == "approved"
                Column(
                    Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Column(Modifier.widthIn(max = 760.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (eligibilityValue != null && !approved) {
                            EligibilityCard(eligibilityValue, canApply = applicationValue == null, onApply = {
                                if (applicationValue == null && eligibilityValue.eligible) showingApplicationForm = true
                            })
                        }
                        ApplicationCard(applicationValue, eligibilityValue, onApplyAgain = { showingApplicationForm = true })
                        if (approved) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                CreatorDashboardPeriod.entries.forEach { option ->
                                    FilterChip(
                                        selected = period == option,
                                        onClick = { period = option },
                                        label = { Text(option.label) },
                                    )
                                }
                            }
                            when (val result = dashboard) {
                                is CreatorWorkspaceResult.Success -> DashboardCard(result.value, loading)
                                is CreatorWorkspaceResult.Failure -> WorkspaceError(
                                    message = result.message,
                                    authenticationRequired = result.authenticationRequired,
                                    onRetry = { refreshVersion += 1 },
                                    onReauthenticate = onReauthenticate,
                                )
                                null -> Card(Modifier.fillMaxWidth()) {
                                    Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                                        CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading creator dashboard" })
                                    }
                                }
                            }
                        }
                        if (!approved && applicationValue == null && eligibilityValue == null) {
                            Text("Creator information is not available yet. Refresh to try again.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EligibilityCard(value: CreatorEligibility, canApply: Boolean, onApply: () -> Unit) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Eligibility", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
            Text(value.decisionNote, style = MaterialTheme.typography.bodyMedium)
            value.requirements.forEach { requirement ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                    Text(if (requirement.met) "Met" else "In progress", style = MaterialTheme.typography.labelLarge, color = if (requirement.met) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                    Column(Modifier.weight(1f)) {
                        Text(requirement.label, style = MaterialTheme.typography.bodyMedium)
                        Text("${requirement.currentValue} / ${requirement.requiredValue}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Text(
                if (value.eligible) "You meet the current Creator Program requirements." else "Continue building your account to meet the listed requirements.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (value.eligible && canApply) Button(onClick = onApply) { Text("Apply as a creator") }
        }
    }
}

@Composable
private fun ApplicationCard(application: CreatorApplication?, eligibility: CreatorEligibility?, onApplyAgain: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Application", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
            if (application == null) {
                Text("No creator application is on file.", style = MaterialTheme.typography.bodyMedium)
                if (eligibility?.eligible == true) Text("You meet the current Creator Program requirements and can submit an application.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                val statusText = when (application.status) {
                    "pending" -> "Under review"
                    "approved" -> "Approved"
                    else -> "Not approved"
                }
                Text(statusText, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                Text("Submitted ${formatCreatorDateTime(application.submittedAt)}", style = MaterialTheme.typography.bodyMedium)
                Text(
                    when (application.status) {
                        "pending" -> "We’re reviewing your application. We’ll notify you when there’s a decision."
                        "approved" -> "Your creator application is approved. Creator tools are available in this workspace."
                        else -> "Review the reason below. You can apply again when the date shown is reached."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (application.contentCategories.isNotEmpty()) Text("Categories: ${application.contentCategories.joinToString()}", style = MaterialTheme.typography.bodyMedium)
                application.reviewedAt?.let { Text("Reviewed $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                application.rejectionReason?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error) }
                application.reapplyAvailableAt?.let { Text("You can re-apply from ${formatCreatorDate(it)}.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                if (application.status == "rejected" && isCreatorReapplyAvailable(application.reapplyAvailableAt)) {
                    Button(onClick = onApplyAgain) { Text("Apply again") }
                }
            }
        }
    }
}

private fun isCreatorReapplyAvailable(value: String?): Boolean {
    if (value == null) return true
    val instant = runCatching { java.time.Instant.parse(value) }.getOrNull() ?: return false
    return !instant.isAfter(java.time.Instant.now())
}

private fun formatCreatorDate(value: String): String = runCatching {
    java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault())
        .format(java.time.format.DateTimeFormatter.ofLocalizedDate(java.time.format.FormatStyle.MEDIUM))
}.getOrDefault(value)

private fun formatCreatorDateTime(value: String): String = runCatching {
    java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault())
        .format(java.time.format.DateTimeFormatter.ofLocalizedDateTime(java.time.format.FormatStyle.MEDIUM))
}.getOrDefault(value)

@Composable
private fun DashboardCard(value: CreatorDashboard, refreshing: Boolean) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Performance · ${value.period.label}", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                if (refreshing) CircularProgressIndicator()
            }
            MetricRow("Total earnings", value.earnings.total)
            MetricRow("Gifts and tips", value.earnings.gifts)
            MetricRow("Affiliate commissions", value.earnings.affiliateCommissions)
            MetricRow("Subscriptions", value.earnings.subscriptions)
            MetricRow("Ad revenue", value.earnings.adRevenue)
            MetricRow("Pending balance", value.pendingBalance)
            MetricRow("Available balance", value.availableBalance)
            Text("Followers gained: ${value.followersGained}", style = MaterialTheme.typography.bodyMedium)
            if (value.topContent.isNotEmpty()) {
                HorizontalDivider()
                Text("Top content", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                value.topContent.forEach { content ->
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(content.title, style = MaterialTheme.typography.bodyLarge)
                        Text("${content.kind} · ${content.views} views · ${formatCreatorMoney(content.earnings)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                Text("No top content for this period.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun MetricRow(label: String, money: com.nantty.android.data.CreatorMoneyAmount) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Text(formatCreatorMoney(money), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun WorkspaceError(message: String, authenticationRequired: Boolean, onRetry: () -> Unit, onReauthenticate: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(if (authenticationRequired) "Sign-in required" else "Couldn’t load Creator Studio", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (authenticationRequired) Button(onClick = onReauthenticate) { Text("Sign in again") }
        else Button(onClick = onRetry) { Text("Try again") }
    }
}

private fun formatCreatorMoney(value: com.nantty.android.data.CreatorMoneyAmount): String {
    val fractionDigits = runCatching { Currency.getInstance(value.currency).defaultFractionDigits }.getOrDefault(2).coerceAtLeast(0)
    val divisor = Math.pow(10.0, fractionDigits.toDouble())
    val formatter = NumberFormat.getNumberInstance(Locale.getDefault()).apply { minimumFractionDigits = fractionDigits; maximumFractionDigits = fractionDigits }
    return "${value.currency} ${formatter.format(value.amountMinor / divisor)}"
}
