package com.nantty.android.ui

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.CurrentProfile
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.CurrentProfileResult
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.PublicProfilePosts
import com.nantty.android.data.PublicProfilePostsResult
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.ProfileImageRepository
import com.nantty.android.data.ProfileImageUploadResult
import com.nantty.android.data.SupportTicketRepository
import java.util.concurrent.Executor

@Composable
internal fun CurrentProfileScreen(
    repository: CurrentProfileRepository,
    executor: Executor,
    modifier: Modifier = Modifier,
    onOpenBusinessTools: () -> Unit = {},
    onOpenCountryPreferences: () -> Unit = {},
    onOpenConnections: (String, String) -> Unit = { _, _ -> },
    onOpenProfile: (String) -> Unit = {},
    onSearchProfile: (String, String) -> Unit = { _, _ -> },
    publicProfileRepository: PublicProfileRepository? = null,
    profileImagesRepository: ProfileImageRepository? = null,
    onOpenPost: (String) -> Unit = {},
    followRequestsRepository: FollowRequestsRepository? = null,
    supportTicketRepository: SupportTicketRepository? = null,
    supportMediaRepository: CreatorSampleMediaRepository? = null,
    buyerOrdersRepository: BuyerOrdersRepository? = null,
    onReauthenticate: () -> Unit = {},
) {
    var profile by remember(repository) { mutableStateOf<CurrentProfile?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var saving by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var message by remember(repository) { mutableStateOf<String?>(null) }
    var editing by remember(repository) { mutableStateOf(false) }
    var showingFollowRequests by remember(repository) { mutableStateOf(false) }
    var showingSupportRequests by remember(repository) { mutableStateOf(false) }
    var reload by remember(repository) { mutableStateOf(0) }
    var publicPosts by remember(repository) { mutableStateOf(PublicProfilePosts(emptyList(), null)) }
    var subscriberPosts by remember(repository) { mutableStateOf(PublicProfilePosts(emptyList(), null)) }
    var postsLoading by remember(repository) { mutableStateOf(false) }
    var subscriberPostsLoading by remember(repository) { mutableStateOf(false) }
    var postsError by remember(repository) { mutableStateOf<String?>(null) }
    var subscriberPostsError by remember(repository) { mutableStateOf<String?>(null) }
    val contentResolver = LocalContext.current.applicationContext.contentResolver

    if (showingSupportRequests && supportTicketRepository != null) {
        SupportRequestsScreen(
            repository = supportTicketRepository,
            executor = executor,
            onBack = { showingSupportRequests = false },
            onAuthenticationRequired = onReauthenticate,
            mediaRepository = supportMediaRepository,
            buyerOrdersRepository = buyerOrdersRepository,
            modifier = modifier,
        )
        return
    }

    if (showingFollowRequests && followRequestsRepository != null) {
        FollowRequestsScreen(
            repository = followRequestsRepository,
            executor = executor,
            onBack = { showingFollowRequests = false },
            onReauthenticate = onReauthenticate,
            onOpenProfile = { userId ->
                showingFollowRequests = false
                onOpenProfile(userId)
            },
            modifier = modifier,
        )
        return
    }

    LaunchedEffect(repository, publicProfileRepository, reload) {
        loading = true
        error = null
        postsError = null
        subscriberPostsError = null
        postsLoading = publicProfileRepository != null
        subscriberPostsLoading = false
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is CurrentProfileResult.Failure -> error = result.message
                    is CurrentProfileResult.Success -> {
                        profile = result.profile
                        editing = false
                        subscriberPostsLoading = result.profile.isCreator && publicProfileRepository != null
                    }
                }
                loading = false
                if (result is CurrentProfileResult.Failure || publicProfileRepository == null) postsLoading = false
            }
            if (result is CurrentProfileResult.Success && publicProfileRepository != null) {
                val loadedPublicPosts = publicProfileRepository.loadPosts(result.profile.accountId)
                val loadedSubscriberPosts = if (result.profile.isCreator) {
                    publicProfileRepository.loadPosts(
                        result.profile.accountId,
                        visibility = PublicProfileRepository.SUBSCRIBER_VISIBILITY,
                    )
                } else null
                Snapshot.withMutableSnapshot {
                    when (loadedPublicPosts) {
                        is PublicProfilePostsResult.Success -> publicPosts = loadedPublicPosts.page
                        is PublicProfilePostsResult.Failure -> postsError = loadedPublicPosts.message
                    }
                    when (loadedSubscriberPosts) {
                        is PublicProfilePostsResult.Success -> subscriberPosts = loadedSubscriberPosts.page
                        is PublicProfilePostsResult.Failure -> subscriberPostsError = loadedSubscriberPosts.message
                        null -> Unit
                    }
                    postsLoading = false
                    subscriberPostsLoading = false
                }
            }
        }
    }

    BoxWithConstraints(modifier.fillMaxSize()) {
        val horizontalPadding = if (maxWidth >= 600.dp) 32.dp else 18.dp
        Column(
            Modifier.widthIn(max = 720.dp).fillMaxSize().align(Alignment.TopCenter),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = horizontalPadding, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Your profile",
                    Modifier.weight(1f).semantics { heading() },
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                if (supportTicketRepository != null) {
                    TextButton(onClick = { showingSupportRequests = true }) { Text("Support") }
                }
                IconButton(
                    enabled = profile != null && !loading,
                    onClick = { profile?.let { onSearchProfile(it.accountId, it.username) } },
                    modifier = Modifier.semantics {
                        contentDescription = profile?.let { "Search @${it.username}'s posts" } ?: "Search your posts"
                    },
                ) {
                    Icon(Icons.Default.Search, contentDescription = null)
                }
                IconButton(
                    onClick = onOpenCountryPreferences,
                    modifier = Modifier.semantics { contentDescription = "Country and currency settings" },
                ) {
                    Icon(Icons.Default.Settings, contentDescription = null)
                }
            }
            HorizontalDivider()
            PullToRefreshBox(
                isRefreshing = profile != null && (loading || postsLoading || subscriberPostsLoading),
                onRefresh = { reload += 1 },
                modifier = Modifier.fillMaxSize(),
            ) {
                when {
                    loading && profile == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                    profile == null -> ProfileLoadError(error ?: "Your profile could not be loaded.", onRetry = { reload += 1 })
                    else -> CurrentProfileContent(
                    profile = profile!!,
                    editing = editing,
                    saving = saving,
                    message = message,
                    error = error,
                    posts = publicPosts,
                    subscriberPosts = subscriberPosts,
                    postsLoading = postsLoading,
                    subscriberPostsLoading = subscriberPostsLoading,
                    postsError = postsError,
                    subscriberPostsError = subscriberPostsError,
                    showPostTimeline = publicProfileRepository != null,
                    onOpenPost = onOpenPost,
                    onRetryPosts = { reload += 1 },
                    allowProfileImageUpload = profileImagesRepository != null,
                    horizontalPadding = horizontalPadding,
                    onOpenBusinessTools = onOpenBusinessTools,
                    onOpenCountryPreferences = onOpenCountryPreferences,
                    onOpenConnections = onOpenConnections,
                    onOpenFollowRequests = { showingFollowRequests = true },
                    onStartEditing = {
                        message = null
                        error = null
                        editing = true
                    },
                    onCancelEditing = {
                        editing = false
                        error = null
                    },
                    onSave = { update, avatarUri, bannerUri ->
                        if (saving) return@CurrentProfileContent
                        saving = true
                        error = null
                        message = null
                        executor.execute {
                            val result = runCatching {
                                val bannerMediaId = bannerUri?.let { uri ->
                                    val upload = profileImagesRepository?.upload(uri, ProfileImageRepository.BANNER_PURPOSE, contentResolver)
                                        ?: ProfileImageUploadResult.Failure("Profile image uploads are unavailable.")
                                    when (upload) {
                                        is ProfileImageUploadResult.Success -> upload.mediaId
                                        is ProfileImageUploadResult.Failure -> error(upload.message)
                                    }
                                }
                                val avatarMediaId = avatarUri?.let { uri ->
                                    val upload = profileImagesRepository?.upload(uri, ProfileImageRepository.AVATAR_PURPOSE, contentResolver)
                                        ?: ProfileImageUploadResult.Failure("Profile image uploads are unavailable.")
                                    when (upload) {
                                        is ProfileImageUploadResult.Success -> upload.mediaId
                                        is ProfileImageUploadResult.Failure -> error(upload.message)
                                    }
                                }
                                repository.update(update.copy(avatarMediaId = avatarMediaId, bannerMediaId = bannerMediaId))
                            }.getOrElse { failure ->
                                CurrentProfileResult.Failure(failure.message ?: "Couldn't save your profile.")
                            }
                            Snapshot.withMutableSnapshot {
                                when (result) {
                                    is CurrentProfileResult.Failure -> error = result.message
                                    is CurrentProfileResult.Success -> {
                                        profile = result.profile
                                        editing = false
                                        message = "Profile updated"
                                    }
                                }
                                saving = false
                            }
                        }
                    },
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileLoadError(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Your profile could not load", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(message, color = MaterialTheme.colorScheme.secondary)
        TextButton(onClick = onRetry, modifier = Modifier.heightIn(min = 48.dp)) { Text("Try again") }
    }
}
