package com.nantty.android.ui

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.ProductRatingSummary
import com.nantty.android.data.ProductRatingSummaryResult
import com.nantty.android.data.ProductReview
import com.nantty.android.data.ProductReviewPage
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.ProductReviewsResult
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun ProductReviewsScreen(
    productId: String,
    repository: ProductReviewsRepository,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var page by androidx.compose.runtime.remember(productId, repository) { mutableStateOf<ProductReviewPage?>(null) }
    var summary by androidx.compose.runtime.remember(productId, repository) { mutableStateOf<ProductRatingSummary?>(null) }
    var error by androidx.compose.runtime.remember(productId, repository) { mutableStateOf<String?>(null) }
    var summaryError by androidx.compose.runtime.remember(productId, repository) { mutableStateOf<String?>(null) }
    var loading by androidx.compose.runtime.remember(productId, repository) { mutableStateOf(true) }
    var loadingMore by androidx.compose.runtime.remember(productId, repository) { mutableStateOf(false) }
    var generation by androidx.compose.runtime.remember(productId, repository) { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    BackHandler(onBack = onBack)
    LaunchedEffect(productId, repository, generation) {
        loading = true
        error = null
        val (pageResult, summaryResult) = withContext(Dispatchers.IO) {
            repository.loadPage(productId) to repository.loadRatingSummary(productId)
        }
        Snapshot.withMutableSnapshot {
            when (pageResult) {
                is ProductReviewsResult.Success -> page = pageResult.value
                is ProductReviewsResult.Failure -> error = pageResult.message
            }
            when (summaryResult) {
                is ProductRatingSummaryResult.Success -> summary = summaryResult.value
                is ProductRatingSummaryResult.Failure -> summaryError = summaryResult.message
            }
            loading = false
        }
    }

    Column(modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to product" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text("Product reviews", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        }
        when {
            loading && page == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading product reviews" })
            }
            error != null && page == null -> ReviewError(error.orEmpty(), onRetry = { generation++ })
            page != null -> {
                val currentPage = page ?: return@Column
                LazyColumn(
                    Modifier.fillMaxWidth().weight(1f),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item(key = "rating-summary") {
                        when {
                            summary != null -> RatingSummaryCard(summary!!)
                            summaryError != null -> Text(summaryError.orEmpty(), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    if (currentPage.reviews.isEmpty()) {
                        item(key = "empty-reviews") {
                            Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("No reviews yet", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text("Buyers can rate this product after it’s delivered.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    } else {
                        items(currentPage.reviews, key = ProductReview::id) { review -> ProductReviewRow(review) }
                    }
                    if (error != null) item(key = "page-error") {
                        Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = { generation++ }) { Text("Retry") }
                    }
                    if (currentPage.nextCursor != null) item(key = "load-more") {
                        Button(
                            onClick = {
                                if (!loadingMore) {
                                    loadingMore = true
                                    scope.launch {
                                        val next = withContext(Dispatchers.IO) {
                                            repository.loadPage(productId, currentPage.nextCursor)
                                        }
                                        when (next) {
                                            is ProductReviewsResult.Success -> {
                                                val previousIds = currentPage.reviews.mapTo(mutableSetOf()) { it.id }
                                                page = currentPage.copy(
                                                    reviews = currentPage.reviews + next.value.reviews.filterNot { it.id in previousIds },
                                                    nextCursor = next.value.nextCursor,
                                                )
                                                error = null
                                            }
                                            is ProductReviewsResult.Failure -> error = next.message
                                        }
                                        loadingMore = false
                                    }
                                }
                            },
                            enabled = !loadingMore,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (loadingMore) CircularProgressIndicator(Modifier.size(18.dp)) else Text("Load more reviews")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RatingSummaryCard(summary: ProductRatingSummary) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("${"%.1f".format(Locale.ROOT, summary.average)}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text("★ ★ ★ ★ ★", color = MaterialTheme.colorScheme.primary, maxLines = 1)
                Text("${summary.count} ${if (summary.count == 1) "review" else "reviews"}", style = MaterialTheme.typography.bodySmall)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                (5 downTo 1).forEach { stars ->
                    val amount = summary.distribution[stars] ?: 0
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("$stars", modifier = Modifier.width(18.dp), style = MaterialTheme.typography.labelSmall)
                        LinearProgressIndicator(
                            progress = { if (summary.count == 0) 0f else (amount.toFloat() / summary.count).coerceIn(0f, 1f) },
                            modifier = Modifier.weight(1f).height(6.dp),
                        )
                        Text("$amount", modifier = Modifier.width(34.dp).padding(start = 8.dp), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductReviewRow(review: ProductReview) {
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            if (review.author.avatarUrl != null) {
                AsyncImage(
                    model = review.author.avatarUrl,
                    contentDescription = "${review.author.name} profile photo",
                    modifier = Modifier.size(36.dp).clip(CircleShape),
                )
            }
            Column(Modifier.weight(1f).padding(start = 10.dp)) {
                Text(review.author.name.ifBlank { review.author.username.ifBlank { "Nantty customer" } }, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                Text("${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}", color = MaterialTheme.colorScheme.primary, modifier = Modifier.semantics { contentDescription = "${review.rating} out of 5 stars" })
            }
            if (review.createdAt.isNotBlank()) Text(review.createdAt.take(10), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (review.verifiedPurchase) Text("Verified purchase", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        review.title?.let { Text(it, fontWeight = FontWeight.SemiBold) }
        if (review.text.isNotBlank()) Text(review.text)
        review.reply?.let {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Reply from ${it.authorName.ifBlank { "the seller" }}", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                    Text(it.body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Spacer(Modifier.fillMaxWidth().height(1.dp))
    }
}

@Composable
private fun ReviewError(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Reviews are unavailable", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(message, Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        TextButton(onClick = onRetry) { Text("Try again") }
    }
}
