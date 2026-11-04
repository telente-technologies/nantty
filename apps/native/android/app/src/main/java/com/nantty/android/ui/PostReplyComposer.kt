package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CommentActingProfile
import com.nantty.android.data.ThreadComment

@Composable
internal fun PostReplyComposer(
    accountId: String,
    profiles: List<CommentActingProfile>?,
    profilesLoading: Boolean,
    profilesError: String?,
    selectedProfileId: String?,
    profileMenuExpanded: Boolean,
    replyTarget: ThreadComment?,
    replyText: String,
    replyError: String?,
    replyNotice: String?,
    sending: Boolean,
    onProfileMenuExpandedChange: (Boolean) -> Unit,
    onProfileSelected: (String?) -> Unit,
    onRetryProfiles: () -> Unit,
    onCancelReply: () -> Unit,
    onReplyTextChange: (String) -> Unit,
    onSendReply: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
        val selectedProfile = profiles?.firstOrNull { it.id == selectedProfileId }
        if (!profiles.isNullOrEmpty()) {
            Box {
                TextButton(
                    onClick = { onProfileMenuExpandedChange(true) },
                    enabled = !sending,
                    modifier = Modifier.semantics {
                        contentDescription = "Commenting as ${selectedProfile?.name ?: "You"}. Choose profile"
                    },
                ) {
                    Text("Commenting as ${selectedProfile?.name ?: "You"}")
                }
                DropdownMenu(
                    expanded = profileMenuExpanded,
                    onDismissRequest = { onProfileMenuExpandedChange(false) },
                ) {
                    DropdownMenuItem(
                        text = { Text("You") },
                        leadingIcon = { RadioButton(selected = selectedProfile == null, onClick = null) },
                        onClick = { onProfileSelected(null) },
                        modifier = Modifier.semantics { contentDescription = "Comment as You" },
                    )
                    profiles.forEach { profile ->
                        DropdownMenuItem(
                            text = { Text("${profile.name} · ${profile.kind}", maxLines = 1, overflow = TextOverflow.Ellipsis) },
                            leadingIcon = { RadioButton(selected = profile.id == selectedProfile?.id, onClick = null) },
                            onClick = { onProfileSelected(profile.id) },
                            modifier = Modifier.semantics { contentDescription = "Comment as ${profile.name}, ${profile.kind}" },
                        )
                    }
                }
            }
        } else if (profilesLoading) {
            Text(
                "Loading business profiles…",
                Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
            )
        }
        profilesError?.let {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Business profiles unavailable", Modifier.weight(1f), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = onRetryProfiles, enabled = !profilesLoading) { Text("Retry") }
            }
        }
        replyTarget?.let { target ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Replying to @${target.username}", Modifier.weight(1f), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
                TextButton(onClick = onCancelReply) { Text("Cancel") }
            }
        }
        replyError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        replyNotice?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall) }
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = replyText,
                onValueChange = { onReplyTextChange(it.take(1500)) },
                modifier = Modifier.weight(1f).testTag("post-reply-input"),
                enabled = !sending,
                label = { Text("Write a reply") },
                supportingText = { Text("${replyText.length}/1500") },
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { onSendReply() }),
                maxLines = 4,
            )
            IconButton(
                onClick = onSendReply,
                enabled = !sending && replyText.isNotBlank() && replyText.length <= 1500,
                modifier = Modifier.semantics { contentDescription = "Send reply" },
            ) {
                if (sending) CircularProgressIndicator(Modifier.width(20.dp).height(20.dp))
                else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
            }
        }
    }
}
