package com.nantty.android.ui

import androidx.compose.runtime.Composable
import com.nantty.android.data.MartProduct
import com.nantty.android.data.MartRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Renders the feed-owned insertion point for personalized product recommendations. */
@Composable
internal fun FeedProductRecommendationInsertion(
    visible: Boolean,
    products: List<MartProduct>?,
    source: String?,
    errorMessage: String?,
    martRepository: MartRepository?,
    recommendationScope: CoroutineScope,
    onOpenProduct: ((String) -> Unit)?,
    onRetry: () -> Unit,
) {
    if (!visible || martRepository == null || onOpenProduct == null) return

    MartRecommendationsSection(
        products = products,
        source = source,
        errorMessage = errorMessage,
        onOpenProduct = { productId ->
            recommendationScope.launch(Dispatchers.IO) {
                martRepository.recordProductClicked(productId, "feed_recommendations")
            }
            onOpenProduct(productId)
        },
        onRetry = onRetry,
    )
}
