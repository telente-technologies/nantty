package com.nantty.android.ui

import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Share
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.MartProductDetailResult
import com.nantty.android.data.MartRepository
import com.nantty.android.data.AddToCartResult
import com.nantty.android.data.CartRepository
import com.nantty.android.data.SaleAttribution
import com.nantty.android.data.StoreFollowResult
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.ProductReportReason
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportResult
import com.nantty.android.data.ProductSaveMutationResult
import com.nantty.android.data.ProductSaveRepository
import com.nantty.android.data.ProductSaveStatusResult
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.PRODUCT_VARIANT_ID_OPTION_KEY
import com.nantty.android.data.productOptionGroups
import com.nantty.android.data.productOptionHasStock
import com.nantty.android.data.resolveProductVariant
import com.nantty.android.share.copyProductLinkFromAndroid
import com.nantty.android.share.shareProductFromAndroid
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun MartProductDetailScreen(
    productId: String,
    saleAttribution: SaleAttribution? = null,
    repository: MartRepository,
    onAuthenticationRequired: () -> Unit,
    onBack: () -> Unit,
    onOpenReviews: (String) -> Unit = {},
    onOpenRelatedProduct: (String) -> Unit = {},
    onOpenStore: (String) -> Unit = {},
    onOpenBrand: (String) -> Unit = {},
    onOpenCart: () -> Unit = {},
    storeRepository: StoreRepository? = null,
    reviewsRepositoryOverride: ProductReviewsRepository? = null,
    modifier: Modifier = Modifier,
    cartRepositoryOverride: CartRepository? = null,
    productReportRepositoryOverride: ProductReportRepository? = null,
    productSaveRepositoryOverride: ProductSaveRepository? = null,
) {
    var result by remember(productId, repository) { mutableStateOf<MartProductDetailResult?>(null) }
    var loading by remember(productId, repository) { mutableStateOf(true) }
    var retryCount by remember(productId) { mutableIntStateOf(0) }
    var selectedOptions by rememberSaveable(productId, stateSaver = productOptionSelectionsSaver) {
        mutableStateOf(emptyMap<String, String>())
    }
    var quantity by rememberSaveable(productId) { mutableIntStateOf(1) }
    var addToCartResult by remember(productId) { mutableStateOf<AddToCartResult?>(null) }
    var productViewRecorded by rememberSaveable(productId) { mutableStateOf(false) }
    var addingToCart by remember(productId) { mutableStateOf(false) }
    var followingStore by remember(productId) { mutableStateOf(false) }
    var followingStoreBusy by remember(productId) { mutableStateOf(false) }
    var storeFollowError by remember(productId) { mutableStateOf<String?>(null) }
    var confirmUnfollowStore by rememberSaveable(productId) { mutableStateOf(false) }
    var reportDialogVisible by rememberSaveable(productId) { mutableStateOf(false) }
    var reportSubmitting by remember(productId) { mutableStateOf(false) }
    var reportSubmitted by remember(productId) { mutableStateOf(false) }
    var reportSelectedReason by rememberSaveable(productId) { mutableStateOf<ProductReportReason?>(null) }
    var reportError by remember(productId) { mutableStateOf<String?>(null) }
    var reportCanRetry by remember(productId) { mutableStateOf(true) }
    var reportIdempotencyKey by rememberSaveable(productId) { mutableStateOf(UUID.randomUUID().toString()) }
    var savedProduct by rememberSaveable(productId) { mutableStateOf<Boolean?>(null) }
    var savingProduct by remember(productId) { mutableStateOf(false) }
    var saveProductError by remember(productId) { mutableStateOf<String?>(null) }
    var shareMenuExpanded by remember(productId) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val cartRepository = remember(productId, repository, cartRepositoryOverride) {
        cartRepositoryOverride ?: CartRepository(
            accessTokenProvider = repository::currentAccessToken,
            productInteractionRepository = repository.productInteractions(),
        )
    }
    val productReportRepository = remember(productId, repository, productReportRepositoryOverride) {
        productReportRepositoryOverride ?: ProductReportRepository(accessTokenProvider = repository::currentAccessToken)
    }
    val productSaveRepository = remember(productId, repository, productSaveRepositoryOverride) {
        productSaveRepositoryOverride ?: ProductSaveRepository(baseUrl = repository.apiBaseUrl(), accessTokenProvider = repository::currentAccessToken)
    }
    val productReviewsRepository = remember(productId, repository, reviewsRepositoryOverride) {
        reviewsRepositoryOverride ?: ProductReviewsRepository(baseUrl = repository.apiBaseUrl(), accessTokenProvider = repository::currentAccessToken)
    }

    fun submitProductReport(reason: ProductReportReason) {
        if (reportSubmitting) return
        reportSelectedReason = reason
        reportSubmitting = true
        reportError = null
        scope.launch {
            val outcome = withContext(Dispatchers.IO) {
                productReportRepository.submit(productId, reason, reportIdempotencyKey)
            }
            reportSubmitting = false
            when (outcome) {
                is ProductReportResult.Success -> reportSubmitted = true
                is ProductReportResult.Failure -> {
                    if (outcome.authenticationRequired) {
                        reportDialogVisible = false
                        onAuthenticationRequired()
                    } else {
                        reportError = outcome.message
                        reportCanRetry = outcome.retryable
                        if (outcome.rotateIdempotencyKeyOnRetry) reportIdempotencyKey = UUID.randomUUID().toString()
                    }
                }
            }
        }
    }

    fun updateStoreFollow(storeId: String, follow: Boolean) {
        if (followingStoreBusy || storeRepository == null) return
        followingStoreBusy = true
        storeFollowError = null
        scope.launch {
            val outcome = withContext(Dispatchers.IO) { storeRepository.setFollowing(storeId, follow) }
            when (outcome) {
                is StoreFollowResult.Success -> followingStore = outcome.state.isFollowing
                is StoreFollowResult.Failure -> {
                    if (outcome.authenticationRequired) onAuthenticationRequired()
                    else storeFollowError = outcome.message
                }
            }
            followingStoreBusy = false
        }
    }

    BackHandler(onBack = onBack)
    LaunchedEffect(productId, repository, retryCount) {
        loading = true
        result = null
        val loaded = withContext(Dispatchers.IO) {
            repository.loadProductDetail(productId)
        }
        Snapshot.withMutableSnapshot {
            result = loaded
            if (loaded is MartProductDetailResult.Success) followingStore = loaded.value.store.isFollowing
            loading = false
        }
        if (loaded is MartProductDetailResult.Success && !productViewRecorded) {
            productViewRecorded = true
            withContext(Dispatchers.IO) { repository.recordProductViewed(loaded.value.id) }
        }
    }
    LaunchedEffect(productId, productSaveRepository) {
        savedProduct = null
        saveProductError = null
        if (repository.currentAccessToken() == null) {
            savedProduct = false
        } else {
            val outcome = withContext(Dispatchers.IO) { productSaveRepository.loadStatus(productId) }
            Snapshot.withMutableSnapshot {
                when (outcome) {
                    is ProductSaveStatusResult.Success -> savedProduct = outcome.isSaved
                    ProductSaveStatusResult.AuthenticationRequired -> savedProduct = false
                    is ProductSaveStatusResult.Failure -> {
                        savedProduct = false
                        saveProductError = outcome.message
                    }
                }
            }
        }
    }

    fun toggleProductSaved() {
        if (savingProduct) return
        if (repository.currentAccessToken() == null) {
            onAuthenticationRequired()
            return
        }
        val previous = savedProduct ?: false
        val next = !previous
        savingProduct = true
        savedProduct = next
        saveProductError = null
        scope.launch {
            val outcome = withContext(Dispatchers.IO) { productSaveRepository.setSaved(productId, next) }
            savingProduct = false
            when (outcome) {
                ProductSaveMutationResult.Success -> savedProduct = next
                ProductSaveMutationResult.AuthenticationRequired -> {
                    savedProduct = previous
                    onAuthenticationRequired()
                }
                is ProductSaveMutationResult.Failure -> {
                    savedProduct = previous
                    saveProductError = outcome.message
                }
            }
        }
    }

    Column(modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(
            Modifier.fillMaxWidth().widthIn(max = 1040.dp).padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to Mart" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text("Product details", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            IconButton(
                onClick = ::toggleProductSaved,
                enabled = !savingProduct && savedProduct != null,
                modifier = Modifier.semantics {
                    contentDescription = if (savedProduct == true) "Remove product from Saved" else "Save product"
                },
            ) {
                Icon(
                    imageVector = if (savedProduct == true) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder,
                    contentDescription = null,
                    tint = if (savedProduct == true) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Box {
                IconButton(
                    onClick = { shareMenuExpanded = true },
                    modifier = Modifier.semantics { contentDescription = "Share product" },
                ) { Icon(Icons.Filled.Share, contentDescription = null) }
                DropdownMenu(expanded = shareMenuExpanded, onDismissRequest = { shareMenuExpanded = false }) {
                    DropdownMenuItem(
                        text = { Text("Copy product link") },
                        onClick = {
                            shareMenuExpanded = false
                            val detail = (result as? MartProductDetailResult.Success)?.value ?: return@DropdownMenuItem
                            copyProductLinkFromAndroid(context, detail.id, detail.title)
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Share product link") },
                        onClick = {
                            shareMenuExpanded = false
                            val detail = (result as? MartProductDetailResult.Success)?.value ?: return@DropdownMenuItem
                            shareProductFromAndroid(context, detail.id, detail.title)
                        },
                    )
                }
            }
        }

        when {
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading product details" })
            }
            result is MartProductDetailResult.Failure -> ProductDetailError(
                message = (result as MartProductDetailResult.Failure).message,
                onRetry = { retryCount++ },
            )
            result is MartProductDetailResult.Success -> {
                val detail = (result as MartProductDetailResult.Success).value
                val optionGroups = remember(detail) { productOptionGroups(detail) }
                val selectedVariant = resolveProductVariant(detail, optionGroups, selectedOptions)
                val missingOption = optionGroups.firstOrNull { it.key !in selectedOptions }
                Column(Modifier.weight(1f)) {
                    ProductDetailContent(
                        detail = detail,
                        optionGroups = optionGroups,
                        selectedOptions = selectedOptions,
                        onSelectOption = { key, value -> selectedOptions = selectedOptions + (key to value); addToCartResult = null },
                        isOptionAvailable = { key, value ->
                            productOptionHasStock(detail.variants, selectedOptions.filterKeys { it == key }, key, value)
                        },
                        quantity = quantity,
                        onQuantityChange = { quantity = it; addToCartResult = null },
                        reviewsRepository = productReviewsRepository,
                        onOpenReviews = { onOpenReviews(detail.id) },
                        onOpenRelatedProduct = onOpenRelatedProduct,
                        onOpenStore = { onOpenStore(detail.store.id) },
                        onOpenBrand = onOpenBrand,
                        isFollowingStore = followingStore,
                        followingStoreBusy = followingStoreBusy,
                        storeFollowError = storeFollowError,
                        onReportProduct = {
                            if (productReportRepository.currentAccessToken() == null) onAuthenticationRequired()
                            else reportDialogVisible = true
                        },
                        onToggleStoreFollow = if (storeRepository == null) null else {
                            {
                                if (!followingStoreBusy) {
                                    if (followingStore) confirmUnfollowStore = true
                                    else updateStoreFollow(detail.store.id, follow = true)
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                    )
                    saveProductError?.let { message ->
                        Text(
                            message,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp),
                        )
                    }
                    val canAdd = detail.stock > 0 && selectedVariant?.inStock == true && !addingToCart
                    val selectionMessage = when {
                        detail.stock <= 0 -> "This product is currently sold out."
                        missingOption != null -> "Choose ${missingOption.label.lowercase()} to continue."
                        selectedVariant == null -> "That combination is unavailable. Choose another option."
                        !selectedVariant.inStock -> "This option is currently sold out."
                        else -> null
                    }
                    selectionMessage?.let { message ->
                        Text(
                            message,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp)
                                .semantics { contentDescription = message },
                        )
                    }
                    addToCartResult?.let { outcome ->
                        val text = when (outcome) {
                            AddToCartResult.Success -> "Added to your cart."
                            is AddToCartResult.Failure -> outcome.message
                        }
                        Text(
                            text,
                            color = if (outcome is AddToCartResult.Success) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp)
                                .semantics { contentDescription = text },
                        )
                    }
                    Button(
                        onClick = {
                            addingToCart = true
                            addToCartResult = null
                            scope.launch {
                                val outcome = withContext(Dispatchers.IO) {
                                    val variant = selectedVariant ?: return@withContext AddToCartResult.Failure("Choose all product options first.")
                                    val useVariantId = optionGroups.isEmpty() || optionGroups.any { it.key == PRODUCT_VARIANT_ID_OPTION_KEY }
                                    cartRepository.addProduct(
                                        productId = detail.id,
                                        variantId = variant.id.takeIf { useVariantId },
                                        quantity = quantity,
                                        attribution = saleAttribution,
                                        size = variant.size.takeIf { !useVariantId && it.isNotBlank() },
                                        color = variant.color.takeIf { !useVariantId && it.isNotBlank() },
                                        options = if (useVariantId) emptyMap() else variant.optionValues,
                                    )
                                }
                                addingToCart = false
                                addToCartResult = outcome
                                if ((outcome as? AddToCartResult.Failure)?.authenticationRequired == true) {
                                    onAuthenticationRequired()
                                } else if (outcome == AddToCartResult.Success) {
                                    onOpenCart()
                                }
                            }
                        },
                        enabled = canAdd,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                    ) {
                        if (addingToCart) CircularProgressIndicator(Modifier.size(18.dp)) else Text("Add to cart")
                    }
                }
            }
        }
    }

    StoreUnfollowConfirmationDialog(
        visible = confirmUnfollowStore,
        onDismiss = { confirmUnfollowStore = false },
        onConfirm = {
            confirmUnfollowStore = false
            val detail = (result as? MartProductDetailResult.Success)?.value
            if (detail != null) updateStoreFollow(detail.store.id, follow = false)
        },
    )

    ProductReportDialog(
        visible = reportDialogVisible,
        submitting = reportSubmitting,
        submitted = reportSubmitted,
        selectedReason = reportSelectedReason,
        errorMessage = reportError,
        canRetry = reportCanRetry,
        onDismiss = {
            reportDialogVisible = false
            if (reportSubmitted) {
                reportSubmitted = false
                reportSelectedReason = null
                reportError = null
                reportCanRetry = true
                reportIdempotencyKey = UUID.randomUUID().toString()
            }
        },
        onSelectReason = ::submitProductReport,
        onRetry = { reportSelectedReason?.let(::submitProductReport) },
    )
}

private val productOptionSelectionsSaver: Saver<Map<String, String>, Any> = listSaver<Map<String, String>, String>(
    save = { selections -> selections.flatMap { (key, value) -> listOf(key, value) } },
    restore = { values: List<String> ->
        values.chunked(2).mapNotNull { pair ->
            val key = pair.getOrNull(0)?.takeIf(String::isNotBlank)
            val value = pair.getOrNull(1)?.takeIf(String::isNotBlank)
            if (key == null || value == null) null else key to value
        }.toMap()
    },
)

@Composable
private fun ProductDetailError(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Product unavailable", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
        TextButton(onClick = onRetry) { Text("Try again") }
    }
}

private const val MIN_PRODUCT_QUANTITY = 1
private const val MAX_PRODUCT_QUANTITY = 10
