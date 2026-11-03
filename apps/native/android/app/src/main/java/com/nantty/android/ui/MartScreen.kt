package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Brush
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import coil.compose.AsyncImage
import com.nantty.android.data.MartCategory
import com.nantty.android.data.MartPage
import com.nantty.android.data.MartProduct
import com.nantty.android.data.MartRepository
import com.nantty.android.data.MartResult
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun MartScreen(repository: MartRepository, modifier: Modifier = Modifier) {
    var categories by remember { mutableStateOf<List<MartCategory>>(emptyList()) }
    var products by remember { mutableStateOf<List<MartProduct>>(emptyList()) }
    var selectedCategoryId by remember { mutableStateOf<String?>(null) }
    var nextCursor by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadingMore by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var pageError by remember { mutableStateOf<String?>(null) }
    var reloadGeneration by remember { mutableStateOf(0) }
    var requestGeneration by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(selectedCategoryId, reloadGeneration) {
        requestGeneration++
        val generation = requestGeneration
        loading = true
        loadingMore = false
        products = emptyList()
        nextCursor = null
        errorMessage = null
        pageError = null
        val result = withContext(Dispatchers.IO) { repository.loadProducts(selectedCategoryId) }
        if (generation != requestGeneration) return@LaunchedEffect
        when (result) {
            is MartResult.Products -> {
                products = result.value.products
                nextCursor = result.value.nextCursor
            }
            is MartResult.Failure -> errorMessage = result.message
            is MartResult.Home -> Unit
        }
        loading = false
    }

    LaunchedEffect(repository) {
        when (val result = withContext(Dispatchers.IO) { repository.loadHome() }) {
            is MartResult.Home -> categories = result.value.categories
            is MartResult.Failure -> if (categories.isEmpty()) errorMessage = result.message
            is MartResult.Products -> Unit
        }
    }

    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.fillMaxSize().widthIn(max = 1040.dp)) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
                Text("Mart", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Browse products from stores on Nantty.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (categories.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        FilterChip(selectedCategoryId == null, onClick = { selectedCategoryId = null }, label = { Text("All") })
                    }
                    items(categories, key = MartCategory::id) { category ->
                        FilterChip(
                            selected = selectedCategoryId == category.id,
                            onClick = { selectedCategoryId = category.id },
                            label = { Text(category.name, maxLines = 1) },
                        )
                    }
                }
            }
            when {
                loading && products.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                errorMessage != null && products.isEmpty() -> MartMessage(
                    title = "Mart is unavailable",
                    body = errorMessage.orEmpty(),
                    action = { reloadGeneration++ },
                )
                products.isEmpty() -> MartMessage(
                    title = "No products here yet",
                    body = "Try another category or check back later.",
                    action = null,
                )
                else -> LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 156.dp),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    items(products, key = MartProduct::id) { product -> MartProductCard(product) }
                    if (pageError != null) {
                        item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
                            MartMessage("Could not load more products", pageError.orEmpty()) {
                                startLoadingMore(scope, repository, selectedCategoryId, nextCursor, products, loadingMore, requestGeneration, { requestGeneration }, { products = it }, { nextCursor = it }, { pageError = it }, { loadingMore = it })
                            }
                        }
                    } else if (nextCursor != null || loadingMore) {
                        item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
                            TextButton(
                                enabled = !loadingMore,
                                onClick = {
                                    startLoadingMore(scope, repository, selectedCategoryId, nextCursor, products, loadingMore, requestGeneration, { requestGeneration }, { products = it }, { nextCursor = it }, { pageError = it }, { loadingMore = it })
                                },
                                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            ) {
                                if (loadingMore) CircularProgressIndicator(Modifier.size(18.dp)) else Text("Load more")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MartProductCard(product: MartProduct) {
    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column {
            Box(
                Modifier.fillMaxWidth().height(148.dp)
                    .background(Brush.linearGradient(listOf(MaterialTheme.colorScheme.surfaceContainerHighest, MaterialTheme.colorScheme.surfaceContainerLow))),
                contentAlignment = Alignment.Center,
            ) {
                product.imageUrl?.let { imageUrl ->
                    AsyncImage(imageUrl, contentDescription = product.name, modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)), contentScale = ContentScale.Crop)
                } ?: Text("N", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black)
            }
            Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                Text(product.name, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(4.dp))
                Text(formatMartPrice(product.amountMinor, product.currency), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                if (product.stock == 0) Text("Out of stock", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun MartMessage(title: String, body: String, action: (() -> Unit)?) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        action?.let { TextButton(onClick = it) { Text("Try again") } }
    }
}

private fun startLoadingMore(
    scope: kotlinx.coroutines.CoroutineScope,
    repository: MartRepository,
    categoryId: String?,
    cursor: String?,
    current: List<MartProduct>,
    loading: Boolean,
    expectedGeneration: Int,
    currentGeneration: () -> Int,
    setProducts: (List<MartProduct>) -> Unit,
    setCursor: (String?) -> Unit,
    setError: (String?) -> Unit,
    setLoading: (Boolean) -> Unit,
) {
    if (loading || cursor == null) return
    setLoading(true)
    setError(null)
    scope.launch {
        val result = withContext(Dispatchers.IO) { repository.loadProducts(categoryId, cursor) }
        if (currentGeneration() != expectedGeneration) return@launch
        when (result) {
            is MartResult.Products -> {
                val seen = current.mapTo(mutableSetOf(), MartProduct::id)
                setProducts(current + result.value.products.filter { seen.add(it.id) })
                setCursor(result.value.nextCursor)
            }
            is MartResult.Failure -> setError(result.message)
            is MartResult.Home -> Unit
        }
        setLoading(false)
    }
}

private fun formatMartPrice(amountMinor: Long, currencyCode: String): String = runCatching {
    val currency = Currency.getInstance(currencyCode)
    val scale = currency.defaultFractionDigits.coerceAtLeast(0)
    NumberFormat.getCurrencyInstance(Locale.getDefault()).apply { this.currency = currency }
        .format(BigDecimal.valueOf(amountMinor, scale))
}.getOrElse { "$currencyCode $amountMinor" }
