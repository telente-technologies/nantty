package com.nantty.android.ui.verification

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Checkbox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.nantty.android.BuildConfig
import com.nantty.android.data.IdentityCaptureRequest
import com.nantty.android.data.IdentityDocumentTypes
import com.nantty.android.data.IdentityEligibility
import com.nantty.android.data.IdentityVerificationCase
import com.nantty.android.data.IdentityVerificationJourney
import com.nantty.android.data.IdentityVerificationRepository
import com.nantty.android.data.IdentityVerificationResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URI

/** Identity verification screen matching the RN journey; mount from the app's existing settings route. */
@Composable
fun IdentityVerificationScreen(
    repository: IdentityVerificationRepository,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
    paymentStepRequested: Boolean = false,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var journey by remember { mutableStateOf<IdentityVerificationJourney?>(null) }
    var documents by remember { mutableStateOf<IdentityDocumentTypes?>(null) }
    var loading by remember { mutableStateOf(true) }
    var documentsLoading by remember { mutableStateOf(false) }
    var busyAction by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var documentError by remember { mutableStateOf<String?>(null) }
    var selectedCountry by remember { mutableStateOf("NG") }
    var selectedDocument by remember { mutableStateOf<String?>(null) }
    var consentAccepted by remember { mutableStateOf(false) }
    BackHandler(onBack = onBack)

    fun refresh() {
        scope.launch {
            loading = true
            error = null
            val result = withContext(Dispatchers.IO) { repository.loadJourney() }
            when (result) {
                is IdentityVerificationResult.Success -> { journey = result.value; loading = false }
                is IdentityVerificationResult.Failure -> { error = result.message; loading = false; if (result.authenticationRequired) onReauthenticate() }
            }
        }
    }
    fun loadDocumentOptions(country: String) {
        scope.launch {
            documentsLoading = true
            documents = null
            selectedDocument = null
            documentError = null
            when (val result = withContext(Dispatchers.IO) { repository.loadDocumentTypes(country) }) {
                is IdentityVerificationResult.Success -> { documents = result.value; documentsLoading = false }
                is IdentityVerificationResult.Failure -> { documentError = result.message; documentsLoading = false; if (result.authenticationRequired) onReauthenticate() }
            }
        }
    }
    fun openSafeUrl(raw: String, expectedHost: String? = null): Boolean {
        val uri = runCatching { URI(raw) }.getOrNull() ?: return false
        if (uri.scheme != "https" || uri.host.isNullOrBlank() || uri.userInfo != null) return false
        if (expectedHost != null && !uri.host.equals(expectedHost, ignoreCase = true)) return false
        return runCatching {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(raw)))
            true
        }.getOrDefault(false)
    }

    LaunchedEffect(Unit) { refresh() }
    LaunchedEffect(journey?.case?.id, journey?.case?.status) {
        val currentCase = journey?.case
        val status = currentCase?.status
        if (status != null && status !in setOf("under_review", "processing", "rejected") &&
            !(status == "awaiting_capture" && currentCase.consentGiven)
        ) loadDocumentOptions(selectedCountry)
    }
    LaunchedEffect(journey?.case?.status, journey?.case?.consentGiven) {
        val currentCase = journey?.case
        if (currentCase?.status == "processing" || (currentCase?.status == "awaiting_capture" && currentCase.consentGiven)) {
            while (true) {
                delay(5_000)
                refresh()
            }
        }
    }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) refresh() }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Surface(modifier = modifier.fillMaxWidth()) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val contentWidth = maxWidth.coerceAtMost(640.dp)
            Column(
                modifier = Modifier.fillMaxWidth().widthIn(max = contentWidth).align(Alignment.TopCenter)
                    .verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                androidx.compose.material3.TextButton(onClick = onBack) { Text("Back") }
                Text("Get verified", modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                if (loading && journey == null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator()
                    Text("Checking your eligibility…", style = MaterialTheme.typography.bodyMedium)
                }
                error?.let { ErrorPanel(it, onRetry = ::refresh) }
                journey?.let { current ->
                    IdentityJourneyContent(
                        journey = current,
                        documents = documents,
                        selectedCountry = selectedCountry,
                        selectedDocument = selectedDocument,
                        documentsLoading = documentsLoading,
                        consentAccepted = consentAccepted,
                        paymentStepRequested = paymentStepRequested,
                        busy = busyAction,
                        actionError = documentError,
                        onCountrySelected = { country -> selectedCountry = country; loadDocumentOptions(country) },
                        onRetryDocuments = { loadDocumentOptions(selectedCountry) },
                        onDocumentSelected = { selectedDocument = it },
                        onConsentChanged = { consentAccepted = it },
                        onRequest = {
                            scope.launch {
                                busyAction = true
                                documentError = null
                                when (val result = withContext(Dispatchers.IO) { repository.requestEligibility() }) {
                                    is IdentityVerificationResult.Success -> { refresh(); busyAction = false }
                                    is IdentityVerificationResult.Failure -> { documentError = result.message; busyAction = false; if (result.authenticationRequired) onReauthenticate() }
                                }
                            }
                        },
                        onPay = {
                            val base = configuredWebOrigin(BuildConfig.NANTTY_WEBAPP_URL)
                            val url = base?.let { "$it/settings/verification?step=pay&return=nantty%3A%2F%2Fpayments%2Freturn" }
                            if (url == null || !openSafeUrl(url, configuredWebHost(BuildConfig.NANTTY_WEBAPP_URL))) {
                                documentError = "The secure payment page is unavailable. Please try again later."
                            }
                        },
                        onCapture = {
                            val case = current.case ?: return@IdentityJourneyContent
                            val type = selectedDocument ?: return@IdentityJourneyContent
                            scope.launch {
                                busyAction = true
                                documentError = null
                                when (val result = withContext(Dispatchers.IO) {
                                    repository.startCapture(case.id, IdentityCaptureRequest(current.consentVersion, true, "android", selectedCountry, type))
                                }) {
                                    is IdentityVerificationResult.Success -> {
                                        val session = result.value
                                        if (session.url != null && !openSafeUrl(session.url)) documentError = "The identity-check link was not opened because it was not a safe HTTPS link."
                                        else if (session.mode == "web_integration" && session.url == null) documentError = "This identity check needs the secure web verification flow, which is not available in this Android screen yet."
                                        refresh()
                                        busyAction = false
                                    }
                                    is IdentityVerificationResult.Failure -> { documentError = result.message; busyAction = false; if (result.authenticationRequired) onReauthenticate() }
                                }
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun IdentityJourneyContent(
    journey: IdentityVerificationJourney,
    documents: IdentityDocumentTypes?,
    selectedCountry: String,
    selectedDocument: String?,
    documentsLoading: Boolean,
    consentAccepted: Boolean,
    paymentStepRequested: Boolean,
    busy: Boolean,
    actionError: String?,
    onCountrySelected: (String) -> Unit,
    onRetryDocuments: () -> Unit,
    onDocumentSelected: (String) -> Unit,
    onConsentChanged: (Boolean) -> Unit,
    onRequest: () -> Unit,
    onPay: () -> Unit,
    onCapture: () -> Unit,
) {
    val gold = journey.color == "gold"
    val badgeLabel = if (gold) "Gold" else "Blue"
    if (journey.blackVetting) {
        InfoCard("Black checkmark: government", "Government bodies are verified through official vetting and two independent approvals, not this check.")
        return
    }
    if (journey.checkmark?.badgeVisible == true) {
        InfoCard("You're verified", "Your $badgeLabel checkmark is active on your profile${journey.case?.verifiedAt?.let { " since $it" }.orEmpty()}.", success = true)
        return
    }
    val identityCase = journey.case
    if (identityCase != null && identityCase.status != "rejected") {
        when {
            identityCase.status == "under_review" -> InfoCard("A person is reviewing your verification", "Some checks need a closer look. We'll notify you within 3 days. If we can't approve it, you get a full refund.", status = "Under review")
            identityCase.status == "processing" || (identityCase.status == "awaiting_capture" && identityCase.consentGiven) -> InfoCard("Checking your selfie and ID", "This usually takes a minute or two. You can leave this screen; we'll notify you.", status = "Checking")
            else -> CaptureCard(
                country = selectedCountry, documentTypes = documents?.documentTypes.orEmpty(), selectedDocument = selectedDocument,
                documentsLoading = documentsLoading, governmentLookup = documents?.governmentLookup == true, consentAccepted = consentAccepted, busy = busy,
                error = actionError, onCountrySelected = onCountrySelected, onDocumentSelected = onDocumentSelected,
                onConsentChanged = onConsentChanged, onCapture = onCapture, onRetryDocuments = onRetryDocuments,
            )
        }
        return
    }
    if (identityCase?.status == "rejected") {
        val details = listOfNotNull(identityCase.decisionReason.takeIf(String::isNotBlank), refundCopy(identityCase))
        InfoCard("We couldn't verify your account", details.joinToString(" "), status = "Not approved", error = true)
    }
    EligibilityCard(
        badgeLabel = badgeLabel,
        gold = gold,
        eligibility = journey.eligibility,
        paymentStepRequested = paymentStepRequested,
        busy = busy,
        actionError = actionError,
        onRequest = onRequest,
        onPay = onPay,
    )
}

@Composable
private fun EligibilityCard(
    badgeLabel: String,
    gold: Boolean,
    eligibility: IdentityEligibility?,
    paymentStepRequested: Boolean,
    busy: Boolean,
    actionError: String?,
    onRequest: () -> Unit,
    onPay: () -> Unit,
) {
    InfoCard(
        title = "The $badgeLabel checkmark",
        body = (if (gold) "For businesses and brands. Shows buyers you're a verified business." else "For people, including creators. Shows everyone it's really you.") + " You pay first, then confirm your identity with a selfie and a government photo ID. If we can't approve you, you get a full refund.",
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        when {
            eligibility?.canBuyNow == true -> {
                Text(if (paymentStepRequested) "You can now apply" else "You qualify", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                Button(onClick = onPay, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Buy now") }
            }
            eligibility?.state == "requested" -> InfoCard("Request received", "We'll check your account again regularly and notify you as soon as you can apply.", status = "Request received")
            eligibility?.tier == "blocked" -> InfoCard("Not available right now", "Verification isn't available for this account right now. Check your account status for details.")
            eligibility != null -> {
                Button(onClick = onRequest, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                    if (busy) CircularProgressIndicator() else Text("Request verification")
                }
            }
        }
        eligibility?.takeIf { !it.canBuyNow }?.reasons?.mapNotNull(::eligibilityReason)?.takeIf { it.isNotEmpty() }?.let { reasons ->
            InfoCard("What helps", reasons.joinToString("\n"))
        }
        actionError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun CaptureCard(
    country: String,
    documentTypes: List<String>,
    selectedDocument: String?,
    documentsLoading: Boolean,
    governmentLookup: Boolean,
    consentAccepted: Boolean,
    busy: Boolean,
    error: String?,
    onCountrySelected: (String) -> Unit,
    onDocumentSelected: (String) -> Unit,
    onConsentChanged: (Boolean) -> Unit,
    onCapture: () -> Unit,
    onRetryDocuments: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Before we check your identity", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        val consentPoints = listOf(
            "Our verification partner Smile ID will capture a short selfie video to check you're a real person, and a photo of your government ID.",
            "Smile ID compares your face with the photo on your ID and, where available, checks your ID number with the government database (for example NIN).",
            "Nantty keeps only the result, your ID type, country and the verification date. We never store your face data or keep your selfie or ID images.",
            "Biometric data is sensitive personal data under the Nigeria Data Protection Act. You can withdraw consent before the check by closing this screen.",
        )
        consentPoints.forEach { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = consentAccepted, onCheckedChange = onConsentChanged)
            Text("I agree to Smile ID processing my selfie and ID photo to verify my identity for Nantty.", style = MaterialTheme.typography.bodyMedium)
        }
        Text("Where was your ID issued?", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            IDENTITY_COUNTRIES.forEach { (code, label) -> FilterChip(selected = country == code, onClick = { onCountrySelected(code) }, label = { Text(label) }) }
        }
        Text("Which photo ID will you use?", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        when {
            documentTypes.isEmpty() && documentsLoading -> CircularProgressIndicator()
            documentTypes.isEmpty() -> {
                Text("No supported document types were returned.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = onRetryDocuments) { Text("Retry document types") }
            }
            else -> FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                documentTypes.forEach { type -> FilterChip(selected = selectedDocument == type, onClick = { onDocumentSelected(type) }, label = { Text(documentTypeLabel(type)) }) }
            }
        }
        if (governmentLookup) Text("We'll also confirm your ID number with the government database.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        Button(onClick = onCapture, enabled = consentAccepted && selectedDocument != null && !busy, modifier = Modifier.fillMaxWidth()) {
            if (busy) CircularProgressIndicator() else Text("Start selfie and ID check")
        }
    }
}

@Composable
private fun InfoCard(title: String, body: String, status: String? = null, success: Boolean = false, error: Boolean = false) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            status?.let { Text(it, color = when { error -> MaterialTheme.colorScheme.error; success -> MaterialTheme.colorScheme.primary; else -> MaterialTheme.colorScheme.onSurfaceVariant }, style = MaterialTheme.typography.labelLarge) }
            Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ErrorPanel(message: String, onRetry: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        OutlinedButton(onClick = onRetry) { Text("Try again") }
    }
}

private val IDENTITY_COUNTRIES = listOf("NG" to "Nigeria", "GH" to "Ghana", "KE" to "Kenya", "ZA" to "South Africa", "GB" to "United Kingdom", "US" to "United States")

private fun eligibilityReason(code: String): String? = when (code) {
    "account_age_below_threshold" -> "Your account needs to be a little older."
    "real_followers_below_threshold" -> "Grow your real, active followers."
    "low_recent_activity" -> "Post original content regularly."
    "recent_violation" -> "Go a while without any strikes on your account."
    "email_not_verified" -> "Verify your email address."
    "high_fraud_score" -> "Some recent activity on your account needs to settle down."
    "completed_orders_below_threshold" -> "Complete more orders in your store."
    "success_rate_below_threshold" -> "Keep your order success rate high."
    "no_active_store_or_brand_page" -> "Set up an active store or brand page."
    "borderline_content" -> "Keep your posts within our community guidelines."
    else -> null
}

private fun documentTypeLabel(code: String): String = when (code) {
    "NIN_SLIP" -> "NIN slip"
    "IDENTITY_CARD" -> "National ID card (NIN)"
    "PASSPORT" -> "International passport"
    "DRIVERS_LICENSE" -> "Driver's licence"
    "VOTER_ID" -> "Voter's card"
    "GHANA_CARD" -> "Ghana Card"
    "NATIONAL_ID" -> "National ID"
    "ALIEN_CARD" -> "Alien card"
    "GREEN_BOOK" -> "Green ID book"
    else -> code.replace('_', ' ').lowercase().replaceFirstChar { it.titlecase() }
}

private fun refundCopy(identityCase: IdentityVerificationCase): String = when {
    identityCase.refundScope == "checkmark_share" && identityCase.refundStatus == "refunded" -> "Your plan stays active. The checkmark's share has been refunded to your card."
    identityCase.refundScope == "checkmark_share" && identityCase.refundStatus == "not_charged" -> "Your plan stays active. You weren't charged for the checkmark."
    identityCase.refundMethod == "plan_continues" -> "Your plan keeps working. Only the checkmark wasn't added, so there is nothing to refund."
    identityCase.refundStatus == "refunded" -> "Your payment has been refunded in full."
    identityCase.refundMethod == "google_play" -> "Google Play is refunding your payment in full."
    identityCase.refundMethod == "apple_request" -> "Apple handles App Store refunds; request yours at reportaproblem.apple.com."
    else -> "We're refunding your payment in full."
}

private fun configuredWebOrigin(raw: String): String? = runCatching {
    val uri = URI(raw)
    require(uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null)
    "https://${uri.host}${if (uri.port > 0) ":${uri.port}" else ""}"
}.getOrNull()

private fun configuredWebHost(raw: String): String? = runCatching { URI(raw).host }.getOrNull()
