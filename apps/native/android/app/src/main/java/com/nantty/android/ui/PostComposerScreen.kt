package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AccountSession
import com.nantty.android.data.PostComposerRepository
import com.nantty.android.data.PostComposerAudience
import com.nantty.android.data.FeedQuotedPost
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.SoundsRepository
import com.nantty.android.ui.stories.StoryPhotoComposer
import java.util.UUID
import java.util.concurrent.Executor

@Composable
internal fun PostComposerScreen(
    sessionProvider: () -> AccountSession?,
    executor: Executor,
    repository: PostComposerRepository = remember { PostComposerRepository(sessionProvider = sessionProvider) },
    storiesRepository: StoriesRepository? = null,
    soundsRepository: SoundsRepository? = null,
    storyMediaRepository: CreatorSampleMediaRepository? = null,
    startInStoryMode: Boolean = false,
    quoteTarget: FeedQuotedPost? = null,
    onCancel: () -> Unit,
    onPublished: (String) -> Unit,
    onStoryPublished: (String) -> Unit = onPublished,
    onReauthenticate: () -> Unit = onCancel,
) {
    var creatingStory by remember(startInStoryMode) { mutableStateOf(startInStoryMode) }
    var content by remember { mutableStateOf(TextFieldValue()) }
    var audience by remember { mutableStateOf(PostComposerAudience.EVERYONE) }
    var requestKey by remember { mutableStateOf(UUID.randomUUID().toString()) }
    var isPublishing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val trimmedText = content.text.trim()
    val withinLimit = content.text.length <= PostComposerRepository.MAX_POST_LENGTH
    val canPublish = trimmedText.isNotEmpty() && withinLimit && !isPublishing

    if (creatingStory && storiesRepository != null && soundsRepository != null && storyMediaRepository != null) {
        StoryPhotoComposer(
            storiesRepository = storiesRepository,
            soundsRepository = soundsRepository,
            mediaRepository = storyMediaRepository,
            executor = executor,
            onCancel = { creatingStory = false },
            onPublished = onStoryPublished,
            onReauthenticate = onReauthenticate,
        )
        return
    }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(onClick = onCancel, enabled = !isPublishing, modifier = Modifier.semantics { contentDescription = "Cancel post" }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                }
                Text(if (quoteTarget == null) "Create post" else "Quote post", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                if (storiesRepository != null && soundsRepository != null && storyMediaRepository != null) {
                    TextButton(
                        onClick = { creatingStory = true },
                        modifier = Modifier.semantics { contentDescription = "Create story" }.testTag("create-story-open"),
                    ) { Text("Story") }
                }
                Spacer(Modifier.weight(1f))
                Button(onClick = {
                    if (!canPublish) return@Button
                    isPublishing = true
                    errorMessage = null
                    val submittedText = content.text
                    val submittedAudience = audience
                    val idempotencyKey = requestKey
                    executor.execute {
                        val result = repository.publishTextPost(submittedText, idempotencyKey, submittedAudience, quoteTarget?.id)
                        Snapshot.withMutableSnapshot {
                            isPublishing = false
                            result.fold(
                                onSuccess = onPublished,
                                onFailure = { errorMessage = it.message ?: "Could not publish your post. Try again." },
                            )
                        }
                    }
                }, enabled = canPublish, modifier = Modifier.semantics { contentDescription = "Publish post" }) {
                    if (isPublishing) CircularProgressIndicator()
                    else {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                        Text("  Post")
                    }
                }
            }
            Spacer(Modifier.height(20.dp))
            quoteTarget?.let { FeedQuotedPostCard(quotedPost = it, unavailable = false) }
            OutlinedTextField(
                value = content,
                onValueChange = { next ->
                    if (next.text != content.text) requestKey = UUID.randomUUID().toString()
                    content = next
                    errorMessage = null
                },
                modifier = Modifier.fillMaxWidth().height(240.dp).semantics { contentDescription = "Post text" },
                placeholder = { Text("What would you like to share?") },
                supportingText = { Text("${content.text.length}/${PostComposerRepository.MAX_POST_LENGTH}", modifier = Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.End) },
                isError = !withinLimit,
                enabled = !isPublishing,
                maxLines = 10,
            )
            Spacer(Modifier.height(16.dp))
            Text("Who can see this post?", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PostComposerAudience.entries.forEach { option ->
                    FilterChip(
                        selected = audience == option,
                        onClick = {
                            if (audience != option) requestKey = UUID.randomUUID().toString()
                            audience = option
                        },
                        enabled = !isPublishing,
                        label = { Text(option.label) },
                        modifier = Modifier.semantics { contentDescription = "Post audience: ${option.label}" },
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text("Posting to your personal account · ${audience.label}", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall)
            errorMessage?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
