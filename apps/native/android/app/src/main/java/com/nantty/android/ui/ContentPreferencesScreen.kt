package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.ContentAgeBracket
import com.nantty.android.data.ContentPreferences
import com.nantty.android.data.ContentPreferencesRepository
import com.nantty.android.data.ContentPreferencesResult
import java.util.concurrent.Executor

@Composable
internal fun ContentPreferencesScreen(
    repository: ContentPreferencesRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onPreferencesChanged: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var preferences by remember(repository) { mutableStateOf<ContentPreferences?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var saving by remember(repository) { mutableStateOf(false) }
    var pendingValue by remember(repository) { mutableStateOf<Boolean?>(null) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var reload by remember(repository) { mutableIntStateOf(0) }
    val lifecycleOwner = LocalLifecycleOwner.current
    BackHandler(onBack = onBack)

    LaunchedEffect(repository, reload, lifecycleOwner) {
        loading = true
        error = null
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                loading = false
                when (result) {
                    is ContentPreferencesResult.Success -> preferences = result.preferences
                    is ContentPreferencesResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    Column(
        modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        OutlinedButton(onClick = onBack) { Text(stringResource(com.nantty.android.R.string.common_back)) }
        Text(
            stringResource(com.nantty.android.R.string.content_preferences_title),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        when {
            loading && preferences == null -> CircularProgressIndicator()
            preferences == null -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(error ?: stringResource(com.nantty.android.R.string.content_preferences_load_error), color = MaterialTheme.colorScheme.error)
                OutlinedButton(onClick = { reload++ }) { Text(stringResource(com.nantty.android.R.string.common_try_again)) }
            }
            else -> {
                val current = requireNotNull(preferences)
                if (current.canChangeSensitiveContentSetting) {
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f).padding(end = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                stringResource(com.nantty.android.R.string.content_preferences_sensitive_toggle),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                stringResource(com.nantty.android.R.string.content_preferences_sensitive_description),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (saving) CircularProgressIndicator()
                        else Switch(
                            checked = pendingValue ?: current.showSensitiveWithoutWarning,
                            enabled = !saving,
                            modifier = Modifier.testTag("contentPreferenceSwitch"),
                            onCheckedChange = { enabled ->
                                saving = true
                                pendingValue = enabled
                                error = null
                                executor.execute {
                                    val result = repository.update(enabled)
                                    Snapshot.withMutableSnapshot {
                                        saving = false
                                        pendingValue = null
                                        when (result) {
                                            is ContentPreferencesResult.Success -> {
                                                preferences = result.preferences
                                                error = null
                                                onPreferencesChanged()
                                            }
                                            is ContentPreferencesResult.Failure -> {
                                                error = result.message
                                                if (result.authenticationRequired) onReauthenticate()
                                            }
                                        }
                                    }
                                }
                            },
                        )
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(vertical = 8.dp)) {
                        Text(
                            stringResource(com.nantty.android.R.string.content_preferences_locked_title),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            stringResource(
                                if (current.ageBracket == ContentAgeBracket.UNKNOWN)
                                    com.nantty.android.R.string.content_preferences_unknown_age
                                else com.nantty.android.R.string.content_preferences_minor,
                            ),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                Text(
                    stringResource(com.nantty.android.R.string.content_preferences_label_source),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
