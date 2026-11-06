package com.nantty.android.ui.spaces

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.CreateSpaceRequest
import com.nantty.android.data.SpaceInvitePerson
import com.nantty.android.data.SpaceInviteRole
import com.nantty.android.data.SpaceVisibility
import java.time.Instant

@Composable
internal fun SpacesCreateDialog(
    working: Boolean,
    onDismiss: () -> Unit,
    onCreate: (CreateSpaceRequest) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var visibility by remember { mutableStateOf(SpaceVisibility.PUBLIC) }
    var scheduled by remember { mutableStateOf(false) }
    var scheduledAt by remember { mutableStateOf("") }
    var coinSupport by remember { mutableStateOf(true) }
    var visibilityMenu by remember { mutableStateOf(false) }
    val scheduleValid = !scheduled || runCatching { Instant.parse(scheduledAt).isAfter(Instant.now()) }.getOrDefault(false)
    val canSubmit = title.isNotBlank() && scheduleValid && !working

    AlertDialog(
        onDismissRequest = { if (!working) onDismiss() },
        title = { Text("Create a Space") },
        text = {
            Column(Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), label = { Text("Title") }, singleLine = true)
                OutlinedTextField(description, { description = it }, Modifier.fillMaxWidth(), label = { Text("Description (optional)") }, minLines = 2)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Who can join?", style = MaterialTheme.typography.labelLarge)
                    OutlinedButton(onClick = { visibilityMenu = true }) { Text(visibility.label) }
                    DropdownMenu(expanded = visibilityMenu, onDismissRequest = { visibilityMenu = false }) {
                        SpaceVisibility.entries.filterNot { it == SpaceVisibility.UNKNOWN }.forEach { option ->
                            DropdownMenuItem(text = { Text(option.label) }, onClick = { visibility = option; visibilityMenu = false })
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Schedule for later", style = MaterialTheme.typography.bodyMedium)
                        Text("Enter a future UTC time in ISO-8601 format.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = scheduled, onCheckedChange = { scheduled = it })
                }
                if (scheduled) {
                    OutlinedTextField(
                        scheduledAt, { scheduledAt = it }, Modifier.fillMaxWidth(),
                        label = { Text("Start time (UTC)") },
                        placeholder = { Text("2030-01-31T18:30:00Z") },
                        singleLine = true,
                        isError = scheduledAt.isNotBlank() && !scheduleValid,
                        supportingText = if (scheduledAt.isNotBlank() && !scheduleValid) ({ Text("Use a future time such as 2030-01-31T18:30:00Z") }) else null,
                    )
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Allow coin donations", style = MaterialTheme.typography.bodyMedium)
                        Text("Listeners can donate Coins; virtual gifts are not supported.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(checked = coinSupport, onCheckedChange = { coinSupport = it })
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val normalizedSchedule = if (scheduled) runCatching { Instant.parse(scheduledAt).toString() }.getOrNull() else null
                    onCreate(CreateSpaceRequest(title.trim(), description.trim().ifBlank { null }, visibility, normalizedSchedule, coinSupport))
                },
                enabled = canSubmit,
            ) { Text(if (working) "Creating…" else if (scheduled) "Schedule" else "Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !working) { Text("Cancel") } },
    )
}

@Composable
internal fun SpaceInviteDialog(
    query: String,
    onQueryChange: (String) -> Unit,
    people: List<SpaceInvitePerson>,
    searching: Boolean,
    searchError: String?,
    searchNeedsAuth: Boolean,
    onRetrySearch: () -> Unit,
    onSignInRequired: () -> Unit,
    working: Boolean,
    onDismiss: () -> Unit,
    onInvite: (SpaceInvitePerson, SpaceInviteRole, String?) -> Unit,
) {
    var role by remember { mutableStateOf(SpaceInviteRole.LISTENER) }
    var title by remember { mutableStateOf("") }
    var roleMenu by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = { if (!working) onDismiss() },
        title = { Text("Invite to Space") },
        text = {
            Column(
                Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Find a Nantty member by name or username.", style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Search people") },
                    placeholder = { Text("Name or @username") },
                    singleLine = true,
                )
                when {
                    query.trim().length < 2 -> Text("Enter at least 2 characters to search.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    searching -> Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        Text("Searching people…", Modifier.padding(start = 10.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    searchError != null -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(searchError, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                        TextButton(onClick = if (searchNeedsAuth) onSignInRequired else onRetrySearch) {
                            Text(if (searchNeedsAuth) "Sign in" else "Retry search")
                        }
                    }
                    people.isEmpty() -> Text("No people found. Try another name or username.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    else -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        people.forEach { person ->
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium,
                                color = MaterialTheme.colorScheme.surfaceVariant,
                            ) {
                                Row(
                                    Modifier.fillMaxWidth().padding(start = 10.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Surface(Modifier.size(38.dp), shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(person.name.firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.onPrimaryContainer)
                                            person.avatarUrl?.let {
                                                AsyncImage(it, contentDescription = null, modifier = Modifier.size(38.dp).clip(CircleShape))
                                            }
                                        }
                                    }
                                    Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                                        Text(person.name, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                                        Text("@${person.username}${if (person.verified) " · Verified" else ""}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                                    }
                                    TextButton(onClick = { onInvite(person, role, title.trim().ifBlank { null }.takeIf { role != SpaceInviteRole.LISTENER }) }, enabled = !working) {
                                        Text(if (working) "Sending…" else "Invite")
                                    }
                                }
                            }
                        }
                    }
                }
                Text("Invite role", style = MaterialTheme.typography.labelLarge)
                OutlinedButton(onClick = { roleMenu = true }) { Text(role.label) }
                DropdownMenu(expanded = roleMenu, onDismissRequest = { roleMenu = false }) {
                    SpaceInviteRole.entries.forEach { option ->
                        DropdownMenuItem(text = { Text(option.label) }, onClick = { role = option; roleMenu = false })
                    }
                }
                if (role != SpaceInviteRole.LISTENER) {
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it.take(60) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Stage title (optional)") },
                        supportingText = { Text("Up to 60 characters") },
                        singleLine = true,
                    )
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss, enabled = !working) { Text("Cancel") } },
    )
}

@Composable
internal fun SpaceDonationDialog(
    hostName: String,
    working: Boolean,
    onDismiss: () -> Unit,
    onDonate: (Long) -> Unit,
) {
    var amount by remember { mutableStateOf("") }
    val coins = amount.toLongOrNull()
    AlertDialog(
        onDismissRequest = { if (!working) onDismiss() },
        title = { Text("Donate Coins") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Send Nantty Coins to $hostName. This is a coin donation, not a virtual gift.", style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = amount,
                    onValueChange = { value -> if (value.isEmpty() || value.all(Char::isDigit)) amount = value },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Coin amount") },
                    singleLine = true,
                    supportingText = { Text("Your balance and Nantty’s current limits are checked securely.") },
                )
            }
        },
        confirmButton = { TextButton(onClick = { coins?.let(onDonate) }, enabled = (coins ?: 0L) > 0 && !working) { Text(if (working) "Sending…" else "Donate") } },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !working) { Text("Cancel") } },
    )
}

private val SpaceVisibility.label: String
    get() = when (this) {
        SpaceVisibility.PUBLIC -> "Everyone"
        SpaceVisibility.FOLLOWERS -> "Followers"
        SpaceVisibility.SUBSCRIBERS -> "Subscribers"
        SpaceVisibility.INVITE_ONLY -> "Invite only"
        SpaceVisibility.UNKNOWN -> "Choose visibility"
    }
