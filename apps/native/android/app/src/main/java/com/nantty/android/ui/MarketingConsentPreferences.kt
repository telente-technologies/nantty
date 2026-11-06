package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.AccountMarketingSettings
import com.nantty.android.data.AccountMarketingSettingsResult
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.MarketingFrequency
import java.util.concurrent.Executor

@Composable
internal fun MarketingConsentPreferences(
    repository: AccountNotificationSettingsRepository,
    executor: Executor,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var settings by remember(repository) { mutableStateOf<AccountMarketingSettings?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var saving by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var reload by remember(repository) { mutableStateOf(0) }

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.loadMarketingSettings()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AccountMarketingSettingsResult.Success -> settings = result.settings
                    is AccountMarketingSettingsResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                loading = false
            }
        }
    }

    fun updateConsent(enabled: Boolean) {
        if (saving) return
        saving = true
        error = null
        executor.execute {
            val result = repository.updateMarketingConsent(enabled)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AccountMarketingSettingsResult.Success -> settings = result.settings
                    is AccountMarketingSettingsResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                saving = false
            }
        }
    }

    fun updateFrequency(frequency: MarketingFrequency) {
        if (saving) return
        saving = true
        error = null
        executor.execute {
            val result = repository.updateMarketingFrequency(frequency)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AccountMarketingSettingsResult.Success -> settings = result.settings
                    is AccountMarketingSettingsResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                saving = false
            }
        }
    }

    when {
        loading && settings == null -> CircularProgressIndicator(modifier.padding(16.dp))
        settings != null -> {
            val current = settings!!
            val consentToggleLabel = stringResource(R.string.marketing_consent_toggle)
            val selectedFrequency = when {
                !current.consentGranted -> MarketingFrequency.OFF
                current.frequency == MarketingFrequency.OFF -> MarketingFrequency.WEEKLY
                else -> current.frequency
            }
            Column(
                modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    stringResource(R.string.marketing_consent_title),
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    stringResource(R.string.marketing_consent_description),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        stringResource(R.string.marketing_consent_toggle),
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Switch(
                        checked = current.consentGranted,
                        onCheckedChange = ::updateConsent,
                        enabled = !saving,
                        modifier = Modifier.semantics {
                            contentDescription = consentToggleLabel
                        },
                    )
                }
                Text(
                    stringResource(R.string.marketing_frequency_title),
                    style = MaterialTheme.typography.bodyMedium,
                )
                MarketingFrequency.entries.forEach { frequency ->
                    val frequencyLabel = stringResource(frequency.labelResource())
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = selectedFrequency == frequency,
                                onClick = { updateFrequency(frequency) },
                                enabled = !saving,
                                role = Role.RadioButton,
                            ),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = selectedFrequency == frequency,
                            onClick = null,
                            enabled = !saving,
                        )
                        Text(
                            frequencyLabel,
                            Modifier
                                .weight(1f)
                                .semantics {
                                    contentDescription = frequencyLabel
                                },
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { reload += 1 }, enabled = !saving) {
                        Text(stringResource(R.string.marketing_preferences_retry))
                    }
                }
            }
        }
        else -> Column(modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
            Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { reload += 1 }) {
                Text(stringResource(R.string.marketing_preferences_retry))
            }
        }
    }
}

private fun MarketingFrequency.labelResource(): Int = when (this) {
    MarketingFrequency.WEEKLY -> R.string.marketing_frequency_weekly
    MarketingFrequency.IMPORTANT_ONLY -> R.string.marketing_frequency_important
    MarketingFrequency.OFF -> R.string.marketing_frequency_off
}
