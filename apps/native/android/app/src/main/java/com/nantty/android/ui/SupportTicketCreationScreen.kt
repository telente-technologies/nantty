package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerOrdersResult
import com.nantty.android.data.CreatorSampleMediaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.Executor

/** Backend-compatible category values and labels used by the React Native support form. */
enum class SupportTicketCategory(val apiValue: String, val label: String) {
    ORDER("order", "An order"),
    PAYMENT("payment", "Payments & wallet"),
    ACCOUNT("account", "My account"),
    SELLER("seller", "Selling"),
    VERIFICATION("verification", "Checkmarks"),
    CREATOR("creator", "Creator and earnings"),
    LIVE("live", "Live"),
    ADS("ads", "Ads and boosts"),
    SAFETY("safety", "Safety"),
    OTHER("other", "Something else"),
}

enum class SupportLinkedReferenceKind(val apiValue: String, val label: String) {
    ORDER("order", "Order"),
    PAYMENT("payment", "Payment"),
    LIVE("live", "Live"),
    REPORT("report", "Report"),
    DISPUTE("dispute", "Dispute"),
}

data class SupportLinkedReferenceInput(val kind: SupportLinkedReferenceKind, val id: String, val label: String)
data class SupportOrderOption(val id: String, val reference: String)

/** Payload mirrors createTicketBodySchema. Uploads are intentionally not simulated. */
data class SupportTicketCreateInput(
    val category: SupportTicketCategory,
    val subject: String,
    val message: String,
    val attachmentUrls: List<String> = emptyList(),
    val linkedReference: SupportLinkedReferenceInput? = null,
)

internal data class SupportTicketFormValues(
    val subject: String,
    val message: String,
    val linkedReference: SupportLinkedReferenceInput? = null,
)

internal fun validateSupportTicketForm(values: SupportTicketFormValues): String? {
    val subject = values.subject.trim()
    val message = values.message.trim()
    if (subject.length !in 4..80) return "Subject must be 4–80 characters."
    if (message.length !in 10..1_500) return "Message must be 10–1,500 characters."
    values.linkedReference?.let { reference ->
        if (reference.id.trim().length !in 1..80) return "Reference ID must be 1–80 characters."
        if (reference.label.trim().length !in 1..120) return "Reference label must be 1–120 characters."
    }
    return null
}

@Composable
internal fun SupportTicketCreationWithRecentOrders(
    onCreate: (SupportTicketCreateInput) -> Unit,
    onCancel: () -> Unit,
    buyerOrdersRepository: BuyerOrdersRepository?,
    modifier: Modifier = Modifier,
    initialCategory: SupportTicketCategory = SupportTicketCategory.ORDER,
    initialLinkedReference: SupportLinkedReferenceInput? = null,
    mediaRepository: CreatorSampleMediaRepository? = null,
    executor: Executor? = null,
    onAuthenticationRequired: () -> Unit = {},
    isSubmitting: Boolean = false,
    submitError: String? = null,
) {
    var category by remember(initialCategory) { mutableStateOf(initialCategory) }
    var options by remember(buyerOrdersRepository) { mutableStateOf<List<SupportOrderOption>?>(null) }
    var loading by remember(buyerOrdersRepository) { mutableStateOf(false) }
    var loadError by remember(buyerOrdersRepository) { mutableStateOf<String?>(null) }
    var reload by remember(buyerOrdersRepository) { mutableIntStateOf(0) }
    var referenceRemoved by remember(initialLinkedReference) { mutableStateOf(false) }

    LaunchedEffect(buyerOrdersRepository, category, initialLinkedReference?.id, referenceRemoved, reload) {
        if ((initialLinkedReference != null && !referenceRemoved) || category !in setOf(SupportTicketCategory.ORDER, SupportTicketCategory.PAYMENT)) {
            options = null
            loadError = null
            loading = false
            return@LaunchedEffect
        }
        val ordersRepository = buyerOrdersRepository
        if (ordersRepository == null) {
            options = emptyList()
            loadError = "Recent orders are unavailable right now."
            return@LaunchedEffect
        }
        loading = true
        loadError = null
        when (val result = withContext(Dispatchers.IO) { ordersRepository.load() }) {
            is BuyerOrdersResult.Success -> options = result.page.orders.map { SupportOrderOption(it.id, it.reference) }
            is BuyerOrdersResult.Failure -> {
                loadError = result.message
                if (result.authenticationRequired) onAuthenticationRequired()
            }
        }
        loading = false
    }

    SupportTicketCreationScreen(
        onCreate = onCreate,
        onCancel = onCancel,
        modifier = modifier,
        initialCategory = initialCategory,
        initialLinkedReference = initialLinkedReference,
        recentOrderOptions = options.orEmpty(),
        recentOrdersLoading = loading,
        recentOrdersError = loadError,
        onRetryRecentOrders = { reload++ },
        onCategorySelected = { category = it },
        onLinkedReferenceRemoved = { referenceRemoved = true },
        mediaRepository = mediaRepository,
        executor = executor,
        onAuthenticationRequired = onAuthenticationRequired,
        isSubmitting = isSubmitting,
        submitError = submitError,
    )
}

/**
 * Self-contained support-ticket form. The caller owns persistence, authentication,
 * navigation, and error presentation after [onCreate] is invoked.
 */
@Composable
fun SupportTicketCreationScreen(
    onCreate: (SupportTicketCreateInput) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
    initialCategory: SupportTicketCategory = SupportTicketCategory.ORDER,
    initialLinkedReference: SupportLinkedReferenceInput? = null,
    recentOrderOptions: List<SupportOrderOption> = emptyList(),
    recentOrdersLoading: Boolean = false,
    recentOrdersError: String? = null,
    onRetryRecentOrders: () -> Unit = {},
    onCategorySelected: (SupportTicketCategory) -> Unit = {},
    onLinkedReferenceRemoved: () -> Unit = {},
    mediaRepository: CreatorSampleMediaRepository? = null,
    executor: Executor? = null,
    onAuthenticationRequired: () -> Unit = {},
    isSubmitting: Boolean = false,
    submitError: String? = null,
) {
    var category by rememberSaveable { mutableStateOf(initialCategory) }
    var subject by rememberSaveable { mutableStateOf("") }
    var message by rememberSaveable { mutableStateOf("") }
    var attachmentUrls by remember { mutableStateOf(emptyList<String>()) }
    var uploadingAttachments by remember { mutableStateOf(false) }
    var linkKind by rememberSaveable { mutableStateOf(initialLinkedReference?.kind?.apiValue.orEmpty()) }
    var linkId by rememberSaveable { mutableStateOf(initialLinkedReference?.id.orEmpty()) }
    var linkLabel by rememberSaveable { mutableStateOf(initialLinkedReference?.label.orEmpty()) }
    var validationError by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("Contact support", style = MaterialTheme.typography.headlineSmall)
        Text("What do you need help with?", style = MaterialTheme.typography.titleSmall)
        SupportTicketCategory.entries.forEach { option ->
            if (option == category) {
                OutlinedButton(
                    onClick = { },
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Selected category: ${option.label}" },
                ) { Text(option.label) }
            } else {
                TextButton(
                    onClick = { category = option; onCategorySelected(option) },
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Choose ${option.label} category" },
                ) { Text(option.label) }
            }
        }

        val selectedReference = if (linkId.isNotBlank()) {
            val kind = SupportLinkedReferenceKind.entries.firstOrNull { it.apiValue == linkKind }
                ?: SupportLinkedReferenceKind.ORDER
            SupportLinkedReferenceInput(kind, linkId, linkLabel)
        } else null
        if (selectedReference != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Linked to ${selectedReference.label}", style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = { linkKind = ""; linkId = ""; linkLabel = ""; onLinkedReferenceRemoved() }) { Text("Remove") }
            }
        } else if (category == SupportTicketCategory.ORDER || category == SupportTicketCategory.PAYMENT) {
            Text("Link an order or payment (optional)", style = MaterialTheme.typography.titleSmall)
            when {
                recentOrdersLoading -> Text("Loading recent orders…", style = MaterialTheme.typography.bodySmall)
                recentOrdersError != null -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(recentOrdersError.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = onRetryRecentOrders) { Text("Retry") }
                }
                recentOrderOptions.isEmpty() -> Text(
                    "No recent orders to link.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> recentOrderOptions.take(4).forEach { order ->
                    val prefix = if (category == SupportTicketCategory.PAYMENT) "Payment for order" else "Order"
                    OutlinedButton(
                        onClick = {
                            linkKind = if (category == SupportTicketCategory.PAYMENT) {
                                SupportLinkedReferenceKind.PAYMENT.apiValue
                            } else SupportLinkedReferenceKind.ORDER.apiValue
                            linkId = order.id
                            linkLabel = "$prefix ${order.reference}"
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("$prefix ${order.reference}") }
                }
            }
        }

        OutlinedTextField(
            value = subject,
            onValueChange = { subject = it.take(80); validationError = null },
            label = { Text("Subject") },
            placeholder = { Text("e.g. My order hasn't arrived") },
            supportingText = { Text("${subject.length}/80 (minimum 4)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = message,
            onValueChange = { message = it.take(1_500); validationError = null },
            label = { Text("Tell us more") },
            placeholder = { Text("Include relevant details and what you've tried") },
            supportingText = { Text("${message.length}/1,500 (minimum 10)") },
            minLines = 5,
            modifier = Modifier.fillMaxWidth(),
        )

        Text(
            "Never share your password, card PIN, or OTP. Nantty will never ask for them.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text("Screenshots (optional)", style = MaterialTheme.typography.bodySmall)
        if (mediaRepository != null && executor != null) {
            SupportTicketAttachments(
                repository = mediaRepository,
                executor = executor,
                urls = attachmentUrls,
                onUrlsChange = { attachmentUrls = it },
                enabled = !isSubmitting,
                onUploadingChange = { uploadingAttachments = it },
                onAuthenticationRequired = onAuthenticationRequired,
            )
        } else {
            Text("Screenshot upload is unavailable right now.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        submitError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        validationError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = onCancel, enabled = !isSubmitting && !uploadingAttachments, modifier = Modifier.weight(1f)) { Text("Cancel") }
            Button(
                enabled = !isSubmitting && !uploadingAttachments,
                onClick = {
                    val values = SupportTicketFormValues(subject, message, selectedReference)
                    validationError = validateSupportTicketForm(values)
                    if (validationError == null) {
                        onCreate(
                            SupportTicketCreateInput(
                                category = category,
                                subject = subject.trim(),
                                message = message.trim(),
                                attachmentUrls = attachmentUrls,
                                linkedReference = selectedReference,
                            ),
                        )
                    }
                },
                modifier = Modifier.weight(1f),
            ) { Text(if (isSubmitting) "Sending…" else "Send") }
        }
    }
}

