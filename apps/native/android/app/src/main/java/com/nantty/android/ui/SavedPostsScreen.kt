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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SavedPost
import com.nantty.android.data.SavedPostsPage
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.SavedPostsResult
import com.nantty.android.data.SavedPostType
import com.nantty.android.data.appendUniqueSavedPosts
import java.util.concurrent.Executor

@Composable
internal fun SavedPostsScreen(
    repository: SavedPostsRepository,
    executor: Executor,
    onBack: () -> Unit,
    onOpenPost: (String) -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var result by remember(repository) { mutableStateOf<SavedPostsResult?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var loadMoreFailure by remember(repository) { mutableStateOf<SavedPostsResult.Failure?>(null) }
    var retryGeneration by remember(repository) { mutableStateOf(0) }
    var requestGeneration by remember(repository) { mutableStateOf(0) }
    var selectedType by remember(repository) { mutableStateOf(SavedPostType.POSTS) }
    val success = result as? SavedPostsResult.Success

    LaunchedEffect(repository, retryGeneration, selectedType) {
        val generation = ++requestGeneration
        val requestedType = selectedType
        loading = true
        result = null
        executor.execute {
            val loaded = repository.load(type = requestedType)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    result = loaded
                    loading = false
                }
            }
        }
    }

    fun loadMore() {
        val page = (result as? SavedPostsResult.Success)?.page ?: return
        val cursor = page.nextCursor ?: return
        if (loadingMore || loading) return
        val generation = requestGeneration
        val requestedType = selectedType
        loadingMore = true
        loadMoreFailure = null
        executor.execute {
            val next = repository.load(cursor, requestedType)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    when (next) {
                        is SavedPostsResult.Failure -> loadMoreFailure = next
                        is SavedPostsResult.Success -> {
                            val current = (result as? SavedPostsResult.Success)?.page ?: page
                            result = SavedPostsResult.Success(
                                SavedPostsPage(appendUniqueSavedPosts(current.posts, next.page.posts), next.page.nextCursor),
                            )
                        }
                    }
                    loadingMore = false
                }
            }
        }
    }

    fun selectType(type: SavedPostType) {
        if (selectedType == type) return
        requestGeneration++
        selectedType = type
        loading = true
        loadingMore = false
        result = null
        loadMoreFailure = null
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 20.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Column {
                Text(if (selectedType == SavedPostType.POSTS) "Saved posts" else "Saved videos", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Only you can see these", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall)
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selectedType == SavedPostType.POSTS, onClick = { selectType(SavedPostType.POSTS) }, label = { Text("Posts") })
            FilterChip(selectedType == SavedPostType.VIDEOS, onClick = { selectType(SavedPostType.VIDEOS) }, label = { Text("Videos") })
        }
        when {
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator()
                    Text(if (selectedType == SavedPostType.POSTS) "Loading saved posts" else "Loading saved videos", color = MaterialTheme.colorScheme.secondary)
                }
            }
            result is SavedPostsResult.Failure && success == null -> {
                val failure = result as SavedPostsResult.Failure
                CenterSavedPostsMessage(
                    title = if (failure.authenticationRequired) "Sign in to continue" else "Saved posts are unavailable",
                    message = failure.message,
                    action = if (failure.authenticationRequired) onAuthenticationRequired else ({ retryGeneration += 1 }),
                    actionLabel = if (failure.authenticationRequired) "Sign in again" else "Retry",
                )
            }
            success != null && success.page.posts.isEmpty() -> CenterSavedPostsMessage(
                title = if (selectedType == SavedPostType.POSTS) "No saved posts yet" else "No saved videos yet",
                message = if (selectedType == SavedPostType.POSTS) "Save a post from your feed and it will be easy to find here." else "Save a video from your feed and it will be easy to find here.",
                icon = true,
            )
            success != null -> LazyColumn(Modifier.fillMaxSize()) {
                items(success.page.posts, key = SavedPost::saveId) { saved ->
                    FeedCard(
                        post = saved.post,
                        onOpenPost = onOpenPost,
                        canInteract = false,
                    )
                }
                item(key = "saved-posts-pagination") {
                    when {
                        loadingMore -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading more saved posts" })
                        }
                        loadMoreFailure != null -> Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Couldn't load the next page.", color = MaterialTheme.colorScheme.error)
                            TextButton(onClick = {
                                if (loadMoreFailure?.authenticationRequired == true) onAuthenticationRequired() else loadMore()
                            }) { Text(if (loadMoreFailure?.authenticationRequired == true) "Sign in again" else "Try again") }
                        }
                        success.page.nextCursor != null -> TextButton(
                            onClick = ::loadMore,
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                        ) { Text("Load more saved posts") }
                    }
                }
            }
        }
    }
}

@Composable
private fun CenterSavedPostsMessage(
    title: String,
    message: String,
    action: (() -> Unit)? = null,
    actionLabel: String = "Retry",
    icon: Boolean = false,
) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (icon) Icon(Icons.Default.BookmarkBorder, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
        Spacer(Modifier.height(12.dp))
        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(message, color = MaterialTheme.colorScheme.secondary)
        action?.let { TextButton(onClick = it) { Text(actionLabel) } }
    }
}
