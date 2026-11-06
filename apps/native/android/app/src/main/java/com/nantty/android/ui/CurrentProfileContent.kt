package com.nantty.android.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.CurrentProfile
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.CurrentProfileUpdate
import com.nantty.android.data.PublicProfilePosts

@Composable
internal fun CurrentProfileContent(
    profile: CurrentProfile,
    posts: PublicProfilePosts,
    subscriberPosts: PublicProfilePosts,
    postsLoading: Boolean,
    subscriberPostsLoading: Boolean,
    postsError: String?,
    subscriberPostsError: String?,
    showPostTimeline: Boolean,
    onOpenPost: (String) -> Unit,
    onRetryPosts: () -> Unit,
    allowProfileImageUpload: Boolean,
    editing: Boolean,
    saving: Boolean,
    message: String?,
    error: String?,
    horizontalPadding: Dp,
    onOpenBusinessTools: () -> Unit,
    onOpenCountryPreferences: () -> Unit,
    onOpenConnections: (String, String) -> Unit,
    onOpenFollowRequests: () -> Unit,
    onStartEditing: () -> Unit,
    onCancelEditing: () -> Unit,
    onSave: (CurrentProfileUpdate, Uri?, Uri?) -> Unit,
) {
    var name by remember(profile.accountId, profile.name) { mutableStateOf(profile.name) }
    var bio by remember(profile.accountId, profile.bio) { mutableStateOf(profile.bio) }
    var isPrivate by remember(profile.accountId, profile.isPrivate) { mutableStateOf(profile.isPrivate) }
    var selectedAvatar by remember(profile.accountId) { mutableStateOf<Uri?>(null) }
    var selectedBanner by remember(profile.accountId) { mutableStateOf<Uri?>(null) }
    LaunchedEffect(editing) {
        if (!editing) {
            selectedAvatar = null
            selectedBanner = null
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = horizontalPadding, vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainerLow,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column {
                Box(
                    Modifier.fillMaxWidth().height(132.dp).background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    (selectedBanner ?: profile.bannerUrl)?.let { url ->
                        AsyncImage(model = url, contentDescription = "Profile banner", modifier = Modifier.fillMaxSize())
                    }
                }
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 18.dp, bottom = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(modifier = Modifier.size(76.dp), shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                profile.name.firstOrNull()?.uppercase() ?: "N",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                            )
                            (selectedAvatar ?: profile.avatarUrl)?.let { url ->
                                AsyncImage(model = url, contentDescription = "Profile photo", modifier = Modifier.fillMaxSize().clip(CircleShape))
                            }
                        }
                    }
                    Column(Modifier.weight(1f).padding(start = 16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(profile.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (profile.isVerified) {
                                androidx.compose.material3.Icon(
                                    Icons.Default.Verified,
                                    contentDescription = "Verified account",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(start = 5.dp).size(20.dp),
                                )
                            }
                        }
                        Text("@${profile.username}", color = MaterialTheme.colorScheme.secondary)
                        if (profile.isCreator) Text("Creator", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }

        if (editing) ProfileEditorFields(
            name = name,
            onNameChange = { name = it.take(CurrentProfileRepository.MAX_NAME_LENGTH) },
            bio = bio,
            onBioChange = { bio = it.take(CurrentProfileRepository.MAX_BIO_LENGTH) },
            isPrivate = isPrivate,
            onPrivateChange = { isPrivate = it },
            saving = saving,
            error = error,
            allowProfileImageUpload = allowProfileImageUpload,
            onAvatarSelected = { selectedAvatar = it },
            onBannerSelected = { selectedBanner = it },
            onCancel = onCancelEditing,
            onSave = { onSave(CurrentProfileUpdate(name, bio, isPrivate), selectedAvatar, selectedBanner) },
        ) else ProfileOverview(
            profile = profile,
            message = message,
            error = error,
            showPostTimeline = showPostTimeline,
            posts = posts,
            subscriberPosts = subscriberPosts,
            postsLoading = postsLoading,
            subscriberPostsLoading = subscriberPostsLoading,
            postsError = postsError,
            subscriberPostsError = subscriberPostsError,
            onOpenPost = onOpenPost,
            onRetryPosts = onRetryPosts,
            onStartEditing = onStartEditing,
            onOpenBusinessTools = onOpenBusinessTools,
            onOpenCountryPreferences = onOpenCountryPreferences,
            onOpenConnections = onOpenConnections,
            onOpenFollowRequests = onOpenFollowRequests,
        )
    }
}

@Composable
private fun ProfileEditorFields(
    name: String,
    onNameChange: (String) -> Unit,
    bio: String,
    onBioChange: (String) -> Unit,
    isPrivate: Boolean,
    onPrivateChange: (Boolean) -> Unit,
    saving: Boolean,
    error: String?,
    allowProfileImageUpload: Boolean,
    onAvatarSelected: (Uri) -> Unit,
    onBannerSelected: (Uri) -> Unit,
    onCancel: () -> Unit,
    onSave: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (allowProfileImageUpload) CurrentProfileImagePicker(onAvatarSelected, onBannerSelected)
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            label = { Text("Name") },
            supportingText = { Text("${name.length}/${CurrentProfileRepository.MAX_NAME_LENGTH}") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = bio,
            onValueChange = onBioChange,
            label = { Text("Bio") },
            supportingText = { Text("${bio.length}/${CurrentProfileRepository.MAX_BIO_LENGTH}") },
            minLines = 3,
            maxLines = 6,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Private profile", fontWeight = FontWeight.SemiBold)
                Text("Only approved followers can see your posts.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
            }
            Switch(checked = isPrivate, onCheckedChange = onPrivateChange, modifier = Modifier.semantics { contentDescription = "Private profile" })
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = onCancel, enabled = !saving, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Cancel") }
            Button(onClick = onSave, enabled = !saving && name.isNotBlank(), modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                if (saving) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Save changes")
            }
        }
    }
}

@Composable
private fun ProfileOverview(
    profile: CurrentProfile,
    message: String?,
    error: String?,
    showPostTimeline: Boolean,
    posts: PublicProfilePosts,
    subscriberPosts: PublicProfilePosts,
    postsLoading: Boolean,
    subscriberPostsLoading: Boolean,
    postsError: String?,
    subscriberPostsError: String?,
    onOpenPost: (String) -> Unit,
    onRetryPosts: () -> Unit,
    onStartEditing: () -> Unit,
    onOpenBusinessTools: () -> Unit,
    onOpenCountryPreferences: () -> Unit,
    onOpenConnections: (String, String) -> Unit,
    onOpenFollowRequests: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Button(onClick = onStartEditing, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
            androidx.compose.material3.Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
            Text("Edit profile", Modifier.padding(start = 8.dp))
        }
        OutlinedButton(onClick = onOpenBusinessTools, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
            Text("Seller, creator, brand & ads tools")
        }
        OutlinedButton(onClick = onOpenCountryPreferences, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
            Text("Country & currency settings")
        }
        if (profile.isPrivate) {
            OutlinedButton(onClick = onOpenFollowRequests, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text("Review follow requests")
            }
        }
        message?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium) }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        ProfileStats(profile, onOpenConnections)
        Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("About", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(profile.bio.ifBlank { "Add a short bio so people know a little about you." }, color = MaterialTheme.colorScheme.onSurfaceVariant)
                HorizontalDivider(Modifier.padding(vertical = 4.dp))
                Text(if (profile.isPrivate) "Private profile" else "Public profile", style = MaterialTheme.typography.labelLarge)
            }
        }
        if (showPostTimeline) CurrentProfilePostsSection(
            profile = profile,
            posts = posts,
            subscriberPosts = subscriberPosts,
            postsLoading = postsLoading,
            subscriberPostsLoading = subscriberPostsLoading,
            postsError = postsError,
            subscriberPostsError = subscriberPostsError,
            onOpenPost = onOpenPost,
            onRetry = onRetryPosts,
        )
    }
}

@Composable
private fun ProfileStats(profile: CurrentProfile, onOpenConnections: (String, String) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        ProfileStat(profile.posts, "Posts")
        ProfileStat(profile.followers, "Followers") { onOpenConnections(profile.accountId, "followers") }
        ProfileStat(profile.following, "Following") { onOpenConnections(profile.accountId, "following") }
    }
}

@Composable
private fun ProfileStat(value: Int, label: String, onClick: (() -> Unit)? = null) {
    Column(
        modifier = if (onClick == null) Modifier else Modifier.clickable(onClick = onClick)
            .semantics { contentDescription = "Open $label" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value.toString(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
    }
}
