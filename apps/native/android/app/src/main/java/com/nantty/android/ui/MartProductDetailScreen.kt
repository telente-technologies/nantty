package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.MartProductDetail
import com.nantty.android.data.MartProductDetailResult
import com.nantty.android.data.MartRepository
import com.nantty.android.data.AddToCartResult
import com.nantty.android.data.CartRepository
import com.nantty.android.data.StoreFollowResult
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.ProductReportReason
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportResult
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun MartProductDetailScreen(
    productId: String,
    repository: MartRepository,
    onAuthenticationRequired: () -> Unit,
    onBack: () -> Unit,
    onOpenReviews: (String) -> Unit = {},
    onOpenStore: (String) -> Unit = {},
    storeRepository: StoreRepository? = null,
    modifier: Modifier = Modifier,
    cartRepositoryOverride: CartRepository? = null,
    productReportRepositoryOverride: ProductReportRepository? = null,
) {
    var result by remember(productId, repository) { mutableStateOf<MartProductDetailResult?>(null) }
    var loading by remember(productId, repository) { mutableStateOf(true) }
    var retryCount by remember(productId) { mutableIntStateOf(0) }
    var selectedVariantId by rememberSaveable(productId) { mutableStateOf<String?>(null) }
    var quantity by rememberSaveable(productId) { mutableIntStateOf(1) }
    var addToCartResult by remember(productId) { mutableStateOf<AddToCartResult?>(null) }
    var addingToCart by remember(productId) { mutableStateOf(false) }
    var followingStore by remember(productId) { mutableStateOf(false) }
    var followingStoreBusy by remember(productId) { mutableStateOf(false) }
    var storeFollowError by remember(productId) { mutableStateOf<String?>(null) }
    var reportDialogVisible by rememberSaveable(productId) { mutableStateOf(false) }
    var reportSubmitting by remember(productId) { mutableStateOf(false) }
    var reportSubmitted by remember(productId) { mutableStateOf(false) }
    var reportSelectedReason by rememberSaveable(productId) { mutableStateOf<ProductReportReason?>(null) }
    var reportError by remember(productId) { mutableStateOf<String?>(null) }
    var reportIdempotencyKey by rememberSaveable(productId) { mutableStateOf(UUID.randomUUID().toString()) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val cartRepository = remember(productId, repository, cartRepositoryOverride) {
        cartRepositoryOverride ?: CartRepository(accessTokenProvider = repository::currentAccessToken)
    }
    val productReportRepository = remember(productId, repository, productReportRepositoryOverride) {
        productReportRepositoryOverride ?: ProductReportRepository(accessTokenProvider = repository::currentAccessToken)
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
                    } else reportError = outcome.message
                }
            }
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
                val effectiveVariantId = selectedVariantId ?: detail.variants.singleOrNull()?.id
                Column(Modifier.weight(1f)) {
                    ProductDetailContent(
                        detail = detail,
                        selectedVariantId = effectiveVariantId,
                        onSelectVariant = { selectedVariantId = it; addToCartResult = null },
                        quantity = quantity,
                        onQuantityChange = { quantity = it; addToCartResult = null },
                        onOpenReviews = { onOpenReviews(detail.id) },
                        onOpenStore = { onOpenStore(detail.store.id) },
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
                                    followingStoreBusy = true
                                    storeFollowError = null
                                    scope.launch {
                                        val outcome = withContext(Dispatchers.IO) {
                                            storeRepository.setFollowing(detail.store.id, follow = !followingStore)
                                        }
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
                            }
                        },
                        modifier = Modifier.weight(1f),
                    )
                    val selectedVariant = detail.variants.firstOrNull { it.id == effectiveVariantId }
                    val canAdd = detail.stock > 0 && selectedVariant?.inStock == true && !addingToCart
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
                                    cartRepository.addProduct(detail.id, selectedVariant?.id, quantity)
                                }
                                addingToCart = false
                                addToCartResult = outcome
                                if ((outcome as? AddToCartResult.Failure)?.authenticationRequired == true) {
                                    onAuthenticationRequired()
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

    ProductReportDialog(
        visible = reportDialogVisible,
        submitting = reportSubmitting,
        submitted = reportSubmitted,
        selectedReason = reportSelectedReason,
        errorMessage = reportError,
        onDismiss = {
            reportDialogVisible = false
            if (reportSubmitted) {
                reportSubmitted = false
                reportSelectedReason = null
                reportError = null
                reportIdempotencyKey = UUID.randomUUID().toString()
            }
        },
        onSelectReason = ::submitProductReport,
        onRetry = { reportSelectedReason?.let(::submitProductReport) },
    )
}

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

@Composable
private fun ProductDetailContent(
    detail: MartProductDetail,
    selectedVariantId: String?,
    onSelectVariant: (String) -> Unit,
    quantity: Int,
    onQuantityChange: (Int) -> Unit,
    onOpenReviews: () -> Unit,
    onOpenStore: () -> Unit,
    onReportProduct: () -> Unit,
    isFollowingStore: Boolean,
    followingStoreBusy: Boolean,
    storeFollowError: String?,
    onToggleStoreFollow: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    BoxWithProductWidth(modifier) { wide ->
        if (wide) {
            Row(
                Modifier.fillMaxSize().widthIn(max = 1040.dp),
                horizontalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(start = 20.dp, bottom = 32.dp)) {
                    item { ProductImages(detail, wide = true) }
                }
                LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(end = 20.dp, bottom = 32.dp)) {
                    item { ProductInformation(detail, selectedVariantId, onSelectVariant, quantity, onQuantityChange, onOpenReviews, onOpenStore, onReportProduct, isFollowingStore, followingStoreBusy, storeFollowError, onToggleStoreFollow) }
                }
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().widthIn(max = 720.dp),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                item { ProductImages(detail, wide = false) }
                item { ProductInformation(detail, selectedVariantId, onSelectVariant, quantity, onQuantityChange, onOpenReviews, onOpenStore, onReportProduct, isFollowingStore, followingStoreBusy, storeFollowError, onToggleStoreFollow) }
            }
        }
    }
}

@Composable
private fun BoxWithProductWidth(modifier: Modifier, content: @Composable (Boolean) -> Unit) {
    androidx.compose.foundation.layout.BoxWithConstraints(modifier, contentAlignment = Alignment.TopCenter) {
        content(maxWidth >= 720.dp)
    }
}

@Composable
private fun ProductImages(detail: MartProductDetail, wide: Boolean) {
    val imageHeight = if (wide) 520.dp else 340.dp
    if (detail.images.isEmpty()) {
        Box(
            Modifier.fillMaxWidth().height(imageHeight).clip(RoundedCornerShape(24.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHighest),
            contentAlignment = Alignment.Center,
        ) {
            Text("No product photos", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(end = 4.dp),
        ) {
            itemsIndexed(detail.images) { index, image ->
                Card(
                    modifier = Modifier.widthIn(min = if (wide) 320.dp else 280.dp, max = if (wide) 520.dp else 520.dp)
                        .height(imageHeight),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                ) {
                    AsyncImage(
                        model = image,
                        contentDescription = "${detail.title}, photo ${index + 1} of ${detail.images.size}",
                        modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(24.dp)),
                        contentScale = ContentScale.Crop,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductInformation(
    detail: MartProductDetail,
    selectedVariantId: String?,
    onSelectVariant: (String) -> Unit,
    quantity: Int,
    onQuantityChange: (Int) -> Unit,
    onOpenReviews: () -> Unit,
    onOpenStore: () -> Unit,
    onReportProduct: () -> Unit,
    isFollowingStore: Boolean,
    followingStoreBusy: Boolean,
    storeFollowError: String?,
    onToggleStoreFollow: (() -> Unit)?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(detail.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(formatDetailPrice(detail.amountMinor, detail.currency), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(if (detail.stock > 0) "In stock" else "Out of stock", color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (detail.rating > 0) Text("${"%.1f".format(Locale.ROOT, detail.rating)} · customer rating", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        TextButton(onClick = onOpenReviews) { Text("Read product reviews") }
        detail.promo?.let { Text(it, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold) }
        if (detail.sizes.isNotEmpty()) DetailLine("Sizes", detail.sizes.joinToString(" · "))
        if (detail.colors.isNotEmpty()) DetailLine("Colors", detail.colors.joinToString(" · "))
        DetailLine("Shipping", detail.shippingInfo.ifBlank { "Shipping details are provided at checkout." })
        if (detail.description.isNotBlank()) DetailLine("About this product", detail.description)
        HorizontalDetailDivider()
        Text("Sold by", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            detail.store.logoUrl?.let { logo ->
                AsyncImage(
                    model = logo,
                    contentDescription = "${detail.store.name} logo",
                    modifier = Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)),
                    contentScale = ContentScale.Crop,
                )
            }
            Column {
                Text(detail.store.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (detail.store.ratingCount > 0) {
                    Text(
                        "${"%.1f".format(Locale.ROOT, detail.store.rating)} · ${detail.store.ratingCount} ratings",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        TextButton(onClick = onOpenStore, modifier = Modifier.semantics { contentDescription = "View ${detail.store.name} store" }) {
            Text("View store")
        }
        if (onToggleStoreFollow != null) {
            TextButton(onClick = onToggleStoreFollow, enabled = !followingStoreBusy) {
                if (followingStoreBusy) CircularProgressIndicator(Modifier.size(16.dp))
                else Text(if (isFollowingStore) "Following store" else "Follow store")
            }
            storeFollowError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
        TextButton(
            onClick = onReportProduct,
            modifier = Modifier.semantics { contentDescription = "Report this product" },
        ) {
            Text(stringResource(com.nantty.android.R.string.report_product_action))
        }
        if (detail.variants.isNotEmpty()) {
            HorizontalDetailDivider()
            Text("Choose an option", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            detail.variants.forEach { variant ->
                FilterChip(
                    selected = selectedVariantId == variant.id,
                    onClick = { if (variant.inStock) onSelectVariant(variant.id) },
                    enabled = variant.inStock,
                    label = {
                        Text(
                            "${variant.title} · ${formatDetailPrice(variant.priceMinor, variant.currency)} · ${if (variant.inStock) "In stock" else "Sold out"}",
                            maxLines = 2,
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        ProductQuantityControl(quantity = quantity, onQuantityChange = onQuantityChange)
    }
}

@Composable
private fun ProductQuantityControl(quantity: Int, onQuantityChange: (Int) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("Quantity", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { onQuantityChange(quantity - 1) },
                enabled = quantity > MIN_PRODUCT_QUANTITY,
                modifier = Modifier.semantics { contentDescription = "Decrease quantity" },
            ) { Text("−", style = MaterialTheme.typography.titleLarge) }
            Text(
                quantity.toString(),
                modifier = Modifier.widthIn(min = 40.dp).semantics { contentDescription = "Product quantity: $quantity" },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            IconButton(
                onClick = { onQuantityChange(quantity + 1) },
                enabled = quantity < MAX_PRODUCT_QUANTITY,
                modifier = Modifier.semantics { contentDescription = "Increase quantity" },
            ) { Text("+", style = MaterialTheme.typography.titleLarge) }
        }
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun HorizontalDetailDivider() {
    Spacer(Modifier.fillMaxWidth().height(1.dp).background(MaterialTheme.colorScheme.outlineVariant))
}

private fun formatDetailPrice(amountMinor: Long, currencyCode: String): String = runCatching {
    val currency = Currency.getInstance(currencyCode)
    val scale = currency.defaultFractionDigits.coerceAtLeast(0)
    NumberFormat.getCurrencyInstance(Locale.getDefault()).apply { this.currency = currency }
        .format(BigDecimal.valueOf(amountMinor, scale))
}.getOrElse { "$currencyCode $amountMinor" }

private const val MIN_PRODUCT_QUANTITY = 1
private const val MAX_PRODUCT_QUANTITY = 10
