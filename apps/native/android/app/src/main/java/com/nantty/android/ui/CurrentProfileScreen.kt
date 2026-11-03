package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.CurrentProfile
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.CurrentProfileResult
import com.nantty.android.data.CurrentProfileUpdate
import java.util.concurrent.Executor

@Composable
internal fun CurrentProfileScreen(
    repository: CurrentProfileRepository,
    executor: Executor,
    modifier: Modifier = Modifier,
) {
    var profile by remember(repository) { mutableStateOf<CurrentProfile?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var saving by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var message by remember(repository) { mutableStateOf<String?>(null) }
    var editing by remember(repository) { mutableStateOf(false) }
    var reload by remember(repository) { mutableStateOf(0) }

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is CurrentProfileResult.Failure -> error = result.message
                    is CurrentProfileResult.Success -> {
                        profile = result.profile
                        editing = false
                    }
                }
                loading = false
            }
        }
    }

    BoxWithConstraints(modifier.fillMaxSize()) {
        val horizontalPadding = if (maxWidth >= 600.dp) 32.dp else 18.dp
        Column(
            Modifier.widthIn(max = 720.dp).fillMaxSize().align(Alignment.TopCenter),
        ) {
            Text(
                "Your profile",
                Modifier.fillMaxWidth().padding(horizontal = horizontalPadding, vertical = 20.dp).semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            HorizontalDivider()
            when {
                loading && profile == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                profile == null -> ProfileLoadError(error ?: "Your profile could not be loaded.", onRetry = { reload += 1 })
                else -> CurrentProfileContent(
                    profile = profile!!,
                    editing = editing,
                    saving = saving,
                    message = message,
                    error = error,
                    horizontalPadding = horizontalPadding,
                    onStartEditing = {
                        message = null
                        error = null
                        editing = true
                    },
                    onCancelEditing = {
                        editing = false
                        error = null
                    },
                    onSave = { update ->
                        if (saving) return@CurrentProfileContent
                        saving = true
                        error = null
                        message = null
                        executor.execute {
                            val result = repository.update(update)
                            Snapshot.withMutableSnapshot {
                                when (result) {
                                    is CurrentProfileResult.Failure -> error = result.message
                                    is CurrentProfileResult.Success -> {
                                        profile = result.profile
                                        editing = false
                                        message = "Profile updated"
                                    }
                                }
                                saving = false
                            }
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun CurrentProfileContent(
    profile: CurrentProfile,
    editing: Boolean,
    saving: Boolean,
    message: String?,
    error: String?,
    horizontalPadding: androidx.compose.ui.unit.Dp,
    onStartEditing: () -> Unit,
    onCancelEditing: () -> Unit,
    onSave: (CurrentProfileUpdate) -> Unit,
) {
    var name by remember(profile.accountId, profile.name) { mutableStateOf(profile.name) }
    var bio by remember(profile.accountId, profile.bio) { mutableStateOf(profile.bio) }
    var isPrivate by remember(profile.accountId, profile.isPrivate) { mutableStateOf(profile.isPrivate) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = horizontalPadding, vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainerLow,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column {
                Box(
                    Modifier.fillMaxWidth().height(132.dp).background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    profile.bannerUrl?.let { url ->
                        AsyncImage(
                            model = url,
                            contentDescription = "Profile banner",
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 18.dp, bottom = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        modifier = Modifier.size(76.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.secondaryContainer,
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                profile.name.firstOrNull()?.uppercase() ?: "N",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                            )
                            profile.avatarUrl?.let { url ->
                                AsyncImage(
                                    model = url,
                                    contentDescription = "Profile photo",
                                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                                )
                            }
                        }
                    }
                    Column(Modifier.weight(1f).padding(start = 16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                profile.name,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (profile.isVerified) {
                                androidx.compose.material3.Icon(
                                    Icons.Default.Verified,
                                    contentDescription = "Verified account",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(start = 5.dp).size(20.dp),
                                )
                            }
                        }
                        Text("@${profile.username}", color = MaterialTheme.colorScheme.secondary)
                        if (profile.isCreator) {
                            Text("Creator", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }

        if (editing) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it.take(CurrentProfileRepository.MAX_NAME_LENGTH) },
                    label = { Text("Name") },
                    supportingText = { Text("${name.length}/${CurrentProfileRepository.MAX_NAME_LENGTH}") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = bio,
                    onValueChange = { bio = it.take(CurrentProfileRepository.MAX_BIO_LENGTH) },
                    label = { Text("Bio") },
                    supportingText = { Text("${bio.length}/${CurrentProfileRepository.MAX_BIO_LENGTH}") },
                    minLines = 3,
                    maxLines = 6,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Private profile", fontWeight = FontWeight.SemiBold)
                        Text("Only approved followers can see your posts.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                    }
                    Switch(
                        checked = isPrivate,
                        onCheckedChange = { isPrivate = it },
                        modifier = Modifier.semantics { contentDescription = "Private profile" },
                    )
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(onClick = onCancelEditing, enabled = !saving, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = { onSave(CurrentProfileUpdate(name, bio, isPrivate)) },
                        enabled = !saving && name.isNotBlank(),
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                    ) {
                        if (saving) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        else Text("Save changes")
                    }
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Button(
                    onClick = onStartEditing,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                ) {
                    androidx.compose.material3.Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                    Text("Edit profile", Modifier.padding(start = 8.dp))
                }
                message?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium) }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                ProfileStats(profile)
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = RoundedCornerShape(18.dp)) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("About", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(profile.bio.ifBlank { "Add a short bio so people know a little about you." }, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        HorizontalDivider(Modifier.padding(vertical = 4.dp))
                        Text(if (profile.isPrivate) "Private profile" else "Public profile", style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileStats(profile: CurrentProfile) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        ProfileStat(profile.posts, "Posts")
        ProfileStat(profile.followers, "Followers")
        ProfileStat(profile.following, "Following")
    }
}

@Composable
private fun ProfileStat(value: Int, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value.toString(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
    }
}

@Composable
private fun ProfileLoadError(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Your profile could not load", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(message, color = MaterialTheme.colorScheme.secondary)
        TextButton(onClick = onRetry, modifier = Modifier.heightIn(min = 48.dp)) { Text("Try again") }
    }
}
