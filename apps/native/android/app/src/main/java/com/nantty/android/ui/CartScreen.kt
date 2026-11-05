package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.CartLine
import com.nantty.android.data.CartMutationResult
import com.nantty.android.data.CartRepository
import com.nantty.android.data.CartResult
import com.nantty.android.data.CartSellerSummary
import com.nantty.android.data.CartSnapshot
import com.nantty.android.data.CheckoutAddress
import com.nantty.android.data.CheckoutAddressInput
import com.nantty.android.data.CheckoutAddressesResult
import com.nantty.android.data.CheckoutCartResult
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.util.concurrent.Executor

@Composable
internal fun CartScreen(
    repository: CartRepository,
    checkoutRepository: CheckoutRepository,
    executor: Executor,
    selectedAddressId: String?,
    onAddressSelected: (String?) -> Unit,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onProceedToCheckout: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var result by remember(repository) { mutableStateOf<CartResult?>(null) }
    var addresses by remember(repository) { mutableStateOf<List<CheckoutAddress>>(emptyList()) }
    var addressLoading by remember(repository) { mutableStateOf(true) }
    var addressError by remember(repository) { mutableStateOf<String?>(null) }
    var quoteLoading by remember(repository) { mutableStateOf(false) }
    var quoteError by remember(repository) { mutableStateOf<String?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var busyItemId by remember(repository) { mutableStateOf<String?>(null) }
    var errorMessage by remember(repository) { mutableStateOf<String?>(null) }
    var refreshGeneration by remember(repository) { mutableStateOf(0) }
    var localAddressId by remember(repository) { mutableStateOf(selectedAddressId) }
    var showingAddressForm by remember(repository) { mutableStateOf(false) }
    var savingAddress by remember(repository) { mutableStateOf(false) }
    var addressSaveError by remember(repository) { mutableStateOf<String?>(null) }
    var quoteRequestGeneration by remember(repository) { mutableStateOf(0) }

    fun quoteAddress(addressId: String) {
        val request = quoteRequestGeneration + 1
        quoteRequestGeneration = request
        quoteLoading = true
        quoteError = null
        executor.execute {
            val outcome = checkoutRepository.quoteCart(addressId)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (request == quoteRequestGeneration && addressId == localAddressId) {
                    when (outcome) {
                        is CheckoutCartResult.Success -> result = CartResult.Success(outcome.cart)
                        is CheckoutCartResult.Failure -> {
                            quoteError = outcome.message
                            if (outcome.authenticationRequired) onAuthenticationRequired()
                        }
                    }
                    quoteLoading = false
                }
            }
        }
    }

    BackHandler(onBack = onBack)
    LaunchedEffect(repository, checkoutRepository, refreshGeneration) {
        loading = true
        addressLoading = true
        errorMessage = null
        executor.execute {
            val loaded = repository.loadCart()
            val addressResult = checkoutRepository.loadAddresses()
            val fetchedAddresses = (addressResult as? CheckoutAddressesResult.Success)?.addresses.orEmpty()
            val requested = localAddressId ?: (loaded as? CartResult.Success)?.cart?.addressId
            // Match RN's explicit address-store selection: a saved default is not silently chosen.
            val chosen = requested?.takeIf { id -> fetchedAddresses.any { it.id == id } }
            val quote = chosen?.let(checkoutRepository::quoteCart)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                result = if (quote is CheckoutCartResult.Success) CartResult.Success(quote.cart) else loaded
                addresses = fetchedAddresses
                addressLoading = false
                localAddressId = chosen
                onAddressSelected(chosen)
                addressError = (addressResult as? CheckoutAddressesResult.Failure)?.message
                quoteError = (quote as? CheckoutCartResult.Failure)?.message
                if ((addressResult as? CheckoutAddressesResult.Failure)?.authenticationRequired == true ||
                    (quote as? CheckoutCartResult.Failure)?.authenticationRequired == true
                ) onAuthenticationRequired()
                loading = false
                if ((loaded as? CartResult.Failure)?.authenticationRequired == true) onAuthenticationRequired()
            }
        }
    }

    LaunchedEffect(selectedAddressId) {
        if (selectedAddressId != localAddressId) {
            localAddressId = selectedAddressId
            if (selectedAddressId != null && addresses.any { it.id == selectedAddressId }) quoteAddress(selectedAddressId)
        }
    }

    fun mutate(item: CartLine, mutation: () -> CartMutationResult) {
        if (busyItemId != null) return
        busyItemId = item.id
        errorMessage = null
        executor.execute {
            val outcome = mutation()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                busyItemId = null
                when (outcome) {
                    CartMutationResult.Success -> refreshGeneration++
                    is CartMutationResult.Failure -> {
                        errorMessage = outcome.message
                        if (outcome.authenticationRequired) onAuthenticationRequired()
                    }
                }
            }
        }
    }

    Column(modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to Mart" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text("Your cart", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(
                onClick = { refreshGeneration++ },
                enabled = !loading && busyItemId == null,
                modifier = Modifier.semantics { contentDescription = "Refresh cart" },
            ) { Icon(Icons.Default.Refresh, contentDescription = null) }
        }

        when {
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading cart" })
            }
            result is CartResult.Failure -> CartMessage(
                message = errorMessage ?: (result as CartResult.Failure).message,
                actionLabel = "Try again",
                onAction = { refreshGeneration++ },
            )
            result is CartResult.Success -> {
                val cart = (result as CartResult.Success).cart
                if (cart.lines.isEmpty()) {
                    CartMessage(message = "Your cart is empty.", actionLabel = "Browse Mart", onAction = onBack)
                } else {
                    CartContent(
                        cart = cart,
                        busyItemId = busyItemId,
                        controlsEnabled = !loading && busyItemId == null,
                        errorMessage = errorMessage,
                        addresses = addresses,
                        selectedAddressId = localAddressId,
                        addressLoading = addressLoading,
                        quoteLoading = quoteLoading,
                        quoteError = quoteError ?: addressError,
                        onSelectAddress = { address ->
                            if (address.id != localAddressId) {
                                localAddressId = address.id
                                onAddressSelected(address.id)
                                quoteAddress(address.id)
                            }
                        },
                        onAddAddress = { addressSaveError = null; showingAddressForm = true },
                        onRetryQuote = { localAddressId?.let(::quoteAddress) },
                        onChangeQuantity = { line, quantity -> mutate(line) { repository.changeQuantity(line.id, quantity) } },
                        onRemove = { line -> mutate(line) { repository.removeItem(line.id) } },
                        onProceedToCheckout = { onProceedToCheckout(localAddressId) },
                    )
                }
            }
            else -> CartMessage("Your cart is ready to load.", "Try again") { refreshGeneration++ }
        }
    }
    if (showingAddressForm) {
        CheckoutAddressForm(
            repository = checkoutRepository,
            executor = executor,
            saving = savingAddress,
            saveError = addressSaveError,
            onDismiss = { if (!savingAddress) showingAddressForm = false },
            onSave = { input: CheckoutAddressInput ->
                if (savingAddress) return@CheckoutAddressForm
                savingAddress = true
                addressSaveError = null
                executor.execute {
                    val outcome = runCatching { checkoutRepository.createAddress(input) }
                    androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                        savingAddress = false
                        outcome.onSuccess { saved ->
                            addresses = addresses.filterNot { it.id == saved.id } + saved
                            localAddressId = saved.id
                            onAddressSelected(saved.id)
                            showingAddressForm = false
                            quoteAddress(saved.id)
                        }.onFailure { addressSaveError = it.message ?: "Could not save this address. Check the details and try again." }
                    }
                }
            },
        )
    }
}

@Composable
private fun CartContent(
    cart: CartSnapshot,
    busyItemId: String?,
    controlsEnabled: Boolean,
    errorMessage: String?,
    addresses: List<CheckoutAddress>,
    selectedAddressId: String?,
    addressLoading: Boolean,
    quoteLoading: Boolean,
    quoteError: String?,
    onSelectAddress: (CheckoutAddress) -> Unit,
    onAddAddress: () -> Unit,
    onRetryQuote: () -> Unit,
    onChangeQuantity: (CartLine, Int) -> Unit,
    onRemove: (CartLine) -> Unit,
    onProceedToCheckout: () -> Unit,
) {
    LazyColumn(
        Modifier.fillMaxSize().widthIn(max = 760.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (errorMessage != null) item { Text(errorMessage, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
        item {
            CartDeliveryAddressPicker(
                addresses = addresses,
                selectedAddressId = selectedAddressId,
                loading = addressLoading,
                enabled = !quoteLoading,
                onSelect = onSelectAddress,
                onAddAddress = onAddAddress,
            )
        }
        if (quoteError != null) item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(quoteError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                Button(onClick = onRetryQuote, enabled = !quoteLoading) { Text("Retry delivery quote") }
            }
        }
        if (quoteLoading) item { Text("Updating delivery and total…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(cart.lines, key = CartLine::id) { line ->
            CartLineCard(
                line = line,
                busy = busyItemId == line.id,
                controlsEnabled = controlsEnabled,
                onDecrease = { onChangeQuantity(line, line.quantity - 1) },
                onIncrease = { onChangeQuantity(line, line.quantity + 1) },
                onRemove = { onRemove(line) },
            )
        }
        items(cart.sellerGroups, key = CartSellerSummary::storeId) { group -> CartSellerShippingSummary(group) }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                CartOrderSummary(cart)
                CartPurchaseTerms()
                Button(
                    onClick = onProceedToCheckout,
                    enabled = selectedAddressId != null && cart.payableGroupCount > 0 && !quoteLoading && quoteError == null,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Continue to checkout") }
            }
        }
    }
}

@Composable
private fun CartLineCard(
    line: CartLine,
    busy: Boolean,
    controlsEnabled: Boolean,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
    onRemove: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AsyncImage(
                model = line.imageUrl,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(line.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (line.variant != null) Text(line.variant, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (line.storeName.isNotBlank()) Text(line.storeName, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    "Unit price · ${formatWalletAmount(WalletMoney(line.unitAmountMinor, line.currency))}",
                    style = MaterialTheme.typography.labelMedium,
                )
                val subtotalMinor = line.unitAmountMinor.takeIf { it <= Long.MAX_VALUE / line.quantity }
                    ?.times(line.quantity.toLong())
                if (subtotalMinor != null) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Line subtotal", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            formatWalletAmount(WalletMoney(subtotalMinor, line.currency)),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.semantics {
                                contentDescription = "Line subtotal ${formatWalletAmount(WalletMoney(subtotalMinor, line.currency))}"
                            },
                        )
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onDecrease,
                        enabled = controlsEnabled && line.quantity > 1,
                        modifier = Modifier.semantics { contentDescription = "Decrease ${line.name} quantity" },
                    ) { Icon(Icons.Default.Remove, contentDescription = null) }
                    Text("${line.quantity}", Modifier.semantics { contentDescription = "Quantity ${line.quantity}" }, style = MaterialTheme.typography.bodyMedium)
                    IconButton(
                        onClick = onIncrease,
                        enabled = controlsEnabled && line.quantity < 99,
                        modifier = Modifier.semantics { contentDescription = "Increase ${line.name} quantity" },
                    ) { Icon(Icons.Default.Add, contentDescription = null) }
                }
            }
            IconButton(
                onClick = onRemove,
                enabled = controlsEnabled,
                modifier = Modifier.semantics { contentDescription = "Remove ${line.name} from cart" },
            ) { Icon(Icons.Default.DeleteOutline, contentDescription = null) }
            if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        }
    }
}

@Composable
private fun CartMessage(message: String, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(message, style = MaterialTheme.typography.bodyLarge)
        if (actionLabel != null && onAction != null) {
            Button(onClick = onAction, modifier = Modifier.padding(top = 12.dp)) { Text(actionLabel) }
        }
    }
}
