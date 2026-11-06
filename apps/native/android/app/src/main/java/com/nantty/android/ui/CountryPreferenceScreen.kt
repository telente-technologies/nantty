package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CountryPreferenceRepository
import com.nantty.android.data.CountryPreferenceResult
import com.nantty.android.data.CountryPreferenceUpdateResult
import com.nantty.android.data.SupportedCountry
import com.nantty.android.data.ViewerLocalePreference
import java.util.concurrent.Executor

private sealed interface CountryPreferenceUiState {
    data object Loading : CountryPreferenceUiState
    data class Loaded(val countries: List<SupportedCountry>, val current: ViewerLocalePreference) : CountryPreferenceUiState
    data class Failed(val message: String, val authenticationRequired: Boolean) : CountryPreferenceUiState
}

@Composable
internal fun CountryPreferenceScreen(
    repository: CountryPreferenceRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onSaved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var state by remember(repository) { mutableStateOf<CountryPreferenceUiState>(CountryPreferenceUiState.Loading) }
    var reload by remember(repository) { mutableIntStateOf(0) }
    var savingCountry by remember(repository) { mutableStateOf<String?>(null) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    BackHandler(onBack = onBack)

    LaunchedEffect(repository, reload) {
        state = CountryPreferenceUiState.Loading
        executor.execute {
            val result = repository.load()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                state = when (result) {
                    is CountryPreferenceResult.Success -> CountryPreferenceUiState.Loaded(result.countries, result.current)
                    is CountryPreferenceResult.Failure -> CountryPreferenceUiState.Failed(result.message, result.authenticationRequired)
                }
                if (result is CountryPreferenceResult.Failure && result.authenticationRequired) onReauthenticate()
            }
        }
    }

    Column(modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OutlinedButton(onClick = onBack) { Text("Back") }
        Text("Country & currency", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        Text(
            "Prices are shown in your country's currency. If your country isn't listed, prices show in US dollars.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        when (val current = state) {
            CountryPreferenceUiState.Loading -> CircularProgressIndicator()
            is CountryPreferenceUiState.Failed -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(current.message, color = MaterialTheme.colorScheme.error)
                OutlinedButton(onClick = { reload++ }) { Text("Try again") }
            }
            is CountryPreferenceUiState.Loaded -> {
                if (!current.current.isCountrySupported) {
                    Text("Your current country is not supported. Prices may be shown in US dollars.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(current.countries, key = SupportedCountry::countryCode) { country ->
                        val selected = country.countryCode == current.current.countryCode
                        Card(Modifier.fillMaxWidth()) {
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(selected = selected, onClick = { saveCountry(country, repository, executor, { savingCountry = it }, { error = it }, onReauthenticate, onSaved) })
                                Column(Modifier.weight(1f)) {
                                    Text(country.countryName, style = MaterialTheme.typography.bodyLarge)
                                    Text("${country.currencyName} (${country.currency})", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                if (savingCountry == country.countryCode) CircularProgressIndicator()
                                else if (!selected) Button(onClick = {
                                    saveCountry(country, repository, executor, { savingCountry = it }, { error = it }, onReauthenticate, onSaved)
                                }) { Text("Use") }
                                else Text("Current", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun saveCountry(
    country: SupportedCountry,
    repository: CountryPreferenceRepository,
    executor: Executor,
    setSaving: (String?) -> Unit,
    setError: (String?) -> Unit,
    onReauthenticate: () -> Unit,
    onSaved: () -> Unit,
) {
    setSaving(country.countryCode)
    setError(null)
    executor.execute {
        val result = repository.updateCountryPreference(country.countryCode)
        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
            setSaving(null)
            when (result) {
                CountryPreferenceUpdateResult.Success -> onSaved()
                is CountryPreferenceUpdateResult.Failure -> {
                    setError(result.message)
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
        }
    }
}
