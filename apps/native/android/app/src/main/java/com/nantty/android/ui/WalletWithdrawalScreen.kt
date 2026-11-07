package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.nantty.android.data.PayoutAccountsResult
import com.nantty.android.data.StepUpGrant
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.WalletPayoutAccount
import com.nantty.android.data.WalletPayoutFee
import com.nantty.android.data.WalletPayoutFeeResult
import com.nantty.android.data.WalletPayoutReadiness
import com.nantty.android.data.WalletPayoutReadinessResult
import com.nantty.android.data.WalletSummary
import com.nantty.android.data.WalletWithdrawalQuote
import com.nantty.android.data.WalletWithdrawalResult
import com.nantty.android.data.WalletRepository
import com.nantty.android.data.formatWalletAmount
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Currency
import java.util.UUID
import java.util.concurrent.Executor

private enum class WalletStepUpMode { PASSWORD, EMAIL }

@Composable
internal fun WalletWithdrawalSection(
    repository: WalletRepository,
    executor: Executor,
    wallet: WalletSummary,
    onManagePayoutAccounts: () -> Unit,
    onWithdrawalSuccess: () -> Unit,
    onRefreshWallet: () -> Unit,
) {
    var readiness by remember(repository) { mutableStateOf<WalletPayoutReadiness?>(null) }
    var readinessError by remember(repository) { mutableStateOf<String?>(null) }
    var fee by remember(repository) { mutableStateOf<WalletPayoutFee?>(null) }
    var feeError by remember(repository) { mutableStateOf<String?>(null) }
    var accounts by remember(repository) { mutableStateOf<List<WalletPayoutAccount>?>(null) }
    var accountsError by remember(repository) { mutableStateOf<String?>(null) }
    var selectedAccountId by remember(repository) { mutableStateOf<String?>(null) }
    var amountText by remember(repository) { mutableStateOf("") }
    var loading by remember(repository) { mutableStateOf(false) }
    var submitting by remember(repository) { mutableStateOf(false) }
    var errorMessage by remember(repository) { mutableStateOf<String?>(null) }
    var statusMessage by remember(repository) { mutableStateOf<String?>(null) }
    var quote by remember(repository) { mutableStateOf<WalletWithdrawalQuote?>(null) }
    var stepUpOpen by remember(repository) { mutableStateOf(false) }
    var stepUpMode by remember(repository) { mutableStateOf(WalletStepUpMode.PASSWORD) }
    var password by remember(repository) { mutableStateOf("") }
    var emailCode by remember(repository) { mutableStateOf("") }
    var emailCodeSent by remember(repository) { mutableStateOf(false) }
    var stepUpError by remember(repository) { mutableStateOf<String?>(null) }
    var stepUpRetryCount by remember(repository) { mutableStateOf(0) }
    var requestSignature by remember(repository) { mutableStateOf<String?>(null) }
    var idempotencyKey by remember(repository) { mutableStateOf<String?>(null) }

    fun refreshPayoutData() {
        loading = true
        executor.execute {
            val nextReadiness = repository.loadPayoutReadiness()
            val nextFee = repository.loadPayoutFee()
            val accountAccessAllowed = wallet.verification.withdrawalsUnlocked &&
                (nextReadiness as? WalletPayoutReadinessResult.Success)?.value?.withdrawalsEnabled == true
            val nextAccounts = if (accountAccessAllowed) repository.payoutAccountsRepository.list() else null
            Snapshot.withMutableSnapshot {
                when (nextReadiness) {
                    is WalletPayoutReadinessResult.Success -> { readiness = nextReadiness.value; readinessError = null }
                    is WalletPayoutReadinessResult.Failure -> readinessError = nextReadiness.message
                }
                when (nextFee) {
                    is WalletPayoutFeeResult.Success -> { fee = nextFee.value; feeError = null }
                    is WalletPayoutFeeResult.Failure -> feeError = nextFee.message
                }
                when (nextAccounts) {
                    is PayoutAccountsResult.Success -> {
                        accounts = nextAccounts.accounts
                        accountsError = null
                        if (selectedAccountId !in nextAccounts.accounts.map(WalletPayoutAccount::id)) {
                            selectedAccountId = nextAccounts.accounts.firstOrNull { it.isDefault }?.id ?: nextAccounts.accounts.firstOrNull()?.id
                        }
                    }
                    is PayoutAccountsResult.Failure -> accountsError = nextAccounts.message
                    null -> { accounts = null; accountsError = null }
                }
                loading = false
            }
        }
    }

    fun requestWithdrawal(grant: StepUpGrant) {
        val currentQuote = quote ?: return
        val accountId = selectedAccountId ?: return
        val signature = "$accountId:${currentQuote.amount.amountMinor}:${currentQuote.amount.currency}"
        if (requestSignature != signature || idempotencyKey == null) {
            requestSignature = signature
            idempotencyKey = UUID.randomUUID().toString()
        }
        submitting = true
        stepUpOpen = false
        password = ""
        emailCode = ""
        executor.execute {
            val key = idempotencyKey.orEmpty()
            val result = repository.requestWithdrawal(accountId, currentQuote.amount, grant.token, key)
            Snapshot.withMutableSnapshot {
                submitting = false
                when (result) {
                    is WalletWithdrawalResult.Success -> {
                        errorMessage = null
                        statusMessage = "Withdrawal requested. The latest status will appear in your wallet transactions."
                        amountText = ""
                        quote = null
                        requestSignature = null
                        idempotencyKey = null
                        onWithdrawalSuccess()
                    }
                    is WalletWithdrawalResult.Failure -> {
                        errorMessage = result.message
                        if (result.stepUpRequired && stepUpRetryCount == 0) {
                            stepUpRetryCount = 1
                            stepUpMode = WalletStepUpMode.PASSWORD
                            stepUpError = result.message
                            stepUpOpen = true
                        }
                        if (result.authenticationRequired || result.code in setOf("VERIFICATION_REQUIRED", "IDENTITY_VERIFICATION_REQUIRED", "SELLER_VERIFICATION_REQUIRED", "WALLET_ON_HOLD")) {
                            onRefreshWallet()
                            refreshPayoutData()
                        }
                    }
                }
            }
        }
    }

    fun beginWithdrawal() {
        val currentAccountId = selectedAccountId ?: return
        val amountMinor = parseWalletAmountInput(amountText, wallet.available.currency)
        if (readiness?.withdrawalsEnabled != true || !wallet.verification.withdrawalsUnlocked || amountMinor == null || amountMinor <= 0) return
        submitting = true
        errorMessage = null
        statusMessage = null
        stepUpRetryCount = 0
        executor.execute {
            val quoted = repository.quoteWithdrawal(currentAccountId, WalletMoney(amountMinor, wallet.available.currency))
            Snapshot.withMutableSnapshot {
                submitting = false
                quoted.fold(
                    onSuccess = { serverQuote ->
                        val amountFits = serverQuote.amount.amountMinor <= wallet.available.amountMinor &&
                            serverQuote.fee.amountMinor >= 0 && serverQuote.fee.amountMinor <= wallet.available.amountMinor - serverQuote.amount.amountMinor
                        if (serverQuote.payoutAccountId != currentAccountId || serverQuote.amount.amountMinor != amountMinor ||
                            serverQuote.amount.currency != wallet.available.currency || serverQuote.fee.currency != wallet.available.currency || !amountFits) {
                            errorMessage = "The withdrawal amount and server-quoted fee exceed your available balance, or the quote changed. Review the amount and try again."
                        } else {
                            quote = serverQuote
                            stepUpMode = WalletStepUpMode.PASSWORD
                            password = ""
                            emailCode = ""
                            emailCodeSent = false
                            stepUpError = null
                            stepUpOpen = true
                        }
                    },
                    onFailure = { failure -> errorMessage = failure.message ?: "Could not check the withdrawal quote. Try again." },
                )
            }
        }
    }

    fun submitStepUp() {
        if (submitting) return
        submitting = true
        stepUpError = null
        val currentMode = stepUpMode
        val submittedPassword = password
        val submittedCode = emailCode
        val codeWasSent = emailCodeSent
        password = ""
        emailCode = ""
        executor.execute {
            val payoutRepository = repository.payoutAccountsRepository
            val grantResult: Result<StepUpGrant?> = when (currentMode) {
                WalletStepUpMode.PASSWORD -> payoutRepository.grantWithPassword(submittedPassword).map { it }
                WalletStepUpMode.EMAIL -> if (!codeWasSent) {
                    payoutRepository.sendEmailCode(payoutRepository.currentEmail().orEmpty()).map { null }
                } else payoutRepository.grantWithEmailCode(payoutRepository.currentEmail().orEmpty(), submittedCode).map { it }
            }
            Snapshot.withMutableSnapshot {
                submitting = false
                grantResult.fold(
                    onSuccess = { grant ->
                        if (grant == null) emailCodeSent = true else requestWithdrawal(grant)
                    },
                    onFailure = { failure -> stepUpError = failure.message ?: "We couldn't confirm it's you. Try again." },
                )
            }
        }
    }

    LaunchedEffect(repository) { refreshPayoutData() }

    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Withdraw", style = MaterialTheme.typography.titleMedium)
            when {
                loading && readiness == null -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CircularProgressIndicator()
                    Text("Loading payout eligibility, fee and accounts…", style = MaterialTheme.typography.bodySmall)
                }
                readiness?.withdrawalsEnabled != true || !wallet.verification.withdrawalsUnlocked -> {
                    Text(
                        readiness?.message ?: wallet.verification.message ?: "Withdrawals are currently unavailable for this account.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text("Withdrawal eligibility is controlled by your account's payout status.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
                readinessError != null -> PayoutInfoMessage(readinessError.orEmpty(), "Try again", ::refreshPayoutData)
                else -> {
                    Text("Available: ${formatWalletAmount(wallet.available)}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    when {
                        accountsError != null -> PayoutInfoMessage(accountsError.orEmpty(), "Try again", ::refreshPayoutData)
                        accounts.isNullOrEmpty() -> {
                            Text("Add a payout account before requesting a withdrawal.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                            TextButton(onClick = onManagePayoutAccounts, modifier = Modifier.heightIn(min = 48.dp)) { Text("Add payout account") }
                        }
                        else -> {
                            Text("Send to", style = MaterialTheme.typography.labelLarge)
                            accounts.orEmpty().forEach { account ->
                                val selected = selectedAccountId == account.id
                                Row(
                                    Modifier.fillMaxWidth().selectable(
                                        selected = selected,
                                        onClick = { selectedAccountId = account.id; quote = null; errorMessage = null },
                                        role = Role.RadioButton,
                                    ).padding(vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    RadioButton(selected = selected, onClick = null)
                                    Column(Modifier.weight(1f).padding(start = 8.dp)) {
                                        Text("${account.bankName} ${account.accountNumberMasked}", style = MaterialTheme.typography.bodyMedium)
                                        Text(account.accountName, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                            TextButton(onClick = onManagePayoutAccounts, modifier = Modifier.align(Alignment.End).heightIn(min = 48.dp)) { Text("Manage accounts") }
                            OutlinedTextField(
                                value = amountText,
                                onValueChange = { value ->
                                    amountText = value.filter { it.isDigit() || it == '.' }
                                    errorMessage = null
                                    statusMessage = null
                                    quote = null
                                    requestSignature = null
                                    idempotencyKey = null
                                },
                                label = { Text("Amount (${wallet.available.currency})") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Withdrawal amount in ${wallet.available.currency}" }.testTag("wallet-withdrawal-amount"),
                            )
                            when {
                                fee != null -> Text(
                                    buildString {
                                        append("Payout fee: ${formatWalletAmount(fee!!.amount)}")
                                        if (fee!!.arrivalEstimate.isNotBlank()) append(" · ${fee!!.arrivalEstimate}")
                                        if (fee!!.firstPayoutNote.isNotBlank()) append("\n${fee!!.firstPayoutNote}")
                                    },
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                                feeError != null -> PayoutInfoMessage(feeError.orEmpty(), "Retry", ::refreshPayoutData)
                            }
                            errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.semantics { contentDescription = it }) }
                            if (errorMessage != null) {
                                TextButton(
                                    onClick = { onRefreshWallet(); refreshPayoutData() },
                                    modifier = Modifier.align(Alignment.End).heightIn(min = 48.dp),
                                ) { Text("Refresh wallet and payout status") }
                            }
                            statusMessage?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall) }
                            val amountMinor = parseWalletAmountInput(amountText, wallet.available.currency)
                            val flatFee = fee?.amount?.takeIf { it.currency == wallet.available.currency }?.amountMinor
                            val clientBalanceOkay = amountMinor != null && flatFee != null && amountMinor <= wallet.available.amountMinor && flatFee <= wallet.available.amountMinor - amountMinor
                            Button(
                                onClick = ::beginWithdrawal,
                                enabled = !submitting && !loading && readiness?.withdrawalsEnabled == true && wallet.verification.withdrawalsUnlocked &&
                                    selectedAccountId != null && clientBalanceOkay,
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("wallet-withdraw-submit"),
                            ) {
                                if (submitting) CircularProgressIndicator()
                                else Text("Request withdrawal")
                            }
                        }
                    }
                }
            }
        }
    }

    if (stepUpOpen) {
        WalletWithdrawalStepUpDialog(
            email = repository.payoutAccountsRepository.currentEmail().orEmpty(),
            mode = stepUpMode,
            codeSent = emailCodeSent,
            password = password,
            code = emailCode,
            busy = submitting,
            error = stepUpError,
            onPasswordChange = { password = it },
            onCodeChange = { emailCode = it },
            onModeChange = { stepUpMode = it; stepUpError = null },
            onSubmit = ::submitStepUp,
            onDismiss = { if (!submitting) { stepUpOpen = false; quote = null } },
        )
    }
}

@Composable
private fun WalletWithdrawalStepUpDialog(
    email: String,
    mode: WalletStepUpMode,
    codeSent: Boolean,
    password: String,
    code: String,
    busy: Boolean,
    error: String?,
    onPasswordChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onModeChange: (WalletStepUpMode) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Confirm it's you") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Confirm your identity before this withdrawal.", style = MaterialTheme.typography.bodySmall)
                when (mode) {
                    WalletStepUpMode.PASSWORD -> OutlinedTextField(
                        value = password,
                        onValueChange = onPasswordChange,
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth().testTag("wallet-withdraw-password"),
                    )
                    WalletStepUpMode.EMAIL -> if (codeSent) {
                        OutlinedTextField(
                            value = code,
                            onValueChange = { onCodeChange(it.filter(Char::isDigit).take(6)) },
                            label = { Text("6-digit code sent to $email") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            modifier = Modifier.fillMaxWidth().testTag("wallet-withdraw-email-code"),
                        )
                    } else Text("We'll email a sign-in code to $email.", style = MaterialTheme.typography.bodySmall)
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.semantics { contentDescription = it }) }
            }
        },
        confirmButton = {
            TextButton(onClick = onSubmit, enabled = !busy) {
                if (busy) CircularProgressIndicator() else Text(if (mode == WalletStepUpMode.EMAIL && !codeSent) "Email me a code" else "Confirm")
            }
        },
        dismissButton = {
            Row {
                if (email.isNotBlank()) {
                    TextButton(onClick = { onModeChange(if (mode == WalletStepUpMode.PASSWORD) WalletStepUpMode.EMAIL else WalletStepUpMode.PASSWORD) }, enabled = !busy) {
                        Text(if (mode == WalletStepUpMode.PASSWORD) "Use email code" else "Use password")
                    }
                }
                TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") }
            }
        },
    )
}

@Composable
private fun PayoutInfoMessage(message: String, actionLabel: String, onAction: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        TextButton(onClick = onAction, modifier = Modifier.heightIn(min = 48.dp)) { Text(actionLabel) }
    }
}

private fun parseWalletAmountInput(value: String, currencyCode: String): Long? = runCatching {
    val fractionDigits = Currency.getInstance(currencyCode).defaultFractionDigits.takeIf { it >= 0 } ?: 2
    BigDecimal(value.trim()).movePointRight(fractionDigits).setScale(0, RoundingMode.UNNECESSARY).longValueExact()
}.getOrNull()
