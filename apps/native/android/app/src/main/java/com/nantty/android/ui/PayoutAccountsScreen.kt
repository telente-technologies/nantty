package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.nantty.android.data.PayoutAccountsRepository
import com.nantty.android.data.PayoutBank
import com.nantty.android.data.PayoutBanksResult
import com.nantty.android.data.PayoutMutationResult
import com.nantty.android.data.PayoutAccountsResult
import com.nantty.android.data.StepUpGrant
import com.nantty.android.data.WalletPayoutAccount
import java.util.Locale
import java.util.concurrent.Executor

private enum class PayoutStepUpMode { PASSWORD, EMAIL }
private sealed interface PayoutChange {
    data class Add(val bankCode: String, val accountNumber: String) : PayoutChange
    data class Remove(val accountId: String, val label: String) : PayoutChange
}

@Composable
internal fun PayoutAccountsScreen(
    repository: PayoutAccountsRepository,
    executor: Executor,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val countryCode = remember { Locale.getDefault().country.uppercase(Locale.ROOT).takeIf { it.matches(Regex("^[A-Z]{2}$")) } ?: "NG" }
    var accounts by remember(repository) { mutableStateOf<List<WalletPayoutAccount>?>(null) }
    var banks by remember(repository) { mutableStateOf<List<PayoutBank>?>(null) }
    var loadingAccounts by remember(repository) { mutableStateOf(false) }
    var loadingBanks by remember(repository) { mutableStateOf(false) }
    var accountsError by remember(repository) { mutableStateOf<String?>(null) }
    var banksError by remember(repository) { mutableStateOf<String?>(null) }
    var bankDialogOpen by remember { mutableStateOf(false) }
    var bankSearch by remember { mutableStateOf("") }
    var selectedBank by remember { mutableStateOf<PayoutBank?>(null) }
    var accountNumber by remember { mutableStateOf("") }
    var pendingChange by remember { mutableStateOf<PayoutChange?>(null) }
    var confirmingRemoval by remember { mutableStateOf<PayoutChange.Remove?>(null) }
    var stepUpMode by remember { mutableStateOf(PayoutStepUpMode.PASSWORD) }
    var password by remember { mutableStateOf("") }
    var emailCode by remember { mutableStateOf("") }
    var emailCodeSent by remember { mutableStateOf(false) }
    var stepUpRetryCount by remember { mutableStateOf(0) }
    var stepUpOpen by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var statusMessage by remember { mutableStateOf<String?>(null) }

    fun refreshAccounts() {
        loadingAccounts = true
        accountsError = null
        executor.execute {
            val result = repository.list()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is PayoutAccountsResult.Success -> { accounts = result.accounts; accountsError = null }
                    is PayoutAccountsResult.Failure -> { accountsError = result.message }
                }
                loadingAccounts = false
            }
        }
    }

    fun loadBanks() {
        if (banks != null || loadingBanks) return
        loadingBanks = true
        banksError = null
        executor.execute {
            val result = repository.listBanks(countryCode)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is PayoutBanksResult.Success -> { banks = result.banks; banksError = null }
                    is PayoutBanksResult.Failure -> banksError = result.message
                }
                loadingBanks = false
            }
        }
    }

    fun beginStepUp(change: PayoutChange) {
        pendingChange = change
        stepUpRetryCount = 0
        password = ""
        emailCode = ""
        emailCodeSent = false
        errorMessage = null
        stepUpOpen = true
    }

    fun consumeGrant(grant: StepUpGrant) {
        val action = pendingChange ?: return
        // Token is captured only for this request, never saved to state, preferences or disk.
        executor.execute {
            val result = when (action) {
                is PayoutChange.Add -> repository.add(action.bankCode, action.accountNumber, grant.token)
                is PayoutChange.Remove -> repository.remove(action.accountId, grant.token)
            }
            Snapshot.withMutableSnapshot {
                stepUpOpen = false
                pendingChange = null
                working = false
                when (result) {
                    PayoutMutationResult.Success -> {
                        password = ""
                        emailCode = ""
                        accountNumber = ""
                        if (action is PayoutChange.Add) selectedBank = null
                        statusMessage = if (action is PayoutChange.Add) "Payout account added." else "Payout account removed."
                        refreshAccounts()
                    }
                    is PayoutMutationResult.Failure -> {
                        password = ""
                        emailCode = ""
                        if (result.stepUpRequired && stepUpRetryCount == 0) {
                            stepUpRetryCount = 1
                            pendingChange = action
                            stepUpMode = PayoutStepUpMode.PASSWORD
                            errorMessage = "Please confirm it's you again to complete this change."
                            stepUpOpen = true
                        } else errorMessage = result.message
                        statusMessage = null
                    }
                }
            }
        }
    }

    fun requestGrant() {
        if (working) return
        working = true
        errorMessage = null
        val mode = stepUpMode
        val submittedPassword = password
        val submittedCode = emailCode
        password = ""
        emailCode = ""
        executor.execute {
            val result: Result<StepUpGrant?> = when (mode) {
                PayoutStepUpMode.PASSWORD -> repository.grantWithPassword(submittedPassword).map { it }
                PayoutStepUpMode.EMAIL -> if (!emailCodeSent) {
                    val send = repository.sendEmailCode(repository.currentEmail().orEmpty())
                    send.fold(onSuccess = { Result.success<StepUpGrant?>(null) }, onFailure = { Result.failure(it) })
                } else repository.grantWithEmailCode(repository.currentEmail().orEmpty(), submittedCode).map { it }
            }
            Snapshot.withMutableSnapshot {
                working = false
                result.fold(
                    onSuccess = { grant ->
                        if (grant == null) {
                            emailCodeSent = true
                            statusMessage = "A sign-in code was sent to your email."
                        } else {
                            statusMessage = null
                            consumeGrant(grant)
                        }
                    },
                    onFailure = { failure -> errorMessage = failure.message ?: "We couldn't confirm it's you. Try again." },
                )
            }
        }
    }

    LaunchedEffect(repository) {
        refreshAccounts()
        loadBanks()
    }

    Column(
        modifier.fillMaxSize().widthIn(max = 760.dp).verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            TextButton(onClick = onBack, modifier = Modifier.testTag("payout-accounts-back")) { Text("‹ Wallet") }
            Text("Payout accounts", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            TextButton(onClick = ::refreshAccounts, enabled = !loadingAccounts, modifier = Modifier.semantics { contentDescription = "Refresh payout accounts" }) { Text("Refresh") }
        }
        when {
            loadingAccounts && accounts == null -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator()
                Text("Loading payout accounts…")
            }
            accountsError != null -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(accountsError.orEmpty(), color = MaterialTheme.colorScheme.error)
                TextButton(onClick = ::refreshAccounts, enabled = !loadingAccounts) { Text("Try again") }
            }
            accounts.isNullOrEmpty() -> Text("No payout accounts saved yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            else -> accounts.orEmpty().forEach { account ->
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${account.bankName} ${account.accountNumberMasked}", style = MaterialTheme.typography.titleSmall)
                        }
                        TextButton(
                            onClick = { confirmingRemoval = PayoutChange.Remove(account.id, "${account.bankName} ${account.accountNumberMasked}") },
                            enabled = !working,
                            modifier = Modifier.testTag("remove-payout-${account.id}"),
                        ) { Text("Remove", color = MaterialTheme.colorScheme.error) }
                    }
                    HorizontalDivider()
                }
            }
        }
        Text("Add a bank account", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
            value = selectedBank?.name.orEmpty(),
            onValueChange = {},
            readOnly = true,
            label = { Text("Bank") },
            placeholder = { Text("Choose your bank") },
            modifier = Modifier.fillMaxWidth().clickable { bankDialogOpen = true; loadBanks() }.testTag("payout-bank-picker"),
            enabled = true,
        )
        if (banksError != null) Row(verticalAlignment = Alignment.CenterVertically) {
            Text(banksError.orEmpty(), Modifier.weight(1f), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = ::loadBanks, enabled = !loadingBanks) { Text("Retry") }
        }
        OutlinedTextField(
            value = accountNumber,
            onValueChange = { value -> accountNumber = value.filter(Char::isDigit).take(10) },
            label = { Text("Account number") },
            placeholder = { Text("10-digit account number") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            singleLine = true,
            modifier = Modifier.fillMaxWidth().testTag("payout-account-number"),
        )
        Text("We verify the account name with your bank. Withdrawals can only go to an account in your name.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        errorMessage?.takeIf { !stepUpOpen }?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        statusMessage?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall) }
        Button(
            onClick = { selectedBank?.let { beginStepUp(PayoutChange.Add(it.code, accountNumber)) } },
            enabled = !working && selectedBank != null && accountNumber.length == 10,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("add-payout-account"),
        ) { Text(if (working) "Working…" else "Add account") }
    }

    if (bankDialogOpen) {
        AlertDialog(
            onDismissRequest = { bankDialogOpen = false },
            title = { Text("Choose your bank") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = bankSearch,
                        onValueChange = { bankSearch = it },
                        label = { Text("Search banks") },
                        singleLine = true,
                    )
                    when {
                        loadingBanks -> CircularProgressIndicator()
                        banksError != null -> Text(banksError.orEmpty(), color = MaterialTheme.colorScheme.error)
                        banks.isNullOrEmpty() -> Text("No banks are currently available for $countryCode.")
                        else -> LazyColumn(Modifier.heightIn(max = 360.dp)) {
                            val matchingBanks = banks.orEmpty().filter { it.name.contains(bankSearch.trim(), ignoreCase = true) }
                            items(matchingBanks, key = PayoutBank::code) { bank ->
                                Text(bank.name, Modifier.fillMaxWidth().clickable { selectedBank = bank; bankDialogOpen = false; bankSearch = "" }.padding(vertical = 12.dp))
                                HorizontalDivider()
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { bankDialogOpen = false }) { Text("Close") } },
        )
    }

    confirmingRemoval?.let { removal ->
        AlertDialog(
            onDismissRequest = { confirmingRemoval = null },
            title = { Text("Remove account?") },
            text = { Text("${removal.label} will no longer receive withdrawals.") },
            confirmButton = {
                TextButton(onClick = { confirmingRemoval = null; beginStepUp(removal) }) { Text("Remove", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmingRemoval = null }) { Text("Cancel") } },
        )
    }

    if (stepUpOpen) {
        PayoutStepUpDialog(
            email = repository.currentEmail(),
            mode = stepUpMode,
            password = password,
            code = emailCode,
            codeSent = emailCodeSent,
            busy = working,
            error = errorMessage,
            onPasswordChange = { password = it },
            onCodeChange = { emailCode = it.filter(Char::isDigit).take(6) },
            onModeChange = { stepUpMode = it; errorMessage = null },
            onConfirm = ::requestGrant,
            onCancel = { if (!working) { stepUpOpen = false; pendingChange = null; password = ""; emailCode = ""; errorMessage = null } },
        )
    }
}

@Composable
private fun PayoutStepUpDialog(
    email: String?,
    mode: PayoutStepUpMode,
    password: String,
    code: String,
    codeSent: Boolean,
    busy: Boolean,
    error: String?,
    onPasswordChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onModeChange: (PayoutStepUpMode) -> Unit,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text("Confirm it's you") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("We check again before a payout account changes.", style = MaterialTheme.typography.bodySmall)
                if (mode == PayoutStepUpMode.PASSWORD) {
                    OutlinedTextField(
                        value = password,
                        onValueChange = onPasswordChange,
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                    )
                } else if (!codeSent) {
                    Text(email?.let { "We'll email a 6-digit code to $it." } ?: "An email address is not available for this account.")
                } else {
                    OutlinedTextField(
                        value = code,
                        onValueChange = onCodeChange,
                        label = { Text("Code sent to ${email.orEmpty()}") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        singleLine = true,
                    )
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !busy && (mode == PayoutStepUpMode.PASSWORD && password.isNotEmpty() || mode == PayoutStepUpMode.EMAIL && (!codeSent || code.length == 6))) {
                if (busy) CircularProgressIndicator()
                else Text(if (mode == PayoutStepUpMode.EMAIL && !codeSent) "Email me a code" else "Confirm")
            }
        },
        dismissButton = {
            Row {
                if (!email.isNullOrBlank()) TextButton(onClick = { onModeChange(if (mode == PayoutStepUpMode.PASSWORD) PayoutStepUpMode.EMAIL else PayoutStepUpMode.PASSWORD) }, enabled = !busy) {
                    Text(if (mode == PayoutStepUpMode.PASSWORD) "Use email code" else "Use password")
                }
                TextButton(onClick = onCancel, enabled = !busy) { Text("Cancel") }
            }
        },
    )
}
