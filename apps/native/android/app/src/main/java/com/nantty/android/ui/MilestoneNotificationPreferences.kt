package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.NotificationPreference
import com.nantty.android.data.NotificationPreferencesResult
import java.util.concurrent.Executor

private const val MILESTONES_CATEGORY = "milestones"

@Composable
internal fun MilestoneNotificationPreferences(
    repository: AccountNotificationSettingsRepository,
    executor: Executor,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var preference by remember(repository) { mutableStateOf<NotificationPreference?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var saving by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var reload by remember(repository) { mutableStateOf(0) }

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.loadCategoryPreferences()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is NotificationPreferencesResult.Success -> preference = result.preferences.firstOrNull { it.category == MILESTONES_CATEGORY }
                    is NotificationPreferencesResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                loading = false
            }
        }
    }

    fun update(push: Boolean? = null, email: Boolean? = null) {
        val current = preference ?: return
        if (saving || current.locked) return
        saving = true
        error = null
        executor.execute {
            val result = repository.updateCategoryPreference(MILESTONES_CATEGORY, push = push, email = email)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is NotificationPreferencesResult.Success -> preference = result.preferences.firstOrNull() ?: current
                    is NotificationPreferencesResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                saving = false
            }
        }
    }

    when {
        loading && preference == null -> CircularProgressIndicator(modifier.padding(16.dp))
        preference != null -> {
            val current = preference ?: return
            Column(modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Milestones", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    "Choose whether Nantty sends birthday and account-anniversary updates.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                PreferenceSwitchRow("Milestones: push", current.push, saving || current.locked) { update(push = it) }
                PreferenceSwitchRow("Milestones: email", current.email, saving || current.locked) { update(email = it) }
                if (current.locked) Text("These preferences are managed by Nantty.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        error != null -> Column(modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
            Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { reload += 1 }) { Text("Retry milestone preferences") }
        }
    }

}

@Composable
private fun PreferenceSwitchRow(label: String, checked: Boolean, enabled: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            modifier = Modifier.semantics { contentDescription = label },
        )
    }
}

