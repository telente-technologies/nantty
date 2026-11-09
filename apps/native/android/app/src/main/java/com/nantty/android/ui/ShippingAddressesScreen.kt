package com.nantty.android.ui

import androidx.activity.compose.BackHandler
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
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.testTag
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.SavedShippingAddress
import com.nantty.android.data.ShippingAddressDeleteResult
import com.nantty.android.data.ShippingAddressResult
import com.nantty.android.data.ShippingAddressesRepository
import com.nantty.android.data.ShippingAddressesResult
import java.util.concurrent.Executor

@Composable
internal fun ShippingAddressesScreen(
    repository: ShippingAddressesRepository,
    geoCatalogue: CheckoutRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var addresses by remember(repository) { mutableStateOf<List<SavedShippingAddress>?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var busy by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var editing by remember(repository) { mutableStateOf<SavedShippingAddress?>(null) }
    var creating by remember(repository) { mutableStateOf(false) }
    var deleteCandidate by remember(repository) { mutableStateOf<SavedShippingAddress?>(null) }
    var reload by remember(repository) { mutableIntStateOf(0) }
    BackHandler(onBack = if (creating || editing != null) ({ creating = false; editing = null }) else onBack)

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                loading = false
                when (result) {
                    is ShippingAddressesResult.Success -> addresses = result.addresses
                    is ShippingAddressesResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    val currentEdit = editing
    if (creating || currentEdit != null) {
        ShippingAddressFormScreen(
            repository = repository,
            geoCatalogue = geoCatalogue,
            executor = executor,
            initialAddress = currentEdit,
            onBack = { creating = false; editing = null },
            onReauthenticate = onReauthenticate,
            onSaved = {
                creating = false
                editing = null
                reload++
            },
            modifier = modifier,
        )
        return
    }

    Column(modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp)) {
        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().align(Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            OutlinedButton(onClick = onBack) { Text("Back") }
            Text(
                "Shipping addresses",
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            error?.let { message ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(onClick = { reload++ }) { Text("Try again") }
                }
            }
            if (loading && addresses == null) {
                Box(Modifier.fillMaxWidth().padding(28.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (addresses.isNullOrEmpty() && error == null) {
                Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("No saved addresses", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("Add where you'd like your orders delivered.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f, fill = false).fillMaxWidth().testTag("shippingAddressList"),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(addresses.orEmpty(), key = SavedShippingAddress::id) { address ->
                        ShippingAddressCard(
                            address = address,
                            enabled = !busy,
                            onEdit = { editing = address },
                            onSetDefault = { mutateAddress(address.id, repository, executor) { result ->
                                busy = false
                                when (result) {
                                    is ShippingAddressResult.Success -> { error = null; reload++ }
                                    is ShippingAddressResult.Failure -> {
                                        error = result.message
                                        if (result.authenticationRequired) onReauthenticate()
                                    }
                                }
                            }.also { busy = true } },
                            onDelete = { deleteCandidate = address },
                        )
                    }
                }
            }
            Button(
                onClick = { creating = true },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().testTag("addShippingAddress"),
            ) { Text("Add new address") }
        }
    }

    deleteCandidate?.let { address ->
        AlertDialog(
            onDismissRequest = { if (!busy) deleteCandidate = null },
            title = { Text("Delete address?") },
            text = { Text("Remove ${address.fullName}'s saved delivery address? This cannot be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        busy = true
                        executor.execute {
                            val result = repository.delete(address.id)
                            Snapshot.withMutableSnapshot {
                                busy = false
                                when (result) {
                                    ShippingAddressDeleteResult.Success -> {
                                        deleteCandidate = null
                                        error = null
                                        reload++
                                    }
                                    is ShippingAddressDeleteResult.Failure -> {
                                        error = result.message
                                        if (result.authenticationRequired) onReauthenticate()
                                    }
                                }
                            }
                        }
                    },
                    enabled = !busy,
                    modifier = Modifier.testTag("confirmDeleteShippingAddress"),
                ) {
                    if (busy) CircularProgressIndicator() else Text("Delete")
                }
            },
            dismissButton = { TextButton(onClick = { deleteCandidate = null }, enabled = !busy) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ShippingAddressCard(
    address: SavedShippingAddress,
    enabled: Boolean,
    onEdit: () -> Unit,
    onSetDefault: () -> Unit,
    onDelete: () -> Unit,
) {
    val location = listOf(address.line1, address.city, address.lga, address.state, address.country)
        .filterNotNull().filter(String::isNotBlank).distinct().joinToString(", ")
    Surface(
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        modifier = Modifier.fillMaxWidth().testTag("shippingAddress-${address.id}"),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(address.fullName, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (address.isDefault) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.PushPin, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text("Default", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
            Text(location, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(address.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onEdit, enabled = enabled, modifier = Modifier.weight(1f).semantics { contentDescription = "Edit ${address.fullName}'s address" }) {
                    Icon(Icons.Default.Edit, contentDescription = null)
                    Text("Edit", Modifier.padding(start = 6.dp))
                }
                if (!address.isDefault) OutlinedButton(onClick = onSetDefault, enabled = enabled, modifier = Modifier.weight(1.25f)) {
                    Icon(Icons.Default.PushPin, contentDescription = null)
                    Text("Set default", Modifier.padding(start = 6.dp))
                }
                OutlinedButton(onClick = onDelete, enabled = enabled, modifier = Modifier.semantics { contentDescription = "Delete ${address.fullName}'s address" }) {
                    Icon(Icons.Default.DeleteOutline, contentDescription = null)
                }
            }
        }
    }
}

private fun mutateAddress(
    addressId: String,
    repository: ShippingAddressesRepository,
    executor: Executor,
    onResult: (ShippingAddressResult) -> Unit,
) {
    executor.execute {
        val result = repository.setDefault(addressId)
        Snapshot.withMutableSnapshot {
            onResult(result)
        }
    }
}
