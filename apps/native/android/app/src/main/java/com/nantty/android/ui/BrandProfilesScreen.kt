package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.ActingProfileSwitchResult
import com.nantty.android.data.BrandActingProfile
import com.nantty.android.data.BrandProfilesRepository
import com.nantty.android.data.BrandProfilesResult
import com.nantty.android.data.BrandProfilesState
import java.util.concurrent.Executor

@Composable
internal fun BrandProfilesScreen(
    repository: BrandProfilesRepository,
    executor: Executor,
    onReauthenticate: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var state by androidx.compose.runtime.remember(repository) { mutableStateOf<BrandProfilesState?>(null) }
    var loading by androidx.compose.runtime.remember(repository) { mutableStateOf(true) }
    var switching by androidx.compose.runtime.remember(repository) { mutableStateOf(false) }
    var error by androidx.compose.runtime.remember(repository) { mutableStateOf<String?>(null) }
    var notice by androidx.compose.runtime.remember(repository) { mutableStateOf<String?>(null) }
    var reload by androidx.compose.runtime.remember(repository) { mutableStateOf(0) }

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is BrandProfilesResult.Success -> state = result.state
                    is BrandProfilesResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
                loading = false
            }
        }
    }

    BoxWithConstraints(modifier.fillMaxSize()) {
        val horizontalPadding = if (maxWidth >= 600.dp) 32.dp else 20.dp
        Column(
            Modifier.widthIn(max = 760.dp).fillMaxSize().align(Alignment.TopCenter),
        ) {
            Text(
                "Switch profile",
                Modifier.fillMaxWidth().padding(horizontal = horizontalPadding, vertical = 20.dp).semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Choose which profile to act as. Actions remain subject to your account permissions.",
                Modifier.fillMaxWidth().padding(start = horizontalPadding, end = horizontalPadding, bottom = 16.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            HorizontalDivider()
            when {
                loading && state == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                state == null -> Column(
                    Modifier.fillMaxSize().padding(horizontalPadding),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(error ?: "Your profiles could not be loaded.", color = MaterialTheme.colorScheme.error)
                    Button(onClick = { reload += 1 }, enabled = !loading) { Text("Try again") }
                }
                else -> {
                    notice?.let { Text(it, Modifier.padding(horizontal = horizontalPadding, vertical = 12.dp), color = MaterialTheme.colorScheme.primary) }
                    error?.let { Text(it, Modifier.padding(horizontal = horizontalPadding, vertical = 8.dp), color = MaterialTheme.colorScheme.error) }
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().selectableGroup(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = horizontalPadding, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(state!!.profiles, key = { it.id }) { profile ->
                            ActingProfileCard(
                                profile = profile,
                                selected = profile.id == state!!.activeProfile.id,
                                enabled = !switching && !loading,
                                onSelect = {
                                    if (profile.id == state!!.activeProfile.id || switching) return@ActingProfileCard
                                    switching = true
                                    error = null
                                    notice = null
                                    executor.execute {
                                        val result = repository.switchActingProfile(profile.id)
                                        Snapshot.withMutableSnapshot {
                                            when (result) {
                                                is ActingProfileSwitchResult.Success -> {
                                                    state = state!!.copy(
                                                        activeProfile = result.profile,
                                                        profiles = state!!.profiles.map { it.copy(active = it.id == result.profile.id) },
                                                    )
                                                    notice = "Now acting as ${result.profile.name}."
                                                }
                                                is ActingProfileSwitchResult.Failure -> {
                                                    error = result.message
                                                    if (result.authenticationRequired) onReauthenticate()
                                                }
                                            }
                                            switching = false
                                        }
                                    }
                                },
                            )
                        }
                        if (switching) item {
                            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                                Text("Switching profile…", Modifier.padding(start = 10.dp), style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActingProfileCard(
    profile: BrandActingProfile,
    selected: Boolean,
    enabled: Boolean,
    onSelect: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceContainerLow,
        modifier = Modifier.fillMaxWidth().selectable(
            selected = selected,
            enabled = enabled,
            role = Role.RadioButton,
            onClick = onSelect,
        ),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Surface(
                modifier = Modifier.size(48.dp),
                shape = CircleShape,
                color = MaterialTheme.colorScheme.surfaceContainerHighest,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    profile.avatarUrl?.let { url ->
                        AsyncImage(model = url, contentDescription = "${profile.name} profile image", modifier = Modifier.fillMaxSize())
                    }
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(profile.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("@${profile.handle} · ${profile.kind.profileKindLabel()}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (profile.onHold) {
                    Text("Publishing is currently on hold", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                }
                if (selected) {
                    Text("Current profile", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                }
            }
            if (selected) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

private fun String.profileKindLabel(): String = when (this) {
    "person" -> "Personal"
    "creator" -> "Creator"
    "business" -> "Business page"
    "brand" -> "Brand"
    "store" -> "Store"
    "government" -> "Government"
    else -> "Profile"
}
