package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.FeedPost
import com.nantty.android.data.PublicProfile
import com.nantty.android.data.PublicProfilePosts
import com.nantty.android.data.PublicProfilePostsResult
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfileResult
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoryRingStatus
import com.nantty.android.data.StoryRingStatusResult
import com.nantty.android.ui.stories.StoryViewerDialog
import com.nantty.android.data.FollowActionResult
import java.util.concurrent.Executor
import androidx.compose.runtime.snapshots.Snapshot

@Composable
internal fun PublicProfileScreen(
    userId: String,
    repository: PublicProfileRepository,
    executor: Executor,
    storiesRepository: StoriesRepository? = null,
    onBack: () -> Unit,
    onOpenPost: (String) -> Unit,
    onSearchProfile: (String, String) -> Unit = { _, _ -> },
    onOpenConnections: (String, String) -> Unit = { _, _ -> },
    onReauthenticate: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var profile by remember(userId) { mutableStateOf<PublicProfile?>(null) }
    var profileLoading by remember(userId) { mutableStateOf(true) }
    var profileError by remember(userId) { mutableStateOf<String?>(null) }
    var profileRetry by remember(userId) { mutableStateOf(0) }
    var posts by remember(userId) { mutableStateOf(PublicProfilePosts(emptyList(), null)) }
    var postsLoading by remember(userId) { mutableStateOf(false) }
    var postsLoadingMore by remember(userId) { mutableStateOf(false) }
    var postsError by remember(userId) { mutableStateOf<String?>(null) }
    var postsRetry by remember(userId) { mutableStateOf(0) }
    var pageGeneration by remember(userId) { mutableStateOf(0) }
    var followBusy by remember(userId) { mutableStateOf(false) }
    var followError by remember(userId) { mutableStateOf<String?>(null) }
    var confirmUnfollow by remember(userId) { mutableStateOf(false) }
    var storyRingStatus by remember(userId) { mutableStateOf<StoryRingStatus?>(null) }
    var showingStory by remember(userId) { mutableStateOf(false) }
    var storyStatusGeneration by remember(userId) { mutableIntStateOf(0) }

    fun updateFollow(follow: Boolean) {
        if (followBusy) return
        followBusy = true
        followError = null
        executor.execute {
            val result = repository.setFollow(userId, follow)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is FollowActionResult.Failure -> followError = result.message
                    is FollowActionResult.Success -> {
                        profile = profile?.let { current ->
                            val wasAccepted = current.followState == "accepted"
                            val nowAccepted = result.state == "accepted"
                            current.copy(
                                followState = result.state,
                                canViewerSeePosts = !current.isPrivate || nowAccepted || current.isViewer,
                                followers = when {
                                    !wasAccepted && nowAccepted -> current.followers + 1
                                    wasAccepted && !nowAccepted -> (current.followers - 1).coerceAtLeast(0)
                                    else -> current.followers
                                },
                            )
                        }
                    }
                }
                followBusy = false
            }
        }
    }

    if (confirmUnfollow) {
        AlertDialog(
            onDismissRequest = { confirmUnfollow = false },
            title = { Text(if (profile?.followState == "requested") "Cancel follow request?" else "Unfollow @${profile?.username.orEmpty()}?") },
            text = { Text(if (profile?.followState == "requested") "They will no longer see your request." else "Their posts will no longer appear in your Following feed.") },
            confirmButton = {
                TextButton(onClick = { confirmUnfollow = false; updateFollow(false) }) {
                    Text(if (profile?.followState == "requested") "Cancel request" else "Unfollow")
                }
            },
            dismissButton = { TextButton(onClick = { confirmUnfollow = false }) { Text("Keep") } },
        )
    }

    LaunchedEffect(userId, profileRetry, repository) {
        profile = null
        profileLoading = true
        profileError = null
        posts = PublicProfilePosts(emptyList(), null)
        postsError = null
        postsLoading = false
        pageGeneration += 1
        val generation = pageGeneration
        executor.execute {
            val result = repository.loadProfile(userId)
            Snapshot.withMutableSnapshot {
                if (pageGeneration == generation) {
                    when (result) {
                        is PublicProfileResult.Failure -> profileError = result.message
                        is PublicProfileResult.Success -> profile = result.profile
                    }
                    profileLoading = false
                }
            }
        }
    }

    LaunchedEffect(userId, profile?.id, postsRetry, repository) {
        val current = profile ?: return@LaunchedEffect
        pageGeneration += 1
        val generation = pageGeneration
        if (!current.canViewerSeePosts || current.isSuspended) {
            posts = PublicProfilePosts(emptyList(), null)
            postsLoading = false
            postsLoadingMore = false
            return@LaunchedEffect
        }
        posts = PublicProfilePosts(emptyList(), null)
        postsError = null
        postsLoading = true
        executor.execute {
            val result = repository.loadPosts(userId)
            Snapshot.withMutableSnapshot {
                if (pageGeneration == generation) {
                    when (result) {
                        is PublicProfilePostsResult.Failure -> postsError = result.message
                        is PublicProfilePostsResult.Success -> posts = result.page
                    }
                    postsLoading = false
                }
            }
        }
    }

    LaunchedEffect(userId, profile?.id, profile?.isPrivate, profile?.canViewerSeePosts, profile?.isViewer, storiesRepository) {
        val current = profile ?: return@LaunchedEffect
        storyRingStatus = null
        val stories = storiesRepository ?: return@LaunchedEffect
        if ((current.isPrivate && !current.canViewerSeePosts && !current.isViewer) || current.isSuspended) return@LaunchedEffect
        val generation = ++storyStatusGeneration
        executor.execute {
            val loaded = stories.loadStoryRingStatus(userId)
            Snapshot.withMutableSnapshot {
                if (storyStatusGeneration == generation) {
                    storyRingStatus = (loaded as? StoryRingStatusResult.Success)?.status
                }
            }
        }
    }

    fun loadMore() {
        val cursor = posts.nextCursor ?: return
        if (postsLoadingMore || postsLoading) return
        val generation = pageGeneration
        postsLoadingMore = true
        postsError = null
        executor.execute {
            val result = repository.loadPosts(userId, cursor)
            Snapshot.withMutableSnapshot {
                if (pageGeneration == generation) {
                    when (result) {
                        is PublicProfilePostsResult.Failure -> postsError = result.message
                        is PublicProfilePostsResult.Success -> {
                            val unique = (posts.posts + result.page.posts).distinctBy(FeedPost::id)
                            posts = PublicProfilePosts(unique, result.page.nextCursor)
                        }
                    }
                    postsLoadingMore = false
                }
            }
        }
    }

    BoxWithConstraints(modifier.fillMaxSize()) {
        val horizontal = if (maxWidth >= 600.dp) 36.dp else 16.dp
        Column(Modifier.widthIn(max = 760.dp).fillMaxSize().align(Alignment.TopCenter)) {
            Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack, modifier = Modifier.size(48.dp).semantics { contentDescription = "Back" }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                }
                Text("Profile", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                IconButton(
                    onClick = { profile?.let { onSearchProfile(it.id, it.username) } },
                    enabled = profile != null,
                    modifier = Modifier.semantics {
                        contentDescription = profile?.let { "Search @${it.username}'s posts" } ?: "Search profile posts"
                    },
                ) {
                    Icon(Icons.Default.Search, contentDescription = null)
                }
            }
            when {
                profileLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                profileError != null -> ProfileMessage("Profile unavailable", profileError, "Try again") { profileRetry += 1 }
                profile != null -> LazyColumn(Modifier.fillMaxSize()) {
                    item(key = "profile-header") {
                        val current = profile!!
                        ProfileHeader(
                            current,
                            horizontal,
                            showFollow = !current.isViewer && repository.viewerId() != null && current.followState != "blocked" && !current.isSuspended,
                            followBusy = followBusy,
                            followError = followError,
                            storyRingStatus = storyRingStatus,
                            onOpenStory = { showingStory = true },
                            onOpenConnections = onOpenConnections,
                            onFollow = {
                                if (current.followState == "accepted" || current.followState == "requested") confirmUnfollow = true
                                else updateFollow(true)
                            },
                        )
                        if (profile!!.isPrivate && !profile!!.canViewerSeePosts) ProfileMessage("This account is private", "Follow this account to see its posts.")
                        else if (profile!!.isSuspended) ProfileMessage("This account is unavailable", "Its posts are not shown here.")
                        else {
                            Text("Posts", Modifier.fillMaxWidth().padding(horizontal = horizontal, vertical = 16.dp).semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            HorizontalDivider()
                        }
                    }
                    if (profile?.canViewerSeePosts == true && profile?.isSuspended != true) {
                        if (postsLoading && posts.posts.isEmpty()) item(key = "posts-loading") {
                            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                        }
                        postsError?.let { error -> item(key = "posts-error") { ProfileMessage("Posts could not load", error, "Try again") { postsRetry += 1 } } }
                        items(posts.posts, key = FeedPost::id) { post -> FeedCard(post, onOpenPost = onOpenPost) }
                        if (!postsLoading && posts.posts.isEmpty() && postsError == null) item(key = "posts-empty") {
                            ProfileMessage("No public posts yet", "When ${profile!!.name} shares a public post, it will appear here.")
                        }
                        if (posts.nextCursor != null) item(key = "posts-more") {
                            TextButton(onClick = ::loadMore, enabled = !postsLoadingMore, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                                if (postsLoadingMore) CircularProgressIndicator(Modifier.size(20.dp)) else Text("Load more posts")
                            }
                        }
                    }
                }
            }
        }
    }

    if (showingStory && storyRingStatus?.hasActiveStory == true && storiesRepository != null) {
        StoryViewerDialog(
            repository = storiesRepository,
            userId = userId,
            executor = executor,
            onClose = { showingStory = false; storyStatusGeneration++ },
            onReauthenticate = onReauthenticate,
        )
    }
}

@Composable
private fun ProfileHeader(
    profile: PublicProfile,
    horizontal: androidx.compose.ui.unit.Dp,
    showFollow: Boolean,
    followBusy: Boolean,
    followError: String?,
    storyRingStatus: StoryRingStatus?,
    onOpenStory: () -> Unit,
    onOpenConnections: (String, String) -> Unit,
    onFollow: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = horizontal)) {
        Box(Modifier.fillMaxWidth().height(156.dp).clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.primaryContainer)) {
            profile.bannerUrl?.let { AsyncImage(it, contentDescription = "${profile.name}'s profile banner", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
        }
        Row(Modifier.fillMaxWidth().padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(
                modifier = Modifier.size(88.dp).then(
                    if (storyRingStatus?.hasActiveStory == true) Modifier.clickable(onClick = onOpenStory) else Modifier,
                ).semantics {
                    if (storyRingStatus?.hasActiveStory == true) contentDescription = "View ${profile.name}'s story"
                    else contentDescription = "${profile.name}'s profile photo"
                },
                shape = CircleShape,
                color = MaterialTheme.colorScheme.secondaryContainer,
                border = storyRingStatus?.takeIf { it.hasActiveStory }?.let { status ->
                    BorderStroke(2.dp, if (status.hasUnseenStory) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)
                },
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(profile.name.firstOrNull()?.uppercase() ?: "N", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSecondaryContainer)
                    profile.avatarUrl?.let { AsyncImage(it, contentDescription = "${profile.name}'s profile photo", modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop) }
                }
            }
        }
        if (showFollow) {
            Button(
                onClick = onFollow,
                enabled = !followBusy,
                modifier = Modifier.fillMaxWidth().padding(top = 14.dp).heightIn(min = 48.dp).semantics {
                    contentDescription = when (profile.followState) {
                        "accepted" -> "Unfollow @${profile.username}"
                        "requested" -> "Cancel follow request to @${profile.username}"
                        else -> "Follow @${profile.username}"
                    }
                },
            ) {
                if (followBusy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text(when (profile.followState) {
                    "accepted" -> "Following"
                    "requested" -> "Requested"
                    else -> "Follow"
                })
            }
            followError?.let { Text(it, Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        }
        Row(Modifier.fillMaxWidth().padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(profile.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            profile.verificationColor?.let { color ->
                Icon(Icons.Default.Verified, contentDescription = when (color) { "gold" -> "Verified business"; "black" -> "Official government account"; else -> "Verified account" }, tint = when (color) { "gold" -> Color(0xFFB7791F); "black" -> MaterialTheme.colorScheme.onSurface; else -> MaterialTheme.colorScheme.primary }, modifier = Modifier.padding(start = 6.dp).size(20.dp))
            }
        }
        Text("@${profile.username}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        if (profile.bio.isNotBlank()) Text(profile.bio, Modifier.fillMaxWidth().padding(top = 12.dp), style = MaterialTheme.typography.bodyLarge)
        Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ProfileCount(profile.following, "Following", Modifier.weight(1f), enabled = profile.canViewerSeePosts) {
                onOpenConnections(profile.id, "following")
            }
            ProfileCount(profile.followers, "Followers", Modifier.weight(1f), enabled = profile.canViewerSeePosts) {
                onOpenConnections(profile.id, "followers")
            }
            ProfileCount(profile.posts, "Posts", Modifier.weight(1f))
        }
        Spacer(Modifier.height(18.dp))
        HorizontalDivider()
    }
}

@Composable
private fun ProfileCount(value: Int, label: String, modifier: Modifier = Modifier, enabled: Boolean = false, onClick: () -> Unit = {}) {
    Column(
        modifier.then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier)
            .semantics { if (enabled) contentDescription = "Open $label" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value.toString(), fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, maxLines = 1)
    }
}

@Composable
private fun ProfileMessage(title: String, detail: String?, actionLabel: String? = null, action: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        detail?.let { Text(it, Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        if (action != null && actionLabel != null) TextButton(onClick = action, modifier = Modifier.heightIn(min = 48.dp)) { Text(actionLabel) }
    }
}
