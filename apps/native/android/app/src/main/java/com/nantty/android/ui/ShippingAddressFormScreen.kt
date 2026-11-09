package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CheckoutGeoArea
import com.nantty.android.data.CheckoutGeoCountry
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.SavedShippingAddress
import com.nantty.android.data.SavedShippingAddressInput
import com.nantty.android.data.ShippingAddressResult
import com.nantty.android.data.ShippingAddressesRepository
import java.util.concurrent.Executor

@Composable
internal fun ShippingAddressFormScreen(
    repository: ShippingAddressesRepository,
    geoCatalogue: CheckoutRepository,
    executor: Executor,
    initialAddress: SavedShippingAddress?,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onSaved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var countries by remember(geoCatalogue) { mutableStateOf<List<CheckoutGeoCountry>>(emptyList()) }
    var regions by remember(geoCatalogue) { mutableStateOf<List<CheckoutGeoArea>>(emptyList()) }
    var adminAreas by remember(geoCatalogue) { mutableStateOf<List<CheckoutGeoArea>>(emptyList()) }
    var cities by remember(geoCatalogue) { mutableStateOf<List<CheckoutGeoArea>>(emptyList()) }
    var countryId by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.countryId.orEmpty()) }
    var stateId by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.stateId.orEmpty()) }
    var lgaId by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.lgaId.orEmpty()) }
    var cityId by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.cityId.orEmpty()) }
    var fullName by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.fullName.orEmpty()) }
    var phone by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.phone.orEmpty()) }
    var line1 by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.line1.orEmpty()) }
    var postalCode by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.postalCode.orEmpty()) }
    var details by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.details.orEmpty()) }
    var isDefault by rememberSaveable(initialAddress?.id) { mutableStateOf(initialAddress?.isDefault ?: false) }
    var loadingCountries by remember(geoCatalogue) { mutableStateOf(true) }
    var locationError by remember(geoCatalogue) { mutableStateOf<String?>(null) }
    var formError by remember(repository, initialAddress?.id) { mutableStateOf<String?>(null) }
    var saving by remember(repository, initialAddress?.id) { mutableStateOf(false) }
    val country = countries.firstOrNull { it.id == countryId }
    val needsState = country?.levels?.contains("state") == true
    val needsLga = country?.levels?.contains("lga") == true
    val needsCity = country?.levels?.contains("city") == true
    val normalizedPhone = phone.trim().filterNot { it in " -()." }
    val canSave = !loadingCountries && country != null && fullName.trim().length in 2..80 &&
        normalizedPhone.matches(Regex("^\\+[1-9][0-9]{7,14}$")) && line1.trim().length in 3..160 &&
        (!needsState || stateId.isNotBlank()) && (!needsLga || lgaId.isNotBlank()) && (!needsCity || cityId.isNotBlank())
    BackHandler(onBack = onBack)

    LaunchedEffect(geoCatalogue) {
        executor.execute {
            val result = runCatching { geoCatalogue.loadGeoCountries() }
            Snapshot.withMutableSnapshot {
                result.onSuccess { countries = it }.onFailure { locationError = it.message ?: "Could not load delivery countries." }
                loadingCountries = false
            }
        }
    }
    LaunchedEffect(geoCatalogue, countryId, needsState) {
        regions = emptyList()
        if (countryId.isNotBlank() && needsState) {
            val requestedId = countryId
            executor.execute {
                val result = runCatching { geoCatalogue.loadGeoAreas("/api/v1/geo/countries/$requestedId/regions") }
                Snapshot.withMutableSnapshot {
                    if (countryId == requestedId) result.onSuccess { regions = it }.onFailure { locationError = it.message ?: "Could not load regions." }
                }
            }
        }
    }
    LaunchedEffect(geoCatalogue, stateId, needsLga) {
        adminAreas = emptyList()
        if (stateId.isNotBlank() && needsLga) {
            val requestedId = stateId
            executor.execute {
                val result = runCatching { geoCatalogue.loadGeoAreas("/api/v1/geo/regions/$requestedId/admin-areas") }
                Snapshot.withMutableSnapshot {
                    if (stateId == requestedId) result.onSuccess { adminAreas = it }.onFailure { locationError = it.message ?: "Could not load areas." }
                }
            }
        }
    }
    LaunchedEffect(geoCatalogue, stateId, lgaId, needsCity, needsLga) {
        cities = emptyList()
        val parentId = if (needsLga) lgaId else stateId
        if (parentId.isNotBlank() && needsCity) {
            val path = if (needsLga) "/api/v1/geo/admin-areas/$parentId/cities" else "/api/v1/geo/regions/$parentId/cities"
            executor.execute {
                val result = runCatching { geoCatalogue.loadGeoAreas(path) }
                Snapshot.withMutableSnapshot {
                    if ((if (needsLga) lgaId else stateId) == parentId) result.onSuccess { cities = it }
                        .onFailure { locationError = it.message ?: "Could not load cities." }
                }
            }
        }
    }

    Column(modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp)) {
        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().align(Alignment.CenterHorizontally).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            OutlinedButton(onClick = onBack) { Text("Back") }
            Text(
                if (initialAddress == null) "New address" else "Edit address",
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            if (loadingCountries) CircularProgressIndicator()
            locationError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            ShippingAddressGeoPicker(
                label = "Country",
                selectedId = countryId,
                options = countries.map { it.id to it.name },
                enabled = !loadingCountries,
                onSelect = { countryId = it; stateId = ""; lgaId = ""; cityId = ""; locationError = null },
            )
            if (needsState) ShippingAddressGeoPicker(
                label = country?.stateLabel?.ifBlank { "State / region" } ?: "State / region",
                selectedId = stateId,
                options = regions.asAddressOptions(),
                enabled = countryId.isNotBlank(),
                onSelect = { stateId = it; lgaId = ""; cityId = ""; locationError = null },
            )
            if (needsLga) ShippingAddressGeoPicker(
                label = country?.lgaLabel?.ifBlank { "Local area" } ?: "Local area",
                selectedId = lgaId,
                options = adminAreas.asAddressOptions(),
                enabled = stateId.isNotBlank(),
                onSelect = { lgaId = it; cityId = ""; locationError = null },
            )
            if (needsCity) ShippingAddressGeoPicker(
                label = "City / town",
                selectedId = cityId,
                options = cities.asAddressOptions(),
                enabled = (if (needsLga) lgaId else stateId).isNotBlank(),
                onSelect = { cityId = it; locationError = null },
            )
            AddressTextField("Recipient name", fullName, { fullName = it.take(80) }, "Enter full name")
            AddressTextField("Phone number", phone, { phone = it.take(40) }, "Include country code, e.g. +234…")
            AddressTextField("Street address", line1, { line1 = it.take(160) }, "House number and street")
            AddressTextField("Postal code (optional)", postalCode, { postalCode = it.take(12) }, "Postal code")
            OutlinedTextField(
                value = details,
                onValueChange = { details = it.take(300) },
                label = { Text("Delivery details (optional)") },
                placeholder = { Text("Landmark, gate code, floor") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )
            Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = MaterialTheme.shapes.medium) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Default.PushPin, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.weight(1f)) {
                        Text("Use as default address", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text("Use this address for delivery by default.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = isDefault, onCheckedChange = { isDefault = it }, modifier = Modifier.semantics { contentDescription = "Use as default address" })
                }
            }
            formError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            Button(
                onClick = {
                    if (saving) return@Button
                    saving = true
                    formError = null
                    val input = SavedShippingAddressInput(fullName, phone, line1, postalCode, details, isDefault, countryId, stateId.takeIf { needsState }, lgaId.takeIf { needsLga }, cityId.takeIf { needsCity })
                    executor.execute {
                        val result = if (initialAddress == null) repository.create(input) else repository.update(initialAddress.id, input)
                        Snapshot.withMutableSnapshot {
                            saving = false
                            when (result) {
                                is ShippingAddressResult.Success -> onSaved()
                                is ShippingAddressResult.Failure -> {
                                    formError = result.message
                                    if (result.authenticationRequired) onReauthenticate()
                                }
                            }
                        }
                    }
                },
                enabled = canSave && !saving,
                modifier = Modifier.fillMaxWidth().testTag("saveShippingAddress"),
            ) {
                if (saving) CircularProgressIndicator() else Text("Save address")
            }
        }
    }
}

@Composable
private fun AddressTextField(label: String, value: String, onValueChange: (String) -> Unit, placeholder: String) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = { Text(placeholder) },
        singleLine = label != "Delivery details (optional)",
        modifier = Modifier.fillMaxWidth(),
    )
}
