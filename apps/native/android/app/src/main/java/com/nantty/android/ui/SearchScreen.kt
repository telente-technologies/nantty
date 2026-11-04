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
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.SearchPage
import com.nantty.android.data.SearchPost
import com.nantty.android.data.SearchProduct
import com.nantty.android.data.SearchRecent
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.RecentSearchResult
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
    onOpenProduct: (String) -> Unit = {},
) {
    var query by remember(repository) { mutableStateOf("") }
    var type by remember(repository) { mutableStateOf(SearchType.TOP) }
    var result by remember(repository) { mutableStateOf<SearchResult?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var paginationError by remember(repository) { mutableStateOf(false) }
    var requestGeneration by remember(repository) { mutableStateOf(0) }
    var retryGeneration by remember(repository) { mutableStateOf(0) }
    var recentEntries by remember(repository) { mutableStateOf<List<SearchRecent>>(emptyList()) }
    var recentError by remember(repository) { mutableStateOf<String?>(null) }
    var recentLoading by remember(repository) { mutableStateOf(false) }
    // Read the repository's live session on every recomposition; the repository can outlive a login change.
    val signedIn = repository.hasAuthenticatedViewer()
    val keyboard = LocalSoftwareKeyboardController.current

    fun refreshRecents() {
        if (!signedIn) return
        recentLoading = true
        executor.execute {
            val loaded = repository.listRecentSearches()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                when (loaded) {
                    is RecentSearchResult.Success -> {
                        recentEntries = loaded.entries
                        recentError = null
                    }
                    is RecentSearchResult.Failure -> recentError = loaded.message
                }
                recentLoading = false
            }
        }
    }

    fun recordQuery(value: String) {
        val clean = value.trim()
        if (!signedIn || clean.isEmpty()) return
        executor.execute {
            val recorded = repository.recordRecentSearch(clean)
            val loaded = repository.listRecentSearches()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                when {
                    loaded is RecentSearchResult.Success -> {
                        recentEntries = loaded.entries
                        recentError = if (recorded is RecentSearchResult.Failure) recorded.message else null
                    }
                    loaded is RecentSearchResult.Failure -> recentError = loaded.message
                }
            }
        }
    }

    fun removeRecent(id: String) {
        executor.execute {
            val removed = repository.removeRecentSearch(id)
            val loaded = repository.listRecentSearches()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (loaded is RecentSearchResult.Success) recentEntries = loaded.entries
                recentError = when {
                    removed is RecentSearchResult.Failure -> removed.message
                    loaded is RecentSearchResult.Failure -> loaded.message
                    else -> null
                }
            }
        }
    }

    fun clearRecents() {
        executor.execute {
            val cleared = repository.clearRecentSearches()
            val loaded = repository.listRecentSearches()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (loaded is RecentSearchResult.Success) recentEntries = loaded.entries
                recentError = when {
                    cleared is RecentSearchResult.Failure -> cleared.message
                    loaded is RecentSearchResult.Failure -> loaded.message
                    else -> null
                }
            }
        }
    }

    LaunchedEffect(repository, signedIn) {
        if (signedIn) {
            refreshRecents()
        } else {
            recentEntries = emptyList()
            recentError = null
            recentLoading = false
        }
    }

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
                            val mergedProducts = (latest.products + next.page.products).distinctBy(SearchProduct::id)
                            result = SearchResult.Success(SearchPage(mergedPosts, mergedUsers, next.page.nextCursor, mergedProducts))
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
            keyboardActions = KeyboardActions(onSearch = {
                recordQuery(query)
                keyboard?.hide()
            }),
        )
        TabRow(selectedTabIndex = SearchType.entries.indexOf(type)) {
            SearchType.entries.forEach { option ->
                Tab(selected = type == option, onClick = { type = option }, text = { Text(option.label) })
            }
        }
        if (signedIn && query.isNotBlank() && recentError != null) {
            RecentHistoryNotice(onRetry = ::refreshRecents)
        }
        when {
            query.isBlank() -> {
                if (signedIn) {
                    Column(Modifier.fillMaxSize()) {
                        if (recentEntries.isNotEmpty()) {
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = SearchDimensions.headerHorizontal, vertical = SearchDimensions.headerVertical),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("Recent", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleMedium)
                                TextButton(onClick = ::clearRecents, enabled = !recentLoading) { Text("Clear all") }
                            }
                            LazyColumn(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(SearchDimensions.listSpacing)) {
                                items(recentEntries, key = SearchRecent::id) { recent ->
                                    RecentSearchRow(
                                        recent = recent,
                                        onSelect = { query = recent.query },
                                        onRemove = { removeRecent(recent.id) },
                                    )
                                }
                            }
                        }
                        if (recentError != null) {
                            RecentHistoryNotice(onRetry = ::refreshRecents)
                        } else if (recentLoading && recentEntries.isEmpty()) {
                            Box(Modifier.fillMaxWidth().padding(SearchDimensions.loadingInset), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                        }
                        if (recentEntries.isEmpty() && recentError == null && !recentLoading) {
                            CenterMessage("Search posts on Nantty", "Type a name, phrase, or hashtag to discover matching posts.")
                        }
                    }
                } else {
                    CenterMessage("Search posts on Nantty", "Type a name, phrase, or hashtag to discover matching posts.")
                }
            }
            loading && result == null -> CenterMessage("Searching Nantty…", progress = true)
            result is SearchResult.Failure -> CenterMessage(
                if ((result as SearchResult.Failure).authenticationRequired) "Your session has expired" else "Search is unavailable",
                (result as SearchResult.Failure).message,
                action = if ((result as SearchResult.Failure).authenticationRequired) onReauthenticate else ({ retryGeneration += 1 }),
                actionLabel = if ((result as SearchResult.Failure).authenticationRequired) "Sign in again" else "Try again",
            )
            result is SearchResult.Success && (result as SearchResult.Success).page.let { it.posts.isEmpty() && it.users.isEmpty() && it.products.isEmpty() } -> CenterMessage("No results found", "Try another search or choose a different result type.")
            result is SearchResult.Success -> {
                val page = (result as SearchResult.Success).page
                LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(page.products, key = { "product:${it.id}" }) { product ->
                        SearchProductRow(product, onClick = { recordQuery(query); onOpenProduct(product.id) })
                    }
                    items(page.users, key = { "user:${it.id}" }) { user -> SearchUserRow(user, onClick = { recordQuery(query); onOpenProfile(user.id) }) }
                    items(page.posts, key = { "post:${it.id}" }) {
                        post -> SearchPostRow(
                            post,
                            onClick = { recordQuery(query); onOpenPost(post.id) },
                            onOpenProfile = { userId -> recordQuery(query); onOpenProfile(userId) },
                        )
                    }
                    item(key = "search-pagination") {
                        when {
                            loadingMore -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                            paginationError -> TextButton(onClick = ::loadMore, modifier = Modifier.fillMaxWidth()) { Text("Couldn’t load more. Try again") }
                            page.nextCursor != null -> TextButton(onClick = ::loadMore, modifier = Modifier.fillMaxWidth().padding(8.dp)) { Text("Show more") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RecentHistoryNotice(onRetry: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = SearchDimensions.noticeHorizontal, vertical = SearchDimensions.noticeVertical),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Recent searches couldn’t be updated.",
            Modifier.weight(1f).semantics { contentDescription = "Recent searches couldn’t be updated" },
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodySmall,
        )
        TextButton(onClick = onRetry) { Text("Try again") }
    }
}

@Composable
private fun RecentSearchRow(recent: SearchRecent, onSelect: () -> Unit, onRemove: () -> Unit) {
    Surface(
        onClick = onSelect,
        modifier = Modifier.fillMaxWidth().padding(horizontal = SearchDimensions.rowHorizontal).sizeIn(minHeight = SearchDimensions.minimumRowHeight)
            .semantics(mergeDescendants = true) { contentDescription = "Search ${recent.query}" },
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(Modifier.padding(start = SearchDimensions.rowContentStart, end = SearchDimensions.rowContentEnd), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(recent.query, Modifier.weight(1f).padding(horizontal = SearchDimensions.rowTextHorizontal), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge)
            androidx.compose.material3.IconButton(onClick = onRemove, modifier = Modifier.sizeIn(minWidth = SearchDimensions.minimumTouchTarget, minHeight = SearchDimensions.minimumTouchTarget)) {
                Icon(Icons.Default.Close, contentDescription = "Remove ${recent.query} from recent searches")
            }
        }
    }
}

private object SearchDimensions {
    val headerHorizontal = 20.dp
    val headerVertical = 8.dp
    val listSpacing = 4.dp
    val loadingInset = 20.dp
    val noticeHorizontal = 20.dp
    val noticeVertical = 4.dp
    val rowHorizontal = 12.dp
    val minimumRowHeight = 56.dp
    val rowContentStart = 16.dp
    val rowContentEnd = 8.dp
    val rowTextHorizontal = 12.dp
    val minimumTouchTarget = 48.dp
}

@Composable
private fun SearchProductRow(product: SearchProduct, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = SearchDimensions.rowHorizontal)
            .sizeIn(minHeight = 88.dp).testTag("product-search-result-${product.id}").semantics(mergeDescendants = true) {
                contentDescription = "Product ${product.name}, ${formatSearchProductPrice(product.amountMinor, product.currency)}"
            },
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (product.imageUrl != null) {
                AsyncImage(
                    model = product.imageUrl,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)),
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                )
            }
            Column(Modifier.weight(1f)) {
                Text(product.name, style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(formatSearchProductPrice(product.amountMinor, product.currency), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (product.stock == 0) Text("Out of stock", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

private fun formatSearchProductPrice(amountMinor: Long, currencyCode: String): String = runCatching {
    val currency = java.util.Currency.getInstance(currencyCode)
    java.text.NumberFormat.getCurrencyInstance(java.util.Locale.getDefault()).apply { this.currency = currency }
        .format(java.math.BigDecimal.valueOf(amountMinor, currency.defaultFractionDigits.coerceAtLeast(0)))
}.getOrElse { "$currencyCode ${amountMinor}" }

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
