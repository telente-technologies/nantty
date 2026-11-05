package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ConnectionFilter
import com.nantty.android.data.ConnectionListPreference
import com.nantty.android.data.ConnectionSort

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ConnectionSortFilterSheet(
    visible: Boolean,
    value: ConnectionListPreference,
    showRelationshipFilter: Boolean,
    onChange: (ConnectionListPreference) -> Unit,
    onClose: () -> Unit,
) {
    if (!visible) return
    ModalBottomSheet(onDismissRequest = onClose) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text("Sort and filter", style = MaterialTheme.typography.titleLarge)
            Text("Sort by", Modifier.padding(top = 16.dp), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            ConnectionSort.entries.forEach { option ->
                PreferenceOptionRow(
                    label = option.label,
                    selected = value.sort == option,
                    onClick = { onChange(value.copy(sort = option)) },
                )
            }
            if (showRelationshipFilter) {
                Text("Show", Modifier.padding(top = 16.dp), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                ConnectionFilter.entries.forEach { option ->
                    PreferenceOptionRow(
                        label = option.label,
                        selected = value.filter == option,
                        onClick = { onChange(value.copy(filter = option)) },
                    )
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { onChange(ConnectionListPreference()) },
                    enabled = value != ConnectionListPreference(),
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                ) { Text("Reset") }
                Button(onClick = onClose, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Done") }
            }
        }
    }
}

@Composable
private fun PreferenceOptionRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
        RadioButton(selected = selected, onClick = null)
    }
}
