package com.nantty.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CurrentProfile
import com.nantty.android.data.FeedPost
import com.nantty.android.data.PublicProfilePosts

@Composable
internal fun CurrentProfilePostsSection(
    profile: CurrentProfile,
    posts: PublicProfilePosts,
    subscriberPosts: PublicProfilePosts,
    postsLoading: Boolean,
    subscriberPostsLoading: Boolean,
    postsError: String?,
    subscriberPostsError: String?,
    onOpenPost: (String) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var selectedTab by remember(profile.accountId) { mutableStateOf(ProfilePostTab.POSTS) }
    val showSubscriberPosts = profile.isCreator && subscriberPosts.posts.isNotEmpty()
    LaunchedEffect(showSubscriberPosts) {
        if (!showSubscriberPosts) selectedTab = ProfilePostTab.POSTS
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Posts", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        if (showSubscriberPosts) {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(
                    selected = selectedTab == ProfilePostTab.POSTS,
                    onClick = { selectedTab = ProfilePostTab.POSTS },
                    label = { Text("Posts") },
                    modifier = Modifier.semantics { selected = selectedTab == ProfilePostTab.POSTS },
                )
                FilterChip(
                    selected = selectedTab == ProfilePostTab.SUBSCRIBERS,
                    onClick = { selectedTab = ProfilePostTab.SUBSCRIBERS },
                    label = { Text("Subscribers") },
                    modifier = Modifier.semantics { selected = selectedTab == ProfilePostTab.SUBSCRIBERS },
                )
            }
        }

        val selectedPosts = if (selectedTab == ProfilePostTab.SUBSCRIBERS) subscriberPosts else posts
        val selectedLoading = if (selectedTab == ProfilePostTab.SUBSCRIBERS) subscriberPostsLoading else postsLoading
        val selectedError = if (selectedTab == ProfilePostTab.SUBSCRIBERS) subscriberPostsError else postsError
        when {
            selectedLoading && selectedPosts.posts.isEmpty() -> CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally).padding(20.dp))
            selectedError != null && selectedPosts.posts.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(selectedError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = onRetry) { Text("Try again") }
            }
            selectedPosts.posts.isEmpty() -> Text(
                if (selectedTab == ProfilePostTab.SUBSCRIBERS) "No subscriber posts yet" else "No posts yet",
                Modifier.padding(vertical = 12.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            else -> {
                selectedError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                selectedPosts.posts.forEach { post ->
                    FeedCard(post = post, onOpenPost = onOpenPost)
                }
            }
        }
    }
}

private enum class ProfilePostTab { POSTS, SUBSCRIBERS }
