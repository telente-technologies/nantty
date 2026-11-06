package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ChatNotificationSettings
import com.nantty.android.data.ChatNotificationSettingsRepository
import com.nantty.android.data.ChatSettings
import com.nantty.android.data.ChatSettingsResult
import com.nantty.android.data.MessageRequestAudience
import java.util.concurrent.Executor

@Composable
internal fun ChatNotificationSettingsScreen(
    repository: ChatNotificationSettingsRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onOpenBlockedAccounts: () -> Unit = {},
    onOpenPasscodeSettings: () -> Unit = {},
    onSettingsChanged: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var settings by remember(repository) { mutableStateOf<ChatSettings?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var saving by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var reload by remember(repository) { mutableIntStateOf(0) }
    BackHandler(onBack = onBack)

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is ChatSettingsResult.Success -> settings = result.settings
                    is ChatSettingsResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                loading = false
            }
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to chat settings" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text(
                "Chat settings",
                Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
        }
        HorizontalDivider()

        when {
            loading && settings == null -> Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading chat notification settings" })
            }
            settings == null -> Column(
                Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
            ) {
                Text(error ?: "Couldn't load notification settings.", color = MaterialTheme.colorScheme.error)
                TextButton(onClick = { reload++ }) { Text("Try again") }
            }
            else -> {
                val current = settings ?: return@Column
                Column(
                    Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(0.dp),
                ) {
                    Column(
                        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text("Message requests", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Who can send you message requests?",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    HorizontalDivider()
                    MessageRequestAudience.entries.forEach { audience ->
                        val selected = current.messageRequestsFrom == audience
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = selected,
                                    enabled = !saving,
                                    role = Role.RadioButton,
                                    onClick = {
                                        saveMessageRequestAudience(audience, repository, executor, { settings = it }, { saving = it }, { error = it }, onReauthenticate, onSettingsChanged)
                                    },
                                )
                                .semantics { contentDescription = "Allow message requests from ${audience.label}" }
                                .padding(horizontal = 20.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = selected,
                                onClick = null,
                            )
                            Text(audience.label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    HorizontalDivider()
                    Text(
                        "Group privacy",
                        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp).semantics { heading() },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    HorizontalDivider()
                    ChatNotificationToggle(
                        label = "Require invitations to join groups",
                        description = "People must invite you and you must accept before joining a group.",
                        checked = current.preventDirectGroupAdds,
                        disabled = saving,
                    ) { enabled ->
                        savePreventDirectGroupAdds(enabled, repository, executor, { settings = it }, { saving = it }, { error = it }, onReauthenticate, onSettingsChanged)
                    }
                    HorizontalDivider()
                    Text(
                        "Notifications",
                        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp).semantics { heading() },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    HorizontalDivider()
                    ChatNotificationToggle("Messages", current.notifications.messages, saving) {
                        saveChatNotifications(current.notifications.copy(messages = it), repository, executor, { settings = it }, { saving = it }, { error = it }, onReauthenticate, onSettingsChanged)
                    }
                    HorizontalDivider()
                    ChatNotificationToggle("Message requests", current.notifications.requests, saving) {
                        saveChatNotifications(current.notifications.copy(requests = it), repository, executor, { settings = it }, { saving = it }, { error = it }, onReauthenticate, onSettingsChanged)
                    }
                    HorizontalDivider()
                    ChatNotificationToggle("Groups and channels", current.notifications.groups, saving) {
                        saveChatNotifications(current.notifications.copy(groups = it), repository, executor, { settings = it }, { saving = it }, { error = it }, onReauthenticate, onSettingsChanged)
                    }
                    HorizontalDivider()
                    ChatNotificationToggle(
                        label = "Streak reminders",
                        description = "A nudge 4 hours before your day ends if a streak is at risk",
                        checked = current.notifications.streakReminders,
                        disabled = saving,
                    ) {
                        saveChatNotifications(current.notifications.copy(streakReminders = it), repository, executor, { settings = it }, { saving = it }, { error = it }, onReauthenticate, onSettingsChanged)
                    }
                    HorizontalDivider()
                    ChatNotificationToggle(
                        label = "Show message preview",
                        description = "Show the sender and text in notifications",
                        checked = current.notifications.showMessagePreview,
                        disabled = saving,
                    ) {
                        saveChatNotifications(current.notifications.copy(showMessagePreview = it), repository, executor, { settings = it }, { saving = it }, { error = it }, onReauthenticate, onSettingsChanged)
                    }
                    TextButton(onClick = onOpenBlockedAccounts, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
                        Text("Blocked accounts")
                    }
                    TextButton(onClick = onOpenPasscodeSettings, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
                        Text("Chat passcode and auto-lock")
                    }
                    HorizontalDivider()
                    error?.let { message ->
                        Text(
                            message,
                            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    HorizontalDivider()
                    Text(
                        "To silence a single chat, tap the bell in its header and mute it for 8 hours, 1 week or always.",
                        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ChatNotificationToggle(
    label: String,
    checked: Boolean,
    disabled: Boolean,
    description: String? = null,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.bodyMedium)
            description?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = !disabled,
            modifier = Modifier.semantics { contentDescription = label },
        )
    }
}

private fun saveChatNotifications(
    notifications: ChatNotificationSettings,
    repository: ChatNotificationSettingsRepository,
    executor: Executor,
    setSettings: (ChatSettings) -> Unit,
    setSaving: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    onReauthenticate: () -> Unit,
    onSettingsChanged: () -> Unit,
) {
    setSaving(true)
    setError(null)
    executor.execute {
        val result = repository.updateNotifications(notifications)
        Snapshot.withMutableSnapshot {
            when (result) {
                is ChatSettingsResult.Success -> {
                    setSettings(result.settings)
                    onSettingsChanged()
                }
                is ChatSettingsResult.Failure -> {
                    setError(result.message)
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
            setSaving(false)
        }
    }
}

private fun saveMessageRequestAudience(
    audience: MessageRequestAudience,
    repository: ChatNotificationSettingsRepository,
    executor: Executor,
    setSettings: (ChatSettings) -> Unit,
    setSaving: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    onReauthenticate: () -> Unit,
    onSettingsChanged: () -> Unit,
) {
    setSaving(true)
    setError(null)
    executor.execute {
        val result = repository.updateMessageRequestsFrom(audience)
        Snapshot.withMutableSnapshot {
            when (result) {
                is ChatSettingsResult.Success -> {
                    setSettings(result.settings)
                    onSettingsChanged()
                }
                is ChatSettingsResult.Failure -> {
                    setError(result.message)
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
            setSaving(false)
        }
    }
}

private fun savePreventDirectGroupAdds(
    enabled: Boolean,
    repository: ChatNotificationSettingsRepository,
    executor: Executor,
    setSettings: (ChatSettings) -> Unit,
    setSaving: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    onReauthenticate: () -> Unit,
    onSettingsChanged: () -> Unit,
) {
    setSaving(true)
    setError(null)
    executor.execute {
        val result = repository.updatePreventDirectGroupAdds(enabled)
        Snapshot.withMutableSnapshot {
            when (result) {
                is ChatSettingsResult.Success -> {
                    setSettings(result.settings)
                    onSettingsChanged()
                }
                is ChatSettingsResult.Failure -> {
                    setError(result.message)
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
            setSaving(false)
        }
    }
}
