package com.nantty.android.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.nantty.android.data.AdsBalanceRepository
import com.nantty.android.data.AdsBalanceResult
import com.nantty.android.data.AdsBalanceSummary
import com.nantty.android.data.AdsBalanceTransaction
import com.nantty.android.data.AdsBalanceTransactionPage
import com.nantty.android.data.AdsBalanceWithdrawalQuote
import com.nantty.android.data.AdsWorkspaceMoney
import com.nantty.android.data.StepUpGrant
import java.util.UUID
import java.util.concurrent.Executor

/** Detailed ad-balance management, matching the React Native balance screen and mounted API contract. */
@Composable
internal fun AdsBalanceScreen(
    repository: AdsBalanceRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onBalanceChanged: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var refreshVersion by remember(repository) { mutableIntStateOf(0) }
    var balanceResult by remember(repository) { mutableStateOf<AdsBalanceResult<AdsBalanceSummary>?>(null) }
    var historyResult by remember(repository) { mutableStateOf<AdsBalanceResult<AdsBalanceTransactionPage>?>(null) }
    var balanceLoading by remember(repository) { mutableStateOf(true) }
    var historyLoading by remember(repository) { mutableStateOf(true) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var topUpAmountText by remember(repository) { mutableStateOf("") }
    var topUpLoading by remember(repository) { mutableStateOf(false) }
    var topUpError by remember(repository) { mutableStateOf<String?>(null) }
    var topUpRequiresAuthentication by remember(repository) { mutableStateOf(false) }
    var withdrawalAmountText by remember(repository) { mutableStateOf("") }
    var quote by remember(repository) { mutableStateOf<AdsBalanceWithdrawalQuote?>(null) }
    var quoteLoading by remember(repository) { mutableStateOf(false) }
    var quoteRequestVersion by remember(repository) { mutableIntStateOf(0) }
    var quoteError by remember(repository) { mutableStateOf<String?>(null) }
    var quoteRequiresAuthentication by remember(repository) { mutableStateOf(false) }
    var withdrawing by remember(repository) { mutableStateOf(false) }
    var withdrawalError by remember(repository) { mutableStateOf<String?>(null) }
    var withdrawalRequiresAuthentication by remember(repository) { mutableStateOf(false) }
    var withdrawalStatus by remember(repository) { mutableStateOf<String?>(null) }
    var stepUpOpen by remember(repository) { mutableStateOf(false) }
    var stepUpMode by remember(repository) { mutableStateOf(AdsBalanceStepUpMode.PASSWORD) }
    var stepUpCodeSent by remember(repository) { mutableStateOf(false) }
    var stepUpPassword by remember(repository) { mutableStateOf("") }
    var stepUpCode by remember(repository) { mutableStateOf("") }
    var stepUpError by remember(repository) { mutableStateOf<String?>(null) }
    var historyError by remember(repository) { mutableStateOf<String?>(null) }
    var managingPayoutAccounts by remember(repository) { mutableStateOf(false) }
    var pendingWithdrawalAmount by remember(repository) { mutableStateOf<AdsWorkspaceMoney?>(null) }
    val balance = (balanceResult as? AdsBalanceResult.Success)?.value
    val history = (historyResult as? AdsBalanceResult.Success)?.value
    val topUpKeys = remember(repository) { AdsBalanceIdempotencyKeys() }
    val withdrawalKeys = remember(repository) { AdsBalanceIdempotencyKeys() }
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    if (managingPayoutAccounts) {
        PayoutAccountsScreen(
            repository = repository.stepUpRepository,
            executor = executor,
            onBack = { managingPayoutAccounts = false; refreshVersion += 1 },
            modifier = modifier,
        )
        return
    }

    BackHandler(onBack = onBack)
    DisposableEffect(lifecycleOwner, repository) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) refreshVersion += 1
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(repository, refreshVersion) {
        balanceLoading = true
        historyLoading = true
        historyError = null
        executor.execute {
            val loadedBalance = repository.loadBalance()
            val loadedHistory = repository.loadTransactions()
            Snapshot.withMutableSnapshot {
                balanceResult = loadedBalance
                historyResult = loadedHistory
                balanceLoading = false
                historyLoading = false
                historyError = (loadedHistory as? AdsBalanceResult.Failure)?.message
            }
        }
    }
    LaunchedEffect(repository, withdrawalAmountText, balance?.withdrawal?.available, refreshVersion) {
        val requestVersion = quoteRequestVersion + 1
        quoteRequestVersion = requestVersion
        val submittedText = withdrawalAmountText
        quote = null
        quoteError = null
        quoteRequiresAuthentication = false
        val amount = balance?.let { parseAdsBalanceAmount(withdrawalAmountText, it.withdrawal.minimum.currency) }
        if (amount == null || balance?.withdrawal?.available != true) {
            quoteLoading = false
            return@LaunchedEffect
        }
        quoteLoading = true
        executor.execute {
            val result = repository.quoteWithdrawal(amount)
            Snapshot.withMutableSnapshot {
                if (requestVersion == quoteRequestVersion && withdrawalAmountText == submittedText) {
                    quote = (result as? AdsBalanceResult.Success)?.value
                    quoteError = (result as? AdsBalanceResult.Failure)?.message
                    quoteRequiresAuthentication = (result as? AdsBalanceResult.Failure)?.authenticationRequired == true
                    quoteLoading = false
                }
            }
        }
    }

    LaunchedEffect(balance?.suggestedTopUps) {
        if (topUpAmountText.isBlank()) balance?.suggestedTopUps?.firstOrNull()?.let { topUpAmountText = adsBalanceAmountInput(it) }
    }

    fun startTopUp() {
        val current = balance ?: return
        val amount = parseAdsBalanceAmount(topUpAmountText, current.topUpMinimum.currency) ?: return
        if (!current.topUpAvailable || amount.amountMinor !in current.topUpMinimum.amountMinor..current.topUpMaximum.amountMinor) return
        topUpLoading = true
        topUpError = null
        topUpRequiresAuthentication = false
        val key = topUpKeys.keyFor(amount)
        executor.execute {
            val result = repository.startTopUp(amount, key)
            Snapshot.withMutableSnapshot {
                topUpLoading = false
                when (result) {
                    is AdsBalanceResult.Failure -> {
                        topUpError = result.message
                        topUpRequiresAuthentication = result.authenticationRequired
                    }
                    is AdsBalanceResult.Success -> {
                        topUpError = null
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(result.value.checkoutUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                        }.onSuccess { topUpKeys.reset() }
                            .onFailure { topUpError = "Couldn't open the secure checkout. Try again." }
                    }
                }
            }
        }
    }

    fun loadMoreTransactions() {
        val cursor = history?.nextCursor ?: return
        if (loadingMore) return
        loadingMore = true
        historyError = null
        executor.execute {
            val result = repository.loadTransactions(cursor)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AdsBalanceResult.Failure -> historyError = result.message
                    is AdsBalanceResult.Success -> {
                        val latest = (historyResult as? AdsBalanceResult.Success)?.value ?: history
                        val merged = (latest.items + result.value.items).distinctBy { it.id }
                        historyResult = AdsBalanceResult.Success(AdsBalanceTransactionPage(merged, result.value.nextCursor))
                    }
                }
                loadingMore = false
            }
        }
    }

    fun requestStepUp() {
        val current = balance ?: return
        val amount = parseAdsBalanceAmount(withdrawalAmountText, current.withdrawal.minimum.currency) ?: return
        val currentQuote = quote ?: return
        if (withdrawing || currentQuote.amount != amount || amount.amountMinor > currentQuote.withdrawable.amountMinor) return
        pendingWithdrawalAmount = amount
        withdrawalError = null
        withdrawalRequiresAuthentication = false
        stepUpError = null
        stepUpPassword = ""
        stepUpCode = ""
        stepUpCodeSent = false
        stepUpMode = AdsBalanceStepUpMode.PASSWORD
        stepUpOpen = true
    }

    fun submitStepUp() {
        val email = repository.stepUpRepository.currentEmail().orEmpty()
        val mode = stepUpMode
        val password = stepUpPassword
        val code = stepUpCode
        val codeSent = stepUpCodeSent
        withdrawing = true
        stepUpError = null
        executor.execute {
            if (mode == AdsBalanceStepUpMode.EMAIL && !codeSent) {
                val result = repository.stepUpRepository.sendEmailCode(email)
                Snapshot.withMutableSnapshot {
                    withdrawing = false
                    result.onSuccess { stepUpCodeSent = true }.onFailure { stepUpError = it.message ?: "Couldn't send the code. Try again." }
                }
                return@execute
            }
            val grant: Result<StepUpGrant> = when (mode) {
                AdsBalanceStepUpMode.PASSWORD -> repository.stepUpRepository.grantWithPassword(password)
                AdsBalanceStepUpMode.EMAIL -> repository.stepUpRepository.grantWithEmailCode(email, code)
            }
            grant.fold(
                onFailure = { failure -> Snapshot.withMutableSnapshot { withdrawing = false; stepUpError = failure.message ?: "We couldn't confirm it's you. Try again." } },
                onSuccess = { proof ->
                    val amount = pendingWithdrawalAmount
                    val currentBalance = (balanceResult as? AdsBalanceResult.Success)?.value
                    val currentQuote = quote
                    if (amount == null || currentBalance == null || currentQuote?.amount != amount || amount.amountMinor > currentQuote.withdrawable.amountMinor) {
                        Snapshot.withMutableSnapshot { withdrawing = false; stepUpError = "Enter a valid withdrawal amount." }
                        return@fold
                    }
                    val result = repository.withdraw(amount, withdrawalKeys.keyFor(amount), proof.token)
                    Snapshot.withMutableSnapshot {
                        withdrawing = false
                        when (result) {
                            is AdsBalanceResult.Failure -> {
                                withdrawalError = result.message
                                withdrawalRequiresAuthentication = result.authenticationRequired
                                stepUpError = if (result.code in setOf("STEP_UP_REQUIRED", "STEP_UP_REUSED")) result.message else null
                            }
                            is AdsBalanceResult.Success -> {
                                stepUpOpen = false
                                withdrawalAmountText = ""
                                quote = null
                                pendingWithdrawalAmount = null
                                withdrawalError = null
                                withdrawalRequiresAuthentication = false
                                withdrawalStatus = "Withdrawn to your wallet."
                                withdrawalKeys.reset()
                                refreshVersion += 1
                                onBalanceChanged()
                            }
                        }
                    }
                },
            )
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to ads" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text("Ad credit & balance", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            IconButton(onClick = { refreshVersion += 1 }, enabled = !balanceLoading && !historyLoading, modifier = Modifier.testTag("ads-balance-refresh")) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh ad balance")
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val wide = maxWidth >= 760.dp
            LazyColumn(
                modifier = Modifier.fillMaxWidth().widthIn(max = 1_040.dp).align(Alignment.TopCenter),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                if (balanceLoading && balance == null) {
                    item("ads-balance-loading") { LoadingState("Loading ad balance") }
                }
                (balanceResult as? AdsBalanceResult.Failure)?.let { failure ->
                    item("ads-balance-error") {
                        ErrorState(
                            title = "Ad balance could not load",
                            message = failure.message,
                            actionLabel = if (failure.authenticationRequired) "Sign in again" else "Try again",
                            onAction = if (failure.authenticationRequired) onReauthenticate else ({ refreshVersion += 1 }),
                        )
                    }
                }
                balance?.let { current ->
                    item("ads-balance-summary") { AdsBalanceSummarySection(current) }
                    item("ads-balance-actions") {
                        if (wide) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            AdsBalanceTopUpSection(current, topUpAmountText, topUpLoading, topUpError, topUpRequiresAuthentication, onReauthenticate,
                                { topUpAmountText = it; topUpError = null; topUpRequiresAuthentication = false }, ::startTopUp, Modifier.weight(1f))
                            AdsBalanceWithdrawalSection(current, withdrawalAmountText, quote, quoteLoading, quoteError, quoteRequiresAuthentication,
                                withdrawing, withdrawalError, withdrawalRequiresAuthentication, withdrawalStatus, onReauthenticate,
                                { withdrawalAmountText = it; quote = null; withdrawalError = null; withdrawalRequiresAuthentication = false; withdrawalStatus = null },
                                ::requestStepUp, { managingPayoutAccounts = true }, Modifier.weight(1f))
                        } else Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            AdsBalanceTopUpSection(current, topUpAmountText, topUpLoading, topUpError, topUpRequiresAuthentication, onReauthenticate,
                                { topUpAmountText = it; topUpError = null; topUpRequiresAuthentication = false }, ::startTopUp)
                            AdsBalanceWithdrawalSection(current, withdrawalAmountText, quote, quoteLoading, quoteError, quoteRequiresAuthentication,
                                withdrawing, withdrawalError, withdrawalRequiresAuthentication, withdrawalStatus, onReauthenticate,
                                { withdrawalAmountText = it; quote = null; withdrawalError = null; withdrawalRequiresAuthentication = false; withdrawalStatus = null },
                                ::requestStepUp, { managingPayoutAccounts = true })
                        }
                    }
                }
                item("ads-balance-history-title") {
                    Text("History", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
                }
                if (historyLoading && history == null) item("ads-balance-history-loading") { CircularProgressIndicator(modifier = Modifier.testTag("ads-balance-history-loading-indicator")) }
                historyError?.let { message ->
                    item("ads-balance-history-error") {
                        val initialFailure = historyResult as? AdsBalanceResult.Failure
                        if (initialFailure != null && history == null) ErrorState(
                            title = "History could not load",
                            message = message,
                            actionLabel = if (initialFailure.authenticationRequired) "Sign in again" else "Try again",
                            onAction = if (initialFailure.authenticationRequired) onReauthenticate else ({ refreshVersion += 1 }),
                        ) else {
                            TextButton(onClick = ::loadMoreTransactions) { Text("Couldn't load more history. Try again.") }
                            Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
                history?.let { page ->
                    if (page.items.isEmpty()) item("ads-balance-history-empty") {
                        Text("Nothing here yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    items(page.items, key = AdsBalanceTransaction::id) { transaction ->
                        AdsBalanceHistoryRow(transaction)
                        AdsBalanceHistoryDivider()
                    }
                    if (page.nextCursor != null) item("ads-balance-history-more") {
                        TextButton(onClick = ::loadMoreTransactions, enabled = !loadingMore, modifier = Modifier.fillMaxWidth().testTag("ads-balance-history-more-button")) {
                            if (loadingMore) CircularProgressIndicator() else Text("Show more")
                        }
                    }
                }
            }
        }
    }

    if (stepUpOpen) AdsBalanceStepUpDialog(
        email = repository.stepUpRepository.currentEmail().orEmpty(),
        mode = stepUpMode,
        codeSent = stepUpCodeSent,
        password = stepUpPassword,
        code = stepUpCode,
        busy = withdrawing,
        error = stepUpError,
        onPasswordChange = { stepUpPassword = it },
        onCodeChange = { stepUpCode = it },
        onModeChange = { stepUpMode = it; stepUpError = null },
        onSubmit = ::submitStepUp,
        onDismiss = { if (!withdrawing) { stepUpOpen = false; pendingWithdrawalAmount = null } },
    )
}

private class AdsBalanceIdempotencyKeys {
    private var signature: String? = null
    private var key: String? = null

    fun keyFor(amount: AdsWorkspaceMoney): String {
        val nextSignature = "${amount.currency}:${amount.amountMinor}"
        if (signature != nextSignature || key == null) {
            signature = nextSignature
            key = UUID.randomUUID().toString()
        }
        return requireNotNull(key)
    }

    fun reset() { signature = null; key = null }
}
