package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SellerReturnLocation
import com.nantty.android.data.SellerReturnReceiptInput
import com.nantty.android.data.SellerReturnRequest
import com.nantty.android.data.SellerReturnStatus
import com.nantty.android.data.SellerReturnsPage
import com.nantty.android.data.SellerReturnsRepository
import com.nantty.android.data.SellerReturnsResult
import com.nantty.android.data.SellerReturnsResult.Failure
import com.nantty.android.data.SellerReturnsResult.Success
import com.nantty.android.data.isValidSellerReturnDeclineNote
import com.nantty.android.data.sellerReturnUtf8Length
import com.nantty.android.data.sellerReturnActions
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private enum class SellerReturnAction { APPROVE, DECLINE, RECEIVE }

/** Return-request management is entered from Seller Orders and keeps server status authoritative. */
@Composable
internal fun SellerReturnsScreen(
    repository: SellerReturnsRepository,
    storeId: String,
    canManage: Boolean,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var filterName by rememberSaveable(storeId) { mutableStateOf(SellerReturnStatus.ALL.name) }
    val filter = SellerReturnStatus.entries.firstOrNull { it.name == filterName } ?: SellerReturnStatus.ALL
    var refreshKey by rememberSaveable(storeId) { mutableIntStateOf(0) }
    var page by remember(storeId, filter, refreshKey) { mutableStateOf<SellerReturnsPage?>(null) }
    var returns by remember(storeId, filter, refreshKey) { mutableStateOf<List<SellerReturnRequest>>(emptyList()) }
    var loading by remember(storeId, filter, refreshKey) { mutableStateOf(true) }
    var loadingMore by remember(storeId, filter, refreshKey) { mutableStateOf(false) }
    var pageError by remember(storeId, filter, refreshKey) { mutableStateOf<Failure?>(null) }
    var actionError by remember(storeId, filter) { mutableStateOf<String?>(null) }
    var selectedAction by remember { mutableStateOf<Pair<SellerReturnRequest, SellerReturnAction>?>(null) }
    var declineNote by remember { mutableStateOf("") }
    var restock by remember { mutableStateOf(false) }
    var selectedLocationId by remember { mutableStateOf<String?>(null) }
    var locations by remember(storeId) { mutableStateOf<List<SellerReturnLocation>?>(null) }
    var locationsError by remember(storeId) { mutableStateOf<String?>(null) }
    var locationsLoading by remember(storeId) { mutableStateOf(false) }
    var locationMenuExpanded by remember { mutableStateOf(false) }
    var actionInProgress by remember { mutableStateOf(false) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    LaunchedEffect(repository, storeId, filter, refreshKey) {
        loading = true
        pageError = null
        val result = withContext(Dispatchers.IO) { repository.load(storeId, filter) }
        when (result) {
            is Success -> {
                page = result.value
                returns = result.value.returns
            }
            is Failure -> {
                pageError = result
                if (result.authenticationRequired) onAuthenticationRequired()
            }
        }
        loading = false
    }

    LaunchedEffect(repository, storeId, restock) {
        if (restock && locations == null && !locationsLoading) {
            locationsLoading = true
            locationsError = null
            when (val result = withContext(Dispatchers.IO) { repository.loadLocations(storeId) }) {
                is Success -> {
                    locations = result.value
                    selectedLocationId = result.value.firstOrNull(SellerReturnLocation::isDefault)?.id
                        ?: result.value.firstOrNull()?.id
                }
                is Failure -> {
                    locationsError = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
            locationsLoading = false
        }
    }

    fun refresh() { refreshKey++ }

    fun requestMore() {
        val cursor = page?.nextCursor ?: return
        if (loadingMore) return
        scope.launch {
            loadingMore = true
            when (val result = withContext(Dispatchers.IO) { repository.load(storeId, filter, cursor) }) {
                is Success -> {
                    page = result.value
                    returns = (returns + result.value.returns).distinctBy(SellerReturnRequest::id)
                    pageError = null
                }
                is Failure -> {
                    pageError = result
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
            loadingMore = false
        }
    }

    fun submitAction(returnRequest: SellerReturnRequest, action: SellerReturnAction) {
        scope.launch {
            actionInProgress = true
            actionError = null
            val result = withContext(Dispatchers.IO) {
                when (action) {
                    SellerReturnAction.APPROVE -> repository.approve(storeId, returnRequest.id)
                    SellerReturnAction.DECLINE -> repository.decline(storeId, returnRequest.id, declineNote)
                    SellerReturnAction.RECEIVE -> repository.receive(
                        storeId,
                        returnRequest.id,
                        SellerReturnReceiptInput(restock, if (restock) selectedLocationId else null),
                    )
                }
            }
            when (result) {
                is Success -> {
                    selectedAction = null
                    declineNote = ""
                    restock = false
                    refresh()
                }
                is Failure -> {
                    actionError = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
            actionInProgress = false
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().widthIn(max = 960.dp).align(Alignment.CenterHorizontally).padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to seller orders" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text("Return requests", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = ::refresh, modifier = Modifier.semantics { contentDescription = "Refresh seller return requests" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        androidx.compose.foundation.lazy.LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().widthIn(max = 960.dp).align(Alignment.CenterHorizontally).padding(horizontal = 16.dp),
        ) {
            items(SellerReturnStatus.entries, key = SellerReturnStatus::name) { status ->
                FilterChip(
                    selected = status == filter,
                    onClick = { filterName = status.name },
                    label = { Text(status.label) },
                )
            }
        }
        if (loading && returns.isNotEmpty()) {
            LinearProgressIndicator(Modifier.fillMaxWidth())
        }
        when {
            loading && returns.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator()
                    Text("Loading return requests", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            pageError != null && returns.isEmpty() -> SellerOrdersMessage(
                title = when {
                    pageError?.authenticationRequired == true -> "Sign in to continue"
                    pageError?.permissionDenied == true -> "Store access required"
                    else -> "Return requests are unavailable"
                },
                message = pageError?.message.orEmpty(),
                actionLabel = if (pageError?.authenticationRequired == true) "Sign in again" else "Retry",
                onAction = if (pageError?.authenticationRequired == true) onAuthenticationRequired else ::refresh,
            )
            returns.isEmpty() -> SellerOrdersMessage(
                title = if (filter == SellerReturnStatus.ALL) "No return requests" else "No ${filter.label.lowercase()} requests",
                message = if (filter == SellerReturnStatus.ALL) "Buyer return requests will appear here." else "Try another return status filter.",
                actionLabel = if (filter == SellerReturnStatus.ALL) null else "Show all requests",
                onAction = if (filter == SellerReturnStatus.ALL) null else ({ filterName = SellerReturnStatus.ALL.name }),
            )
            else -> LazyColumn(Modifier.fillMaxSize().widthIn(max = 960.dp).align(Alignment.CenterHorizontally)) {
                items(returns, key = SellerReturnRequest::id) { row ->
                    SellerReturnCard(
                        request = row,
                        canManage = canManage,
                        onAction = { action ->
                            selectedAction = row to action
                            actionError = null
                            if (action == SellerReturnAction.RECEIVE) restock = false
                            if (action == SellerReturnAction.DECLINE) declineNote = ""
                        },
                    )
                }
                item {
                    when {
                        loadingMore -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                        page?.nextCursor != null -> TextButton(onClick = ::requestMore, modifier = Modifier.fillMaxWidth().padding(12.dp)) { Text("Load more") }
                        else -> Text("You’re all caught up", Modifier.fillMaxWidth().padding(20.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    pageError?.let { failure ->
                        Text(failure.message, Modifier.fillMaxWidth().padding(horizontal = 20.dp), color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = ::requestMore, modifier = Modifier.fillMaxWidth()) { Text("Retry loading more") }
                    }
                }
            }
        }
    }

    selectedAction?.let { (request, action) ->
        when (action) {
            SellerReturnAction.APPROVE -> AlertDialog(
                onDismissRequest = { if (!actionInProgress) selectedAction = null },
                title = { Text("Approve return?") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Approve the return request for order ${request.orderNumber}?")
                        actionError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    }
                },
                confirmButton = {
                    TextButton(enabled = !actionInProgress, onClick = { submitAction(request, action) }) {
                        Text(if (actionInProgress) "Approving…" else "Approve return")
                    }
                },
                dismissButton = { TextButton(enabled = !actionInProgress, onClick = { selectedAction = null }) { Text("Cancel") } },
            )
            SellerReturnAction.DECLINE -> AlertDialog(
                onDismissRequest = { if (!actionInProgress) selectedAction = null },
                title = { Text("Decline return") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Add a note for the buyer (5–500 characters).")
                        OutlinedTextField(
                            value = declineNote,
                            onValueChange = { if (sellerReturnUtf8Length(it) <= SellerReturnsRepository.MAX_NOTE_LENGTH) declineNote = it },
                            label = { Text("Reason") },
                            supportingText = { Text("${sellerReturnUtf8Length(declineNote.trim())}/${SellerReturnsRepository.MAX_NOTE_LENGTH}") },
                            isError = declineNote.isNotEmpty() && !isValidSellerReturnDeclineNote(declineNote),
                            minLines = 3,
                        )
                        actionError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    }
                },
                confirmButton = {
                    TextButton(
                        enabled = !actionInProgress && isValidSellerReturnDeclineNote(declineNote),
                        onClick = { submitAction(request, action) },
                    ) { Text(if (actionInProgress) "Declining…" else "Decline return") }
                },
                dismissButton = { TextButton(enabled = !actionInProgress, onClick = { selectedAction = null }) { Text("Cancel") } },
            )
            SellerReturnAction.RECEIVE -> AlertDialog(
                onDismissRequest = { if (!actionInProgress) selectedAction = null },
                title = { Text("Receive returned items") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Confirm that the items for order ${request.orderNumber} have arrived.")
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = restock, onCheckedChange = { restock = it }, enabled = !actionInProgress)
                            Text("Restock returned items")
                        }
                        if (restock) SellerReturnLocationPicker(
                            locations = locations.orEmpty(),
                            loading = locationsLoading,
                            error = locationsError,
                            selectedLocationId = selectedLocationId,
                            expanded = locationMenuExpanded,
                            onExpandedChange = { locationMenuExpanded = it },
                            onSelected = { selectedLocationId = it; locationMenuExpanded = false },
                        )
                        actionError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    }
                },
                confirmButton = {
                    TextButton(
                        enabled = !actionInProgress && (!restock || selectedLocationId != null),
                        onClick = { submitAction(request, action) },
                    ) { Text(if (actionInProgress) "Saving…" else "Confirm received") }
                },
                dismissButton = { TextButton(enabled = !actionInProgress, onClick = { selectedAction = null }) { Text("Cancel") } },
            )
        }
    }
}

@Composable
private fun SellerReturnCard(
    request: SellerReturnRequest,
    canManage: Boolean,
    onAction: (SellerReturnAction) -> Unit,
) {
    Surface(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Order ${request.orderNumber}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("Buyer: ${request.buyerName}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                SellerReturnStatusBadge(request.status)
            }
            request.lines.forEach { line ->
                Text("${line.name} · Qty ${line.quantity}", style = MaterialTheme.typography.bodyMedium)
            }
            Text("Reason: ${request.reason}", style = MaterialTheme.typography.bodyMedium)
            if (request.declineNote != null) Text("Seller note: ${request.declineNote}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                "Refund amount: ${formatWalletAmount(WalletMoney(request.refundAmount.amountMinor, request.refundAmount.currency))}",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            if (canManage) {
                val availableActions = sellerReturnActions(request.status)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if ("approve" in availableActions) {
                        Button(onClick = { onAction(SellerReturnAction.APPROVE) }) { Text("Approve") }
                    }
                    if ("decline" in availableActions) {
                        OutlinedButton(onClick = { onAction(SellerReturnAction.DECLINE) }) { Text("Decline") }
                    }
                    if ("receive" in availableActions) Button(onClick = { onAction(SellerReturnAction.RECEIVE) }) { Text("Receive return") }
                }
            } else if (request.status in setOf("requested", "approved")) {
                Text("You can view requests but do not have permission to process them.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun SellerReturnStatusBadge(status: String) {
    val (label, color) = when (status) {
        "requested" -> "Requested" to MaterialTheme.colorScheme.primaryContainer
        "approved" -> "Approved" to MaterialTheme.colorScheme.tertiaryContainer
        "declined" -> "Declined" to MaterialTheme.colorScheme.errorContainer
        "refunded" -> "Refunded" to MaterialTheme.colorScheme.secondaryContainer
        else -> status.replaceFirstChar(Char::uppercase) to MaterialTheme.colorScheme.surfaceVariant
    }
    Surface(color = color, shape = MaterialTheme.shapes.small) {
        Text(label, Modifier.padding(horizontal = 9.dp, vertical = 5.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
private fun SellerReturnLocationPicker(
    locations: List<SellerReturnLocation>,
    loading: Boolean,
    error: String?,
    selectedLocationId: String?,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelected: (String) -> Unit,
) {
    val selected = locations.firstOrNull { it.id == selectedLocationId }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        when {
            loading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CircularProgressIndicator()
                Text("Loading store locations")
            }
            error != null -> Text("$error You can still receive without restocking.", color = MaterialTheme.colorScheme.error)
            locations.isEmpty() -> Text("No active store locations are available. You can receive without restocking.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            else -> Box {
                OutlinedButton(onClick = { onExpandedChange(true) }, modifier = Modifier.fillMaxWidth()) {
                    Text(selected?.let(::sellerReturnLocationLabel) ?: "Choose restock location")
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
                    locations.forEach { location ->
                        DropdownMenuItem(text = { Text(sellerReturnLocationLabel(location)) }, onClick = { onSelected(location.id) })
                    }
                }
            }
        }
    }
}

private fun sellerReturnLocationLabel(location: SellerReturnLocation): String = buildList {
    add(location.name)
    listOf(location.city, location.state).filter(String::isNotBlank).distinct().forEach(::add)
    if (location.isDefault) add("Default")
}.joinToString(" · ")
