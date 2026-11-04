package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import com.nantty.android.data.PublicStore
import com.nantty.android.data.PublicStorePage
import com.nantty.android.data.PublicStoreResult
import com.nantty.android.data.SearchProduct
import com.nantty.android.data.StoreRepository
import java.util.concurrent.Executor

@Composable
internal fun PublicStoreScreen(
    storeId: String,
    repository: StoreRepository,
    executor: Executor,
    onBack: () -> Unit,
    onOpenProduct: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var store by remember(storeId) { mutableStateOf<PublicStore?>(null) }
    var products by remember(storeId) { mutableStateOf<List<SearchProduct>>(emptyList()) }
    var nextCursor by remember(storeId) { mutableStateOf<String?>(null) }
    var loading by remember(storeId) { mutableStateOf(true) }
    var loadingMore by remember(storeId) { mutableStateOf(false) }
    var error by remember(storeId) { mutableStateOf<String?>(null) }
    var pageError by remember(storeId) { mutableStateOf(false) }
    var reloadGeneration by remember(storeId) { mutableStateOf(0) }
    var requestGeneration by remember(storeId) { mutableStateOf(0) }

    LaunchedEffect(storeId, reloadGeneration) {
        requestGeneration += 1
        val generation = requestGeneration
        loading = true
        loadingMore = false
        pageError = false
        error = null
        val result = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { repository.loadStore(storeId) }
        if (generation != requestGeneration) return@LaunchedEffect
        when (result) {
            is PublicStoreResult.Success -> {
                store = result.page.store
                products = result.page.products
                nextCursor = result.page.nextCursor
            }
            is PublicStoreResult.Failure -> error = result.message
        }
        loading = false
    }

    fun loadMore() {
        val cursor = nextCursor ?: return
        if (loading || loadingMore) return
        val generation = requestGeneration
        loadingMore = true
        pageError = false
        executor.execute {
            val result = repository.loadStore(storeId, cursor)
            Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    when (result) {
                        is PublicStoreResult.Success -> {
                            products = (products + result.page.products).distinctBy(SearchProduct::id)
                            nextCursor = result.page.nextCursor
                        }
                        is PublicStoreResult.Failure -> pageError = true
                    }
                    loadingMore = false
                }
            }
        }
    }

    Column(modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth().widthIn(max = 1040.dp).padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to search" }) {
                Icon(Icons.Default.ArrowBack, contentDescription = null)
                Text("Back")
            }
        }
        when {
            loading && store == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            error != null && store == null -> SearchCenterMessage("Store is unavailable", error, action = { reloadGeneration++ })
            store != null -> PublicStoreContent(
                store = store!!,
                products = products,
                loadingProducts = loading,
                pageError = pageError,
                loadingMore = loadingMore,
                nextCursor = nextCursor,
                onOpenProduct = onOpenProduct,
                onLoadMore = ::loadMore,
                onRetry = { reloadGeneration++ },
            )
        }
    }
}

@Composable
private fun PublicStoreContent(
    store: PublicStore,
    products: List<SearchProduct>,
    loadingProducts: Boolean,
    pageError: Boolean,
    loadingMore: Boolean,
    nextCursor: String?,
    onOpenProduct: (String) -> Unit,
    onLoadMore: () -> Unit,
    onRetry: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxWidth().widthIn(max = 1040.dp).testTag("public-store-content"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "store-summary") { PublicStoreHeader(store) }
        item(key = "store-products-heading") {
            Text("Products", Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        if (loadingProducts && products.isEmpty()) {
            item(key = "store-products-loading") { Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
        } else if (products.isEmpty()) {
            item(key = "store-products-empty") { SearchCenterMessage("No products available", "This store has no visible products right now.") }
        } else {
            items(products, key = SearchProduct::id) { product ->
                SearchProductRow(product) { onOpenProduct(product.id) }
            }
        }
        if (pageError) {
            item(key = "store-products-page-error") { TextButton(onClick = onLoadMore, modifier = Modifier.fillMaxWidth()) { Text("Couldn’t load more products. Try again") } }
        } else if (nextCursor != null) {
            item(key = "store-products-pagination") {
                TextButton(onClick = onLoadMore, modifier = Modifier.fillMaxWidth().padding(8.dp), enabled = !loadingMore) {
                    if (loadingMore) CircularProgressIndicator(Modifier.size(18.dp)) else Text("Show more products")
                }
            }
        }
        item(key = "store-products-retry") {
            if (loadingProducts && products.isNotEmpty()) TextButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text("Refresh store products") }
        }
    }
}

@Composable
private fun PublicStoreHeader(store: PublicStore) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        store.bannerUrl?.let { banner ->
            AsyncImage(banner, contentDescription = "${store.name} store banner", modifier = Modifier.fillMaxWidth().height(160.dp), contentScale = ContentScale.Crop)
        }
        Row(Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(Modifier.size(64.dp), color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.medium) {
                if (store.logoUrl != null) AsyncImage(store.logoUrl, contentDescription = "${store.name} store logo", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Storefront, contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer) }
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(store.name, modifier = Modifier.weight(1f, fill = false).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    if (store.verified) Icon(Icons.Default.Verified, contentDescription = "Verified store", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp).size(18.dp))
                }
                if (store.handle.isNotBlank()) Text("@${store.handle}", color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (store.bio.isNotBlank()) Text(store.bio, Modifier.fillMaxWidth().padding(top = 12.dp), style = MaterialTheme.typography.bodyMedium)
        Text(
            "${store.followers} followers · ${store.productsCount} products · ${store.rating} rating (${store.ratingCount})",
            Modifier.fillMaxWidth().padding(top = 8.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
        Spacer(Modifier.height(8.dp))
    }
}
