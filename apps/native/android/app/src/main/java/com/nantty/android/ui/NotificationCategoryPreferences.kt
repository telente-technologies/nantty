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

@Composable
internal fun NotificationCategoryPreferences(
    repository: AccountNotificationSettingsRepository,
    executor: Executor,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var preferences by remember(repository) { mutableStateOf<List<NotificationPreference>?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var savingCategory by remember(repository) { mutableStateOf<String?>(null) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var reload by remember(repository) { mutableStateOf(0) }

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.loadCategoryPreferences()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is NotificationPreferencesResult.Success -> preferences = result.preferences
                    is NotificationPreferencesResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                loading = false
            }
        }
    }

    fun update(category: String, push: Boolean? = null, email: Boolean? = null) {
        val current = preferences?.firstOrNull { it.category == category } ?: return
        if (savingCategory != null || current.locked) return
        savingCategory = category
        error = null
        executor.execute {
            val result = repository.updateCategoryPreference(category, push = push, email = email)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is NotificationPreferencesResult.Success -> {
                        val updated = result.preferences.firstOrNull()
                        if (updated != null) preferences = preferences.orEmpty().map { if (it.category == updated.category) updated else it }
                    }
                    is NotificationPreferencesResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                savingCategory = null
            }
        }
    }

    when {
        loading && preferences == null -> CircularProgressIndicator(modifier.padding(16.dp))
        preferences != null -> {
            Column(modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Notification categories", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    "Choose which categories can reach you by push or email. Required account notices stay on.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                preferences.orEmpty().forEach { preference ->
                    val title = notificationCategoryTitle(preference.category)
                    val saving = savingCategory != null
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(title, Modifier.padding(top = 12.dp), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        PreferenceSwitchRow("$title: push", preference.push, !saving && !preference.locked) { update(preference.category, push = it) }
                        PreferenceSwitchRow("$title: email", preference.email, !saving && !preference.locked) { update(preference.category, email = it) }
                        if (preference.locked) {
                            Text("Required account notices cannot be turned off.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { reload += 1 }) { Text("Retry notification preferences") }
                }
            }
        }
        else -> Column(modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
            Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { reload += 1 }) { Text("Retry notification preferences") }
        }
    }
}

private fun notificationCategoryTitle(category: String): String = when (category) {
    "auth" -> "Account security"
    "orders" -> "Orders"
    "escrow" -> "Escrow"
    "seller" -> "Seller activity"
    "payments" -> "Payments"
    "creator" -> "Creator program"
    "checkmarks" -> "Verification"
    "social" -> "Social activity"
    "milestones" -> "Milestones"
    "live" -> "Live"
    "trust" -> "Trust and safety"
    "privacy" -> "Privacy"
    "support" -> "Support"
    "marketing" -> "News and offers"
    else -> category.replace('-', ' ').replace('_', ' ').split(' ').joinToString(" ") { word -> word.replaceFirstChar(Char::uppercase) }
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
