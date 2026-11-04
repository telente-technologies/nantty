package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private enum class BusinessWorkspaceTab(val label: String) {
    Seller("Seller"), Creator("Creator"), Brands("Brands"), Ads("Ads"),
}

/** A native, role-oriented shell; feature content is supplied by its API-backed screens. */
@Composable
internal fun BusinessWorkspaceScreen(
    sellerContent: @Composable () -> Unit,
    creatorContent: @Composable () -> Unit,
    brandContent: @Composable () -> Unit,
    adsContent: @Composable () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    val tabs = BusinessWorkspaceTab.entries

    Column(modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxWidth().widthIn(max = 1_040.dp).align(Alignment.CenterHorizontally),
        ) {
            androidx.compose.foundation.layout.Row(
                Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 8.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Business tools",
                    Modifier.weight(1f).semantics { heading() },
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                TextButton(onClick = onBack) { Text("Profile") }
            }
            TabRow(selectedTabIndex = selectedTab) {
                tabs.forEachIndexed { index, tab ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(tab.label, maxLines = 1) },
                    )
                }
            }
        }
        Box(
            Modifier.fillMaxSize().widthIn(max = 1_040.dp).align(Alignment.CenterHorizontally),
        ) {
            when (tabs[selectedTab]) {
                BusinessWorkspaceTab.Seller -> sellerContent()
                BusinessWorkspaceTab.Creator -> creatorContent()
                BusinessWorkspaceTab.Brands -> brandContent()
                BusinessWorkspaceTab.Ads -> adsContent()
            }
        }
    }
}
