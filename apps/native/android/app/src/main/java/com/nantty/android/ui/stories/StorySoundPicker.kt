package com.nantty.android.ui.stories

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.SelectableSound
import com.nantty.android.data.SoundLibraryResult
import com.nantty.android.data.SoundLibraryScope
import com.nantty.android.data.SoundsRepository
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.Executor
import kotlinx.coroutines.delay

@Composable
internal fun StorySoundPicker(
    visible: Boolean,
    selectedSoundId: String?,
    repository: SoundsRepository,
    executor: Executor,
    onSelect: (SelectableSound?) -> Unit,
    onDismiss: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var query by remember { mutableStateOf("") }
    var debouncedQuery by remember { mutableStateOf("") }
    var sounds by remember { mutableStateOf<List<SelectableSound>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var reauthenticationRequired by remember { mutableStateOf(false) }
    val requestGeneration = remember { AtomicInteger(0) }

    LaunchedEffect(visible, query) {
        if (!visible) return@LaunchedEffect
        if (query.isBlank()) {
            debouncedQuery = ""
            return@LaunchedEffect
        }
        delay(300)
        debouncedQuery = query.trim()
    }
    LaunchedEffect(visible, debouncedQuery, selectedTab, repository, executor) {
        if (!visible) {
            requestGeneration.incrementAndGet()
            return@LaunchedEffect
        }
        val scope = if (debouncedQuery.isNotBlank()) SoundLibraryScope.SEARCH
        else if (selectedTab == 0) SoundLibraryScope.TRENDING else SoundLibraryScope.SAVED
        val requestedQuery = debouncedQuery
        val generation = requestGeneration.incrementAndGet()
        loading = true
        error = null
        reauthenticationRequired = false
        executor.execute {
            val result = repository.list(scope, requestedQuery)
            Snapshot.withMutableSnapshot {
                if (requestGeneration.get() == generation) {
                    loading = false
                    when (result) {
                        is SoundLibraryResult.Success -> sounds = result.sounds
                        is SoundLibraryResult.Failure -> {
                            error = result.message
                            sounds = emptyList()
                            reauthenticationRequired = result.authenticationRequired
                        }
                    }
                }
            }
        }
    }

    if (!visible) return
    val dismiss = {
        requestGeneration.incrementAndGet()
        onDismiss()
    }
    val selectSound: (SelectableSound?) -> Unit = { sound ->
        requestGeneration.incrementAndGet()
        onSelect(sound)
    }
    AlertDialog(
        onDismissRequest = dismiss,
        title = { Text(stringResource(R.string.story_sound_picker_title)) },
        text = {
            Column(
                Modifier.fillMaxWidth().widthIn(max = 560.dp).heightIn(max = 560.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it.take(80) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text(stringResource(R.string.story_sound_search)) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                )
                if (debouncedQuery.isBlank()) {
                    PrimaryTabRow(selectedTabIndex = selectedTab) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            text = { Text(stringResource(R.string.story_sound_trending)) },
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = { selectedTab = 1 },
                            text = { Text(stringResource(R.string.story_sound_saved)) },
                        )
                    }
                }
                TextButton(
                    onClick = { selectSound(null) },
                    modifier = Modifier.fillMaxWidth().testTag("story-sound-none").semantics {
                        role = Role.RadioButton
                        selected = selectedSoundId == null
                    },
                ) {
                    Text(stringResource(R.string.story_sound_none), modifier = Modifier.weight(1f))
                    if (selectedSoundId == null) Icon(Icons.Default.Check, contentDescription = null)
                }
                when {
                    loading -> CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally).padding(20.dp))
                    error != null -> Column {
                        Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
                        if (reauthenticationRequired) {
                            TextButton(onClick = onReauthenticate) {
                                Text(stringResource(R.string.messages_sign_in_again))
                            }
                        }
                    }
                    sounds.isEmpty() -> Text(
                        stringResource(if (selectedTab == 1 && debouncedQuery.isBlank()) R.string.story_sound_saved_empty else R.string.story_sound_empty),
                        modifier = Modifier.align(Alignment.CenterHorizontally).padding(20.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    else -> LazyColumn(Modifier.weight(1f)) {
                        items(sounds, key = SelectableSound::id) { sound ->
                            StorySoundOption(
                                sound = sound,
                                selected = selectedSoundId == sound.id,
                                onClick = { selectSound(sound) },
                            )
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = dismiss) { Text(stringResource(R.string.story_create_cancel)) } },
    )
}

@Composable
private fun StorySoundOption(sound: SelectableSound, selected: Boolean, onClick: () -> Unit) {
    val disabledReason = when {
        sound.status == "under_copyright_review" -> stringResource(R.string.story_sound_copyright_review)
        sound.status == "removed" -> stringResource(R.string.story_sound_removed)
        sound.status != "available" -> stringResource(R.string.story_sound_unavailable)
        !sound.allowReuse -> stringResource(R.string.story_sound_reuse_disabled, sound.ownerUsername)
        else -> null
    }
    Surface(
        onClick = onClick,
        enabled = disabledReason == null,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth().testTag("story-sound-${sound.id}").semantics {
            role = Role.RadioButton
            this.selected = selected
        },
    ) {
        Row(
            Modifier.fillMaxWidth().padding(vertical = 10.dp, horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    if (sound.isOriginal) stringResource(R.string.story_sound_original) else sound.title,
                    style = MaterialTheme.typography.bodyLarge,
                )
                Text(
                    disabledReason ?: stringResource(
                        R.string.story_sound_credit_usage,
                        sound.ownerName.ifBlank { sound.ownerUsername },
                        sound.ownerUsername,
                        sound.usageCount,
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (selected) Icon(Icons.Default.Check, contentDescription = stringResource(R.string.story_sound_selected))
        }
    }
}
