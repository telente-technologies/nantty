package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.MartCategory

@Composable
internal fun MartCategoryChips(
    categories: List<MartCategory>,
    selectedCategoryId: String?,
    onSelectCategory: (String?) -> Unit,
) {
    LazyRow(
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            FilterChip(selectedCategoryId == null, onClick = { onSelectCategory(null) }, label = { Text("All") })
        }
        items(categories, key = MartCategory::id) { category ->
            FilterChip(
                selected = selectedCategoryId == category.id,
                onClick = { onSelectCategory(category.id) },
                label = { Text(category.name, maxLines = 1) },
            )
        }
    }
}

@Composable
internal fun MartCategoryPane(
    categories: List<MartCategory>,
    selectedCategoryId: String?,
    onSelectCategory: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(modifier = modifier.padding(start = 12.dp, end = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            FilterChip(
                selected = selectedCategoryId == null,
                onClick = { onSelectCategory(null) },
                label = { Text("All", maxLines = 1) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        items(categories, key = MartCategory::id) { category ->
            FilterChip(
                selected = selectedCategoryId == category.id,
                onClick = { onSelectCategory(category.id) },
                label = { Text(category.name, maxLines = 2, overflow = TextOverflow.Ellipsis) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
