package com.nantty.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CheckoutGeoArea

@Composable
internal fun ShippingAddressGeoPicker(
    label: String,
    selectedId: String,
    options: List<Pair<String, String>>,
    enabled: Boolean = true,
    onSelect: (String) -> Unit,
) {
    var expanded by rememberSaveable(label) { mutableStateOf(false) }
    var search by rememberSaveable(label) { mutableStateOf("") }
    val selectedName = options.firstOrNull { it.first == selectedId }?.second ?: "Choose $label"
    val visibleOptions = remember(options, search) {
        if (search.isBlank()) options else options.filter { it.second.contains(search.trim(), ignoreCase = true) }
    }
    androidx.compose.foundation.layout.Box {
        OutlinedButton(
            onClick = { expanded = true },
            enabled = enabled,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) { Text("$label: $selectedName", modifier = Modifier.fillMaxWidth()) }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false; search = "" },
            modifier = Modifier.heightIn(max = 360.dp),
        ) {
            Column(Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it.take(80) },
                    label = { Text("Search $label") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                LazyColumn(Modifier.heightIn(max = 300.dp)) {
                    items(visibleOptions, key = { it.first }) { (id, name) ->
                        DropdownMenuItem(
                            text = { Text(name) },
                            onClick = { expanded = false; search = ""; onSelect(id) },
                        )
                    }
                    if (visibleOptions.isEmpty()) item { Text("No matching options", Modifier.padding(16.dp)) }
                }
            }
        }
    }
}

internal fun List<CheckoutGeoArea>.asAddressOptions(): List<Pair<String, String>> = map { it.id to it.name }
