package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SellerApplicationStatus
import com.nantty.android.data.SellerDashboardPeriod
import com.nantty.android.data.SellerWorkspace
import com.nantty.android.data.SellerWorkspaceDashboard
import com.nantty.android.data.SellerWorkspaceRepository
import com.nantty.android.data.SellerWorkspaceResult
import com.nantty.android.data.SellerOrdersRepository
import com.nantty.android.data.SellerShipmentRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.formatSellerMoney
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.Executor

private sealed interface SellerWorkspaceUiState {
    data object Loading : SellerWorkspaceUiState
    data class Loaded(val workspace: SellerWorkspace) : SellerWorkspaceUiState
    data class Failed(val message: String, val authenticationRequired: Boolean) : SellerWorkspaceUiState
}

/** First read-only Seller workspace slice; entry/navigation is intentionally owned by the host app. */
@Composable
internal fun SellerWorkspaceScreen(
    repository: SellerWorkspaceRepository,
    sellerOrdersRepository: SellerOrdersRepository,
    sellerShipmentRepository: SellerShipmentRepository,
    disputeRepository: DisputeRepository,
    executor: Executor,
    onAuthenticationRequired: () -> Unit,
    onMessageBuyer: (String) -> Unit,
    onOpenBuyerProfile: (String) -> Unit = {},
    onOpenCountryPreferences: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var period by rememberSaveable { mutableStateOf(SellerDashboardPeriod.TODAY) }
    var retryKey by rememberSaveable { mutableIntStateOf(0) }
    var state by remember { mutableStateOf<SellerWorkspaceUiState>(SellerWorkspaceUiState.Loading) }
    var showingOrders by rememberSaveable { mutableStateOf(false) }
    var showingApplication by rememberSaveable { mutableStateOf(false) }

    BackHandler(enabled = showingOrders) { showingOrders = false }
    BackHandler(enabled = showingApplication) { showingApplication = false }

    if (showingApplication) {
        SellerApplicationForm(
            repository = repository,
            executor = executor,
            onBack = { showingApplication = false },
            onSubmitted = { showingApplication = false; retryKey++ },
            onAuthenticationRequired = onAuthenticationRequired,
            onOpenCountryPreferences = onOpenCountryPreferences,
        )
        return
    }

    if (showingOrders) {
        SellerOrdersScreen(
            repository = sellerOrdersRepository,
            shipmentRepository = sellerShipmentRepository,
            disputeRepository = disputeRepository,
            executor = executor,
            onBack = { showingOrders = false },
            onAuthenticationRequired = onAuthenticationRequired,
            onMessageBuyer = onMessageBuyer,
            onOpenBuyerProfile = onOpenBuyerProfile,
            modifier = modifier,
        )
        return
    }

    LaunchedEffect(period, retryKey, repository) {
        state = SellerWorkspaceUiState.Loading
        state = when (val result = withContext(Dispatchers.IO) { repository.load(period) }) {
            is SellerWorkspaceResult.Success -> SellerWorkspaceUiState.Loaded(result.workspace)
            is SellerWorkspaceResult.Failure -> SellerWorkspaceUiState.Failed(result.message, result.authenticationRequired)
        }
    }

    Surface(modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp)) {
            Text(
                "Seller workspace",
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text("Store performance and application status", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(16.dp))

            when (val current = state) {
                SellerWorkspaceUiState.Loading -> SellerWorkspaceLoading()
                is SellerWorkspaceUiState.Failed -> SellerWorkspaceFailure(current, onRetry = { retryKey++ })
                is SellerWorkspaceUiState.Loaded -> SellerWorkspaceContent(
                    workspace = current.workspace,
                    period = period,
                    onPeriodChange = { period = it },
                    onOpenOrders = { showingOrders = true },
                    onStartApplication = { showingApplication = true },
                )
            }
        }
    }
}

@Composable
private fun SellerWorkspaceLoading() {
    Box(Modifier.fillMaxWidth().padding(vertical = 48.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator(Modifier.semantics { })
            Text("Loading seller workspace", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SellerWorkspaceFailure(state: SellerWorkspaceUiState.Failed, onRetry: () -> Unit) {
    Card(Modifier.fillMaxWidth().padding(top = 8.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(if (state.authenticationRequired) "Sign-in required" else "Workspace unavailable", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(state.message, style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(onClick = onRetry) { Text("Try again") }
        }
    }
}

@Composable
private fun SellerWorkspaceContent(
    workspace: SellerWorkspace,
    period: SellerDashboardPeriod,
    onPeriodChange: (SellerDashboardPeriod) -> Unit,
    onOpenOrders: () -> Unit,
    onStartApplication: () -> Unit,
) {
    val dashboard = workspace.dashboard
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (workspace.access.storeId == null) {
            SellerAccessEmptyState(workspace.application, onStartApplication)
        } else {
            Text(
                workspace.access.storeName?.takeIf(String::isNotBlank) ?: "Your store",
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            SellerApplicationCard(workspace.application)
            OutlinedButton(onClick = onOpenOrders, modifier = Modifier.fillMaxWidth()) { Text("View orders") }
            SellerPeriodSelector(period, onPeriodChange)
            if (dashboard == null) {
                SellerEmptyCard("Dashboard data is not available yet.")
            } else {
                AdaptiveDashboard(dashboard)
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun SellerAccessEmptyState(application: SellerApplicationStatus?, onStartApplication: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SellerApplicationCard(application)
        SellerEmptyCard(
            when (application?.status?.lowercase()) {
                "pending" -> "Your application is under review. Store tools will appear when seller access is granted."
                "rejected" -> "Seller access is not available for this application. Review the decision details above."
                "approved" -> "Your application is approved, but this account has no active store access. Contact support if you think this is incorrect."
                else -> "No seller store is linked to this account yet. Apply to sell from Nantty to get started."
            },
        )
        if (application == null || application.status.equals("rejected", ignoreCase = true)) {
            Button(onClick = onStartApplication, modifier = Modifier.fillMaxWidth()) {
                Text(if (application == null) "Start selling" else "Apply again")
            }
        }
    }
}

@Composable
private fun SellerApplicationCard(application: SellerApplicationStatus?) {
    if (application == null) return
    val status = application.status.lowercase()
    val statusLabel = when (status) {
        "pending" -> "Under review"
        "approved" -> "Approved"
        "rejected" -> "Not approved"
        else -> status.replaceFirstChar { it.uppercase() }
    }
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Seller application · $statusLabel", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            if (application.storeName.isNotBlank()) Text(application.storeName, style = MaterialTheme.typography.bodyMedium)
            if (application.categoryName.isNotBlank()) Text(application.categoryName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            application.rejectionReason?.takeIf(String::isNotBlank)?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun SellerPeriodSelector(value: SellerDashboardPeriod, onChange: (SellerDashboardPeriod) -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        SellerDashboardPeriod.entries.forEach { period ->
            FilterChip(
                selected = value == period,
                onClick = { onChange(period) },
                label = { Text(period.label) },
            )
        }
    }
}

@Composable
private fun AdaptiveDashboard(dashboard: SellerWorkspaceDashboard) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val wide = maxWidth >= 840.dp
        if (wide) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    SalesSummaryCard(dashboard, Modifier.fillMaxWidth())
                    CatalogSummaryCard(dashboard, Modifier.fillMaxWidth())
                }
                RecentOrdersCard(dashboard, Modifier.weight(1.25f))
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                SalesSummaryCard(dashboard, Modifier.fillMaxWidth())
                CatalogSummaryCard(dashboard, Modifier.fillMaxWidth())
                RecentOrdersCard(dashboard, Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun SalesSummaryCard(dashboard: SellerWorkspaceDashboard, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Total sales · ${dashboard.period.ifBlank { "selected period" }}", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Text(
                formatSellerMoney(dashboard.totalSalesMinor, dashboard.currency),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text("${dashboard.orders} ${if (dashboard.orders == 1) "order" else "orders"}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }
}

@Composable
private fun CatalogSummaryCard(dashboard: SellerWorkspaceDashboard, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Catalog", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                CatalogCount("Products", dashboard.totalProducts)
                CatalogCount("Active", dashboard.activeProducts)
                CatalogCount("Drafts", dashboard.draftProducts)
            }
        }
    }
}

@Composable
private fun CatalogCount(label: String, count: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(count.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun RecentOrdersCard(dashboard: SellerWorkspaceDashboard, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Recent orders", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            if (dashboard.recentOrders.isEmpty()) {
                Text("No recent orders for this period.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                dashboard.recentOrders.forEach { order ->
                    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(order.customerName, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.width(12.dp))
                            Text(formatSellerMoney(order.amountMinor, order.currency), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        }
                        Text(
                            "${order.orderNumber} · ${order.itemsCount} ${if (order.itemsCount == 1) "item" else "items"} · ${order.status}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SellerEmptyCard(message: String) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Text(message, Modifier.padding(18.dp), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
