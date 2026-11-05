package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CreatorApplicationRepository
import com.nantty.android.data.CreatorApplicationSocialLink
import com.nantty.android.data.CreatorApplicationSubmission
import com.nantty.android.data.CreatorApplication
import com.nantty.android.data.CreatorPayoutAccount
import com.nantty.android.data.CreatorPayoutAccountsResult
import com.nantty.android.data.CreatorWorkspaceRepository
import com.nantty.android.data.CreatorWorkspaceResult
import java.util.UUID
import java.util.concurrent.Executor

private data class CreatorApplicationCategory(val id: String, val label: String)
private data class CreatorSocialPlatform(val id: String, val label: String, val placeholder: String)

private val creatorApplicationCategories = listOf(
    CreatorApplicationCategory("fashion", "Fashion"),
    CreatorApplicationCategory("beauty", "Beauty"),
    CreatorApplicationCategory("tech", "Tech"),
    CreatorApplicationCategory("food", "Food"),
    CreatorApplicationCategory("lifestyle", "Lifestyle"),
    CreatorApplicationCategory("comedy", "Comedy"),
    CreatorApplicationCategory("music", "Music"),
    CreatorApplicationCategory("education", "Education"),
    CreatorApplicationCategory("fitness", "Fitness"),
    CreatorApplicationCategory("parenting", "Parenting"),
)

private val creatorSocialPlatforms = listOf(
    CreatorSocialPlatform("instagram", "Instagram", "https://instagram.com/yourname"),
    CreatorSocialPlatform("tiktok", "TikTok", "https://tiktok.com/@yourname"),
    CreatorSocialPlatform("youtube", "YouTube", "https://youtube.com/@yourname"),
)

@Composable
internal fun CreatorApplicationForm(
    repository: CreatorWorkspaceRepository,
    executor: Executor,
    onBack: () -> Unit,
    onSubmitted: (CreatorApplication) -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var selectedCategories by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var socialUrls by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var sampleContentUrls by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var sampleUploading by remember { mutableStateOf(false) }
    var selectedPayoutAccountId by rememberSaveable { mutableStateOf<String?>(null) }
    var payoutAccounts by remember { mutableStateOf<List<CreatorPayoutAccount>>(emptyList()) }
    var payoutAccountsLoading by remember { mutableStateOf(true) }
    var payoutAccountsFailure by remember { mutableStateOf<String?>(null) }
    var payoutAccountsRequireSignIn by remember { mutableStateOf(false) }
    var acceptedTerms by rememberSaveable { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var submitFailure by remember { mutableStateOf<com.nantty.android.data.CreatorWorkspaceResult.Failure?>(null) }
    var termsVisible by remember { mutableStateOf(false) }
    val idempotencyKey = rememberSaveable { UUID.randomUUID().toString() }
    val uriHandler = LocalUriHandler.current
    val canSubmit = selectedCategories.isNotEmpty() && selectedCategories.size <= CreatorApplicationRepository.MAX_CATEGORIES && acceptedTerms && !submitting && !sampleUploading

    fun loadPayoutAccounts() {
        payoutAccountsLoading = true
        payoutAccountsFailure = null
        executor.execute {
            when (val result = repository.listPayoutAccounts()) {
                is CreatorPayoutAccountsResult.Success -> Snapshot.withMutableSnapshot {
                    payoutAccounts = result.accounts
                    selectedPayoutAccountId = selectedPayoutAccountId ?: result.accounts.firstOrNull()?.id
                    payoutAccountsLoading = false
                    payoutAccountsRequireSignIn = false
                }
                is CreatorPayoutAccountsResult.Failure -> Snapshot.withMutableSnapshot {
                    payoutAccountsLoading = false
                    payoutAccountsFailure = result.message
                    payoutAccountsRequireSignIn = result.authenticationRequired
                }
            }
        }
    }

    LaunchedEffect(repository) { loadPayoutAccounts() }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 12.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onBack, enabled = !submitting) { Text("Back") }
            Text("Apply as a creator", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        }
        HorizontalDivider()
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("What do you create?", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("Pick up to 3.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    creatorApplicationCategories.forEach { category ->
                        val selected = category.id in selectedCategories
                        FilterChip(
                            selected = selected,
                            onClick = {
                                selectedCategories = if (selected) selectedCategories - category.id
                                else if (selectedCategories.size < CreatorApplicationRepository.MAX_CATEGORIES) selectedCategories + category.id
                                else selectedCategories
                            },
                            label = { Text(category.label) },
                        )
                    }
                }
                if (selectedCategories.isEmpty()) {
                    Text("Choose at least one category to continue.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                } else if (selectedCategories.size == CreatorApplicationRepository.MAX_CATEGORIES) {
                    Text("You can select up to 3 categories.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Your other social accounts (optional)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                creatorSocialPlatforms.forEachIndexed { index, platform ->
                    OutlinedTextField(
                        value = socialUrls.getOrElse(index) { "" },
                        onValueChange = { value ->
                            socialUrls = List(creatorSocialPlatforms.size) { i -> if (i == index) value else socialUrls.getOrElse(i) { "" } }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(platform.label) },
                        placeholder = { Text(platform.placeholder) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Sample content (optional)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                CreatorSampleContentPicker(
                    repository = repository,
                    executor = executor,
                    sampleUrls = sampleContentUrls,
                    onAddSample = { url ->
                        if (url !in sampleContentUrls && sampleContentUrls.size < CreatorApplicationRepository.MAX_SAMPLE_IMAGES) {
                            sampleContentUrls = sampleContentUrls + url
                        }
                    },
                    onRemoveSample = { url -> sampleContentUrls = sampleContentUrls - url },
                    onUploadingChange = { sampleUploading = it },
                    enabled = !submitting,
                    onReauthenticate = onReauthenticate,
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Payout account (optional)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    "You can apply without a payout account. Any creator earnings stay in your Nantty balance until you add an eligible payout method.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                when {
                    payoutAccountsLoading -> Text("Loading saved payout accounts…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    payoutAccountsFailure != null -> {
                        Text(payoutAccountsFailure.orEmpty(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            TextButton(onClick = ::loadPayoutAccounts, enabled = !submitting) { Text("Retry") }
                            if (payoutAccountsRequireSignIn) TextButton(onClick = onReauthenticate, enabled = !submitting) { Text("Sign in again") }
                        }
                    }
                    payoutAccounts.isEmpty() -> Text("No saved payout accounts. You can continue without one.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    else -> payoutAccounts.forEach { account ->
                        Row(
                            Modifier.fillMaxWidth()
                                .clickable(enabled = !submitting) { selectedPayoutAccountId = account.id }
                                .padding(vertical = 4.dp)
                                .semantics { contentDescription = "${account.bankName} ${account.accountNumberMasked}, ${account.accountName}" },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = account.id == selectedPayoutAccountId,
                                onClick = { selectedPayoutAccountId = account.id },
                                enabled = !submitting,
                            )
                            Column {
                                Text("${account.bankName} ${account.accountNumberMasked}", style = MaterialTheme.typography.bodyMedium)
                                Text(account.accountName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = acceptedTerms,
                    onCheckedChange = { acceptedTerms = it },
                    enabled = !submitting,
                    modifier = Modifier.semantics { contentDescription = "I agree to the Creator Terms" },
                )
                Column {
                    Text("I agree to the Creator Terms, including honest disclosure of sponsored and affiliate content.", style = MaterialTheme.typography.bodyMedium)
                    TextButton(onClick = { termsVisible = true }, enabled = !submitting) { Text("Read Creator Terms") }
                }
            }
            if (termsVisible) {
                androidx.compose.material3.AlertDialog(
                    onDismissRequest = { termsVisible = false },
                    title = { Text("Creator Terms") },
                    text = { Text("Open the current Creator Terms on Nantty's website.") },
                    confirmButton = {
                        TextButton(onClick = {
                            termsVisible = false
                            runCatching { uriHandler.openUri(CREATOR_TERMS_URL) }
                        }) { Text("Open terms") }
                    },
                    dismissButton = { TextButton(onClick = { termsVisible = false }) { Text("Cancel") } },
                )
            }
            submitFailure?.let { failure ->
                Text(failure.message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error, modifier = Modifier.semantics { contentDescription = "Application submission error" })
                if (failure.authenticationRequired) TextButton(onClick = onReauthenticate) { Text("Sign in again") }
            }
        }

        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = {
                    if (!canSubmit) return@Button
                    submitting = true
                    submitFailure = null
                    val submission = CreatorApplicationSubmission(
                        contentCategories = selectedCategories,
                        socialLinks = creatorSocialPlatforms.mapIndexedNotNull { index, platform ->
                            socialUrls.getOrElse(index) { "" }.trim().takeIf(String::isNotEmpty)?.let { CreatorApplicationSocialLink(platform.id, it) }
                        },
                        sampleContentUrls = sampleContentUrls,
                        payoutAccountId = selectedPayoutAccountId,
                        acceptedCreatorTermsVersion = CREATOR_TERMS_VERSION,
                    )
                    executor.execute {
                        val result = repository.submitApplication(submission, idempotencyKey)
                        Snapshot.withMutableSnapshot {
                            submitting = false
                            if (result is CreatorWorkspaceResult.Failure) submitFailure = result
                        }
                        if (result is CreatorWorkspaceResult.Success) onSubmitted(result.value)
                    }
                },
                enabled = canSubmit,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (submitting) "Submitting…" else "Submit application")
            }
        }
    }
}

internal const val CREATOR_TERMS_VERSION = "2026-09"
private const val CREATOR_TERMS_URL = "https://nantty.com/creator-terms"
