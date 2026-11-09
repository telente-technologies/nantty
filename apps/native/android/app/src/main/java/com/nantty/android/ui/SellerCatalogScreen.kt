package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.SellerCatalogProduct
import com.nantty.android.data.SellerCatalogRepository
import com.nantty.android.data.SellerCatalogResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private sealed interface SellerCatalogUiState {
    data object Loading : SellerCatalogUiState
    data class Loaded(val products: List<SellerCatalogProduct>) : SellerCatalogUiState
    data class Failed(val message: String, val authenticationRequired: Boolean) : SellerCatalogUiState
}

@Composable
internal fun SellerCatalogScreen(
    repository: SellerCatalogRepository,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var retryKey by rememberSaveable { mutableIntStateOf(0) }
    var state by remember(repository) { mutableStateOf<SellerCatalogUiState>(SellerCatalogUiState.Loading) }
    var workingProductId by remember(repository) { mutableStateOf<String?>(null) }
    var actionMessage by remember(repository) { mutableStateOf<String?>(null) }
    var creating by rememberSaveable { mutableStateOf(false) }
    var editingProductId by rememberSaveable { mutableStateOf<String?>(null) }
    BackHandler(enabled = true) {
        if (creating || editingProductId != null) { creating = false; editingProductId = null } else onBack()
    }
    LaunchedEffect(repository, retryKey) {
        state = SellerCatalogUiState.Loading
        state = when (val result = withContext(Dispatchers.IO) { repository.load() }) {
            is SellerCatalogResult.Success -> SellerCatalogUiState.Loaded(result.value)
            is SellerCatalogResult.Failure -> SellerCatalogUiState.Failed(result.message, result.authenticationRequired)
        }
        if ((state as? SellerCatalogUiState.Failed)?.authenticationRequired == true) onAuthenticationRequired()
    }

    if (creating || editingProductId != null) {
        SellerCatalogFormScreen(
            repository = repository,
            productId = editingProductId,
            onBack = { creating = false; editingProductId = null },
            onAuthenticationRequired = onAuthenticationRequired,
            onSaved = { creating = false; editingProductId = null; retryKey++ },
            modifier = modifier,
        )
        return
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Products", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Manage product visibility in your store", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            OutlinedButton(onClick = { retryKey++ }, enabled = state !is SellerCatalogUiState.Loading && workingProductId == null) { Text("Refresh") }
        }
        Button(onClick = { creating = true }, modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp), enabled = workingProductId == null) {
            Text("Add product")
        }

        when (val current = state) {
            SellerCatalogUiState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading products" })
            }
            is SellerCatalogUiState.Failed -> Column(
                Modifier.fillMaxWidth().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(if (current.authenticationRequired) "Sign-in required" else "Products unavailable", style = MaterialTheme.typography.titleMedium)
                Text(current.message, style = MaterialTheme.typography.bodyMedium)
                Button(onClick = { retryKey++ }) { Text("Try again") }
            }
            is SellerCatalogUiState.Loaded -> if (current.products.isEmpty()) {
                Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text("No products yet. Add products from your seller dashboard.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 168.dp),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(current.products, key = SellerCatalogProduct::id) { product ->
                        SellerCatalogProductCard(
                            product = product,
                            busy = workingProductId == product.id,
                            enabled = workingProductId == null,
                            message = actionMessage?.takeIf { it.startsWith("${product.id}:") }?.substringAfter(':')?.trim(),
                            onEdit = { editingProductId = product.id },
                            onVisibilityChange = {
                                val publish = !product.publishedOnline
                                workingProductId = product.id
                                actionMessage = null
                                val outcome = withContext(Dispatchers.IO) { repository.setPublished(product.id, publish) }
                                if (outcome is SellerCatalogResult.Failure) {
                                    actionMessage = "${product.id}: ${outcome.message}"
                                    if (outcome.authenticationRequired) onAuthenticationRequired()
                                } else {
                                    actionMessage = "${product.id}: ${if (publish) "Product published." else "Product hidden from buyers."}"
                                    retryKey++
                                }
                                workingProductId = null
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SellerCatalogProductCard(
    product: SellerCatalogProduct,
    busy: Boolean,
    enabled: Boolean,
    message: String?,
    onEdit: () -> Unit,
    onVisibilityChange: suspend () -> Unit,
) {
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AsyncImage(
                model = product.imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxWidth().height(132.dp),
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            )
            Column(Modifier.padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(product.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(
                    "${product.status.replaceFirstChar(Char::uppercase)} · ${if (product.publishedOnline) "Published" else "Hidden"} · ${product.variantCount} ${if (product.variantCount == 1) "variant" else "variants"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (message != null) Text(message, Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite }, style = MaterialTheme.typography.bodySmall)
            }
            OutlinedButton(onClick = onEdit, enabled = enabled, modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp)) {
                Text("Edit product")
            }
            OutlinedButton(
                onClick = { scope.launch { onVisibilityChange() } },
                enabled = enabled,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp).semantics {
                    contentDescription = "${if (product.publishedOnline) "Hide" else "Publish"} ${product.name}"
                },
            ) {
                if (busy) CircularProgressIndicator(Modifier.padding(end = 8.dp), strokeWidth = 2.dp)
                Text(if (busy) "Updating…" else if (product.publishedOnline) "Hide" else "Publish")
            }
        }
    }
}
