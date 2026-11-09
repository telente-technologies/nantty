package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.MentionAudience
import com.nantty.android.data.MentionPrivacyRepository
import com.nantty.android.data.MentionPrivacyResult
import java.util.concurrent.Executor

private data class MentionAudienceCopy(val label: String, val description: String)

private val mentionAudienceCopy = mapOf(
    MentionAudience.EVERYONE to MentionAudienceCopy(
        "Everyone",
        "Anyone on Nantty can mention you in posts, comments and groups you are in.",
    ),
    MentionAudience.FOLLOWING to MentionAudienceCopy(
        "People I follow",
        "Only people you follow can mention you. Other mentions show as plain text and you are not notified.",
    ),
    MentionAudience.NO_ONE to MentionAudienceCopy(
        "No one",
        "Mentions of you show as plain text and you are never notified.",
    ),
)

@Composable
internal fun MentionPrivacyScreen(
    repository: MentionPrivacyRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var savedAudience by remember(repository) { mutableStateOf<MentionAudience?>(null) }
    var pendingAudience by remember(repository) { mutableStateOf<MentionAudience?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var saving by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var reload by remember(repository) { mutableIntStateOf(0) }
    val enabled = !loading && !saving && savedAudience != null
    BackHandler(onBack = onBack)

    LaunchedEffect(repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                loading = false
                when (result) {
                    is MentionPrivacyResult.Success -> savedAudience = result.audience
                    is MentionPrivacyResult.Failure -> {
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
        OutlinedButton(onClick = onBack, modifier = Modifier.testTag("mentionPrivacyBack")) {
            Text("Back")
        }
        Text(
            "Mention privacy",
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Text("Who can mention me", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
        when {
            loading && savedAudience == null -> CircularProgressIndicator()
            savedAudience == null -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(error ?: "Mention privacy could not be loaded.", color = MaterialTheme.colorScheme.error)
                OutlinedButton(onClick = { reload++ }, modifier = Modifier.testTag("mentionPrivacyRetry")) { Text("Try again") }
            }
            else -> {
                val selected = pendingAudience ?: requireNotNull(savedAudience)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    MentionAudience.entries.forEach { audience ->
                        FilterChip(
                            selected = selected == audience,
                            onClick = {
                                if (enabled && audience != savedAudience) {
                                    saving = true
                                    pendingAudience = audience
                                    error = null
                                    executor.execute {
                                        val result = repository.update(audience)
                                        Snapshot.withMutableSnapshot {
                                            saving = false
                                            pendingAudience = null
                                            when (result) {
                                                is MentionPrivacyResult.Success -> {
                                                    savedAudience = result.audience
                                                    error = null
                                                }
                                                is MentionPrivacyResult.Failure -> {
                                                    error = result.message
                                                    if (result.authenticationRequired) onReauthenticate()
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            enabled = enabled,
                            label = { Text(mentionAudienceCopy.getValue(audience).label) },
                            modifier = Modifier.testTag("mentionPrivacy-${audience.wireValue}"),
                        )
                    }
                }
                val descriptionAudience = pendingAudience ?: savedAudience
                descriptionAudience?.let { audience ->
                    Text(
                        mentionAudienceCopy.getValue(audience).description,
                        Modifier.fillMaxWidth().testTag("mentionPrivacyDescription"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (saving) CircularProgressIndicator(Modifier.size(20.dp).testTag("mentionPrivacySaving"), strokeWidth = 2.dp)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
}
