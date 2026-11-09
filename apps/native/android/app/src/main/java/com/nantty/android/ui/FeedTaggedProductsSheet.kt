package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import android.os.Handler
import android.os.Looper
import coil.compose.AsyncImage
import com.nantty.android.R
import com.nantty.android.data.FeedTaggedProduct
import com.nantty.android.data.AddToCartResult
import com.nantty.android.data.CartRepository
import com.nantty.android.data.SaleAttribution
import java.util.concurrent.Executor

private data class FeedTaggedProductsMessage(
    val text: String? = null,
    val addedCount: Int? = null,
    val failedCount: Int? = null,
    val succeeded: Boolean = false,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun FeedTaggedProductsSheet(
    products: List<FeedTaggedProduct>,
    attribution: SaleAttribution? = null,
    onDismiss: () -> Unit,
    onOpenProduct: (String) -> Unit,
    cartRepository: CartRepository? = null,
    ioExecutor: Executor? = null,
    canInteract: Boolean = false,
    onRequireSignInWithAction: ((() -> Unit) -> Unit) = { },
    onOpenCart: () -> Unit = {},
) {
    var addingProductId by remember(products) { mutableStateOf<String?>(null) }
    var addingAll by remember(products) { mutableStateOf(false) }
    var addedProductIds by remember(products) { mutableStateOf(emptySet<String>()) }
    var actionMessage by remember(products) { mutableStateOf<FeedTaggedProductsMessage?>(null) }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }

    fun addProduct(product: FeedTaggedProduct, afterSignIn: Boolean = false) {
        if (!canInteract && !afterSignIn) {
            onDismiss()
            onRequireSignInWithAction { addProduct(product, afterSignIn = true) }
            return
        }
        val repository = cartRepository
        val executor = ioExecutor
        if (repository == null || executor == null || addingAll || addingProductId != null) return
        addingProductId = product.id
        actionMessage = null
        executor.execute {
            val result = repository.addProduct(product.id, variantId = null, quantity = 1, attribution = attribution)
            mainHandler.post {
                addingProductId = null
                when (result) {
                    AddToCartResult.Success -> {
                        addedProductIds = addedProductIds + product.id
                        actionMessage = FeedTaggedProductsMessage(succeeded = true)
                    }
                    is AddToCartResult.Failure -> {
                        if (result.authenticationRequired) {
                            onDismiss()
                            onRequireSignInWithAction { addProduct(product, afterSignIn = true) }
                        } else {
                            actionMessage = FeedTaggedProductsMessage(text = result.message)
                        }
                    }
                }
            }
        }
    }

    fun addRemainingProducts(afterSignIn: Boolean = false) {
        if (!canInteract && !afterSignIn) {
            onDismiss()
            onRequireSignInWithAction { addRemainingProducts(afterSignIn = true) }
            return
        }
        val repository = cartRepository
        val executor = ioExecutor
        if (repository == null || executor == null || addingAll || addingProductId != null) return
        val remaining = products.filterNot { it.id in addedProductIds }
        if (remaining.isEmpty()) {
            onDismiss()
            onOpenCart()
            return
        }
        addingAll = true
        actionMessage = null
        executor.execute {
            var successes = 0
            var authenticationRequired = false
            var failureCount = 0
            for (product in remaining) {
                when (val result = repository.addProduct(product.id, variantId = null, quantity = 1, attribution = attribution)) {
                    AddToCartResult.Success -> {
                        successes++
                        mainHandler.post { addedProductIds = addedProductIds + product.id }
                    }
                    is AddToCartResult.Failure -> {
                        failureCount++
                        if (result.authenticationRequired) {
                            authenticationRequired = true
                            break
                        }
                    }
                }
            }
            mainHandler.post {
                addingAll = false
                when {
                    authenticationRequired -> {
                        onDismiss()
                        onRequireSignInWithAction { addRemainingProducts(afterSignIn = true) }
                    }
                    failureCount == 0 -> {
                        onDismiss()
                        onOpenCart()
                    }
                    else -> {
                        actionMessage = FeedTaggedProductsMessage(
                            addedCount = successes.takeIf { it > 0 },
                            failedCount = failureCount,
                        )
                    }
                }
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    ) {
        Column(
            Modifier.fillMaxWidth().testTag("feed-tagged-products-sheet").padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(stringResource(R.string.feed_products_sheet_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            LazyColumn(
                modifier = Modifier.fillMaxWidth().heightIn(max = 480.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(products, key = FeedTaggedProduct::id) { product ->
                    val price = formatSearchProductPrice(product.amountMinor, product.currency)
                    val addActionLabel = stringResource(R.string.feed_tagged_product_add_a11y, product.name)
                    val addedActionLabel = stringResource(R.string.feed_tagged_product_added_a11y, product.name)
                    Surface(
                        modifier = Modifier.fillMaxWidth()
                            .testTag("feed-tagged-product-${product.id}")
                            .semantics { contentDescription = "${product.name}, $price" }
                            .clickable { onOpenProduct(product.id) },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surface,
                    ) {
                        Row(
                            Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Surface(
                                modifier = Modifier.size(52.dp),
                                shape = RoundedCornerShape(8.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant,
                            ) {
                                product.imageUrl?.let { url ->
                                    AsyncImage(
                                        model = url,
                                        contentDescription = null,
                                        modifier = Modifier.clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop,
                                    )
                                }
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(product.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                                Text(price, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            }
                            if (cartRepository != null && ioExecutor != null) {
                                IconButton(
                                    onClick = { addProduct(product) },
                                    enabled = addingProductId == null && !addingAll && product.id !in addedProductIds,
                                    modifier = Modifier.semantics {
                                        contentDescription = if (product.id in addedProductIds) addedActionLabel else addActionLabel
                                    },
                                ) {
                                    if (addingProductId == product.id) {
                                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                                    } else if (product.id in addedProductIds) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                                    } else {
                                        Icon(Icons.Default.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            actionMessage?.let { message ->
                Text(
                    when {
                        message.succeeded -> stringResource(R.string.feed_product_added_to_cart)
                        message.addedCount != null && message.failedCount != null -> stringResource(
                            R.string.feed_products_added_partially,
                            message.addedCount,
                            message.failedCount,
                        )
                        else -> message.text.orEmpty()
                    },
                    Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    color = if (message.succeeded) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (products.size > 1 && cartRepository != null && ioExecutor != null) {
                TextButton(
                    onClick = ::addRemainingProducts,
                    enabled = !addingAll && addingProductId == null,
                    modifier = Modifier.fillMaxWidth().testTag("feed-tagged-products-add-all"),
                ) {
                    if (addingAll) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Text(stringResource(R.string.feed_add_all_to_cart))
                }
            }
        }
    }
}
