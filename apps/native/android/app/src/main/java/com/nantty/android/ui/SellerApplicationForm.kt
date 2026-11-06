package com.nantty.android.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SellerApplicationBank
import com.nantty.android.data.SellerApplicationCategory
import com.nantty.android.data.SellerApplicationMutationResult
import com.nantty.android.data.SellerApplicationOptions
import com.nantty.android.data.SellerApplicationOptionsResult
import com.nantty.android.data.SellerApplicationSubmission
import com.nantty.android.data.SellerIdentityUploadResult
import com.nantty.android.data.SellerWorkspaceRepository
import java.util.UUID
import java.util.concurrent.Executor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private val sellerApplicationSteps = listOf("Store", "Contact & logistics", "Identity", "Payout", "Review")
private const val SELLER_STORE_NAME_MAX_LENGTH = 40
private const val SELLER_STORE_DESCRIPTION_MAX_LENGTH = 300
private val identityDocumentTypes = listOf(
    "nin_slip" to "NIN slip or card", "drivers_licence" to "Driver's licence",
    "voters_card" to "Voter's card (PVC)", "international_passport" to "International passport",
)

@Composable
internal fun SellerApplicationForm(
    repository: SellerWorkspaceRepository,
    executor: Executor,
    onBack: () -> Unit,
    onSubmitted: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onOpenCountryPreferences: () -> Unit = {},
) {
    val context = LocalContext.current.applicationContext
    var options by remember { mutableStateOf<SellerApplicationOptions?>(null) }
    var optionsError by remember { mutableStateOf<String?>(null) }
    var optionsLoading by remember { mutableStateOf(true) }
    var step by rememberSaveable { mutableIntStateOf(0) }
    var storeName by rememberSaveable { mutableStateOf("") }
    var categoryId by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable { mutableStateOf("") }
    var city by rememberSaveable { mutableStateOf("") }
    var state by rememberSaveable { mutableStateOf("") }
    var logisticsChoice by rememberSaveable { mutableStateOf<Boolean?>(null) }
    var documentType by rememberSaveable { mutableStateOf("") }
    var documentNumber by rememberSaveable { mutableStateOf("") }
    var documentPhotoUrl by rememberSaveable { mutableStateOf("") }
    var bankCode by rememberSaveable { mutableStateOf("") }
    var accountNumber by rememberSaveable { mutableStateOf("") }
    var accountName by rememberSaveable { mutableStateOf("") }
    var accountNameError by rememberSaveable { mutableStateOf<String?>(null) }
    var verifyingAccount by remember { mutableStateOf(false) }
    var uploadingDocument by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var authenticationRequired by remember { mutableStateOf(false) }
    var retryOptions by remember { mutableIntStateOf(0) }
    val idempotencyKey = rememberSaveable { UUID.randomUUID().toString() }

    LaunchedEffect(repository, retryOptions) {
        optionsLoading = true
        optionsError = null
        when (val result = withContext(Dispatchers.IO) { repository.loadApplicationOptions() }) {
            is SellerApplicationOptionsResult.Success -> options = result.options
            is SellerApplicationOptionsResult.Failure -> {
                optionsError = result.message
                if (result.authenticationRequired) onAuthenticationRequired()
            }
        }
        optionsLoading = false
    }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null || uploadingDocument) return@rememberLauncherForActivityResult
        uploadingDocument = true
        errorMessage = null
        executor.execute {
            val result = repository.uploadIdentityDocument(uri, context.contentResolver, context.cacheDir)
            Snapshot.withMutableSnapshot {
                uploadingDocument = false
                when (result) {
                    is SellerIdentityUploadResult.Success -> documentPhotoUrl = result.url
                    is SellerIdentityUploadResult.Failure -> {
                        errorMessage = result.message
                        if (result.authenticationRequired) onAuthenticationRequired()
                    }
                    SellerIdentityUploadResult.Cancelled -> Unit
                }
            }
        }
    }

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { if (step == 0) onBack() else step-- }) { Text("Back") }
            Text("Step ${step + 1} of ${sellerApplicationSteps.size}", style = MaterialTheme.typography.labelLarge)
        }
        Text("Start selling", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        Text(sellerApplicationSteps[step], style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)

        when {
            optionsLoading -> CircularProgressIndicator()
            optionsError != null -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(optionsError.orEmpty(), color = MaterialTheme.colorScheme.error)
                OutlinedButton(onClick = { retryOptions++ }) { Text("Try again") }
            }
            options?.countryCode != "NG" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Seller applications are currently open only to sellers based in Nigeria. Your account country is ${options?.countryCode ?: "not set"}.")
                OutlinedButton(onClick = onOpenCountryPreferences) { Text("Open country settings") }
                Text("Creator applications from outside Nigeria remain available.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            else -> {
                val currentOptions = options!!
                when (step) {
                    0 -> SellerStoreApplicationFields(
                        storeName, { storeName = it }, currentOptions.categories, categoryId, { categoryId = it }, description, { description = it },
                    )
                    1 -> SellerContactApplicationFields(
                        phone, { phone = it }, address, { address = it }, city, { city = it }, state, { state = it }, logisticsChoice, { logisticsChoice = it },
                    )
                    2 -> SellerIdentityApplicationFields(
                        documentType, { documentType = it }, documentNumber, { documentNumber = it }, documentPhotoUrl,
                        uploadingDocument, { imagePicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    )
                    3 -> SellerPayoutApplicationFields(
                        currentOptions.banks, bankCode, { bankCode = it; accountName = "" }, accountNumber,
                        { accountNumber = it.filter(Char::isDigit).take(10); accountName = "" }, accountName, accountNameError,
                        verifyingAccount,
                        onVerify = {
                            verifyingAccount = true
                            accountNameError = null
                            executor.execute {
                                val resolved = runCatching { repository.resolvePayoutAccountName(bankCode, accountNumber) }
                                Snapshot.withMutableSnapshot {
                                    verifyingAccount = false
                                    resolved.onSuccess { accountName = it }.onFailure { accountNameError = it.message ?: "Could not verify account." }
                                }
                            }
                        },
                    )
                    else -> SellerApplicationReview(
                        storeName, currentOptions.categories.firstOrNull { it.id == categoryId }?.name.orEmpty(), description,
                        phone, address, city, state, logisticsChoice, documentType, documentNumber, documentPhotoUrl.isNotBlank(),
                        currentOptions.banks.firstOrNull { it.code == bankCode }?.name.orEmpty(), accountNumber, accountName,
                    )
                }
                errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                if (step == sellerApplicationSteps.lastIndex) {
                    Button(
                        onClick = {
                            submitting = true
                            errorMessage = null
                            val submission = SellerApplicationSubmission(
                                storeName, categoryId, description, phone, address, city, state, logisticsChoice,
                                documentType, documentNumber, documentPhotoUrl, bankCode, accountNumber,
                            )
                            executor.execute {
                                val result = repository.submitApplication(submission, idempotencyKey)
                                Snapshot.withMutableSnapshot {
                                    submitting = false
                                    when (result) {
                                        is SellerApplicationMutationResult.Success -> onSubmitted()
                                        is SellerApplicationMutationResult.Failure -> {
                                            errorMessage = result.message
                                            if (result.authenticationRequired) onAuthenticationRequired()
                                        }
                                    }
                                }
                            }
                        },
                        enabled = !submitting && validSellerApplication(storeName, categoryId, description, phone, address, city, state, logisticsChoice, documentType, documentNumber, documentPhotoUrl, bankCode, accountNumber, accountName),
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(if (submitting) "Submitting…" else "Submit application") }
                } else {
                    Button(onClick = { step++ }, enabled = !uploadingDocument && !verifyingAccount && validSellerApplicationStep(
                        step, storeName, categoryId, description, phone, address, city, state, logisticsChoice,
                        documentType, documentNumber, documentPhotoUrl, bankCode, accountNumber, accountName,
                    ), modifier = Modifier.fillMaxWidth()) { Text("Continue") }
                }
            }
        }
    }
}

@Composable
private fun SellerStoreApplicationFields(name: String, onName: (String) -> Unit, categories: List<SellerApplicationCategory>, selected: String, onSelect: (String) -> Unit, description: String, onDescription: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            name,
            { value -> onName(value.take(SELLER_STORE_NAME_MAX_LENGTH)) },
            label = { Text("Store name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Column {
            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                Text(categories.firstOrNull { it.id == selected }?.name ?: "Choose a store category")
            }
            DropdownMenu(expanded, { expanded = false }, modifier = Modifier.fillMaxWidth()) {
                categories.forEach { category -> DropdownMenuItem(text = { Text(category.name) }, onClick = { onSelect(category.id); expanded = false }) }
            }
        }
        OutlinedTextField(
            description,
            { value -> onDescription(value.take(SELLER_STORE_DESCRIPTION_MAX_LENGTH)) },
            label = { Text("About your store") },
            minLines = 3,
            maxLines = 6,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "${description.length}/$SELLER_STORE_DESCRIPTION_MAX_LENGTH",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SellerContactApplicationFields(phone: String, onPhone: (String) -> Unit, address: String, onAddress: (String) -> Unit, city: String, onCity: (String) -> Unit, state: String, onState: (String) -> Unit, logistics: Boolean?, onLogistics: (Boolean) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(phone, onPhone, label = { Text("Business phone number") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(address, onAddress, label = { Text("Pickup address") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(city, onCity, label = { Text("City or town") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(state, onState, label = { Text("State") }, modifier = Modifier.fillMaxWidth())
        Text("Can your store handle order logistics?", style = MaterialTheme.typography.titleSmall)
        Text("This records your store’s capability for review. It does not activate a third-party courier. Your and your buyers’ email addresses are not shared with logistics providers.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected = logistics == true, onClick = { onLogistics(true) }); Text("Yes, we can")
            RadioButton(selected = logistics == false, onClick = { onLogistics(false) }); Text("Not yet")
        }
        Text("Couriers collect orders from this address. Buyers only see your city and state.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SellerIdentityApplicationFields(type: String, onType: (String) -> Unit, number: String, onNumber: (String) -> Unit, photoUrl: String, uploading: Boolean, onPickPhoto: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        identityDocumentTypes.forEach { (value, label) -> Row(verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected = type == value, onClick = { onType(value) }); Text(label)
        } }
        OutlinedTextField(number, onNumber, label = { Text("Document number") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii), modifier = Modifier.fillMaxWidth())
        Text("Your document number is encrypted and never shown in full.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = onPickPhoto, enabled = !uploading, modifier = Modifier.fillMaxWidth()) {
            Text(when { uploading -> "Uploading and securing photo…"; photoUrl.isNotBlank() -> "Replace ID photo"; else -> "Add ID photo" })
        }
    }
}

@Composable
private fun SellerPayoutApplicationFields(banks: List<SellerApplicationBank>, selectedCode: String, onBank: (String) -> Unit, number: String, onNumber: (String) -> Unit, accountName: String, error: String?, verifying: Boolean, onVerify: () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) { Text(banks.firstOrNull { it.code == selectedCode }?.name ?: "Choose your bank") }
        DropdownMenu(expanded, { expanded = false }) { banks.forEach { bank -> DropdownMenuItem(text = { Text(bank.name) }, onClick = { onBank(bank.code); expanded = false }) } }
        OutlinedTextField(number, onNumber, label = { Text("10-digit account number") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        OutlinedButton(onClick = onVerify, enabled = selectedCode.isNotBlank() && number.length == 10 && !verifying, modifier = Modifier.fillMaxWidth()) {
            Text(if (verifying) "Verifying…" else "Verify account name")
        }
        when { accountName.isNotBlank() -> Text(accountName, color = MaterialTheme.colorScheme.primary); error != null -> Text(error, color = MaterialTheme.colorScheme.error) }
        Text("Escrow releases and withdrawals go to this account. The account name must match the name on your ID.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SellerApplicationReview(name: String, category: String, description: String, phone: String, address: String, city: String, state: String, logistics: Boolean?, documentType: String, documentNumber: String, hasPhoto: Boolean, bank: String, accountNumber: String, accountName: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Review your details before submitting. Nantty checks account country and category eligibility on the server.", style = MaterialTheme.typography.bodyMedium)
        listOf(
            "Store" to name, "Category" to category, "Description" to description, "Phone" to phone,
            "Pickup address" to listOf(address, city, state).filter(String::isNotBlank).joinToString(", "),
            "Logistics" to when (logistics) { true -> "Can handle logistics"; false -> "Cannot handle logistics yet"; null -> "Not selected" },
            "Identity document" to "${identityDocumentTypes.firstOrNull { it.first == documentType }?.second.orEmpty()} ·••${documentNumber.takeLast(4)} · ${if (hasPhoto) "Photo attached" else "Photo missing"}",
            "Payout" to "$bank ·••${accountNumber.takeLast(4)} · $accountName",
        ).forEach { (label, value) -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(.8f))
            Text(value, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1.2f))
        } }
    }
}

private fun validSellerApplicationStep(step: Int, name: String, category: String, description: String, phone: String, address: String, city: String, state: String, logistics: Boolean?, documentType: String, documentNumber: String, photo: String, bank: String, accountNumber: String, accountName: String): Boolean = when (step) {
    0 -> name.trim().length >= 3 && category.isNotBlank() && description.trim().length >= 20
    1 -> phone.count(Char::isDigit) >= 10 && address.trim().length >= 5 && city.trim().length >= 2 && state.trim().length >= 2 && logistics != null
    2 -> documentType in identityDocumentTypes.map { it.first } && documentNumber.length >= 5 && photo.isNotBlank()
    3 -> bank.isNotBlank() && accountNumber.matches(Regex("^\\d{10}$")) && accountName.isNotBlank()
    else -> true
}

private fun validSellerApplication(name: String, category: String, description: String, phone: String, address: String, city: String, state: String, logistics: Boolean?, documentType: String, documentNumber: String, photo: String, bank: String, accountNumber: String, accountName: String) =
    (0..3).all { step -> validSellerApplicationStep(step, name, category, description, phone, address, city, state, logistics, documentType, documentNumber, photo, bank, accountNumber, accountName) }
