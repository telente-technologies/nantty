package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import coil.compose.AsyncImage
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.AccountSession
import com.nantty.android.data.CommentActingProfile
import com.nantty.android.data.PostDetail
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PostDetailResult
import com.nantty.android.data.ThreadComment
import com.nantty.android.data.ThreadSort
import com.nantty.android.data.appendUniqueThreadComments
import com.nantty.android.data.isRepeatedThreadCursor
import com.nantty.android.data.updateThreadCommentLike
import com.nantty.android.share.sharePostFromAndroid
import java.util.concurrent.Executor
import java.net.URI

@Composable
internal fun PostDetailScreen(
    postId: String,
    sessionProvider: () -> AccountSession?,
    executor: Executor,
    onBack: () -> Unit,
    repository: PostDetailRepository? = null,
    onSharePost: ((PostDetail) -> Unit)? = null,
) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val dataRepository = remember(sessionProvider, repository) {
        repository ?: PostDetailRepository(sessionProvider = sessionProvider)
    }
    val currentSession = sessionProvider()
    val accountId = currentSession?.takeIf { it.accessToken.isNotBlank() }?.user?.id
    var result by remember(postId, accountId) { mutableStateOf<PostDetailResult?>(null) }
    var loading by remember(postId) { mutableStateOf(false) }
    var loadingMore by remember(postId) { mutableStateOf(false) }
    var completedCursors by remember(postId) { mutableStateOf(emptySet<String>()) }
    var loadMoreError by remember(postId) { mutableStateOf<String?>(null) }
    var replyText by remember(postId) { mutableStateOf("") }
    var replyTarget by remember(postId) { mutableStateOf<ThreadComment?>(null) }
    var sending by remember(postId) { mutableStateOf(false) }
    var replyError by remember(postId) { mutableStateOf<String?>(null) }
    var replyNotice by remember(postId) { mutableStateOf<String?>(null) }
    var interactionBusy by remember(postId) { mutableStateOf(false) }
    var interactionError by remember(postId) { mutableStateOf<String?>(null) }
    var commentLikeBusyIds by remember(postId, accountId) { mutableStateOf(emptySet<String>()) }
    var commentLikeErrors by remember(postId, accountId) { mutableStateOf(emptyMap<String, String>()) }
    var commentProfiles by remember(postId, accountId) { mutableStateOf<List<CommentActingProfile>?>(null) }
    var profilesLoading by remember(postId, accountId) { mutableStateOf(false) }
    var profilesError by remember(postId, accountId) { mutableStateOf<String?>(null) }
    var selectedProfileId by remember(postId, accountId) { mutableStateOf<String?>(null) }
    var profileMenuExpanded by remember(postId, accountId) { mutableStateOf(false) }
    var threadSort by rememberSaveable(postId) { mutableStateOf(ThreadSort.RELEVANT) }
    var threadSortMenuExpanded by rememberSaveable(postId) { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current

    fun load(cursor: String? = null, append: Boolean = false, sort: ThreadSort = threadSort) {
        if (append) {
            if (loadingMore || cursor.isNullOrBlank() || cursor in completedCursors) return
            loadingMore = true
            loadMoreError = null
        } else {
            if (loading) return
            loading = true
            completedCursors = emptySet()
            loadMoreError = null
        }
        executor.execute {
            val next = dataRepository.load(postId, cursor, sort)
            Snapshot.withMutableSnapshot {
                if (threadSort != sort) {
                    loading = false
                    loadingMore = false
                } else if (append && result is PostDetailResult.Success) {
                    val previous = result as PostDetailResult.Success
                    if (next is PostDetailResult.Success) {
                        val repeatedCursor = isRepeatedThreadCursor(cursor.orEmpty(), next.nextCursor, completedCursors)
                        completedCursors = completedCursors + cursor.orEmpty()
                        result = next.copy(
                            comments = appendUniqueThreadComments(previous.comments, next.comments),
                            nextCursor = next.nextCursor.takeUnless { repeatedCursor },
                        )
                        if (repeatedCursor) loadMoreError = "The server repeated a reply page. Reload the thread to continue."
                    } else {
                        loadMoreError = (next as PostDetailResult.Failure).message
                    }
                } else {
                    result = next
                }
                loading = false
                loadingMore = false
            }
        }
    }

    fun sendReply() {
        if (sending || replyText.isBlank() || accountId == null) return
        val text = replyText
        val parentId = replyTarget?.id
        val selectedProfileIdForSubmit = commentProfiles?.firstOrNull { it.id == selectedProfileId }?.id
        sending = true
        replyError = null
        replyNotice = null
        executor.execute {
            val sent = dataRepository.reply(postId, text, parentId, selectedProfileIdForSubmit, accountId)
            Snapshot.withMutableSnapshot {
                sending = false
                if (sent.isSuccess) {
                    replyText = ""
                    replyTarget = null
                    selectedProfileId = null
                    replyNotice = "Reply posted."
                } else {
                    replyError = sent.exceptionOrNull()?.message ?: "Your reply could not be posted. Please try again."
                }
            }
            if (sent.isSuccess) load()
        }
        keyboard?.hide()
    }

    fun toggleCommentLike(comment: ThreadComment) {
        val expectedAccountId = accountId ?: return
        if (comment.id in commentLikeBusyIds) return
        val current = result as? PostDetailResult.Success ?: return
        val nextLiked = !comment.liked
        result = current.copy(comments = updateThreadCommentLike(current.comments, comment.id, nextLiked))
        commentLikeBusyIds = commentLikeBusyIds + comment.id
        commentLikeErrors = commentLikeErrors - comment.id
        executor.execute {
            val outcome = dataRepository.setCommentLiked(comment.id, nextLiked, expectedAccountId)
            if (sessionProvider()?.user?.id != expectedAccountId) return@execute
            Snapshot.withMutableSnapshot {
                if (outcome.isFailure) {
                    val latest = result as? PostDetailResult.Success
                    if (latest != null) {
                        result = latest.copy(comments = updateThreadCommentLike(latest.comments, comment.id, !nextLiked))
                    }
                    commentLikeErrors = commentLikeErrors + (comment.id to (outcome.exceptionOrNull()?.message ?: "Could not update this comment like. Try again."))
                }
                commentLikeBusyIds = commentLikeBusyIds - comment.id
            }
        }
    }

    fun openPostLink(url: String) {
        if (runCatching { uriHandler.openUri(url) }.isSuccess && accountId != null) {
            val expectedAccountId = accountId
            executor.execute { dataRepository.recordPostLinkClick(postId, expectedAccountId) }
        }
    }

    fun loadCommentProfiles(expectedAccountId: String) {
        profilesLoading = true
        profilesError = null
        executor.execute {
            val outcome = dataRepository.listCommentProfiles(expectedAccountId)
            Snapshot.withMutableSnapshot {
                if (sessionProvider()?.user?.id == expectedAccountId) {
                    commentProfiles = outcome.getOrNull()
                    profilesError = outcome.exceptionOrNull()?.message
                    profilesLoading = false
                }
            }
        }
    }

    LaunchedEffect(postId, accountId, threadSort) {
        load(sort = threadSort)
    }

    LaunchedEffect(postId, accountId) {
        commentProfiles = null
        selectedProfileId = null
        profileMenuExpanded = false
        if (accountId != null) loadCommentProfiles(accountId)
    }

    Column(Modifier.fillMaxSize().imePadding().background(MaterialTheme.colorScheme.background)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to feed" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text("Post", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            TextButton(onClick = { load() }, enabled = !loading) { Text("Retry") }
        }

        when (val current = result) {
            null -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            is PostDetailResult.Failure -> Column(
                Modifier.weight(1f).fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("Post unavailable", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text(current.message, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { load() }) { Text("Try again") }
            }
            is PostDetailResult.Success -> {
                LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 16.dp)) {
                    item(key = "platform-identity") {
                        Text(
                            "Nantty for Android",
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                    item(key = "post") {
                        PostDetailCard(
                            post = current.post,
                            canInteract = sessionProvider()?.accessToken?.isNotBlank() == true,
                            interactionBusy = interactionBusy,
                            interactionError = interactionError,
                            onOpenLink = ::openPostLink,
                            onShare = { post ->
                                if (onSharePost != null) onSharePost(post)
                                else sharePostFromAndroid(context, post.id)
                            },
                            onLike = {
                                val next = !current.post.liked
                                interactionBusy = true
                                interactionError = null
                                executor.execute {
                                    val outcome = dataRepository.setLiked(postId, next)
                                    Snapshot.withMutableSnapshot {
                                        interactionBusy = false
                                        if (outcome.isSuccess) result = current.copy(post = current.post.copy(liked = next, likes = (current.post.likes + if (next) 1 else -1).coerceAtLeast(0)))
                                        else interactionError = outcome.exceptionOrNull()?.message ?: "Could not update your like. Try again."
                                    }
                                }
                            },
                            onRepost = {
                                val next = !current.post.reposted
                                interactionBusy = true
                                interactionError = null
                                executor.execute {
                                    val outcome = dataRepository.setReposted(postId, next)
                                    Snapshot.withMutableSnapshot {
                                        interactionBusy = false
                                        if (outcome.isSuccess) result = current.copy(post = current.post.copy(reposted = next, reposts = (current.post.reposts + if (next) 1 else -1).coerceAtLeast(0)))
                                        else interactionError = outcome.exceptionOrNull()?.message ?: "Could not update your repost. Try again."
                                    }
                                }
                            },
                            onSave = {
                                if (!interactionBusy) {
                                    val nextSaved = !current.post.bookmarked
                                    interactionBusy = true
                                    interactionError = null
                                    executor.execute {
                                        val outcome = dataRepository.setSaved(postId, nextSaved)
                                        Snapshot.withMutableSnapshot {
                                            interactionBusy = false
                                            if (outcome.isSuccess) result = current.copy(post = current.post.copy(bookmarked = nextSaved))
                                            else interactionError = outcome.exceptionOrNull()?.message ?: "Could not update your saved posts. Try again."
                                        }
                                    }
                                }
                            },
                        )
                    }
                    item(key = "thread-sort") {
                        Row(
                            Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Replies", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Box {
                                TextButton(
                                    onClick = { threadSortMenuExpanded = true },
                                    enabled = !loading,
                                    modifier = Modifier.semantics {
                                        contentDescription = "Sort replies, currently ${threadSort.label}"
                                    },
                                ) { Text(threadSort.label) }
                                DropdownMenu(
                                    expanded = threadSortMenuExpanded,
                                    onDismissRequest = { threadSortMenuExpanded = false },
                                ) {
                                    ThreadSort.entries.forEach { option ->
                                        DropdownMenuItem(
                                            text = { Text(option.label) },
                                            leadingIcon = { RadioButton(selected = option == threadSort, onClick = null) },
                                            onClick = {
                                                threadSortMenuExpanded = false
                                                if (option != threadSort) {
                                                    completedCursors = emptySet()
                                                    loadMoreError = null
                                                    result = null
                                                    threadSort = option
                                                }
                                            },
                                            modifier = Modifier.semantics {
                                                contentDescription = "Sort replies by ${option.label}"
                                                selected = option == threadSort
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }
                    if (current.comments.isEmpty() && !loading) {
                        item(key = "empty-thread") {
                            Text(
                                "No replies yet. Start the conversation.",
                                Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 32.dp).semantics { contentDescription = "No replies yet" },
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyLarge,
                            )
                        }
                    } else {
                        items(current.comments, key = ThreadComment::id) { comment ->
                            ThreadCommentRow(
                                comment,
                                canReply = sessionProvider() != null,
                                canLike = accountId != null,
                                likeBusyIds = commentLikeBusyIds,
                                likeErrors = commentLikeErrors,
                                onReply = { replyTarget = it },
                                onToggleLike = ::toggleCommentLike,
                                onOpenLink = ::openPostLink,
                            )
                        }
                    }
                    current.nextCursor?.let { cursor ->
                        item(key = "load-more") {
                            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                                loadMoreError?.let { error ->
                                    Text(error, Modifier.padding(horizontal = 16.dp, vertical = 4.dp), color = MaterialTheme.colorScheme.error)
                                }
                                TextButton(
                                    onClick = { load(cursor, append = true) },
                                    enabled = !loadingMore,
                                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = if (loadingMore) "Loading more replies" else if (loadMoreError != null) "Retry loading replies" else "Load more replies" },
                                ) {
                                    if (loadingMore) {
                                        CircularProgressIndicator(Modifier.width(20.dp).height(20.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("Loading replies")
                                    } else {
                                        Text(if (loadMoreError != null) "Retry loading replies" else "Load more replies")
                                    }
                                }
                            }
                        }
                    }
                    if (current.nextCursor == null && current.comments.isNotEmpty()) {
                        item(key = "thread-end") {
                            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                loadMoreError?.let { error ->
                                    Text(error, color = MaterialTheme.colorScheme.error)
                                    TextButton(onClick = { load() }, modifier = Modifier.testTag("reload-thread-after-cursor-error")) { Text("Reload thread") }
                                } ?: Text("You’re all caught up.", Modifier.semantics { contentDescription = "End of replies" }, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }

                val authenticated = accountId != null
                if (authenticated) {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
                        val selectedProfile = commentProfiles?.firstOrNull { it.id == selectedProfileId }
                        if (!commentProfiles.isNullOrEmpty()) {
                            Box {
                                TextButton(
                                    onClick = { profileMenuExpanded = true },
                                    enabled = !sending,
                                    modifier = Modifier.semantics { contentDescription = "Commenting as ${selectedProfile?.name ?: "You"}. Choose profile" },
                                ) {
                                    Text("Commenting as ${selectedProfile?.name ?: "You"}")
                                }
                                DropdownMenu(
                                    expanded = profileMenuExpanded,
                                    onDismissRequest = { profileMenuExpanded = false },
                                ) {
                                    DropdownMenuItem(
                                        text = { Text("You") },
                                        leadingIcon = { RadioButton(selected = selectedProfile == null, onClick = null) },
                                        onClick = { selectedProfileId = null; profileMenuExpanded = false },
                                        modifier = Modifier.semantics { contentDescription = "Comment as You" },
                                    )
                                    commentProfiles.orEmpty().forEach { profile ->
                                        DropdownMenuItem(
                                            text = { Text("${profile.name} · ${profile.kind}", maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                            leadingIcon = { RadioButton(selected = profile.id == selectedProfile?.id, onClick = null) },
                                            onClick = { selectedProfileId = profile.id; profileMenuExpanded = false },
                                            modifier = Modifier.semantics { contentDescription = "Comment as ${profile.name}, ${profile.kind}" },
                                        )
                                    }
                                }
                            }
                        } else if (profilesLoading) {
                            Text("Loading business profiles…", Modifier.padding(horizontal = 12.dp, vertical = 4.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                        }
                        profilesError?.let { error ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Business profiles unavailable", Modifier.weight(1f), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                                TextButton(onClick = { accountId?.let(::loadCommentProfiles) }, enabled = !profilesLoading) { Text("Retry") }
                            }
                        }
                        replyTarget?.let { target ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Replying to @${target.username}", Modifier.weight(1f), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
                                TextButton(onClick = { replyTarget = null }) { Text("Cancel") }
                            }
                        }
                        replyError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                        replyNotice?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall) }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = replyText,
                                onValueChange = { replyText = it.take(1500); replyError = null; replyNotice = null },
                                modifier = Modifier.weight(1f).testTag("post-reply-input"),
                                enabled = !sending,
                                label = { Text("Write a reply") },
                                supportingText = { Text("${replyText.length}/1500") },
                                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                                keyboardActions = KeyboardActions(onSend = { sendReply() }),
                                maxLines = 4,
                            )
                            IconButton(
                                onClick = { sendReply() },
                                enabled = !sending && replyText.isNotBlank() && replyText.length <= 1500,
                                modifier = Modifier.semantics { contentDescription = "Send reply" },
                            ) {
                                if (sending) CircularProgressIndicator(Modifier.width(20.dp).height(20.dp))
                                else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                            }
                        }
                    }
                } else {
                    Text("Sign in to reply.", Modifier.fillMaxWidth().padding(16.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun PostDetailCard(
    post: PostDetail,
    canInteract: Boolean,
    interactionBusy: Boolean,
    interactionError: String?,
    onOpenLink: (String) -> Unit,
    onShare: (PostDetail) -> Unit,
    onLike: () -> Unit,
    onRepost: () -> Unit,
    onSave: () -> Unit,
) {
    val images = remember(post.media) { post.media.filter { it.type == "image" } }
    var previewImageIndex by remember(post.id) { mutableIntStateOf(-1) }
    Surface(Modifier.fillMaxWidth().padding(12.dp), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp) {
        Column(Modifier.padding(18.dp)) {
            Text(post.authorName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            if (post.username.isNotBlank()) Text("@${post.username}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (post.text.isNotBlank()) Text(post.text, Modifier.padding(top = 14.dp), style = MaterialTheme.typography.bodyLarge)
            PostExternalLinkActions(post.text, onOpenLink)
            var imageIndex = 0
            post.media.forEach { media ->
                if (media.type == "image") {
                    val selectedImageIndex = imageIndex++
                    PostDetailImage(media, selectedImageIndex, images.size) { previewImageIndex = selectedImageIndex }
                } else {
                    ThreadMedia(media)
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (canInteract) {
                    IconButton(onClick = onLike, enabled = !interactionBusy, modifier = Modifier.semantics {
                        contentDescription = "${if (post.liked) "Unlike post" else "Like post"}, ${post.likes}"
                        selected = post.liked
                    }) {
                        Icon(if (post.liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder, contentDescription = null, tint = if (post.liked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary)
                    }
                    Text("${post.likes}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                    Spacer(Modifier.width(12.dp))
                    IconButton(onClick = onRepost, enabled = !interactionBusy, modifier = Modifier.semantics {
                        contentDescription = "${if (post.reposted) "Undo repost" else "Repost"}, ${post.reposts}"
                        selected = post.reposted
                    }) {
                        Icon(Icons.Default.Repeat, contentDescription = null, tint = if (post.reposted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary)
                    }
                    Text("${post.reposts}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                    IconButton(onClick = onSave, enabled = !interactionBusy, modifier = Modifier.semantics {
                        contentDescription = if (post.bookmarked) "Remove post from saved" else "Save post"
                        selected = post.bookmarked
                    }) {
                        Icon(if (post.bookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = null, tint = if (post.bookmarked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary)
                    }
                } else {
                    Text("${post.likes} likes · ${post.reposts} reposts", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                }
                Spacer(Modifier.width(12.dp))
                Text("${post.comments} replies", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                Spacer(Modifier.width(8.dp))
                IconButton(onClick = { onShare(post) }, modifier = Modifier.semantics { contentDescription = "Share post" }) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                }
            }
            interactionError?.let { Text(it, Modifier.padding(top = 4.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        }
    }
    if (previewImageIndex in images.indices) {
        PostDetailImageViewer(images, previewImageIndex) { previewImageIndex = -1 }
    }
}

@Composable
private fun ThreadCommentRow(
    comment: ThreadComment,
    depth: Int = 0,
    canReply: Boolean = false,
    canLike: Boolean = false,
    likeBusyIds: Set<String> = emptySet(),
    likeErrors: Map<String, String> = emptyMap(),
    onReply: (ThreadComment) -> Unit = {},
    onToggleLike: (ThreadComment) -> Unit = {},
    onOpenLink: (String) -> Unit = {},
) {
    Column(Modifier.fillMaxWidth().padding(start = (depth.coerceAtMost(4) * 16).dp, end = 12.dp, top = 4.dp, bottom = 4.dp)) {
        Surface(
            Modifier.fillMaxWidth().semantics {
                contentDescription = "Reply by ${comment.authorName}${if (comment.username.isNotBlank()) ", @${comment.username}" else ""}, depth ${comment.depth}"
            },
            shape = RoundedCornerShape(14.dp),
            color = MaterialTheme.colorScheme.surface,
        ) {
            Column(Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    comment.avatarUrl?.let { url ->
                        AsyncImage(url, "${comment.authorName} profile photo", Modifier.width(34.dp).height(34.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                        Spacer(Modifier.width(10.dp))
                    }
                    Column {
                        Text(comment.authorName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (comment.username.isNotBlank()) Text("@${comment.username}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Text(comment.text, Modifier.fillMaxWidth().padding(top = 9.dp), style = MaterialTheme.typography.bodyMedium)
                PostExternalLinkActions(comment.text, onOpenLink)
                comment.media.forEach { ThreadMedia(it) }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (canLike) {
                        IconButton(
                            onClick = { onToggleLike(comment) },
                            enabled = comment.id !in likeBusyIds,
                            modifier = Modifier
                                .testTag("like-comment-${comment.id}")
                                .semantics {
                                    contentDescription = "${if (comment.liked) "Unlike" else "Like"} comment, ${comment.likes}"
                                    selected = comment.liked
                                },
                        ) {
                            Icon(
                                if (comment.liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                contentDescription = null,
                                tint = if (comment.liked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary,
                            )
                        }
                        Text("${comment.likes}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        Text("${comment.likes} likes", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(" · ${comment.replyCount} replies", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                likeErrors[comment.id]?.let { error ->
                    Text(error, Modifier.testTag("like-error-${comment.id}"), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                if (canReply) TextButton(onClick = { onReply(comment) }, modifier = Modifier.testTag("reply-${comment.id}")) { Text("Reply") }
            }
        }
        comment.replies.forEach { reply ->
            ThreadCommentRow(
                comment = reply,
                depth = depth + 1,
                canReply = canReply,
                canLike = canLike,
                likeBusyIds = likeBusyIds,
                likeErrors = likeErrors,
                onReply = onReply,
                onToggleLike = onToggleLike,
                onOpenLink = onOpenLink,
            )
        }
    }
}

@Composable
private fun PostExternalLinkActions(text: String, onOpenLink: (String) -> Unit) {
    val links = remember(text) { com.nantty.android.data.extractSafePostLinks(text) }
    links.forEach { url ->
        val host = runCatching { URI(url).host }.getOrNull() ?: return@forEach
        TextButton(
            onClick = { onOpenLink(url) },
            modifier = Modifier.semantics { contentDescription = "Open link to $host" },
        ) {
            Text(host, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ThreadMedia(media: FeedMedia) {
    val imageUrl = if (media.type == "video") media.posterUrl ?: media.url else media.url
    AsyncImage(
        model = imageUrl,
        contentDescription = if (media.type == "video") "Video reply preview" else "Attached image",
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp).aspectRatio(
            media.width?.toFloat()?.div(media.height?.toFloat() ?: 0f)?.takeIf { it.isFinite() && it in 0.5f..2.2f } ?: 1.5f,
        ).clip(RoundedCornerShape(12.dp)),
        contentScale = ContentScale.Crop,
    )
}
