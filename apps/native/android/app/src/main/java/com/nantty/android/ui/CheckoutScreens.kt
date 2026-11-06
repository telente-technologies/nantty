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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CheckoutAddress
import com.nantty.android.data.CheckoutAddressInput
import com.nantty.android.data.CheckoutAddressesResult
import com.nantty.android.data.CheckoutCartResult
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.CheckoutPaymentMode
import com.nantty.android.data.CheckoutPaymentSelection
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.CheckoutPaymentMethod
import com.nantty.android.data.CheckoutProviderWallet
import com.nantty.android.data.SavedCardCredentialStore
import com.nantty.android.data.DeviceSavedCard
import com.nantty.android.data.ProviderWalletLoadResult
import com.nantty.android.data.ProviderWalletPaymentRepository
import com.nantty.android.data.PlaceCheckoutResult
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.util.UUID
import java.util.concurrent.Executor

@Composable
internal fun CheckoutScreen(
    repository: CheckoutRepository,
    providerWalletRepository: ProviderWalletPaymentRepository,
    savedCardCredentialStore: SavedCardCredentialStore,
    executor: Executor,
    initialAddressId: String? = null,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onCheckoutCreated: (CheckoutReceipt) -> Unit,
) {
    var addresses by remember(repository) { mutableStateOf<List<CheckoutAddress>?>(null) }
    var selectedId by remember(repository) { mutableStateOf(initialAddressId) }
    var cart by remember(repository) { mutableStateOf<com.nantty.android.data.CartSnapshot?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var placing by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var showingAddressForm by remember(repository) { mutableStateOf(false) }
    var savingAddress by remember(repository) { mutableStateOf(false) }
    var addressSaveError by remember(repository) { mutableStateOf<String?>(null) }
    var generation by remember(repository) { mutableStateOf(0) }
    var checkoutKey by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    var paymentSelections by remember(repository) { mutableStateOf<Map<String, CheckoutPaymentSelection>>(emptyMap()) }
    var providerWallet by remember(providerWalletRepository) { mutableStateOf<CheckoutProviderWallet?>(null) }
    var savedCard by remember(savedCardCredentialStore) { mutableStateOf<DeviceSavedCard?>(null) }
    var saveCardOnDevice by rememberSaveable { mutableStateOf(false) }
    var paymentMethod by rememberSaveable { mutableStateOf(CheckoutPaymentMethod.HOSTED) }
    var paymentMethodChosen by rememberSaveable { mutableStateOf(false) }
    var confirmingDirectStoreId by remember(repository) { mutableStateOf<String?>(null) }
    var directConfirmationInput by remember(repository) { mutableStateOf("") }
    val addressId = selectedId ?: addresses?.firstOrNull(CheckoutAddress::isDefault)?.id ?: addresses?.firstOrNull()?.id

    BackHandler(onBack = onBack)
    LaunchedEffect(repository, providerWalletRepository, savedCardCredentialStore, generation, addressId) {
        loading = true
        error = null
        executor.execute {
            val addressResult = if (addresses == null || generation > 0) repository.loadAddresses() else CheckoutAddressesResult.Success(addresses.orEmpty())
            val rows = (addressResult as? CheckoutAddressesResult.Success)?.addresses
            val selected = selectedId?.takeIf { candidate -> rows?.any { it.id == candidate } == true }
                ?: addressId?.takeIf { candidate -> rows?.any { it.id == candidate } == true }
                ?: rows?.firstOrNull(CheckoutAddress::isDefault)?.id
                ?: rows?.firstOrNull()?.id
            val cartResult = if (selected != null) repository.quoteCart(selected) else null
            val providerWalletResult = providerWalletRepository.loadWallet()
            val loadedWallet = (providerWalletResult as? ProviderWalletLoadResult.Success)?.wallet
            val loadedSavedCard = runCatching(savedCardCredentialStore::readDisplay).getOrNull()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                savedCard = loadedSavedCard
                when (providerWalletResult) {
                    is ProviderWalletLoadResult.Success -> providerWallet = loadedWallet
                    is ProviderWalletLoadResult.Failure -> {
                        providerWallet = null
                        if (providerWalletResult.authenticationRequired) onAuthenticationRequired()
                    }
                }
                when (addressResult) {
                    is CheckoutAddressesResult.Failure -> {
                        error = addressResult.message
                        if (addressResult.authenticationRequired) onAuthenticationRequired()
                    }
                    is CheckoutAddressesResult.Success -> {
                        addresses = rows.orEmpty()
                        if (selectedId != selected) selectedId = selected
                        when (cartResult) {
                            is CheckoutCartResult.Success -> cart = cartResult.cart
                            is CheckoutCartResult.Failure -> {
                                error = cartResult.message
                                if (cartResult.authenticationRequired) onAuthenticationRequired()
                            }
                            null -> cart = null
                        }
                    }
                }
                val walletCanCover = (cartResult as? CheckoutCartResult.Success)?.cart?.let { currentCart ->
                    loadedWallet?.let { wallet ->
                        wallet.status == "active" && wallet.currency == currentCart.currency && wallet.spendableMinor >= currentCart.totalAmountMinor && currentCart.totalAmountMinor > 0
                    }
                } == true
                if (!paymentMethodChosen) {
                    paymentMethod = when {
                        loadedSavedCard != null -> CheckoutPaymentMethod.SAVED_CARD
                        else -> CheckoutPaymentMethod.HOSTED
                    }
                } else if (!walletCanCover && paymentMethod == CheckoutPaymentMethod.PROVIDER_WALLET) {
                    paymentMethod = CheckoutPaymentMethod.HOSTED
                }
                loading = false
            }
        }
    }

    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to cart" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text("Checkout", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { generation++ }, enabled = !loading, modifier = Modifier.semantics { contentDescription = "Refresh checkout" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        when {
            loading && addresses == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading checkout" })
            }
            else -> LazyColumn(
                Modifier.fillMaxSize().widthIn(max = 760.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (error != null) item { Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
                item { Text("Delivery address", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold) }
                if (addresses.isNullOrEmpty()) {
                    item {
                        CheckoutInfoCard(
                            title = "Add a delivery address to continue",
                            body = "Add a delivery address so Nantty can calculate delivery and show your server-calculated total.",
                        )
                    }
                    item {
                        Button(onClick = { addressSaveError = null; showingAddressForm = true }, enabled = !loading) {
                            Text("Add delivery address")
                        }
                    }
                } else {
                    items(addresses.orEmpty(), key = CheckoutAddress::id) { address ->
                        Card(
                            onClick = { if (selectedId != address.id) { selectedId = address.id; cart = null; generation++ } },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                        ) {
                            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                RadioButton(selected = address.id == addressId, onClick = null)
                                Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                    Text(address.fullName + if (address.isDefault) " · Default" else "", fontWeight = FontWeight.Medium)
                                    Text(listOf(address.line1, address.line2, address.city, address.state, address.country).filter(String::isNotBlank).joinToString(", "), style = MaterialTheme.typography.bodyMedium)
                                    Text(address.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    item {
                        OutlinedButton(onClick = { addressSaveError = null; showingAddressForm = true }, enabled = !loading) {
                            Text("Add another address")
                        }
                    }
                }
                item { Text("Order summary", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold) }
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Server-calculated total", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            cart?.itemsTotal?.let { CheckoutAmountRow("Items", it) }
                            cart?.discounts?.takeIf { it.amountMinor > 0L }?.let { CheckoutAmountRow("Discounts", it, negative = true) }
                            cart?.storeCredit?.takeIf { it.amountMinor > 0L }?.let { CheckoutAmountRow("Store credit", it, negative = true) }
                            cart?.shipping?.let { CheckoutAmountRow("Delivery", it) }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Total due", fontWeight = FontWeight.Bold)
                                Text(
                                    cart?.let { formatWalletAmount(WalletMoney(it.totalAmountMinor, it.currency)) }
                                        ?: if (loading) "Updating…" else "Select an address",
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                }
                item {
                    CheckoutPaymentMethodOptions(
                        wallet = providerWallet,
                        savedCard = savedCard,
                        total = cart?.let { WalletMoney(it.totalAmountMinor, it.currency) },
                        selected = paymentMethod,
                        saveCardOnDevice = saveCardOnDevice,
                        onSaveCardOnDeviceChange = { saveCardOnDevice = it },
                        onRemoveSavedCard = {
                            runCatching(savedCardCredentialStore::remove).onSuccess {
                                savedCard = null
                                if (paymentMethod == CheckoutPaymentMethod.SAVED_CARD) {
                                    paymentMethod = CheckoutPaymentMethod.HOSTED
                                    paymentMethodChosen = true
                                }
                            }.onFailure { error = "Couldn't remove the saved card from this device." }
                        },
                        onSelect = { paymentMethod = it; paymentMethodChosen = true },
                    )
                }
                item {
                    val sellerGroups = cart?.sellerGroups.orEmpty()
                    if (sellerGroups.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Payment protection", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                            sellerGroups.forEach { group ->
                                CheckoutSellerPaymentOptions(
                                    storeName = group.storeName,
                                    verified = group.verified,
                                    selection = paymentSelections[group.storeId]
                                        ?: CheckoutPaymentSelection(CheckoutPaymentMode.ESCROW),
                                    confirmingDirect = confirmingDirectStoreId == group.storeId,
                                    confirmationInput = if (confirmingDirectStoreId == group.storeId) directConfirmationInput else "",
                                    onSelectEscrow = {
                                        paymentSelections = paymentSelections + (group.storeId to CheckoutPaymentSelection(CheckoutPaymentMode.ESCROW))
                                        confirmingDirectStoreId = null
                                        directConfirmationInput = ""
                                        checkoutKey = UUID.randomUUID().toString()
                                    },
                                    onRequestDirect = {
                                        confirmingDirectStoreId = group.storeId
                                        directConfirmationInput = ""
                                    },
                                    onConfirmationInput = { value ->
                                        directConfirmationInput = value
                                        if (value.trim().uppercase() == "DIRECT") {
                                            paymentSelections = paymentSelections + (
                                                group.storeId to CheckoutPaymentSelection(
                                                    mode = CheckoutPaymentMode.DIRECT,
                                                    directConfirmed = true,
                                                )
                                            )
                                            confirmingDirectStoreId = null
                                            directConfirmationInput = ""
                                            checkoutKey = UUID.randomUUID().toString()
                                        }
                                    },
                                )
                            }
                        }
                    }
                }
                item {
                    CheckoutInfoCard(
                        title = "Protected payment",
                        body = "Escrow remains the default. For a verified store, direct payment is optional and removes escrow protection. Payment is not confirmed until Nantty verifies it.",
                    )
                }
                item {
                    Button(
                        onClick = {
                            val chosen = addressId ?: return@Button
                            val currentCart = cart ?: return@Button
                            if (placing || currentCart.lines.isEmpty()) return@Button
                            val sellerGroups = currentCart.sellerGroups
                            val selections = paymentSelections
                            val idempotencyKey = checkoutKey
                            placing = true
                            error = null
                            executor.execute {
                                when (val result = repository.placeOrder(
                                    chosen,
                                    idempotencyKey,
                                    sellerGroups,
                                    selections,
                                )) {
                                    is PlaceCheckoutResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        placing = false
                        onCheckoutCreated(
                            result.receipt.copy(
                                paymentMethod = paymentMethod,
                                saveCardOnDevice = paymentMethod == CheckoutPaymentMethod.HOSTED && saveCardOnDevice,
                            ),
                        )
                                    }
                                    is PlaceCheckoutResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        placing = false
                                        error = result.message
                                        if (result.authenticationRequired) onAuthenticationRequired()
                                    }
                                }
                            }
                        },
                        enabled = !placing && !loading && addressId != null && cart?.lines?.isNotEmpty() == true && cart?.payableGroupCount?.let { it > 0 } == true,
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    ) {
                        if (placing) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        else Text("Continue to secure payment")
                    }
                }
            }
        }
    }
    if (showingAddressForm) {
        CheckoutAddressForm(
            repository = repository,
            executor = executor,
            saving = savingAddress,
            saveError = addressSaveError,
            onDismiss = { if (!savingAddress) showingAddressForm = false },
            onSave = { input: CheckoutAddressInput ->
                if (savingAddress) return@CheckoutAddressForm
                savingAddress = true
                addressSaveError = null
                executor.execute {
                    val outcome = runCatching { repository.createAddress(input) }
                    androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                        savingAddress = false
                        outcome.onSuccess { saved ->
                            addresses = (addresses.orEmpty().filterNot { it.id == saved.id } + saved)
                            selectedId = saved.id
                            cart = null
                            showingAddressForm = false
                            generation++
                        }.onFailure { addressSaveError = it.message ?: "Could not save this address. Check the details and try again." }
                    }
                }
            },
        )
    }
}

@Composable
private fun CheckoutSellerPaymentOptions(
    storeName: String,
    verified: Boolean,
    selection: CheckoutPaymentSelection,
    confirmingDirect: Boolean,
    confirmationInput: String,
    onSelectEscrow: () -> Unit,
    onRequestDirect: () -> Unit,
    onConfirmationInput: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(storeName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        if (!verified) {
            Text(
                "Escrow: locked in your own wallet until delivery",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            return@Column
        }
        Card(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onSelectEscrow),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        ) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                RadioButton(
                    selected = selection.mode == CheckoutPaymentMode.ESCROW,
                    onClick = onSelectEscrow,
                    modifier = Modifier.semantics { contentDescription = "Escrow protection for $storeName" },
                )
                Column(Modifier.padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("Escrow protection (recommended)", fontWeight = FontWeight.Medium)
                    Text("Money is held until you confirm delivery.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Card(
            modifier = Modifier.fillMaxWidth().clickable(
                enabled = selection.mode != CheckoutPaymentMode.DIRECT && !confirmingDirect,
                onClick = onRequestDirect,
            ),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        ) {
            Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(
                        selected = selection.mode == CheckoutPaymentMode.DIRECT,
                        onClick = if (selection.mode == CheckoutPaymentMode.DIRECT) null else onRequestDirect,
                        modifier = Modifier.semantics { contentDescription = "Pay $storeName directly" },
                    )
                    Column(Modifier.padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("Pay directly", fontWeight = FontWeight.Medium)
                        Text("The seller is paid right away.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (selection.mode == CheckoutPaymentMode.DIRECT || confirmingDirect) {
                    Text(
                        "You lose escrow protection. Refunds and disputes depend on the seller, and Nantty cannot hold or reverse this payment.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                if (confirmingDirect) {
                    Text(
                        "Type DIRECT to confirm paying $storeName directly.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                    OutlinedTextField(
                        value = confirmationInput,
                        onValueChange = onConfirmationInput,
                        label = { Text("Type DIRECT") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false),
                        modifier = Modifier.fillMaxWidth().semantics {
                            contentDescription = "Type DIRECT to confirm paying $storeName directly"
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun CheckoutAmountRow(label: String, amount: WalletMoney, negative: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            (if (negative) "−" else "") + formatWalletAmount(amount),
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
private fun CheckoutInfoCard(title: String, body: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
