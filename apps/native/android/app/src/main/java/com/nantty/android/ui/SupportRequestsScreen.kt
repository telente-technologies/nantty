package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SupportTicketRepository
import com.nantty.android.data.SupportTicketResult
import com.nantty.android.data.SupportTicketSummary
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.BuyerOrdersRepository
import java.util.UUID
import java.util.concurrent.Executor

@Composable
internal fun SupportRequestsScreen(
    repository: SupportTicketRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    mediaRepository: CreatorSampleMediaRepository? = null,
    buyerOrdersRepository: BuyerOrdersRepository? = null,
    initialTicketId: String? = null,
    onInitialTicketHandled: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var selectedTicketId by remember(repository) { mutableStateOf(initialTicketId) }
    var creating by remember(repository) { mutableStateOf(false) }
    var refreshGeneration by remember(repository) { mutableIntStateOf(0) }
    var createSubmitting by remember(repository) { mutableStateOf(false) }
    var createError by remember(repository) { mutableStateOf<String?>(null) }
    var createdTicketId by remember(repository) { mutableStateOf<String?>(null) }
    var tickets by remember(repository) { mutableStateOf<List<SupportTicketSummary>?>(null) }
    var unreadCount by remember(repository) { mutableStateOf<Int?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var requestGeneration by remember(repository) { mutableIntStateOf(0) }

    LaunchedEffect(initialTicketId) {
        if (initialTicketId != null) onInitialTicketHandled()
    }

    BackHandler(enabled = selectedTicketId != null || createdTicketId != null || creating) {
        when {
            selectedTicketId != null -> selectedTicketId = null
            createdTicketId != null -> createdTicketId = null
            else -> { creating = false; createError = null }
        }
    }

    val ticketId = createdTicketId ?: selectedTicketId
    if (ticketId != null) {
        SupportTicketThreadScreen(
            ticketId = ticketId,
            repository = repository,
            executor = executor,
            onBack = {
                selectedTicketId = null
                createdTicketId = null
                refreshGeneration++
            },
            onAuthenticationRequired = onAuthenticationRequired,
            modifier = modifier,
        )
        return
    }

    if (creating) {
        SupportTicketCreationWithRecentOrders(
            mediaRepository = mediaRepository,
            executor = executor,
            buyerOrdersRepository = buyerOrdersRepository,
            onAuthenticationRequired = onAuthenticationRequired,
            isSubmitting = createSubmitting,
            submitError = createError,
            onCancel = { creating = false; createError = null },
            onCreate = { input ->
                if (!createSubmitting) {
                    createSubmitting = true
                    createError = null
                    executor.execute {
                        val result = repository.createTicket(
                            category = input.category.apiValue,
                            subject = input.subject,
                            message = input.message,
                            linkedReference = input.linkedReference?.let {
                                com.nantty.android.data.SupportLinkedReference(it.kind.apiValue, it.id, it.label)
                            },
                            attachmentUrls = input.attachmentUrls,
                            idempotencyKey = UUID.randomUUID().toString(),
                        )
                        Snapshot.withMutableSnapshot {
                            createSubmitting = false
                            when (result) {
                                is SupportTicketResult.Success -> {
                                    creating = false
                                    createdTicketId = result.value.id
                                    refreshGeneration++
                                }
                                is SupportTicketResult.Failure -> {
                                    createError = result.message
                                    if (result.authenticationRequired) onAuthenticationRequired()
                                }
                            }
                        }
                    }
                }
            },
            modifier = modifier,
        )
        return
    }

    LaunchedEffect(repository, refreshGeneration) {
        val generation = ++requestGeneration
        loading = true
        error = null
        executor.execute {
            val result = repository.listMyTickets()
            val unreadResult = repository.unreadCount()
            Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    when (result) {
                        is SupportTicketResult.Success -> tickets = result.value
                        is SupportTicketResult.Failure -> {
                            error = result.message
                            if (result.authenticationRequired) onAuthenticationRequired()
                        }
                    }
                    if (unreadResult is SupportTicketResult.Success) unreadCount = unreadResult.value
                    if (unreadResult is SupportTicketResult.Failure && unreadResult.authenticationRequired) onAuthenticationRequired()
                    loading = false
                }
            }
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text(
                unreadCount?.takeIf { it > 0 }?.let { "Support requests · $it unread" } ?: "Support requests",
                Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            IconButton(onClick = { refreshGeneration++ }, modifier = Modifier.semantics { contentDescription = "Refresh support requests" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        Button(onClick = { creating = true }, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            Text("Contact support")
        }
        when {
            loading && tickets == null -> Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) { CircularProgressIndicator(); Text("Loading support requests", Modifier.padding(top = 12.dp)) }
            error != null && tickets == null -> Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
                TextButton(onClick = { refreshGeneration++ }) { Text("Try again") }
            }
            tickets.isNullOrEmpty() -> Text(
                "No support requests yet.",
                Modifier.fillMaxWidth().padding(32.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            else -> LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(tickets.orEmpty(), key = { it.id }) { ticket ->
                    SupportTicketSummaryRow(ticket, onClick = { selectedTicketId = ticket.id })
                }
            }
        }
    }
}

@Composable
private fun SupportTicketSummaryRow(ticket: SupportTicketSummary, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).semantics {
            contentDescription = "${ticket.subject}, ${supportTicketStatusLabel(ticket.status)}${if (ticket.unreadCount > 0) ", ${ticket.unreadCount} unread replies" else ""}"
        },
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surfaceContainer,
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(ticket.subject, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall, fontWeight = if (ticket.unreadCount > 0) FontWeight.SemiBold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (ticket.unreadCount > 0) Text("${ticket.unreadCount}", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelMedium)
                Text(supportTicketStatusLabel(ticket.status), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
            }
            Text(ticket.lastMessagePreview, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            ticket.linkedReference?.let { Text(it.label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Text(
                listOfNotNull(ticket.reference, ticket.updatedAt.takeIf(String::isNotBlank)?.let { "Updated $it" }).joinToString(" · "),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
