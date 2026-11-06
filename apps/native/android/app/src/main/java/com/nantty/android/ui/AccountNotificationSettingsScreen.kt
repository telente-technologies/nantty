package com.nantty.android.ui

import android.os.Build
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.foundation.rememberScrollState
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AccountNotificationSettings
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.AccountNotificationSettingsResult
import com.nantty.android.NanttyApplication
import com.nantty.android.notifications.NativePushRegistration
import java.util.concurrent.Executor

private const val POST_NOTIFICATIONS_PERMISSION = "android.permission.POST_NOTIFICATIONS"

@Composable
internal fun AccountNotificationSettingsScreen(
    repository: AccountNotificationSettingsRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var settings by androidx.compose.runtime.remember(repository) { mutableStateOf<AccountNotificationSettings?>(null) }
    var loading by androidx.compose.runtime.remember(repository) { mutableStateOf(true) }
    var saving by androidx.compose.runtime.remember(repository) { mutableStateOf(false) }
    var error by androidx.compose.runtime.remember(repository) { mutableStateOf<String?>(null) }
    var reload by androidx.compose.runtime.remember(repository) { mutableStateOf(0) }
    var explainPushPermission by androidx.compose.runtime.remember { mutableStateOf(false) }
    val context = LocalContext.current
    val nativePushConfigured = (context.applicationContext as? NanttyApplication)?.firebasePushConfigured == true

    fun updatePushPreference(enabled: Boolean) {
        if (saving) return
        saving = true
        error = null
        executor.execute {
            val result = repository.updatePushNotifications(enabled)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AccountNotificationSettingsResult.Success -> {
                        settings = result.settings
                    }
                    is AccountNotificationSettingsResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                saving = false
            }
            if (result is AccountNotificationSettingsResult.Success) {
                NativePushRegistration.enqueueSync(context.applicationContext)
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) updatePushPreference(true)
        else error = "Notifications stay off until you allow them in Android settings."
    }

    fun requestPushOptIn() {
        val manager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
        if (manager?.areNotificationsEnabled() == false) {
            error = "Allow Nantty notifications in Android settings to turn this on."
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.checkSelfPermission(POST_NOTIFICATIONS_PERMISSION) == PackageManager.PERMISSION_GRANTED
        ) {
            updatePushPreference(true)
        } else {
            explainPushPermission = true
        }
    }

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is AccountNotificationSettingsResult.Success -> settings = result.settings
                    is AccountNotificationSettingsResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                loading = false
            }
        }
    }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to activity" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text("Notifications", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        HorizontalDivider()
        when {
            loading && settings == null -> Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                CircularProgressIndicator()
            }
            settings == null -> Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(error ?: "Could not load notification settings.", color = MaterialTheme.colorScheme.error)
                TextButton(onClick = { reload += 1 }) { Text("Try again") }
            }
            else -> {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f).padding(end = 16.dp)) {
                        Text("Push notifications", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text("Account-level preference for receiving push notifications.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(
                        checked = settings!!.pushNotificationsEnabled,
                        onCheckedChange = { enabled ->
                            if (enabled) requestPushOptIn() else updatePushPreference(false)
                        },
                        enabled = !saving,
                        modifier = Modifier.semantics { contentDescription = "Push notifications" },
                    )
                }
                if (!nativePushConfigured) {
                    Text(
                        "Native Android push delivery is not configured for this build. Your account preference can still be changed.",
                        Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 16.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                error?.let { Text(it, Modifier.padding(horizontal = 20.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                HorizontalDivider()
                NotificationCategoryPreferences(
                    repository = repository,
                    executor = executor,
                    onReauthenticate = onReauthenticate,
                )
                HorizontalDivider()
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                        Text("Device notification permission", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text("Android device settings can also block notifications.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = {
                        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        context.startActivity(intent)
                    }) {
                        Icon(Icons.Default.Settings, contentDescription = null)
                        Text("Open", Modifier.padding(start = 6.dp))
                    }
                }
            }
        }
    }

    if (explainPushPermission) {
        AlertDialog(
            onDismissRequest = { explainPushPermission = false },
            title = { Text("Allow Nantty notifications?") },
            text = { Text("Nantty can show activity and invitation updates here. You can change this permission any time in Android settings.") },
            confirmButton = {
                TextButton(onClick = {
                    explainPushPermission = false
                    permissionLauncher.launch(POST_NOTIFICATIONS_PERMISSION)
                }) { Text("Continue") }
            },
            dismissButton = { TextButton(onClick = { explainPushPermission = false }) { Text("Not now") } },
        )
    }
}
