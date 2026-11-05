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
import androidx.compose.foundation.text.KeyboardActions
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
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import com.nantty.android.R
import com.nantty.android.data.ChatSearchConversation
import com.nantty.android.data.ChatSearchPerson
import com.nantty.android.data.ChatSearchResult
import com.nantty.android.data.ConversationSearchRepository
import com.nantty.android.data.ConversationType
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.StartConversationResult
import java.util.concurrent.Executor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun MessagesSearchScreen(
    repository: MessagesRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onOpenConversation: (InboxConversation) -> Unit,
) {
    val closeSearchDescription = stringResource(R.string.messages_search_close)
    val clearSearchDescription = stringResource(R.string.messages_search_clear)
    val searchLoadingDescription = stringResource(R.string.messages_search_loading)
    var query by remember(repository) { mutableStateOf("") }
    var result by remember(repository) { mutableStateOf<ChatSearchResult?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var requestGeneration by remember(repository) { mutableIntStateOf(0) }
    var retryVersion by remember(repository) { mutableIntStateOf(0) }
    var startingPersonId by remember(repository) { mutableStateOf<String?>(null) }
    var startError by remember(repository) { mutableStateOf<String?>(null) }
    var startErrorRequiresAuthentication by remember(repository) { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current
    val coroutineScope = rememberCoroutineScope()

    fun openConversation(match: ChatSearchConversation) {
        keyboardController?.hide()
        onOpenConversation(
            InboxConversation(
                id = match.id,
                title = match.peer.name,
                peerName = match.peer.name,
                avatarUrl = match.peer.avatarUrl,
                type = ConversationType.DIRECT,
                lastMessageAt = "",
                unreadCount = 0,
            ),
        )
    }

    fun startConversation(person: ChatSearchPerson) {
        if (startingPersonId != null) return
        startingPersonId = person.id
        startError = null
        startErrorRequiresAuthentication = false
        coroutineScope.launch {
            when (val started = withContext(Dispatchers.IO) { repository.startConversationWithPerson(person.id) }) {
                is StartConversationResult.Failure -> {
                    startError = started.message
                    startErrorRequiresAuthentication = started.authenticationRequired
                    startingPersonId = null
                }
                is StartConversationResult.Success -> {
                    keyboardController?.hide()
                    startingPersonId = null
                    onOpenConversation(started.conversation)
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
            val loaded = repository.search(term)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation != requestGeneration) return@withMutableSnapshot
                result = loaded
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = closeSearchDescription }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            OutlinedTextField(
                value = query,
                onValueChange = {
                    if (it.length <= ConversationSearchRepository.MAX_SEARCH_QUERY_LENGTH) {
                        query = it
                        startError = null
                    }
                },
                modifier = Modifier.weight(1f).focusRequester(focusRequester),
                singleLine = true,
                placeholder = { Text(stringResource(R.string.messages_search_placeholder)) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = if (query.isNotEmpty()) ({
                    IconButton(onClick = { query = "" }, modifier = Modifier.semantics { contentDescription = clearSearchDescription }) {
                        Icon(Icons.Default.Close, contentDescription = null)
                    }
                }) else null,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { keyboardController?.hide() }),
            )
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        val success = result as? ChatSearchResult.Success
        val failure = result as? ChatSearchResult.Failure
        when {
            query.isBlank() -> InboxState(stringResource(R.string.messages_search_title), stringResource(R.string.messages_search_hint))
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = searchLoadingDescription })
            }
            failure != null -> InboxState(
                stringResource(R.string.messages_search_failed),
                failure.message,
                stringResource(if (failure.authenticationRequired) R.string.messages_sign_in_again else R.string.messages_search_retry),
                if (failure.authenticationRequired) onReauthenticate else ({ retryVersion += 1 }),
            )
            success != null && success.results.conversations.isEmpty() && success.results.people.isEmpty() ->
                InboxState(stringResource(R.string.messages_search_empty_title), stringResource(R.string.messages_search_empty_body))
            success != null -> LazyColumn(Modifier.fillMaxSize()) {
                if (success.results.conversations.isNotEmpty()) {
                    item(key = "message-search-conversations-heading") {
                        Text(
                            stringResource(R.string.messages_search_conversations),
                            Modifier.padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 6.dp),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    items(success.results.conversations, key = { "conversation-${it.id}" }) { match ->
                        SearchPersonRow(match.peer, enabled = startingPersonId == null) { openConversation(match) }
                    }
                }
                if (success.results.people.isNotEmpty()) {
                    item(key = "message-search-people-heading") {
                        Text(
                            stringResource(R.string.messages_search_people),
                            Modifier.padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 6.dp),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    items(success.results.people, key = { "person-${it.id}" }) { person ->
                        SearchPersonRow(person, enabled = startingPersonId == null, loading = startingPersonId == person.id) { startConversation(person) }
                    }
                }
                startError?.let { error ->
                    item(key = "message-search-start-error") {
                        Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
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

@Composable
private fun SearchPersonRow(person: ChatSearchPerson, enabled: Boolean, loading: Boolean = false, onClick: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background) {
        Row(
            Modifier.fillMaxWidth().clickable(enabled = enabled, role = Role.Button, onClick = onClick).semantics(mergeDescendants = true) {
                contentDescription = person.name
            }.padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AsyncImage(
                model = person.avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(44.dp).clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
            Text(person.name, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
        }
    }
}
