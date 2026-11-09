package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ProductOptionGroup

/** Android-native option controls that retain the independent choices shown in React Native. */
@Composable
internal fun ProductOptionGroupSelector(
    group: ProductOptionGroup,
    selectedValue: String?,
    onSelect: (String) -> Unit,
    isAvailable: (String) -> Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(group.label, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        LazyRow(
            modifier = Modifier.fillMaxWidth().semantics {
                contentDescription = "Choose ${group.label.lowercase()}"
            },
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(group.choices, key = { it.value }) { choice ->
                val available = isAvailable(choice.value)
                FilterChip(
                    selected = selectedValue == choice.value,
                    onClick = { onSelect(choice.value) },
                    enabled = available || selectedValue == choice.value,
                    label = { Text(choice.label) },
                )
            }
        }
    }
}
