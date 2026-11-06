package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.R
import com.nantty.android.data.ChatSearchPerson
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagePeopleResult
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.StartConversationResult
import java.util.concurrent.Executor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun NewMessagePickerScreen(
    repository: MessagesRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onOpenConversation: (InboxConversation) -> Unit,
) {
    val backDescription = stringResource(R.string.new_message_back)
    val clearSearchDescription = stringResource(R.string.new_message_clear_search)
    var query by remember(repository) { mutableStateOf("") }
    var result by remember(repository) { mutableStateOf<MessagePeopleResult?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var retryVersion by remember(repository) { mutableIntStateOf(0) }
    var requestGeneration by remember(repository) { mutableIntStateOf(0) }
    var startingPersonId by remember(repository) { mutableStateOf<String?>(null) }
    var startError by remember(repository) { mutableStateOf<String?>(null) }
    var startErrorRequiresAuthentication by remember(repository) { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    val scope = rememberCoroutineScope()

    fun startConversation(person: ChatSearchPerson) {
        if (startingPersonId != null) return
        startingPersonId = person.id
        startError = null
        startErrorRequiresAuthentication = false
        scope.launch {
            when (val started = withContext(Dispatchers.IO) { repository.startConversationWithPerson(person.id) }) {
                is StartConversationResult.Success -> {
                    keyboard?.hide()
                    startingPersonId = null
                    onOpenConversation(started.conversation)
                }
                is StartConversationResult.Failure -> {
                    startingPersonId = null
                    startError = started.message
                    startErrorRequiresAuthentication = started.authenticationRequired
                }
            }
        }
    }

    LaunchedEffect(repository, query, retryVersion) {
        val term = query.trim()
        val generation = ++requestGeneration
        if (term.isEmpty()) {
            result = null
            loading = false
            return@LaunchedEffect
        }
        result = null
        loading = false
        delay(300)
        loading = true
        executor.execute {
            val loaded = repository.searchPeopleToMessage(term)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation == requestGeneration) {
                    result = loaded
                    loading = false
                }
            }
        }
    }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.semantics { contentDescription = backDescription },
            ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null) }
            Text(stringResource(R.string.new_message_title), Modifier.weight(1f), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Medium)
        }
        OutlinedTextField(
            value = query,
            onValueChange = { value ->
                if (value.length <= 100) {
                    query = value
                    startError = null
                }
            },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).focusRequester(focusRequester),
            singleLine = true,
            placeholder = { Text(stringResource(R.string.new_message_search_placeholder)) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = if (query.isNotEmpty()) ({
                IconButton(onClick = { query = "" }, modifier = Modifier.semantics { contentDescription = clearSearchDescription }) {
                    Icon(Icons.Default.Close, contentDescription = null)
                }
            }) else null,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        )
        HorizontalDivider(Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.outlineVariant)
        when {
            query.isBlank() -> NewMessagePickerState(
                stringResource(R.string.new_message_search_title),
                stringResource(R.string.new_message_search_hint),
            )
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            result is MessagePeopleResult.Failure -> {
                val failure = result as MessagePeopleResult.Failure
                NewMessagePickerState(
                    stringResource(R.string.new_message_search_failed),
                    failure.message,
                    stringResource(if (failure.authenticationRequired) R.string.messages_sign_in_again else R.string.messages_search_retry),
                    if (failure.authenticationRequired) onReauthenticate else ({ retryVersion += 1 }),
                )
            }
            result is MessagePeopleResult.Success -> {
                val people = (result as MessagePeopleResult.Success).people
                if (people.isEmpty()) {
                    NewMessagePickerState(stringResource(R.string.new_message_no_people_title), stringResource(R.string.new_message_no_people_body))
                } else {
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(people, key = ChatSearchPerson::id) { person ->
                            NewMessagePersonRow(person, enabled = startingPersonId == null, loading = startingPersonId == person.id) {
                                startConversation(person)
                            }
                        }
                        startError?.let { message ->
                            item(key = "new-message-start-error") {
                                Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                                    if (startErrorRequiresAuthentication) {
                                        TextButton(onClick = onReauthenticate) { Text(stringResource(R.string.messages_sign_in_again)) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NewMessagePersonRow(person: ChatSearchPerson, enabled: Boolean, loading: Boolean, onClick: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background) {
        Row(
            Modifier.fillMaxWidth().clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .semantics(mergeDescendants = true) { contentDescription = "${person.name}, @${person.username.orEmpty()}" }
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AsyncImage(
                model = person.avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(48.dp).clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
            Column(Modifier.weight(1f)) {
                Text(person.name, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("@${person.username.orEmpty()}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        }
    }
}

@Composable
private fun NewMessagePickerState(title: String, message: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(message, Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (action != null && onAction != null) TextButton(onClick = onAction) { Text(action) }
    }
}
