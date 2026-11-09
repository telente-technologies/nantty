package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SellerCatalogBrand
import com.nantty.android.data.SellerCatalogImage
import com.nantty.android.data.SellerCatalogLocation
import com.nantty.android.data.SellerCatalogOptionDraft
import com.nantty.android.data.SellerCatalogProduct
import com.nantty.android.data.SellerCatalogProductBrand
import com.nantty.android.data.SellerCatalogRepository
import com.nantty.android.data.SellerCatalogResult
import com.nantty.android.data.SellerCatalogUpsert
import com.nantty.android.data.sellerCatalogForm
import com.nantty.android.data.validateSellerCatalogForm
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

@Composable
internal fun SellerCatalogFormScreen(
    repository: SellerCatalogRepository,
    productId: String?,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onSaved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var product by remember(productId) { mutableStateOf<SellerCatalogProduct?>(null) }
    var images by remember(productId) { mutableStateOf(emptyList<SellerCatalogImage>()) }
    var form by remember(productId) { mutableStateOf(sellerCatalogForm(null)) }
    var brand by remember(productId) { mutableStateOf<SellerCatalogProductBrand?>(null) }
    var locations by remember { mutableStateOf<List<SellerCatalogLocation>>(emptyList()) }
    var loadError by remember(productId) { mutableStateOf<String?>(null) }
    var locationError by remember(productId) { mutableStateOf<String?>(null) }
    var brandError by remember { mutableStateOf<String?>(null) }
    var brands by remember { mutableStateOf<List<SellerCatalogBrand>>(emptyList()) }
    var brandSearch by rememberSaveable { mutableStateOf("") }
    var brandPickerOpen by rememberSaveable { mutableStateOf(false) }
    var loading by rememberSaveable(productId) { mutableStateOf(productId != null) }
    var loadingBrands by remember { mutableStateOf(false) }
    var saving by rememberSaveable { mutableStateOf(false) }
    var photosUploading by remember { mutableStateOf(false) }
    var archiving by rememberSaveable { mutableStateOf(false) }
    var showArchiveConfirmation by rememberSaveable { mutableStateOf(false) }
    var saveError by rememberSaveable { mutableStateOf<String?>(null) }
    var idempotencyKey by rememberSaveable(productId) { mutableStateOf(UUID.randomUUID().toString()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(repository, productId) {
        loading = productId != null
        loadError = null
        if (productId != null) {
            when (val result = withContext(Dispatchers.IO) { repository.loadProduct(productId) }) {
                is SellerCatalogResult.Success -> {
                    product = result.value
                    images = result.value.images
                    form = sellerCatalogForm(result.value)
                    brand = result.value.brand
                }
                is SellerCatalogResult.Failure -> {
                    loadError = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
            loading = false
        } else {
            product = null
            images = emptyList()
            form = sellerCatalogForm(null)
            brand = null
            idempotencyKey = UUID.randomUUID().toString()
        }
        if (productId == null) {
            when (val result = withContext(Dispatchers.IO) { repository.loadLocations() }) {
                is SellerCatalogResult.Success -> locations = result.value.filter(SellerCatalogLocation::active)
                is SellerCatalogResult.Failure -> {
                    locationError = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
        }
    }

    LaunchedEffect(repository, brandPickerOpen, brandSearch) {
        if (!brandPickerOpen) return@LaunchedEffect
        delay(250)
        loadingBrands = true
        when (val result = withContext(Dispatchers.IO) { repository.searchBrands(brandSearch) }) {
            is SellerCatalogResult.Success -> { brands = result.value; brandError = null }
            is SellerCatalogResult.Failure -> {
                brandError = result.message
                if (result.authenticationRequired) onAuthenticationRequired()
            }
        }
        loadingBrands = false
    }

    val defaultLocation = locations.firstOrNull(SellerCatalogLocation::isDefault) ?: locations.firstOrNull()
    val draft = SellerCatalogUpsert(form, product, images, brand, defaultLocation?.id, idempotencyKey)
    val validation = validateSellerCatalogForm(draft)

    if (loading) {
        Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
            CircularProgressIndicator()
            Text("Loading product…", Modifier.padding(top = 12.dp))
        }
        return
    }

    if (loadError != null && productId != null && product == null) {
        Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Product unavailable", style = MaterialTheme.typography.titleLarge)
            Text(loadError.orEmpty(), color = MaterialTheme.colorScheme.error)
            Button(onClick = onBack) { Text("Back to products") }
        }
        return
    }

    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            if (product == null) "New product" else "Edit product",
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        if (loadError != null) Text(loadError.orEmpty(), color = MaterialTheme.colorScheme.error)

        SellerCatalogPhotos(
            repository = repository,
            images = images,
            enabled = !saving && !archiving,
            onImagesChange = { images = it },
            onUploadingChange = { photosUploading = it },
            onAuthenticationRequired = onAuthenticationRequired,
        )

        OutlinedTextField(
            value = form.name,
            onValueChange = { form = form.copy(name = it.take(120)) },
            label = { Text("Product name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.description,
            onValueChange = { form = form.copy(description = it.take(5_000)) },
            label = { Text("Description") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.priceMajorText,
            onValueChange = { form = form.copy(priceMajorText = it.filter { char -> char.isDigit() || char == '.' }.take(18)) },
            label = { Text(product?.variants?.firstOrNull()?.currency?.let { "Price ($it)" } ?: "Price (store currency)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        if (product == null) {
            OutlinedTextField(
                value = form.stockText,
                onValueChange = { form = form.copy(stockText = it.filter(Char::isDigit).take(7)) },
                label = { Text("Opening stock") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                defaultLocation?.let { "Opening stock will be added to ${it.name.ifBlank { "your default store location" }}." }
                    ?: locationError ?: "Add an active store location before setting opening stock.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Text("Change stock from your seller inventory. Product edits keep current stock.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        SellerCatalogBrandSelector(
            selected = brand,
            query = brandSearch,
            open = brandPickerOpen,
            loading = loadingBrands,
            results = brands,
            error = brandError,
            onOpen = { brandPickerOpen = true },
            onClose = { brandPickerOpen = false },
            onQueryChange = { brandSearch = it },
            onRelationshipChange = { relationship -> brand = brand?.copy(relationship = relationship) },
            onSelect = { chosen ->
                brand = chosen?.let { selected ->
                    val relationship = product?.brand
                        ?.takeIf { existing -> existing.brandId == selected.id }
                        ?.relationship
                        ?: "genuine_resale"
                    SellerCatalogProductBrand(selected.id, selected.name, relationship)
                }
                brandPickerOpen = false
            },
        )

        SellerCatalogOptionsEditor(
            options = form.options,
            enabled = !saving,
            onOptionsChange = { form = form.copy(options = it) },
        )
        if (product != null && hasRemovedStockVariant(draft)) {
            Text(
                "A variant being removed still has stock. Set that variant to zero in inventory before saving.",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        validation?.let {
            Text(it, Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Assertive }, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        saveError?.let { Text(it, Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Assertive }, color = MaterialTheme.colorScheme.error) }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick = onBack, enabled = !saving && !archiving && !photosUploading) { Text("Cancel") }
            Button(
                enabled = validation == null && !saving && !archiving && !photosUploading && loadError == null,
                onClick = {
                    saving = true
                    saveError = null
                    scope.launch {
                        when (val result = withContext(Dispatchers.IO) { repository.save(draft) }) {
                            is SellerCatalogResult.Success -> onSaved()
                            is SellerCatalogResult.Failure -> {
                                saveError = result.message
                                if (result.authenticationRequired) onAuthenticationRequired()
                            }
                        }
                        saving = false
                    }
                },
            ) { Text(if (saving) "Saving…" else if (product == null) "Publish product" else "Save changes") }
        }
        if (product != null) {
            Spacer(Modifier.height(2.dp))
            OutlinedButton(onClick = { showArchiveConfirmation = true }, enabled = !saving && !archiving && !photosUploading) {
                Text(if (archiving) "Archiving…" else "Delete product")
            }
        }
    }

    if (showArchiveConfirmation && product != null) {
        AlertDialog(
            onDismissRequest = { showArchiveConfirmation = false },
            title = { Text("Delete product?") },
            text = { Text("Buyers will no longer see this product.") },
            confirmButton = {
                TextButton(onClick = {
                    showArchiveConfirmation = false
                    archiving = true
                    saveError = null
                    scope.launch {
                        when (val result = withContext(Dispatchers.IO) { repository.archive(product!!.id) }) {
                            is SellerCatalogResult.Success -> onSaved()
                            is SellerCatalogResult.Failure -> {
                                saveError = result.message
                                if (result.authenticationRequired) onAuthenticationRequired()
                            }
                        }
                        archiving = false
                    }
                }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { showArchiveConfirmation = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun SellerCatalogBrandSelector(
    selected: SellerCatalogProductBrand?,
    query: String,
    open: Boolean,
    loading: Boolean,
    results: List<SellerCatalogBrand>,
    error: String?,
    onOpen: () -> Unit,
    onClose: () -> Unit,
    onQueryChange: (String) -> Unit,
    onRelationshipChange: (String) -> Unit,
    onSelect: (SellerCatalogBrand?) -> Unit,
) {
    var relationshipMenuOpen by remember(selected?.brandId) { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Brand (optional)", style = MaterialTheme.typography.titleSmall)
        OutlinedButton(onClick = onOpen, modifier = Modifier.fillMaxWidth()) {
            Text(selected?.name ?: "Unbranded / my own design")
        }
        Text("Only tag a brand if the product is genuine.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (selected != null) {
            TextButton(onClick = { relationshipMenuOpen = true }) {
                Text("Relationship: ${selected.relationship.replace('_', ' ')}")
            }
            DropdownMenu(expanded = relationshipMenuOpen, onDismissRequest = { relationshipMenuOpen = false }) {
                listOf("own", "authorised_reseller", "genuine_resale").forEach { relationship ->
                    DropdownMenuItem(
                        text = { Text(relationship.replace('_', ' ')) },
                        onClick = { onRelationshipChange(relationship); relationshipMenuOpen = false },
                    )
                }
            }
        }
    }
    if (open) AlertDialog(
        onDismissRequest = onClose,
        title = { Text("Choose brand") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(query, onQueryChange, label = { Text("Search brands") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                if (loading) CircularProgressIndicator()
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (!loading && error == null) {
                    TextButton(onClick = { onSelect(null) }) { Text("Unbranded / my own design") }
                    androidx.compose.foundation.lazy.LazyColumn(modifier = Modifier.height(220.dp)) {
                        items(results.take(20), key = { it.id }) { brand ->
                            TextButton(onClick = { onSelect(brand) }, modifier = Modifier.fillMaxWidth()) { Text(brand.name, Modifier.fillMaxWidth()) }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onClose) { Text("Close") } },
    )
}

@Composable
private fun SellerCatalogOptionsEditor(
    options: List<SellerCatalogOptionDraft>,
    enabled: Boolean,
    onOptionsChange: (List<SellerCatalogOptionDraft>) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Options and variants", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text("Add sizes, colours, or other product options. Each combination becomes a variant.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        options.forEachIndexed { index, option ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = option.name,
                        onValueChange = { value -> onOptionsChange(options.mapIndexed { row, old -> if (row == index) old.copy(name = value.take(30)) else old }) },
                        label = { Text("Option ${index + 1} name") },
                        singleLine = true,
                        enabled = enabled,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { onOptionsChange(options.filterIndexed { row, _ -> row != index }) }, enabled = enabled) { Text("Remove") }
                }
                OutlinedTextField(
                    value = option.valuesText,
                    onValueChange = { value -> onOptionsChange(options.mapIndexed { row, old -> if (row == index) old.copy(valuesText = value.take(1_500)) else old }) },
                    label = { Text("Values separated by commas") },
                    placeholder = { Text("Small, Medium, Large") },
                    enabled = enabled,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        if (options.size < 3) {
            OutlinedButton(onClick = { onOptionsChange(options + SellerCatalogOptionDraft("", "")) }, enabled = enabled) {
                Text("Add option")
            }
        }
        val variantCount = options.fold(1L) { total, option -> total * option.values.size.coerceAtLeast(1) }
        Text("${variantCount.coerceAtMost(100_000)} variant combination${if (variantCount == 1L) "" else "s"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun hasRemovedStockVariant(input: SellerCatalogUpsert): Boolean {
    val product = input.product ?: return false
    val options = input.form.options.map { it.copy(name = it.name.trim()) }.filter { it.name.isNotEmpty() && it.values.isNotEmpty() }
    val combinations = buildList<Map<String, String>> {
        fun visit(index: Int, values: Map<String, String>) {
            if (index >= options.size) { add(values); return }
            val option = options[index]
            option.values.forEach { visit(index + 1, values + (option.name to it)) }
        }
        visit(0, emptyMap())
    }
    return product.variants.any { variant ->
        val kept = combinations.any { values -> options.all { option ->
            val oldValue = option.originalName?.let(variant.optionValues::get)
                ?: if (option.originalName == null) option.values.firstOrNull() else null
            values[option.name] == oldValue
        } }
        !kept && variant.stock.any { it.onHand != 0 }
    }
}
