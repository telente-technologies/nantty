package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ExploreRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.RecentSearchResult
import com.nantty.android.data.SearchPage
import com.nantty.android.data.SearchPost
import com.nantty.android.data.SearchProduct
import com.nantty.android.data.SearchRecent
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
    onOpenProduct: (String) -> Unit = {},
    onOpenStore: (String) -> Unit = {},
    onOpenBrand: (String) -> Unit = {},
    onOpenCategory: (String, String) -> Unit = { _, _ -> },
    exploreRepository: ExploreRepository? = null,
    profileRepository: PublicProfileRepository? = null,
    onRequireSignIn: () -> Unit = onReauthenticate,
    onRequireSignInWithAction: ((() -> Unit) -> Unit) = { onRequireSignIn() },
    initialScope: String = SearchRepository.GLOBAL_SCOPE,
    initialScopeLabel: String = "Everywhere",
    onScopeChanged: (String, String) -> Unit = { _, _ -> },
) {
    var query by rememberSaveable(repository) { mutableStateOf("") }
    var type by rememberSaveable(repository, initialScope) { mutableStateOf(if (initialScope == "mart") SearchType.PRODUCTS else SearchType.TOP) }
    var scope by rememberSaveable(repository, initialScope) { mutableStateOf(initialScope) }
    var scopeLabel by rememberSaveable(repository, initialScope, initialScopeLabel) { mutableStateOf(initialScopeLabel) }
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
    val normalizedQuery = query.trim()

    fun refreshRecents() {
        if (!signedIn) return
        recentLoading = true
        executor.execute {
            val loaded = repository.listRecentSearches(scope)
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
            val recorded = repository.recordRecentSearch(clean, scope)
            val loaded = repository.listRecentSearches(scope)
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
            val loaded = repository.listRecentSearches(scope)
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
            val cleared = repository.clearRecentSearches(scope)
            val loaded = repository.listRecentSearches(scope)
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

    LaunchedEffect(repository, signedIn, scope) {
        if (signedIn) {
            refreshRecents()
        } else {
            recentEntries = emptyList()
            recentError = null
            recentLoading = false
        }
    }

    LaunchedEffect(normalizedQuery, type, scope, repository, retryGeneration) {
        requestGeneration += 1
        val generation = requestGeneration
        val cleanQuery = normalizedQuery
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
                val next = repository.search(cleanQuery, type, scope = scope)
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
            val next = repository.search(query.trim(), type, cursor, scope)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    when (next) {
                        is SearchResult.Failure -> paginationError = true
                        is SearchResult.Success -> {
                            val latest = (result as? SearchResult.Success)?.page ?: current
                            val mergedPosts = (latest.posts + next.page.posts).distinctBy(SearchPost::id)
                            val mergedUsers = (latest.users + next.page.users).distinctBy(SearchUser::id)
                            val mergedProducts = (latest.products + next.page.products).distinctBy(SearchProduct::id)
                    val mergedOther = (latest.otherResults + next.page.otherResults).distinctBy { "${it.kind}:${it.id}" }
                    result = SearchResult.Success(SearchPage(mergedPosts, mergedUsers, next.page.nextCursor, mergedProducts, mergedOther))
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
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            androidx.compose.material3.FilterChip(
                selected = scope == SearchRepository.GLOBAL_SCOPE,
                onClick = {
                    scope = SearchRepository.GLOBAL_SCOPE
                    scopeLabel = "Everywhere"
                    type = SearchType.TOP
                    onScopeChanged(scope, scopeLabel)
                },
                label = { Text("Everywhere") },
            )
            androidx.compose.material3.FilterChip(
                selected = scope == "mart",
                onClick = {
                    scope = "mart"
                    scopeLabel = "Mart"
                    type = SearchType.PRODUCTS
                    onScopeChanged(scope, scopeLabel)
                },
                label = { Text("Mart") },
            )
            if (scope.startsWith("store:") || scope.startsWith("profile:")) {
                androidx.compose.material3.FilterChip(selected = true, onClick = {
                    scope = SearchRepository.GLOBAL_SCOPE
                    scopeLabel = "Everywhere"
                    type = SearchType.TOP
                    onScopeChanged(scope, scopeLabel)
                }, label = { Text(scopeLabel, maxLines = 1, overflow = TextOverflow.Ellipsis) })
            }
        }
        val resultTypes = when {
            scope == SearchRepository.GLOBAL_SCOPE -> SearchType.entries.map { it to it.label }
            scope.startsWith("store:") -> listOf(
                SearchType.TOP to "All",
                SearchType.PRODUCTS to "Products",
                SearchType.POSTS to "Posts",
            )
            scope.startsWith("profile:") -> listOf(
                SearchType.TOP to "All",
                SearchType.POSTS to "Posts",
                SearchType.CLIPS to "Clips",
                SearchType.PRODUCTS to "Products",
            )
            else -> emptyList()
        }
        if (query.isNotBlank() && resultTypes.isNotEmpty()) {
            androidx.compose.foundation.lazy.LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(resultTypes, key = { (option, _) -> option.apiValue }) { (option, label) ->
                    androidx.compose.material3.FilterChip(
                        selected = type == option,
                        onClick = { type = option },
                        label = { Text(label) },
                    )
                }
            }
        }
        if (signedIn && query.isNotBlank() && recentError != null) {
            RecentHistoryNotice(onRetry = ::refreshRecents)
        }
        when {
            query.isBlank() && scope == SearchRepository.GLOBAL_SCOPE && exploreRepository != null -> ExploreHomeScreen(
                repository = exploreRepository,
                executor = executor,
                signedIn = signedIn,
                onSearch = { hashtag -> query = "#${hashtag.removePrefix("#")}"; type = SearchType.POSTS },
                onOpenPost = onOpenPost,
                onOpenProfile = { onOpenProfile(it) },
                onRequireSignIn = onRequireSignIn,
                onRequireSignInWithAction = onRequireSignInWithAction,
                modifier = Modifier.weight(1f),
                profileRepository = profileRepository,
                recentEntries = recentEntries,
                recentLoading = recentLoading,
                recentError = recentError,
                onSelectRecent = { query = it.query },
                onRemoveRecent = { removeRecent(it.id) },
                onClearRecents = ::clearRecents,
                onRetryRecents = ::refreshRecents,
            )
            query.isBlank() -> SearchCenterMessage("Search ${scopeLabel}", "Type a name, phrase, or hashtag to search this space.")
            loading && result == null -> SearchCenterMessage("Searching Nantty…", progress = true)
            result is SearchResult.Failure -> SearchCenterMessage(
                if ((result as SearchResult.Failure).authenticationRequired) "Your session has expired" else "Search is unavailable",
                (result as SearchResult.Failure).message,
                action = if ((result as SearchResult.Failure).authenticationRequired) onReauthenticate else ({ retryGeneration += 1 }),
                actionLabel = if ((result as SearchResult.Failure).authenticationRequired) "Sign in again" else "Try again",
            )
            result is SearchResult.Success && (result as SearchResult.Success).page.let { it.posts.isEmpty() && it.users.isEmpty() && it.products.isEmpty() && it.otherResults.isEmpty() } -> SearchCenterMessage("No results found", "Try another search or choose a different result type.")
            result is SearchResult.Success -> {
                val page = (result as SearchResult.Success).page
                LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(page.otherResults, key = { "${it.kind}:${it.id}" }) { item ->
                        SearchOtherRow(item, onClick = when {
                            item.kind == "hashtag" || item.kind == "category" || item.kind == "store" -> ({
                            recordQuery(query)
                            when (item.kind) {
                                "hashtag" -> {
                                    query = "#${item.title.removePrefix("#")}"
                                    type = SearchType.POSTS
                                }
                                "store" -> {
                                    onOpenStore(item.id)
                                }
                                "category" -> {
                                    onOpenCategory(item.id, item.title)
                                }
                            }
                            })
                            item.kind == "brand" -> ({ recordQuery(query); onOpenBrand(item.id) })
                            else -> null
                        })
                    }
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
