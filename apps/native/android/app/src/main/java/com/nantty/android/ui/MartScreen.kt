package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.MartCategory
import com.nantty.android.data.MartHighlight
import com.nantty.android.data.MartHighlightTarget
import com.nantty.android.data.MartProduct
import com.nantty.android.data.MartProductAd
import com.nantty.android.data.MartRepository
import com.nantty.android.data.MartResult
import com.nantty.android.data.MartRecommendationsResult
import com.nantty.android.data.ProductAdResult
import com.nantty.android.data.ProductAdsRepository
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.StoreRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun MartScreen(
    repository: MartRepository,
    modifier: Modifier = Modifier,
    showCategoryPane: Boolean = false,
    onAuthenticationRequired: () -> Unit = {},
    initialProductId: String? = null,
    onInitialProductHandled: () -> Unit = {},
    initialCategoryId: String? = null,
    initialCategoryName: String? = null,
    onBackFromInitialCategory: () -> Unit = {},
    onInitialCategoryHandled: () -> Unit = {},
    onOpenStore: (String) -> Unit = {},
    onOpenBrand: (String) -> Unit = {},
    storeRepository: StoreRepository? = null,
    reviewsRepositoryOverride: ProductReviewsRepository? = null,
    productAdsRepositoryOverride: ProductAdsRepository? = null,
) {
    var categories by remember { mutableStateOf<List<MartCategory>>(emptyList()) }
    var martHome by remember { mutableStateOf<com.nantty.android.data.MartHome?>(null) }
    var highlights by remember { mutableStateOf<List<MartHighlight>>(emptyList()) }
    var productAd by remember { mutableStateOf<MartProductAd?>(null) }
    var products by remember { mutableStateOf<List<MartProduct>>(emptyList()) }
    val recommendationAccountId = repository.currentAccountId()
    var recommendedProducts by remember(repository, recommendationAccountId) { mutableStateOf<List<MartProduct>?>(null) }
    var recommendationSource by remember(repository, recommendationAccountId) { mutableStateOf<String?>(null) }
    var recommendationError by remember(repository, recommendationAccountId) { mutableStateOf<String?>(null) }
    var recommendationReload by remember { mutableStateOf(0) }
    var selectedCategoryId by rememberMartCategorySelection()
    var selectedCollection by rememberSaveable { mutableStateOf<String?>(null) }
    var focusedCategoryName by rememberSaveable { mutableStateOf<String?>(null) }
    var enteredFromInitialCategory by rememberSaveable { mutableStateOf(false) }
    var selectedProductId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedReviewsProductId by rememberSaveable { mutableStateOf<String?>(null) }
    var nextCursor by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadingMore by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var pageError by remember { mutableStateOf<String?>(null) }
    var reloadGeneration by remember { mutableStateOf(0) }
    var requestGeneration by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    val productAdsRepository = productAdsRepositoryOverride
        ?: remember(repository) { ProductAdsRepository(accessTokenProvider = repository::currentAccessToken) }
    val productAdSessionId = remember { "mart_ads_${java.util.UUID.randomUUID()}" }

    LaunchedEffect(productAdsRepository, productAdSessionId) {
        val result = withContext(Dispatchers.IO) { productAdsRepository.decideMartProductAd(productAdSessionId) }
        productAd = (result as? ProductAdResult.Success)?.ad
    }

    LaunchedEffect(initialProductId) {
        if (initialProductId != null) {
            selectedProductId = initialProductId
            onInitialProductHandled()
        }
    }

    LaunchedEffect(initialCategoryId, initialCategoryName) {
        if (initialCategoryId != null) {
            enteredFromInitialCategory = true
            selectedCollection = null
            selectedCategoryId = initialCategoryId
            focusedCategoryName = initialCategoryName?.trim()?.takeIf(String::isNotEmpty)
            onInitialCategoryHandled()
        }
    }

    val exitCategoryBrowse = {
        if (enteredFromInitialCategory) {
            enteredFromInitialCategory = false
            onBackFromInitialCategory()
        } else {
            focusedCategoryName = null
            selectedCategoryId = null
            selectedCollection = null
        }
    }
    BackHandler(enabled = focusedCategoryName != null, onBack = exitCategoryBrowse)

    selectedProductId?.takeIf { selectedReviewsProductId == null }?.let { productId ->
        MartProductDetailScreen(
            productId = productId,
            repository = repository,
            onAuthenticationRequired = onAuthenticationRequired,
            onBack = { selectedProductId = null },
            onOpenReviews = { selectedReviewsProductId = it },
            onOpenStore = onOpenStore,
            onOpenBrand = onOpenBrand,
            storeRepository = storeRepository,
            modifier = modifier,
        )
        return
    }

    selectedReviewsProductId?.let { productId ->
        ProductReviewsScreen(
            productId = productId,
            repository = reviewsRepositoryOverride ?: remember(repository) { ProductReviewsRepository(accessTokenProvider = repository::currentAccessToken) },
            onBack = { selectedReviewsProductId = null },
            modifier = modifier,
        )
        return
    }

    LaunchedEffect(selectedCategoryId, selectedCollection, reloadGeneration) {
        if (initialCategoryId != null && selectedCategoryId != initialCategoryId) return@LaunchedEffect
        requestGeneration++
        val generation = requestGeneration
        loading = true
        loadingMore = false
        products = emptyList()
        nextCursor = null
        errorMessage = null
        pageError = null
        val result = withContext(Dispatchers.IO) { repository.loadProducts(selectedCategoryId, collection = selectedCollection) }
        if (generation != requestGeneration) return@LaunchedEffect
        when (result) {
            is MartResult.Products -> {
                products = result.value.products
                nextCursor = result.value.nextCursor
            }
            is MartResult.Failure -> errorMessage = result.message
            is MartResult.Home -> Unit
            is MartResult.Highlights -> Unit
        }
        loading = false
    }

    LaunchedEffect(repository) {
        when (val result = withContext(Dispatchers.IO) { repository.loadHome() }) {
            is MartResult.Home -> {
                martHome = result.value
                categories = result.value.categories
            }
            is MartResult.Failure -> if (categories.isEmpty()) errorMessage = result.message
            is MartResult.Products -> Unit
            is MartResult.Highlights -> Unit
        }
    }

    LaunchedEffect(repository) {
        when (val result = withContext(Dispatchers.IO) { repository.loadHighlights() }) {
            is MartResult.Highlights -> highlights = result.value
            is MartResult.Failure, is MartResult.Home, is MartResult.Products -> Unit
        }
    }

    LaunchedEffect(repository, recommendationAccountId, recommendationReload) {
        recommendedProducts = null
        recommendationSource = null
        recommendationError = null
        when (val result = withContext(Dispatchers.IO) { repository.loadProductRecommendations() }) {
            is MartRecommendationsResult.Success -> {
                recommendedProducts = result.value.products
                recommendationSource = result.value.source
            }
            is MartRecommendationsResult.Failure -> recommendationError = result.message
        }
    }

    LaunchedEffect(repository, selectedCategoryId) {
        selectedCategoryId?.let { categoryId ->
            withContext(Dispatchers.IO) { repository.recordCategoryViewed(categoryId) }
        }
    }

    val openProduct = { productId: String ->
        scope.launch(Dispatchers.IO) { repository.recordProductClicked(productId) }
        selectedProductId = productId
    }
    val openRecommendedProduct = { productId: String ->
        scope.launch(Dispatchers.IO) { repository.recordProductClicked(productId, "mart_recommendations") }
        selectedProductId = productId
    }

    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.fillMaxSize().widthIn(max = 1040.dp)) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            focusedCategoryName ?: stringResource(com.nantty.android.R.string.mart_title),
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.semantics { heading() },
                        )
                        Text(
                            stringResource(
                                when {
                                    focusedCategoryName == null -> com.nantty.android.R.string.mart_browse_description
                                    selectedCollection != null -> com.nantty.android.R.string.mart_collection_description
                                    else -> com.nantty.android.R.string.mart_category_description
                                },
                            ),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    if (focusedCategoryName != null) {
                        TextButton(onClick = exitCategoryBrowse) {
                            Text(
                                stringResource(
                                    if (enteredFromInitialCategory) com.nantty.android.R.string.mart_back_to_discover
                                    else com.nantty.android.R.string.mart_back_to_all,
                                ),
                            )
                        }
                    }
                }
            }
            if (focusedCategoryName == null) {
                MartHighlights(
                    highlights = highlights,
                    onOpen = { highlight ->
                        when (val target = highlight.target) {
                            is MartHighlightTarget.Product -> selectedProductId = target.productId
                            is MartHighlightTarget.Category -> {
                                selectedCollection = null
                                selectedCategoryId = target.categoryId
                                focusedCategoryName = target.name
                            }
                            is MartHighlightTarget.Collection -> {
                                selectedCategoryId = null
                                selectedCollection = target.collection
                                focusedCategoryName = target.name
                            }
                        }
                        highlight.sponsored?.let { sponsored ->
                            val itemId = (highlight.target as? MartHighlightTarget.Product)?.productId
                            if (itemId != null) scope.launch(Dispatchers.IO) { repository.recordSponsoredEvent(sponsored, itemId, "click") }
                        }
                    },
                    onViewed = { highlight ->
                        val sponsored = highlight.sponsored ?: return@MartHighlights
                        val itemId = (highlight.target as? MartHighlightTarget.Product)?.productId ?: return@MartHighlights
                        scope.launch(Dispatchers.IO) { repository.recordSponsoredEvent(sponsored, itemId, "impression") }
                    },
                )
                martHome?.let { home ->
                    MartCollectionTiles(home, onOpenCollection = { collection, name ->
                        selectedCategoryId = null
                        selectedCollection = collection
                        focusedCategoryName = name
                    })
                }
            }
            val loadMore = {
                startLoadingMore(
                    scope, repository, selectedCategoryId, selectedCollection, nextCursor, products, loadingMore,
                    requestGeneration, { requestGeneration }, { products = it }, { nextCursor = it },
                    { pageError = it }, { loadingMore = it },
                )
            }
            if (showCategoryPane && categories.isNotEmpty() && focusedCategoryName == null) {
                Row(Modifier.fillMaxSize()) {
                    MartCategoryPane(
                        categories = categories,
                        selectedCategoryId = selectedCategoryId,
                        onSelectCategory = { selectedCategoryId = it },
                        modifier = Modifier.weight(0.28f).fillMaxHeight(),
                    )
                    MartProductResults(
                        modifier = Modifier.weight(0.72f).fillMaxHeight(),
                        loading = loading,
                        products = products,
                        productAd = productAd,
                        onProductAdViewed = { ad -> scope.launch(Dispatchers.IO) { productAdsRepository.recordImpression(ad) } },
                        onProductAdClick = { ad ->
                            scope.launch(Dispatchers.IO) { productAdsRepository.recordClick(ad) }
                            selectedProductId = ad.productId
                        },
                        recommendedProducts = recommendedProducts,
                        recommendationSource = recommendationSource,
                        recommendationError = recommendationError,
                        // React Native keeps this shelf in the Mart tab while category chips/pane filters change.
                        showRecommendations = focusedCategoryName == null,
                        onOpenProduct = openProduct,
                        onOpenRecommendedProduct = openRecommendedProduct,
                        onRetryRecommendations = { recommendationReload++ },
                        errorMessage = errorMessage,
                        pageError = pageError,
                        nextCursor = nextCursor,
                        loadingMore = loadingMore,
                        onRetry = { reloadGeneration++ },
                        onLoadMore = loadMore,
                    )
                }
            } else {
                if (categories.isNotEmpty() && focusedCategoryName == null) {
                    MartCategoryChips(categories, selectedCategoryId) { selectedCategoryId = it }
                }
                MartProductResults(
                    modifier = Modifier.fillMaxSize(),
                    loading = loading,
                    products = products,
                    productAd = productAd,
                    onProductAdViewed = { ad -> scope.launch(Dispatchers.IO) { productAdsRepository.recordImpression(ad) } },
                    onProductAdClick = { ad ->
                        scope.launch(Dispatchers.IO) { productAdsRepository.recordClick(ad) }
                        selectedProductId = ad.productId
                    },
                    recommendedProducts = recommendedProducts,
                    recommendationSource = recommendationSource,
                    recommendationError = recommendationError,
                    // Keep recommendations visible for in-place category filtering, matching React Native Mart.
                    showRecommendations = focusedCategoryName == null,
                    onOpenProduct = openProduct,
                    onOpenRecommendedProduct = openRecommendedProduct,
                    onRetryRecommendations = { recommendationReload++ },
                    errorMessage = errorMessage,
                    pageError = pageError,
                    nextCursor = nextCursor,
                    loadingMore = loadingMore,
                    onRetry = { reloadGeneration++ },
                    onLoadMore = loadMore,
                )
            }
        }
    }
}
@Composable
internal fun rememberMartCategorySelection(): MutableState<String?> = rememberSaveable { mutableStateOf(null) }

private fun startLoadingMore(
    scope: kotlinx.coroutines.CoroutineScope,
    repository: MartRepository,
    categoryId: String?,
    collection: String?,
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
        val result = withContext(Dispatchers.IO) { repository.loadProducts(categoryId, cursor, collection) }
        if (currentGeneration() != expectedGeneration) return@launch
        when (result) {
            is MartResult.Products -> {
                val seen = current.mapTo(mutableSetOf(), MartProduct::id)
                setProducts(current + result.value.products.filter { seen.add(it.id) })
                setCursor(result.value.nextCursor)
            }
            is MartResult.Failure -> setError(result.message)
            is MartResult.Home -> Unit
            is MartResult.Highlights -> Unit
        }
        setLoading(false)
    }
}
