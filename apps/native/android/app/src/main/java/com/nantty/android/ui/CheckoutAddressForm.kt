package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CheckoutAddressInput
import com.nantty.android.data.CheckoutGeoArea
import com.nantty.android.data.CheckoutGeoCountry
import com.nantty.android.data.CheckoutRepository
import java.util.concurrent.Executor

@Composable
internal fun CheckoutAddressForm(
    repository: CheckoutRepository,
    executor: Executor,
    saving: Boolean,
    saveError: String?,
    onDismiss: () -> Unit,
    onSave: (CheckoutAddressInput) -> Unit,
) {
    var countries by remember(repository) { mutableStateOf<List<CheckoutGeoCountry>>(emptyList()) }
    var regions by remember(repository) { mutableStateOf<List<CheckoutGeoArea>>(emptyList()) }
    var adminAreas by remember(repository) { mutableStateOf<List<CheckoutGeoArea>>(emptyList()) }
    var cities by remember(repository) { mutableStateOf<List<CheckoutGeoArea>>(emptyList()) }
    var countryId by rememberSaveable(repository) { mutableStateOf("") }
    var stateId by rememberSaveable(repository) { mutableStateOf("") }
    var lgaId by rememberSaveable(repository) { mutableStateOf("") }
    var cityId by rememberSaveable(repository) { mutableStateOf("") }
    var fullName by rememberSaveable(repository) { mutableStateOf("") }
    var phone by rememberSaveable(repository) { mutableStateOf("") }
    var line1 by rememberSaveable(repository) { mutableStateOf("") }
    var postalCode by rememberSaveable(repository) { mutableStateOf("") }
    var details by rememberSaveable(repository) { mutableStateOf("") }
    var freeState by rememberSaveable(repository) { mutableStateOf("") }
    var freeCity by rememberSaveable(repository) { mutableStateOf("") }
    var countryLoading by remember(repository) { mutableStateOf(true) }
    var locationLoading by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var openPicker by rememberSaveable { mutableStateOf<String?>(null) }
    val country = countries.firstOrNull { it.id == countryId }
    val hasState = country?.levels?.contains("state") == true
    val hasLga = country?.levels?.contains("lga") == true
    val hasCity = country?.levels?.contains("city") == true && hasState
    val normalizedPhone = phone.trim().filterNot { it in " -()." }
    val canSave = fullName.trim().length >= 2 && normalizedPhone.matches(Regex("\\+[1-9][0-9]{7,14}")) &&
        line1.trim().length >= 3 && countryId.isNotBlank() && (!hasState || stateId.isNotBlank()) &&
        (!hasLga || lgaId.isNotBlank()) && (!hasCity || cityId.isNotBlank())

    LaunchedEffect(repository) {
        executor.execute {
            val result = runCatching { repository.loadGeoCountries() }
            Snapshot.withMutableSnapshot {
                result.onSuccess { countries = it }.onFailure { error = it.message ?: "Could not load delivery countries." }
                countryLoading = false
            }
        }
    }
    LaunchedEffect(repository, countryId, hasState) {
        regions = emptyList(); adminAreas = emptyList(); cities = emptyList()
        stateId = ""; lgaId = ""; cityId = ""
        if (countryId.isNotBlank() && hasState) {
            locationLoading = true
            val requestedCountryId = countryId
            executor.execute {
                val result = runCatching { repository.loadGeoAreas("/api/v1/geo/countries/$requestedCountryId/regions") }
                Snapshot.withMutableSnapshot {
                    if (countryId == requestedCountryId) {
                        result.onSuccess { regions = it }.onFailure { error = it.message ?: "Could not load regions." }
                        locationLoading = false
                    }
                }
            }
        }
    }
    LaunchedEffect(repository, stateId, hasLga) {
        adminAreas = emptyList(); cities = emptyList(); lgaId = ""; cityId = ""
        if (stateId.isNotBlank() && hasLga) {
            locationLoading = true
            val requestedStateId = stateId
            executor.execute {
                val result = runCatching { repository.loadGeoAreas("/api/v1/geo/regions/$requestedStateId/admin-areas") }
                Snapshot.withMutableSnapshot {
                    if (stateId == requestedStateId) {
                        result.onSuccess { adminAreas = it }.onFailure { error = it.message ?: "Could not load delivery areas." }
                        locationLoading = false
                    }
                }
            }
        }
    }
    LaunchedEffect(repository, stateId, lgaId, hasCity, hasLga) {
        cities = emptyList(); cityId = ""
        val parentId = if (hasLga) lgaId else stateId
        if (parentId.isNotBlank() && hasCity) {
            locationLoading = true
            val path = if (hasLga) "/api/v1/geo/admin-areas/$parentId/cities" else "/api/v1/geo/regions/$parentId/cities"
            executor.execute {
                val result = runCatching { repository.loadGeoAreas(path) }
                Snapshot.withMutableSnapshot {
                    if ((if (hasLga) lgaId else stateId) == parentId) {
                        result.onSuccess { cities = it }.onFailure { error = it.message ?: "Could not load cities." }
                        locationLoading = false
                    }
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add delivery address") },
        text = {
            Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
                LazyColumn(
                    Modifier.fillMaxWidth().heightIn(max = 560.dp),
                    contentPadding = PaddingValues(bottom = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            if (countryLoading) CircularProgressIndicator()
                            LocationPicker("Country", countries.firstOrNull { it.id == countryId }?.name ?: "Choose country", countries.map { it.id to it.name }, countryLoading, openPicker == "country", { openPicker = "country" }, { openPicker = null }) { selected ->
                                countryId = selected
                                freeState = ""
                                freeCity = ""
                            }
                            if (hasState) LocationPicker(country?.stateLabel?.ifBlank { "State" } ?: "State", regions.firstOrNull { it.id == stateId }?.name ?: "Choose state", regions.map { it.id to it.name }, countryId.isBlank() || locationLoading, openPicker == "state", { openPicker = "state" }, { openPicker = null }, { stateId = it })
                            else if (countryId.isNotBlank()) OutlinedTextField(freeState, { freeState = it.take(80) }, label = { Text("State / region (if applicable)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            if (hasLga) LocationPicker(country?.lgaLabel?.ifBlank { "Local area" } ?: "Local area", adminAreas.firstOrNull { it.id == lgaId }?.name ?: "Choose area", adminAreas.map { it.id to it.name }, stateId.isBlank() || locationLoading, openPicker == "area", { openPicker = "area" }, { openPicker = null }, { lgaId = it })
                            if (hasCity) LocationPicker("City / town", cities.firstOrNull { it.id == cityId }?.name ?: "Choose city", cities.map { it.id to it.name }, (if (hasLga) lgaId else stateId).isBlank() || locationLoading, openPicker == "city", { openPicker = "city" }, { openPicker = null }, { cityId = it })
                            else if (countryId.isNotBlank()) OutlinedTextField(freeCity, { freeCity = it.take(80) }, label = { Text("City / town") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            OutlinedTextField(fullName, { fullName = it.take(80) }, label = { Text("Recipient name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            OutlinedTextField(phone, { phone = it.take(40) }, label = { Text("Phone number (include country code)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            OutlinedTextField(line1, { line1 = it.take(160) }, label = { Text("Street address") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            OutlinedTextField(postalCode, { postalCode = it.take(12) }, label = { Text("Postal code (optional)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                            OutlinedTextField(details, { details = it.take(300) }, label = { Text("Delivery details (optional)") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                            (saveError ?: error)?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val input = CheckoutAddressInput(fullName, phone, line1, postalCode, details, countryId, stateId.takeIf { hasState }, lgaId.takeIf { hasLga }, cityId.takeIf { hasCity }, freeState, freeCity)
                onSave(input)
            }, enabled = canSave && !saving) {
                if (saving) CircularProgressIndicator()
                else Text("Save address")
            }
        },
        dismissButton = { OutlinedButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun LocationPicker(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    disabled: Boolean,
    expanded: Boolean,
    onOpen: () -> Unit,
    onDismiss: () -> Unit,
    onSelect: (String) -> Unit,
) {
    var search by rememberSaveable(label) { mutableStateOf("") }
    val visibleOptions = remember(options, search) {
        if (search.isBlank()) options else options.filter { it.second.contains(search.trim(), ignoreCase = true) }
    }
    androidx.compose.foundation.layout.Box {
        OutlinedButton(onClick = onOpen, enabled = !disabled, modifier = Modifier.fillMaxWidth()) {
            Text("$label: $value", modifier = Modifier.fillMaxWidth())
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { search = ""; onDismiss() }, modifier = Modifier.heightIn(max = 360.dp)) {
            Column(Modifier.widthIn(min = 240.dp, max = 360.dp)) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it.take(80) },
                    label = { Text("Search $label") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                )
                LazyColumn(Modifier.heightIn(max = 300.dp)) {
                    items(visibleOptions, key = { it.first }) { (id, name) ->
                        DropdownMenuItem(text = { Text(name) }, onClick = { search = ""; onSelect(id) })
                    }
                    if (visibleOptions.isEmpty()) item {
                        Text("No matching options", Modifier.padding(16.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}
