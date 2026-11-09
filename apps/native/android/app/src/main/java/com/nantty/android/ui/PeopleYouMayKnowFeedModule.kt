package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.ExploreSuggestion

@Composable
internal fun PeopleYouMayKnowFeedModule(
    suggestions: List<ExploreSuggestion>,
    followStates: Map<String, String>,
    busyIds: Set<String>,
    onOpenProfile: (String) -> Unit,
    onFollow: (ExploreSuggestion) -> Unit,
    onDismiss: (ExploreSuggestion) -> Unit,
    onSeeAll: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (suggestions.isEmpty()) return
    Column(
        modifier.fillMaxWidth().testTag("feed-people-you-may-know"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "People you may know",
                Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            TextButton(onClick = onSeeAll) { Text("See all") }
        }
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp),
        ) {
            items(suggestions, key = { it.user.id }) { suggestion ->
                val state = followStates[suggestion.user.id] ?: "none"
                PersonSuggestionCard(
                    suggestion = suggestion,
                    followState = state,
                    busy = suggestion.user.id in busyIds,
                    onOpenProfile = { onOpenProfile(suggestion.user.id) },
                    onFollow = { onFollow(suggestion) },
                    onDismiss = { onDismiss(suggestion) },
                )
            }
        }
    }
}

@Composable
private fun PersonSuggestionCard(
    suggestion: ExploreSuggestion,
    followState: String,
    busy: Boolean,
    onOpenProfile: () -> Unit,
    onFollow: () -> Unit,
    onDismiss: () -> Unit,
) {
    val user = suggestion.user
    Surface(
        modifier = Modifier.padding(bottom = 2.dp).testTag("suggested-person-${user.id}"),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            modifier = Modifier.size(width = 156.dp, height = 220.dp).padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(28.dp).semantics { contentDescription = "Remove ${user.name} from suggestions" }.testTag("dismiss-suggested-person-${user.id}"),
                ) {
                    Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Surface(
                onClick = onOpenProfile,
                color = androidx.compose.ui.graphics.Color.Transparent,
                modifier = Modifier.weight(1f).fillMaxWidth().semantics { contentDescription = "Open ${user.name}'s profile" },
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.size(68.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                        Surface(color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.fillMaxSize()) {}
                        if (user.avatarUrl != null) {
                            AsyncImage(
                                model = user.avatarUrl,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize().clip(CircleShape),
                            )
                        } else {
                            Text(user.name.firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(user.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        if (suggestion.isOfficial || user.verified) {
                            Icon(
                                Icons.Default.Verified,
                                contentDescription = if (suggestion.isOfficial) "Official account" else "Verified account",
                                modifier = Modifier.size(14.dp),
                                tint = when (user.verificationColor) {
                                    "gold" -> MaterialTheme.colorScheme.secondary
                                    "black" -> MaterialTheme.colorScheme.onSurface
                                    else -> MaterialTheme.colorScheme.primary
                                },
                            )
                        }
                    }
                    Text(
                        suggestion.reasonLabel.ifBlank { "@${user.username}" },
                        maxLines = 2,
                        minLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            val following = followState == "accepted"
            val requested = followState == "requested"
            val buttonLabel = when {
                following -> "Following"
                requested -> "Requested"
                else -> "Follow"
            }
            val actionDescription = when {
                busy -> "Updating follow status for ${user.name}"
                requested -> "Cancel follow request to ${user.name}"
                following -> "Unfollow ${user.name}"
                else -> "Follow ${user.name}"
            }
            if (following || requested) {
                OutlinedButton(
                    onClick = onFollow,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = actionDescription }.testTag("follow-suggested-person-${user.id}"),
                ) { FollowButtonLabel(busy, buttonLabel) }
            } else {
                Button(
                    onClick = onFollow,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = actionDescription }.testTag("follow-suggested-person-${user.id}"),
                ) { FollowButtonLabel(busy, buttonLabel) }
            }
        }
    }
}

@Composable
private fun FollowButtonLabel(busy: Boolean, label: String) {
    if (busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
    else Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

@Composable
internal fun ConfirmSuggestedPersonUnfollowDialog(
    username: String,
    isRequest: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isRequest) "Cancel follow request?" else "Unfollow @$username?") },
        text = { Text(if (isRequest) "Your request to follow @$username will be cancelled." else "You’ll no longer see updates from @$username in your Following feed.") },
        confirmButton = { TextButton(onClick = onConfirm) { Text(if (isRequest) "Cancel request" else "Unfollow") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Keep") } },
    )
}
