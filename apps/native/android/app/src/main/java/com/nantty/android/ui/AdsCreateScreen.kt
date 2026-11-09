package com.nantty.android.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AdsCampaignCreated
import com.nantty.android.data.AdsCampaignDraft
import com.nantty.android.data.AdsCampaignEstimate
import com.nantty.android.data.AdsCampaignOptions
import com.nantty.android.data.AdsCampaignPaymentOption
import com.nantty.android.data.AdsCampaignRepository
import com.nantty.android.data.AdsCampaignResubmitSource
import com.nantty.android.data.AdsCampaignResult
import com.nantty.android.data.AdsCreateIdempotencyKeys
import com.nantty.android.data.AdsWorkspaceMoney
import com.nantty.android.data.adsCampaignMinimumBudgetValid
import com.nantty.android.data.buildAdsCampaignCreateBody
import com.nantty.android.data.buildAdsCampaignEstimateBody
import com.nantty.android.data.isSafeAdsCheckoutUrl
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.Executor

private val CREATE_AD_STEPS = listOf("What to promote", "Goal and audience", "Budget and schedule", "Preview and pay")

@Composable
internal fun AdsCreateScreen(
    repository: AdsCampaignRepository,
    executor: Executor,
    resubmitBoostId: String?,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onSubmitted: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var loadVersion by remember(repository, resubmitBoostId) { mutableIntStateOf(0) }
    var step by remember(repository, resubmitBoostId) { mutableIntStateOf(if (resubmitBoostId == null) 0 else 1) }
    var optionsResult by remember(repository, resubmitBoostId) { mutableStateOf<AdsCampaignResult<AdsCampaignOptions>?>(null) }
    var destinationResult by remember(repository, resubmitBoostId) { mutableStateOf<com.nantty.android.data.AdsCampaignResult<com.nantty.android.data.AdsCampaignDestinations>?>(null) }
    var sourceResult by remember(repository, resubmitBoostId) { mutableStateOf<AdsCampaignResult<AdsCampaignResubmitSource>?>(null) }
    var loading by remember(repository, resubmitBoostId) { mutableStateOf(true) }
    var estimateResult by remember(repository, resubmitBoostId) { mutableStateOf<AdsCampaignResult<AdsCampaignEstimate>?>(null) }
    var estimating by remember(repository, resubmitBoostId) { mutableStateOf(false) }
    var submitting by remember(repository, resubmitBoostId) { mutableStateOf(false) }
    var submitError by remember(repository, resubmitBoostId) { mutableStateOf<String?>(null) }
    var estimateGeneration by remember(repository, resubmitBoostId) { mutableIntStateOf(0) }
    var draft by remember(repository, resubmitBoostId) { mutableStateOf(AdsCampaignDraft()) }
    val keys = remember(repository, resubmitBoostId) { AdsCreateIdempotencyKeys() }
    val context = LocalContext.current
    val options = (optionsResult as? AdsCampaignResult.Success)?.value
    val destinations = (destinationResult as? AdsCampaignResult.Success)?.value
    val source = (sourceResult as? AdsCampaignResult.Success)?.value
    val estimate = (estimateResult as? AdsCampaignResult.Success)?.value
    val estimateBody = buildAdsCampaignEstimateBody(draft)

    BackHandler(onBack = onBack)
    LaunchedEffect(repository, resubmitBoostId, loadVersion) {
        loading = true
        executor.execute {
            val options = repository.loadOptions()
            val available = repository.loadDestinations()
            val source = resubmitBoostId?.let(repository::loadResubmitSource)
            Snapshot.withMutableSnapshot {
                optionsResult = options
                destinationResult = available
                sourceResult = source
                val defaults = (options as? AdsCampaignResult.Success)?.value
                if (source is AdsCampaignResult.Success) {
                    val rejected = source.value
                    draft = AdsCampaignDraft(
                        destination = rejected.destination,
                        goal = rejected.goal,
                        audience = rejected.audience,
                        budgetType = rejected.budgetType,
                        dailyBudget = rejected.dailyBudget,
                        totalBudget = rejected.totalBudget,
                        durationDays = rejected.durationDays,
                        startAt = null,
                        paymentMethod = defaults?.paymentOptions?.firstOrNull(AdsCampaignPaymentOption::available)?.method,
                    )
                    step = 1
                } else if (resubmitBoostId == null && defaults != null) {
                    draft = AdsCampaignDraft(
                        dailyBudget = defaults.suggestedDailyBudgets.getOrNull(1) ?: defaults.suggestedDailyBudgets.firstOrNull(),
                        durationDays = defaults.durationDays.getOrNull(1) ?: defaults.durationDays.firstOrNull(),
                        paymentMethod = defaults.paymentOptions.firstOrNull(AdsCampaignPaymentOption::available)?.method,
                    )
                }
                loading = false
            }
        }
    }
    LaunchedEffect(repository, step, estimateBody?.toString(), options) {
        val currentOptions = options ?: return@LaunchedEffect
        if (step < 2 || estimateBody == null || !adsCampaignMinimumBudgetValid(currentOptions, draft)) {
            estimateResult = null
            estimating = false
            return@LaunchedEffect
        }
        val generation = estimateGeneration + 1
        estimateGeneration = generation
        estimating = true
        executor.execute {
            val result = repository.estimate(draft)
            Snapshot.withMutableSnapshot {
                if (generation == estimateGeneration) {
                    estimateResult = result
                    estimating = false
                }
            }
        }
    }

    val title = if (resubmitBoostId == null) "Create ad" else "Edit and resubmit"
    val loadFailure = (optionsResult as? AdsCampaignResult.Failure)
        ?: (destinationResult as? AdsCampaignResult.Failure)
        ?: (sourceResult as? AdsCampaignResult.Failure)
    val goals = draft.destination?.let { options?.goalsByDestination?.get(it.type).orEmpty() }.orEmpty()
    val chosenGoal = draft.goal?.takeIf { it in goals } ?: goals.firstOrNull()
    val normalizedDraft = if (draft.goal != chosenGoal) draft.copy(goal = chosenGoal) else draft
    val payable = options?.let { campaignOptions ->
        campaignOptions.paymentOptions.filter { option ->
            if (!option.available) return@filter false
            when (option.method) {
                "ad_balance" -> (campaignOptions.adBalanceSpendable?.let { balance -> estimate?.let { balance.currency == it.totalCost.currency && balance.amountMinor >= it.totalCost.amountMinor } } == true)
                "free" -> campaignOptions.freeBoostEligible && campaignOptions.freeBoostRemaining > 0 && campaignOptions.freeBoostMaxTotal?.let { max -> estimate?.let { max.currency == it.totalCost.currency && max.amountMinor >= it.totalCost.amountMinor } } == true
                else -> true
            }
        }
    }.orEmpty()
    val canContinue = when (step) {
        0 -> normalizedDraft.destination != null
        1 -> normalizedDraft.goal != null
        2 -> estimate != null && estimateBody != null && options != null && adsCampaignMinimumBudgetValid(options, normalizedDraft)
        else -> estimate != null && normalizedDraft.paymentMethod in payable.map { it.method }
    }

    Column(modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = if (step > 0 && resubmitBoostId == null) ({ step -= 1 }) else onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text(title, Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        if (loading) {
            LoadingState(if (resubmitBoostId == null) "Loading ad options" else "Loading rejected ad")
        } else if (loadFailure != null) {
            ErrorState(
                title = "Ad creation unavailable",
                message = loadFailure.message,
                actionLabel = if (loadFailure.authenticationRequired) "Sign in again" else "Try again",
                onAction = if (loadFailure.authenticationRequired) onReauthenticate else ({ loadVersion += 1 }),
            )
        } else if (options != null && destinations != null) {
            BoxWithConstraints(Modifier.weight(1f)) {
                val contentWidth = if (maxWidth >= 760.dp) Modifier.widthIn(max = 720.dp).align(Alignment.TopCenter) else Modifier.fillMaxWidth()
                LazyColumn(
                    modifier = contentWidth.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    item {
                        Text("Step ${step + 1} of ${CREATE_AD_STEPS.size} · ${CREATE_AD_STEPS[step]}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    source?.rejectionReason?.let { reason ->
                        item {
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("Why it wasn't approved", fontWeight = FontWeight.SemiBold)
                                    Text(reason, color = MaterialTheme.colorScheme.onErrorContainer)
                                    Text("Fix the issue and submit a new ad. The rejected ad's paid amount remains in your ad balance.", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                    when (step) {
                        0 -> item {
                            AdsCampaignDestinationPicker(destinations, normalizedDraft.destination) { selected ->
                                val availableGoals = options.goalsByDestination[selected.type].orEmpty()
                                draft = normalizedDraft.copy(destination = selected, goal = availableGoals.firstOrNull(), paymentMethod = normalizedDraft.paymentMethod)
                            }
                        }
                        1 -> {
                            item {
                                Text("Goal", style = MaterialTheme.typography.titleSmall)
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    goals.forEach { goal ->
                                        FilterChip(
                                            selected = normalizedDraft.goal == goal,
                                            onClick = { draft = normalizedDraft.copy(goal = goal) },
                                            label = { Text(goalLabel(goal)) },
                                        )
                                    }
                                }
                            }
                            item {
                                AdsCampaignAudienceEditor(
                                    repository = repository,
                                    executor = executor,
                                    audience = normalizedDraft.audience,
                                    defaultCountryCode = destinations.defaultCountryCode,
                                    onChange = { draft = normalizedDraft.copy(audience = it) },
                                )
                            }
                        }
                        2 -> item {
                            AdsCampaignBudgetEditor(options, normalizedDraft) { draft = normalizedDraft.copy(
                                budgetType = it.budgetType,
                                dailyBudget = it.dailyBudget,
                                totalBudget = it.totalBudget,
                                durationDays = it.durationDays,
                                startAt = it.startAt,
                            ) }
                        }
                        else -> {
                            item { AdsCampaignPreview(normalizedDraft, estimate, estimating) }
                            item {
                                Text("Pay with", style = MaterialTheme.typography.titleSmall)
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (payable.isEmpty()) Text("No payment method is available for this ad and budget.", color = MaterialTheme.colorScheme.error)
                                    options.paymentOptions.forEach { option ->
                                        val selectable = option.method in payable.map { it.method }
                                        Card(
                                            modifier = Modifier.fillMaxWidth().clickable(enabled = selectable) {
                                                draft = normalizedDraft.copy(paymentMethod = option.method)
                                            },
                                            colors = CardDefaults.cardColors(
                                                containerColor = if (normalizedDraft.paymentMethod == option.method) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceContainerLow,
                                            ),
                                        ) {
                                            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                                Text(paymentMethodLabel(option.method), fontWeight = FontWeight.Medium)
                                                val note = option.reason ?: when (option.method) {
                                                    "ad_balance" -> options.adBalanceSpendable?.let { "${formatAdsMoney(it)} available. Credit is used first." }
                                                    "free" -> options.freeBoostMaxTotal?.let { "Covers up to ${formatAdsMoney(it)}." }
                                                    "card" -> "Secure payment checkout"
                                                    else -> null
                                                }
                                                note?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                                if (!selectable) Text("Unavailable for this amount", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (step >= 2) {
                        item {
                            when {
                                estimating && estimate == null -> LoadingState("Estimating reach")
                                estimateResult is AdsCampaignResult.Failure -> Text((estimateResult as AdsCampaignResult.Failure).message, color = MaterialTheme.colorScheme.error)
                                estimate != null -> AdsCampaignEstimateCard(estimate)
                            }
                        }
                    }
                }
            }
            if (submitError != null) Text(submitError!!, Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (step > 0 && resubmitBoostId == null) TextButton(onClick = { step -= 1 }, modifier = Modifier.weight(1f)) { Text("Back") }
                if (step < CREATE_AD_STEPS.lastIndex) {
                    Button(onClick = { step += 1; submitError = null }, enabled = canContinue, modifier = Modifier.weight(1f)) { Text("Continue") }
                } else {
                    Button(
                        onClick = {
                            val body = buildAdsCampaignCreateBody(normalizedDraft) ?: return@Button
                            val key = keys.keyFor(body)
                            submitting = true
                            submitError = null
                            executor.execute {
                                val result = repository.create(normalizedDraft, key)
                                Snapshot.withMutableSnapshot {
                                    submitting = false
                                    when (result) {
                                        is AdsCampaignResult.Failure -> submitError = result.message
                                        is AdsCampaignResult.Success -> {
                                            keys.reset()
                                            openAdCheckout(context, result.value)
                                            onSubmitted(result.value.boostId)
                                        }
                                    }
                                }
                            }
                        },
                        enabled = canContinue && !submitting,
                        modifier = Modifier.weight(1f),
                    ) {
                        if (submitting) CircularProgressIndicator() else Text("Submit for review · ${estimate?.let { formatAdsMoney(it.totalCost) }.orEmpty()}")
                    }
                }
            }
        }
    }
}

@Composable
private fun AdsCampaignDestinationPicker(
    destinations: com.nantty.android.data.AdsCampaignDestinations,
    selected: com.nantty.android.data.AdsCampaignDestination?,
    onSelect: (com.nantty.android.data.AdsCampaignDestination) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val groups = listOf(
            "A post" to destinations.posts,
            "A product" to destinations.products,
            "My store" to listOfNotNull(destinations.store),
            "My profile" to listOf(destinations.profile),
        )
        groups.forEach { (title, entries) ->
            Text(title, style = MaterialTheme.typography.titleSmall)
            if (entries.isEmpty()) {
                Text(
                    when (title) {
                        "A post" -> "You haven't posted anything yet. Publish a post first, then promote it."
                        "A product" -> "Publish a product in your store first, then promote it."
                        else -> "This destination isn't available for your account yet."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else entries.forEach { entry ->
                Card(
                    modifier = Modifier.fillMaxWidth().clickable { onSelect(entry) },
                    colors = CardDefaults.cardColors(
                        containerColor = if (selected?.type == entry.type && selected.targetId == entry.targetId) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceContainerLow,
                    ),
                ) {
                    Text(entry.label, Modifier.fillMaxWidth().padding(14.dp), maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun AdsCampaignBudgetEditor(options: AdsCampaignOptions, draft: AdsCampaignDraft, onChange: (AdsCampaignDraft) -> Unit) {
    var amountText by remember(draft.budgetType, draft.totalBudget, draft.dailyBudget) {
        mutableStateOf(((if (draft.budgetType == "total") draft.totalBudget else draft.dailyBudget)?.amountMinor?.div(100.0))?.toString().orEmpty())
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Budget", style = MaterialTheme.typography.titleSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = draft.budgetType == "daily", onClick = { onChange(draft.copy(budgetType = "daily")) }, label = { Text("Daily budget") })
            FilterChip(selected = draft.budgetType == "total", onClick = { onChange(draft.copy(budgetType = "total")) }, label = { Text("Total budget") })
        }
        if (draft.budgetType == "daily") {
            options.suggestedDailyBudgets.forEach { amount ->
                FilterChip(selected = draft.dailyBudget == amount, onClick = { amountText = ""; onChange(draft.copy(dailyBudget = amount)) }, label = { Text("${formatAdsMoney(amount)} a day") })
            }
        }
        OutlinedTextField(
            value = amountText,
            onValueChange = { text ->
                amountText = text.take(20)
                val parsed = parseAdBudget(text, options.minimumDailyBudget.currency)
                if (parsed != null) onChange(if (draft.budgetType == "total") draft.copy(totalBudget = parsed) else draft.copy(dailyBudget = parsed))
                else if (draft.budgetType == "total") onChange(draft.copy(totalBudget = null)) else onChange(draft.copy(dailyBudget = null))
            },
            label = { Text(if (draft.budgetType == "daily") "Or enter a daily amount (${options.minimumDailyBudget.currency})" else "Total for the whole ad (${options.minimumDailyBudget.currency})") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Text("Minimum ${formatAdsMoney(options.minimumDailyBudget)} a day.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("How long", style = MaterialTheme.typography.titleSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            options.durationDays.forEach { days ->
                FilterChip(selected = draft.durationDays == days, onClick = { onChange(draft.copy(durationDays = days)) }, label = { Text("$days ${if (days == 1) "day" else "days"}") })
            }
        }
        if (options.maximumScheduleDays > 0) {
            Text("Start", style = MaterialTheme.typography.titleSmall)
            val scheduleOptions = listOf(null, 1, 3, 7, 14).filter { it == null || it <= options.maximumScheduleDays }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                scheduleOptions.forEach { ahead ->
                    val label = when (ahead) { null -> "After approval"; 1 -> "Tomorrow"; else -> "In $ahead days" }
                    FilterChip(selected = if (ahead == null) draft.startAt == null else draft.startAt == scheduledStartAt(ahead), onClick = { onChange(draft.copy(startAt = ahead?.let(::scheduledStartAt))) }, label = { Text(label) })
                }
            }
        }
    }
}

@Composable
private fun AdsCampaignPreview(draft: AdsCampaignDraft, estimate: AdsCampaignEstimate?, estimating: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Preview", style = MaterialTheme.typography.titleSmall)
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Promoting ${draft.destination?.label.orEmpty()}", fontWeight = FontWeight.SemiBold)
                Text("Goal: ${draft.goal?.let(::goalLabel).orEmpty()}")
                Text("Audience: ${if (draft.audience.mode == "automatic") "Automatic" else "Custom · ${draft.audience.countryCode} · age ${draft.audience.ageMin}–${draft.audience.ageMax}"}")
                Text("Budget: ${draft.durationDays ?: "—"} days · ${draft.budgetType}")
                if (estimating) CircularProgressIndicator()
                estimate?.let {
                    Text("Estimated reach: ${it.reachMin.toString().withGrouping()}–${it.reachMax.toString().withGrouping()} people")
                    Text(it.resultLabel, style = MaterialTheme.typography.bodySmall)
                    Text("Total: ${formatAdsMoney(it.totalCost)}", fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Text("Ads are reviewed before they run, usually within a day. Estimates are not guarantees.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun AdsCampaignEstimateCard(estimate: AdsCampaignEstimate) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Estimated reach", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("${estimate.reachMin.toString().withGrouping()}–${estimate.reachMax.toString().withGrouping()} people", style = MaterialTheme.typography.titleMedium)
            Text(estimate.resultLabel, style = MaterialTheme.typography.bodySmall)
            Text("Total: ${formatAdsMoney(estimate.totalCost)}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text("The price is set by Nantty for your region. Estimates are not guarantees.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun goalLabel(goal: String) = when (goal) {
    "views" -> "More views"
    "profile_visits" -> "More profile visits"
    "messages" -> "More messages"
    "store_visits" -> "More store visits"
    "product_visits" -> "More product views"
    else -> goal
}

private fun paymentMethodLabel(method: String) = when (method) {
    "card" -> "Card or bank transfer"
    "ad_balance" -> "Ad credit & balance"
    "balance" -> "Nantty earnings"
    "free" -> "Free Premium boost"
    "wallet" -> "Wallet"
    else -> method
}

private fun parseAdBudget(text: String, currency: String): AdsWorkspaceMoney? {
    val normalized = text.trim().replace(",", "")
    if (normalized.isEmpty() || normalized.length > 20 || !normalized.matches(Regex("[0-9]+(\\.[0-9]{0,2})?"))) return null
    val minor = runCatching { java.math.BigDecimal(normalized).movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact() }.getOrNull()
    return minor?.takeIf { it > 0 }?.let { AdsWorkspaceMoney(it, currency) }
}

private fun scheduledStartAt(daysAhead: Int): String {
    val date = java.time.LocalDate.now().plusDays(daysAhead.toLong()).atTime(8, 0).atZone(ZoneId.systemDefault()).toInstant()
    return Instant.ofEpochMilli(date.toEpochMilli()).toString()
}

private fun openAdCheckout(context: android.content.Context, result: AdsCampaignCreated) {
    val checkoutUrl = result.checkoutUrl?.takeIf(::isSafeAdsCheckoutUrl) ?: return
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(checkoutUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

private fun String.withGrouping(): String = runCatching { java.text.NumberFormat.getIntegerInstance().format(toLong()) }.getOrDefault(this)
