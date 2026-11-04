package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.nantty.android.data.ExploreCategory
import com.nantty.android.data.ExploreHeadline
import com.nantty.android.data.ExplorePostsPage
import com.nantty.android.data.ExploreRepository
import com.nantty.android.data.ExploreResult
import com.nantty.android.data.ExploreSuggestion
import com.nantty.android.data.ExploreTrend
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FollowActionResult
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.RecentSearchResult
import com.nantty.android.data.SearchRecent
import java.util.concurrent.Executor

private val exploreCategories = listOf(
    ExploreCategory("for_you", "For you"), ExploreCategory("trending", "Trending"), ExploreCategory("news", "News"),
    ExploreCategory("sports", "Sports"), ExploreCategory("entertainment", "Entertainment"), ExploreCategory("music", "Music"),
    ExploreCategory("tech", "Tech"), ExploreCategory("business", "Business"), ExploreCategory("fashion", "Fashion"),
    ExploreCategory("gaming", "Gaming"), ExploreCategory("comedy", "Comedy"), ExploreCategory("religion", "Religion"),
    ExploreCategory("food", "Food"), ExploreCategory("politics", "Politics"), ExploreCategory("lifestyle", "Lifestyle"),
)

@Composable
internal fun ExploreHomeScreen(
    repository: ExploreRepository,
    executor: Executor,
    signedIn: Boolean,
    onSearch: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onRequireSignIn: () -> Unit,
    modifier: Modifier = Modifier,
    profileRepository: PublicProfileRepository? = null,
    recentEntries: List<SearchRecent> = emptyList(),
    recentLoading: Boolean = false,
    recentError: String? = null,
    onSelectRecent: (SearchRecent) -> Unit = {},
    onRemoveRecent: (SearchRecent) -> Unit = {},
    onClearRecents: () -> Unit = {},
    onRetryRecents: () -> Unit = {},
) {
    var category by remember(repository) { mutableStateOf("for_you") }
    var showAllTrends by remember(repository) { mutableStateOf(false) }
    var categories by remember(repository) { mutableStateOf(exploreCategories) }
    var trends by remember(repository) { mutableStateOf<List<ExploreTrend>>(emptyList()) }
    var headlines by remember(repository) { mutableStateOf<List<ExploreHeadline>>(emptyList()) }
    var suggestions by remember(repository) { mutableStateOf<List<ExploreSuggestion>>(emptyList()) }
    var posts by remember(repository) { mutableStateOf<ExplorePostsPage?>(null) }
    var categoriesError by remember(repository) { mutableStateOf<String?>(null) }
    var trendsError by remember(repository) { mutableStateOf<String?>(null) }
    var headlinesError by remember(repository) { mutableStateOf<String?>(null) }
    var suggestionsError by remember(repository) { mutableStateOf<String?>(null) }
    var postsError by remember(repository) { mutableStateOf<String?>(null) }
    var categoriesLoading by remember(repository) { mutableStateOf(true) }
    var trendsLoading by remember(repository) { mutableStateOf(true) }
    var headlinesLoading by remember(repository) { mutableStateOf(true) }
    var suggestionsLoading by remember(repository) { mutableStateOf(true) }
    var postsLoading by remember(repository) { mutableStateOf(true) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var retryCategories by remember(repository) { mutableStateOf(0) }
    var retryTrends by remember(repository) { mutableStateOf(0) }
    var retryHeadlines by remember(repository) { mutableStateOf(0) }
    var retrySuggestions by remember(repository) { mutableStateOf(0) }
    var retryPosts by remember(repository) { mutableStateOf(0) }
    var requestGeneration by remember(repository) { mutableStateOf(0) }
    var followError by remember(repository) { mutableStateOf<String?>(null) }
    val followStates = remember(repository) { mutableStateMapOf<String, String>() }
    val followBusy = remember(repository) { mutableStateMapOf<String, Boolean>() }

    LaunchedEffect(repository, retryCategories) {
        categoriesLoading = true
        executor.execute {
            val result = repository.loadCategories()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                when (result) {
                    is ExploreResult.Success -> { categories = result.value; categoriesError = null }
                    is ExploreResult.Failure -> categoriesError = result.message
                }
                categoriesLoading = false
            }
        }
    }

    LaunchedEffect(repository, retrySuggestions) {
        suggestionsLoading = true
        executor.execute {
            val result = repository.loadWhoToFollow()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                when (result) {
                    is ExploreResult.Success -> { suggestions = result.value; suggestionsError = null }
                    is ExploreResult.Failure -> suggestionsError = result.message
                }
                suggestionsLoading = false
            }
        }
    }

    LaunchedEffect(repository, category, retryTrends, retryHeadlines, retryPosts) {
        requestGeneration += 1
        val generation = requestGeneration
        trendsLoading = true
        headlinesLoading = true
        postsLoading = true
        postsError = null
        trendsError = null
        headlinesError = null
        executor.execute {
            val nextTrends = repository.loadTrends(category)
            val nextHeadlines = repository.loadHeadlines(category)
            val nextPosts = repository.loadPosts(category)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    when (nextTrends) {
                        is ExploreResult.Success -> { trends = nextTrends.value.items; trendsError = null }
                        is ExploreResult.Failure -> trendsError = nextTrends.message
                    }
                    when (nextHeadlines) {
                        is ExploreResult.Success -> { headlines = nextHeadlines.value.items; headlinesError = null }
                        is ExploreResult.Failure -> headlinesError = nextHeadlines.message
                    }
                    when (nextPosts) {
                        is ExploreResult.Success -> { posts = nextPosts.value; postsError = null }
                        is ExploreResult.Failure -> postsError = nextPosts.message
                    }
                    trendsLoading = false
                    headlinesLoading = false
                    postsLoading = false
                }
            }
        }
    }

    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().widthIn(max = 960.dp).testTag("explore-home-content"),
            contentPadding = PaddingValues(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            if (recentEntries.isNotEmpty() || recentLoading || recentError != null) {
                item(key = "recent-search-header") {
                    Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 14.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Recent searches", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        TextButton(onClick = onClearRecents, enabled = recentEntries.isNotEmpty() && !recentLoading) { Text("Clear") }
                    }
                }
                if (recentLoading && recentEntries.isEmpty()) item(key = "recent-loading") { LoadingLine("Loading recent searches") }
                if (recentError != null) item(key = "recent-error") { RetryLine("Recent searches couldn’t be updated.", onRetryRecents) }
                items(recentEntries, key = { "recent:${it.id}" }) { entry ->
                    RecentExploreSearchRow(entry, onClick = { onSelectRecent(entry) }, onRemove = { onRemoveRecent(entry) })
                }
            }

            item(key = "explore-category-heading") {
                Text("Explore", Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 4.dp).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            item(key = "explore-categories") {
                LazyRow(
                    modifier = Modifier.fillMaxWidth().testTag("explore-category-tabs"),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(categories, key = ExploreCategory::id) { item ->
                        FilterChip(
                            selected = item.id == category,
                            onClick = { if (category != item.id) { category = item.id; followError = null } },
                            label = { Text(item.label) },
                            modifier = Modifier.semantics { contentDescription = "Explore ${item.label}${if (item.id == category) ", selected" else ""}" },
                        )
                    }
                    if (categoriesLoading && categories.isEmpty()) item { CircularProgressIndicator(Modifier.padding(12.dp).size(20.dp), strokeWidth = 2.dp) }
                    if (categoriesError != null) item { TextButton(onClick = { retryCategories += 1 }) { Text("Retry categories") } }
                }
            }

            item(key = "headlines-title") { ExploreHeading("What’s happening") }
            when {
                headlinesLoading && headlines.isEmpty() -> item(key = "headlines-loading") { LoadingLine("Loading headlines") }
                headlinesError != null && headlines.isEmpty() -> item(key = "headlines-error") { RetryLine("Headlines didn’t load.", { retryHeadlines += 1 }) }
                headlines.isEmpty() -> item(key = "headlines-empty") { QuietLine("Nothing big is happening here right now.") }
                else -> item(key = "headlines-list") {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(headlines, key = ExploreHeadline::id) { headline ->
                            HeadlineExploreCard(headline, onClick = {
                                headline.postIds.firstOrNull()?.let(onOpenPost) ?: onSearch(headline.hashtags.firstOrNull() ?: headline.id)
                            })
                        }
                    }
                }
            }

            item(key = "trends-title") {
                Row(
                    Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 18.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (category == "for_you") "Trends for you" else "Trending",
                        Modifier.weight(1f).semantics { heading() },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (trends.size > COLLAPSED_TREND_COUNT) {
                        TextButton(
                            onClick = { showAllTrends = !showAllTrends },
                            modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).testTag("explore-toggle-trends"),
                        ) { Text(if (showAllTrends) "Show less" else "Show more") }
                    }
                }
            }
            when {
                trendsLoading && trends.isEmpty() -> item(key = "trends-loading") { LoadingLine("Loading trends") }
                trendsError != null && trends.isEmpty() -> item(key = "trends-error") { RetryLine("Trends didn’t load.", { retryTrends += 1 }) }
                trends.isEmpty() -> item(key = "trends-empty") { QuietLine("No trends in this category yet.") }
                else -> items(
                    if (showAllTrends) trends else trends.take(COLLAPSED_TREND_COUNT),
                    key = ExploreTrend::hashtag,
                ) { trend -> TrendExploreRow(trend, onClick = { onSearch(trend.hashtag) }) }
            }

            item(key = "suggestions-title") { ExploreHeading("Who to follow") }
            when {
                suggestionsLoading && suggestions.isEmpty() -> item(key = "suggestions-loading") { LoadingLine("Loading account suggestions") }
                suggestionsError != null && suggestions.isEmpty() -> item(key = "suggestions-error") { RetryLine("Suggestions didn’t load.", { retrySuggestions += 1 }) }
                suggestions.isEmpty() -> item(key = "suggestions-empty") { QuietLine("No suggestions right now.") }
                else -> items(suggestions, key = { it.user.id }) { suggestion ->
                    FollowExploreRow(
                        suggestion = suggestion,
                        signedIn = signedIn,
                        followingState = followStates[suggestion.user.id] ?: "none",
                        busy = followBusy[suggestion.user.id] == true,
                        onOpenProfile = { onOpenProfile(suggestion.user.id) },
                        onFollow = {
                            if (!signedIn) onRequireSignIn()
                            else if (profileRepository == null || followBusy[suggestion.user.id] == true) Unit
                            else {
                                val follow = followStates[suggestion.user.id] !in setOf("accepted", "requested")
                                followBusy[suggestion.user.id] = true
                                followError = null
                                executor.execute {
                                    val action = profileRepository.setFollow(suggestion.user.id, follow)
                                    androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        when (action) {
                                            is FollowActionResult.Success -> followStates[suggestion.user.id] = action.state
                                            is FollowActionResult.Failure -> followError = action.message
                                        }
                                        followBusy[suggestion.user.id] = false
                                    }
                                }
                            }
                        },
                    )
                }
            }
            if (followError != null) item(key = "follow-error") { QuietLine(followError.orEmpty(), isError = true) }

            item(key = "posts-title") { ExploreHeading("Posts for you") }
            when {
                postsLoading && posts == null -> item(key = "posts-loading") { LoadingLine("Loading posts for you") }
                postsError != null && posts == null -> item(key = "posts-error") { RetryLine("Posts didn’t load.", { retryPosts += 1 }) }
                posts?.posts.isNullOrEmpty() -> item(key = "posts-empty") { QuietLine("No posts here yet. Try another category.") }
                else -> {
                    items(posts?.posts.orEmpty(), key = { "explore-post:${it.post.id}" }) { ranked ->
                        if (ranked.explanations.isNotEmpty()) {
                            Text(
                                "Why this post · ${ranked.explanations.joinToString(" · ") { it.label }}",
                                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                        FeedCard(post = ranked.post, onOpenPost = onOpenPost, onOpenProfile = onOpenProfile)
                    }
                    if (posts?.nextCursor != null) {
                        item(key = "posts-more") {
                            TextButton(
                                onClick = {
                                    val cursor = posts?.nextCursor ?: return@TextButton
                                    if (loadingMore) return@TextButton
                                    val selectedCategory = category
                                    val generation = requestGeneration
                                    loadingMore = true
                                    executor.execute {
                                        val next = repository.loadPosts(selectedCategory, cursor)
                                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            if (generation == requestGeneration && selectedCategory == category) {
                                                when (next) {
                                                    is ExploreResult.Success -> {
                                                        val old = posts?.posts.orEmpty()
                                                        posts = ExplorePostsPage((old + next.value.posts).distinctBy { it.post.id }, next.value.nextCursor)
                                                        postsError = null
                                                    }
                                                    is ExploreResult.Failure -> postsError = next.message
                                                }
                                            }
                                            loadingMore = false
                                        }
                                    }
                                },
                                enabled = !loadingMore,
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).sizeIn(minHeight = 48.dp).testTag("explore-load-more"),
                            ) {
                                if (loadingMore) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Show more posts")
                            }
                        }
                    }
                }
            }
        }
    }
}

private const val COLLAPSED_TREND_COUNT = 5

@Composable
private fun ExploreHeading(title: String) {
    Text(title, Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 18.dp, bottom = 6.dp).semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
}

@Composable
private fun LoadingLine(label: String) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun RetryLine(message: String, onRetry: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(message, Modifier.weight(1f), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        TextButton(onClick = onRetry) { Text("Try again") }
    }
}

@Composable
private fun QuietLine(message: String, isError: Boolean = false) {
    Text(message, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp), style = MaterialTheme.typography.bodySmall, color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun RecentExploreSearchRow(entry: SearchRecent, onClick: () -> Unit, onRemove: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp).sizeIn(minHeight = 56.dp)
            .semantics(mergeDescendants = true) { contentDescription = "Search ${entry.query}" },
    ) {
        Row(Modifier.padding(start = 16.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(entry.query, Modifier.weight(1f).padding(horizontal = 12.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge)
            androidx.compose.material3.IconButton(onClick = onRemove, modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Remove ${entry.query} from recent searches")
            }
        }
    }
}

@Composable
private fun HeadlineExploreCard(headline: ExploreHeadline, onClick: () -> Unit) {
    Surface(onClick = onClick, modifier = Modifier.widthIn(min = 260.dp, max = 360.dp).sizeIn(minHeight = 164.dp).testTag("explore-headline-${headline.id}"), shape = RoundedCornerShape(18.dp), tonalElevation = 1.dp) {
        Column {
            headline.coverImageUrl?.let { url ->
                AsyncImage(url, contentDescription = null, modifier = Modifier.fillMaxWidth().sizeIn(minHeight = 82.dp, maxHeight = 112.dp), contentScale = ContentScale.Crop)
            }
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(headline.categoryLabel.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                Text(headline.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Text("${headline.postCount} posts · ${headline.authorCount} people", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(headline.sourceLabel, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun TrendExploreRow(trend: ExploreTrend, onClick: () -> Unit) {
    Surface(onClick = onClick, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp).sizeIn(minHeight = 68.dp).semantics(mergeDescendants = true) {
        contentDescription = "Search ${trend.label}, trending in ${trend.categoryLabel}, ${trend.postCount} posts"
    }) {
        Column(Modifier.padding(horizontal = 18.dp, vertical = 10.dp)) {
            Text("${trend.rank} · ${trend.context.ifBlank { trend.categoryLabel }}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(trend.label, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text("${trend.postCount} posts · ${trend.authorCount} people · ${trend.scope}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun FollowExploreRow(
    suggestion: ExploreSuggestion,
    signedIn: Boolean,
    followingState: String,
    busy: Boolean,
    onOpenProfile: () -> Unit,
    onFollow: () -> Unit,
) {
    val user = suggestion.user
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(onClick = onOpenProfile, modifier = Modifier.weight(1f).sizeIn(minHeight = 56.dp).semantics(mergeDescendants = true) { contentDescription = "Open ${user.name}, @${user.username}'s profile" }, color = MaterialTheme.colorScheme.surface) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(44.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                    Surface(color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.fillMaxSize()) {}
                    user.avatarUrl?.let { AsyncImage(it, contentDescription = null, modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop) }
                        ?: Text(user.name.firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(user.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (suggestion.isOfficial || user.verified) Icon(Icons.Default.Verified, contentDescription = if (suggestion.isOfficial) "Official account" else "Verified account", modifier = Modifier.padding(start = 4.dp).size(16.dp), tint = MaterialTheme.colorScheme.primary)
                    }
                    Text("@${user.username}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(suggestion.reasonLabel, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        androidx.compose.material3.Button(onClick = onFollow, enabled = !busy, modifier = Modifier.sizeIn(minWidth = 88.dp, minHeight = 48.dp)) {
            if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            else Text(when (followingState) { "accepted" -> "Following"; "requested" -> "Requested"; else -> if (signedIn) "Follow" else "Sign in" })
        }
    }
}
