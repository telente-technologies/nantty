package com.nantty.android.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.lazy.items
import coil.compose.AsyncImage
import com.nantty.android.data.MartProduct
import com.nantty.android.data.MartProductAd
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

@Composable
internal fun MartProductResults(
    modifier: Modifier,
    loading: Boolean,
    products: List<MartProduct>,
    productAd: MartProductAd?,
    onProductAdViewed: (MartProductAd) -> Unit,
    onProductAdClick: (MartProductAd) -> Unit,
    recommendedProducts: List<MartProduct>?,
    recommendationSource: String?,
    recommendationError: String?,
    showRecommendations: Boolean,
    onOpenProduct: (String) -> Unit,
    onOpenRecommendedProduct: (String) -> Unit,
    onRetryRecommendations: () -> Unit,
    errorMessage: String?,
    pageError: String?,
    nextCursor: String?,
    loadingMore: Boolean,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 156.dp),
        modifier = modifier,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        productAd?.let { ad ->
            item(span = { GridItemSpan(maxLineSpan) }) {
                MartProductAdCard(ad, onOpenProduct = { onProductAdClick(ad) }, onViewed = onProductAdViewed)
            }
        }
        if (showRecommendations) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                MartRecommendationsSection(
                    products = recommendedProducts,
                    source = recommendationSource,
                    errorMessage = recommendationError,
                    onOpenProduct = onOpenRecommendedProduct,
                    onRetry = onRetryRecommendations,
                )
            }
        }
        when {
            loading && products.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                Box(Modifier.fillMaxWidth().padding(vertical = 36.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            errorMessage != null && products.isEmpty() -> item(span = { GridItemSpan(maxLineSpan) }) {
                MartMessage("Mart is unavailable", errorMessage, onRetry)
            }
            products.isEmpty() && productAd == null -> item(span = { GridItemSpan(maxLineSpan) }) {
                MartMessage("No products here yet", "Try another category or check back later.", null)
            }
            else -> items(products, key = MartProduct::id) { product ->
                MartProductCard(product, onOpen = { onOpenProduct(product.id) })
            }
        }
        if (pageError != null) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                MartMessage("Could not load more products", pageError, onLoadMore)
            }
        } else if ((nextCursor != null || loadingMore) && products.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                TextButton(
                    enabled = !loadingMore,
                    onClick = onLoadMore,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                ) {
                    if (loadingMore) CircularProgressIndicator(Modifier.size(18.dp)) else Text("Load more")
                }
            }
        }
    }
}

@Composable
internal fun MartRecommendationsSection(
    products: List<MartProduct>?,
    source: String?,
    errorMessage: String?,
    onOpenProduct: (String) -> Unit,
    onRetry: () -> Unit,
) {
    // Match React Native: do not leave an empty personalized shelf in the Mart catalog.
    if (products != null && products.isEmpty() && errorMessage == null) return
    Column(Modifier.fillMaxWidth().padding(start = 16.dp, top = 8.dp, bottom = 16.dp)) {
        Text(
            stringResource(com.nantty.android.R.string.mart_recommendations_title),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(end = 16.dp, bottom = 10.dp).semantics { heading() },
        )
        if (source != null && products != null && errorMessage == null) {
            Text(
                stringResource(
                    if (source == "personalized") com.nantty.android.R.string.mart_recommendations_personalized
                    else com.nantty.android.R.string.mart_recommendations_popular,
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(end = 16.dp, bottom = 8.dp),
            )
        }
        when {
            products == null && errorMessage == null -> Row(
                Modifier.fillMaxWidth().padding(vertical = 20.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                Text(
                    stringResource(com.nantty.android.R.string.mart_recommendations_loading),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 10.dp),
                )
            }
            errorMessage != null -> Row(
                Modifier.fillMaxWidth().padding(end = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(com.nantty.android.R.string.mart_recommendations_error),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = onRetry) {
                    Text(stringResource(com.nantty.android.R.string.mart_recommendations_retry))
                }
            }
            products.isNullOrEmpty() -> Text(
                stringResource(com.nantty.android.R.string.mart_recommendations_empty),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(end = 16.dp, bottom = 8.dp),
            )
            else -> LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(products, key = MartProduct::id) { product ->
                    Box(Modifier.widthIn(min = 168.dp, max = 190.dp)) {
                        MartProductCard(product, onOpen = { onOpenProduct(product.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun MartProductCard(product: MartProduct, onOpen: () -> Unit) {
    Card(
        onClick = onOpen,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column {
            Box(
                Modifier.fillMaxWidth().height(148.dp)
                    .background(
                        Brush.linearGradient(
                            listOf(
                                MaterialTheme.colorScheme.surfaceContainerHighest,
                                MaterialTheme.colorScheme.surfaceContainerLow,
                            ),
                        ),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                product.imageUrl?.let { imageUrl ->
                    AsyncImage(
                        imageUrl,
                        contentDescription = product.name,
                        modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)),
                        contentScale = ContentScale.Crop,
                    )
                } ?: Text(
                    "N",
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Black,
                )
            }
            Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                Text(product.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(4.dp))
                Text(
                    formatMartPrice(product.amountMinor, product.currency),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                if (product.stock == 0) {
                    Text(
                        "Out of stock",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
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

internal fun formatMartPrice(amountMinor: Long, currencyCode: String): String = runCatching {
    val currency = Currency.getInstance(currencyCode)
    val scale = currency.defaultFractionDigits.coerceAtLeast(0)
    NumberFormat.getCurrencyInstance(Locale.getDefault()).apply { this.currency = currency }
        .format(BigDecimal.valueOf(amountMinor, scale))
}.getOrElse { "$currencyCode $amountMinor" }
