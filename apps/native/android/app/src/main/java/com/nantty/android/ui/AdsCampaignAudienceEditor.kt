package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AdsCampaignAudience
import com.nantty.android.data.AdsCampaignLocation
import com.nantty.android.data.AdsCampaignRepository
import com.nantty.android.data.AdsCampaignResult
import com.nantty.android.data.AdsCampaignTopic
import java.util.concurrent.Executor
import kotlinx.coroutines.delay

@Composable
internal fun AdsCampaignAudienceEditor(
    repository: AdsCampaignRepository,
    executor: Executor,
    audience: AdsCampaignAudience,
    defaultCountryCode: String?,
    onChange: (AdsCampaignAudience) -> Unit,
) {
    var countrySearch by remember { mutableStateOf("") }
    var stateSearch by remember { mutableStateOf("") }
    var countries by remember { mutableStateOf<List<AdsCampaignLocation>?>(null) }
    var states by remember { mutableStateOf<List<AdsCampaignLocation>?>(null) }
    var topics by remember { mutableStateOf<List<AdsCampaignTopic>?>(null) }
    var locationError by remember { mutableStateOf<String?>(null) }
    var topicError by remember { mutableStateOf<String?>(null) }
    var loadingCountries by remember { mutableStateOf(false) }
    var loadingStates by remember { mutableStateOf(false) }
    var loadingTopics by remember { mutableStateOf(false) }

    LaunchedEffect(repository) {
        loadingCountries = true
        executor.execute {
            val result = repository.searchLocations("", "")
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AdsCampaignResult.Success -> { countries = result.value.filter { it.type == "country" }; locationError = null }
                    is AdsCampaignResult.Failure -> locationError = result.message
                }
                loadingCountries = false
            }
        }
    }
    LaunchedEffect(repository, audience.countryCode, stateSearch) {
        if (audience.countryCode.length != 2) {
            states = emptyList()
            loadingStates = false
            return@LaunchedEffect
        }
        delay(250)
        loadingStates = true
        executor.execute {
            val result = repository.searchLocations(stateSearch.trim(), audience.countryCode)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AdsCampaignResult.Success -> { states = result.value.filter { it.type == "state" || it.type == "region" }; locationError = null }
                    is AdsCampaignResult.Failure -> locationError = result.message
                }
                loadingStates = false
            }
        }
    }
    LaunchedEffect(repository) {
        loadingTopics = true
        executor.execute {
            val result = repository.loadTopics()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AdsCampaignResult.Success -> { topics = result.value; topicError = null }
                    is AdsCampaignResult.Failure -> topicError = result.message
                }
                loadingTopics = false
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Audience", style = MaterialTheme.typography.titleSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = audience.mode == "automatic", onClick = { onChange(AdsCampaignAudience()) }, label = { Text("Automatic") })
            FilterChip(selected = audience.mode == "custom", onClick = {
                onChange(audience.copy(
                    mode = "custom",
                    countryCode = audience.countryCode.takeIf { it.length == 2 } ?: defaultCountryCode.orEmpty(),
                ))
            }, label = { Text("Custom") })
        }
        if (audience.mode == "custom") {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Country", style = MaterialTheme.typography.labelLarge)
                    OutlinedTextField(countrySearch, { countrySearch = it.take(60) }, label = { Text("Find a country") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    if (loadingCountries) CircularProgressIndicator()
                    FilterOptions(
                        options = countries.orEmpty().filter { countrySearch.isBlank() || it.name.contains(countrySearch, true) || it.code.contains(countrySearch, true) },
                        selected = audience.countryCode,
                        label = AdsCampaignLocation::name,
                        key = AdsCampaignLocation::code,
                        onSelect = { code -> onChange(audience.copy(countryCode = code, states = emptyList())) },
                    )
                    locationError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    Text("States or regions", style = MaterialTheme.typography.labelLarge)
                    OutlinedTextField(stateSearch, { stateSearch = it.take(80) }, label = { Text("Search states or regions") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    if (loadingStates) CircularProgressIndicator()
                    FilterOptions(
                        options = states.orEmpty(),
                        selectedValues = audience.states.toSet(),
                        label = AdsCampaignLocation::name,
                        key = AdsCampaignLocation::code,
                        multiple = true,
                        onSelect = { code ->
                            val selected = audience.states
                            val next = if (code in selected) selected - code else if (selected.size < MAX_STATES) selected + code else selected
                            onChange(audience.copy(states = next))
                        },
                    )
                    Text(if (audience.states.isEmpty()) "Whole country" else "${audience.states.size} areas selected", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Age", style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        AGE_RANGES.forEach { (minimum, maximum) ->
                            FilterChip(
                                selected = audience.ageMin == minimum && audience.ageMax == maximum,
                                onClick = { onChange(audience.copy(ageMin = minimum, ageMax = maximum)) },
                                label = { Text(if (minimum == 18 && maximum == 65) "18–65" else "$minimum–$maximum") },
                            )
                        }
                    }
                    Text("Gender", style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        GENDERS.forEach { (value, title) ->
                            FilterChip(selected = audience.gender == value, onClick = { onChange(audience.copy(gender = value)) }, label = { Text(title) })
                        }
                    }
                    Text("Interests", style = MaterialTheme.typography.labelLarge)
                    if (loadingTopics) CircularProgressIndicator()
                    FilterOptions(
                        options = topics.orEmpty(),
                        selectedValues = audience.topicIds.toSet(),
                        label = AdsCampaignTopic::name,
                        key = AdsCampaignTopic::id,
                        multiple = true,
                        onSelect = { id ->
                            val selected = audience.topicIds
                            val next = if (id in selected) selected - id else if (selected.size < MAX_TOPICS) selected + id else selected
                            onChange(audience.copy(topicIds = next))
                        },
                    )
                    topicError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    Text("Choose up to $MAX_TOPICS interests.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun <T> FilterOptions(
    options: List<T>,
    selected: String? = null,
    selectedValues: Set<String> = emptySet(),
    label: (T) -> String,
    key: (T) -> String,
    multiple: Boolean = false,
    onSelect: (String) -> Unit,
) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        items(options, key = { key(it) }) { option ->
            val value = key(option)
            FilterChip(
                selected = if (multiple) value in selectedValues else selected == value,
                onClick = { onSelect(value) },
                label = { Text(label(option), maxLines = 1) },
            )
        }
    }
}

private val AGE_RANGES = listOf(18 to 65, 18 to 24, 25 to 34, 35 to 44, 45 to 65)
private val GENDERS = listOf("all" to "Everyone", "female" to "Women", "male" to "Men")
private const val MAX_STATES = 30
private const val MAX_TOPICS = 20
