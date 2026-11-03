package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.SearchPage
import com.nantty.android.data.SearchPost
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SearchResult
import com.nantty.android.data.SearchType
import com.nantty.android.data.SearchUser
import java.util.concurrent.Executor
import kotlinx.coroutines.delay

@Composable
internal fun SearchScreen(
    repository: SearchRepository,
    executor: Executor,
    modifier: Modifier = Modifier,
    onOpenPost: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    onReauthenticate: () -> Unit = {},
) {
    var query by remember(repository) { mutableStateOf("") }
    var type by remember(repository) { mutableStateOf(SearchType.TOP) }
    var result by remember(repository) { mutableStateOf<SearchResult?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var paginationError by remember(repository) { mutableStateOf(false) }
    var requestGeneration by remember(repository) { mutableStateOf(0) }
    var retryGeneration by remember(repository) { mutableStateOf(0) }
    val keyboard = LocalSoftwareKeyboardController.current

    LaunchedEffect(query, type, repository, retryGeneration) {
        requestGeneration += 1
        val generation = requestGeneration
        val cleanQuery = query.trim()
        result = null
        loading = false
        loadingMore = false
        paginationError = false
        if (cleanQuery.isEmpty()) {
            Unit
        } else {
            delay(300)
            loading = true
            executor.execute {
                val next = repository.search(cleanQuery, type)
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    if (requestGeneration == generation) {
                        result = next
                        loading = false
                    }
                }
            }
        }
    }

    fun loadMore() {
        val current = (result as? SearchResult.Success)?.page ?: return
        val cursor = current.nextCursor ?: return
        if (loadingMore || loading) return
        val generation = requestGeneration
        loadingMore = true
        paginationError = false
        executor.execute {
            val next = repository.search(query.trim(), type, cursor)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    when (next) {
                        is SearchResult.Failure -> paginationError = true
                        is SearchResult.Success -> {
                            val latest = (result as? SearchResult.Success)?.page ?: current
                            val mergedPosts = (latest.posts + next.page.posts).distinctBy(SearchPost::id)
                            val mergedUsers = (latest.users + next.page.users).distinctBy(SearchUser::id)
                            result = SearchResult.Success(SearchPage(mergedPosts, mergedUsers, next.page.nextCursor))
                        }
                    }
                    loadingMore = false
                }
            }
        }
    }

    Column(modifier.fillMaxSize()) {
        Text("Discover", Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 8.dp).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        OutlinedTextField(
            value = query,
            onValueChange = { query = it.take(SearchRepository.MAX_QUERY_LENGTH) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            singleLine = true,
            label = { Text("Search Nantty") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
        )
        TabRow(selectedTabIndex = SearchType.entries.indexOf(type)) {
            SearchType.entries.forEach { option ->
                Tab(selected = type == option, onClick = { type = option }, text = { Text(option.label) })
            }
        }
        when {
            query.isBlank() -> CenterMessage("Search posts on Nantty", "Type a name, phrase, or hashtag to discover matching posts.")
            loading && result == null -> CenterMessage("Searching Nantty…", progress = true)
            result is SearchResult.Failure -> CenterMessage(
                if ((result as SearchResult.Failure).authenticationRequired) "Your session has expired" else "Search is unavailable",
                (result as SearchResult.Failure).message,
                action = if ((result as SearchResult.Failure).authenticationRequired) onReauthenticate else ({ retryGeneration += 1 }),
                actionLabel = if ((result as SearchResult.Failure).authenticationRequired) "Sign in again" else "Try again",
            )
            result is SearchResult.Success && (result as SearchResult.Success).page.let { it.posts.isEmpty() && it.users.isEmpty() } -> CenterMessage("No results found", "Try another search or choose a different result type.")
            result is SearchResult.Success -> {
                val page = (result as SearchResult.Success).page
                LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(page.users, key = { "user:${it.id}" }) { user -> SearchUserRow(user, onClick = { onOpenProfile(user.id) }) }
                    items(page.posts, key = { "post:${it.id}" }) { post -> SearchPostRow(post, onClick = { onOpenPost(post.id) }, onOpenProfile = onOpenProfile) }
                    item(key = "search-pagination") {
                        when {
                            loadingMore -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                            paginationError -> TextButton(onClick = ::loadMore, modifier = Modifier.fillMaxWidth()) { Text("Couldn’t load more. Try again") }
                            page.nextCursor != null -> TextButton(onClick = ::loadMore, modifier = Modifier.fillMaxWidth().padding(8.dp)) { Text("Load more posts") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchPostRow(post: SearchPost, onClick: () -> Unit, onOpenProfile: (String) -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp).semantics(mergeDescendants = true) {
            contentDescription = "Open post: ${post.caption.ifBlank { "Post" }}"
        },
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            if (post.thumbnailUrl != null) {
                AsyncImage(post.thumbnailUrl, contentDescription = "Post image", modifier = Modifier.size(64.dp, 72.dp))
            } else {
                Surface(Modifier.size(64.dp, 72.dp), shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                    Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Search, contentDescription = null) }
                }
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text(post.caption.ifBlank { "Post" }, maxLines = 3, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(6.dp))
                Text("${post.likes} likes · ${post.views} views", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                post.authorId?.let { authorId ->
                    TextButton(onClick = { onOpenProfile(authorId) }, modifier = Modifier.sizeIn(minHeight = 48.dp)) { Text("View author profile") }
                }
            }
        }
    }
}

@Composable
private fun SearchUserRow(user: SearchUser, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp).sizeIn(minHeight = 56.dp).semantics(mergeDescendants = true) {
            contentDescription = "Open ${user.name}, @${user.username}'s profile"
        },
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                Surface(Modifier.fillMaxSize(), shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer) {
                    Text(user.name.firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.onPrimaryContainer, fontWeight = FontWeight.Bold)
                }
                user.avatarUrl?.let { AsyncImage(it, contentDescription = null, modifier = Modifier.fillMaxSize().clip(CircleShape)) }
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(user.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                    if (user.verified) Icon(Icons.Default.Verified, contentDescription = "Verified account", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp).size(16.dp))
                }
                Text("@${user.username}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun CenterMessage(message: String, detail: String? = null, progress: Boolean = false, action: (() -> Unit)? = null, actionLabel: String = "Try again") {
    Column(Modifier.fillMaxSize().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        if (progress) CircularProgressIndicator()
        Text(message, Modifier.padding(top = if (progress) 16.dp else 0.dp), style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
        detail?.let { Text(it, Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        action?.let { TextButton(onClick = it) { Text(actionLabel) } }
    }
}
