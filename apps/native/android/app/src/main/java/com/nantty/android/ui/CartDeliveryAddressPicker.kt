package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CheckoutAddress

@Composable
internal fun CartDeliveryAddressPicker(
    addresses: List<CheckoutAddress>,
    selectedAddressId: String?,
    loading: Boolean,
    enabled: Boolean,
    onSelect: (CheckoutAddress) -> Unit,
    onAddAddress: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showingPicker by remember { mutableStateOf(false) }
    val selected = addresses.firstOrNull { it.id == selectedAddressId }
    Card(
        onClick = { if (enabled && addresses.isNotEmpty()) showingPicker = true },
        enabled = enabled && addresses.isNotEmpty(),
        modifier = modifier.fillMaxWidth().semantics {
            contentDescription = selected?.let { "Delivery address, ${it.fullName}, ${it.city}" } ?: "Choose delivery address"
        },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Deliver to", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    selected?.let { "${it.fullName}, ${listOf(it.city, it.state, it.country).filter(String::isNotBlank).joinToString(", ")}" }
                        ?: if (loading) "Loading saved addresses…" else "Choose delivery address",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                )
            }
            if (selected != null) TextButton(onClick = { showingPicker = true }, enabled = enabled) { Text("Change") }
        }
    }
    if (selected == null && addresses.isEmpty() && !loading) {
        OutlinedButton(onClick = onAddAddress, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text("Add delivery address")
        }
    }
    if (showingPicker) {
        AlertDialog(
            onDismissRequest = { showingPicker = false },
            title = { Text("Delivery address") },
            text = {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(addresses, key = CheckoutAddress::id) { address ->
                        Row(
                            Modifier.fillMaxWidth().selectable(
                                selected = address.id == selectedAddressId,
                                role = Role.RadioButton,
                                onClick = {
                                    showingPicker = false
                                    onSelect(address)
                                },
                            ).semantics {
                                contentDescription = "${address.fullName}, ${address.line1}, ${address.city}, ${address.country}"
                            },
                        ) {
                            RadioButton(selected = address.id == selectedAddressId, onClick = null)
                            Column(Modifier.padding(top = 12.dp, start = 4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(address.fullName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                                Text(
                                    listOf(address.line1, address.line2, address.city, address.state, address.country)
                                        .filter(String::isNotBlank).joinToString(", "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(address.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showingPicker = false }) { Text("Done") } },
            dismissButton = { Button(onClick = { showingPicker = false; onAddAddress() }) { Text("Add new address") } },
        )
    }
}
