package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.clickable
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.FollowRequest
import com.nantty.android.data.FollowRequestsPage
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.FollowRequestsResult
import java.net.HttpURLConnection
import java.util.concurrent.Executor

@Composable
internal fun FollowRequestsScreen(
    repository: FollowRequestsRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onOpenProfile: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onBack)
    var page by remember(repository) { mutableStateOf<FollowRequestsPage?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var reauthRequired by remember(repository) { mutableStateOf(false) }
    var pendingId by remember(repository) { mutableStateOf<String?>(null) }
    var refreshGeneration by remember(repository) { mutableStateOf(0) }

    fun load(clear: Boolean) {
        if (loading || loadingMore) return
        val cursor = if (clear) null else page?.nextCursor ?: return
        loading = clear
        loadingMore = !clear
        error = null
        executor.execute {
            val result = repository.load(cursor)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is FollowRequestsResult.Failure -> {
                        error = result.message
                        reauthRequired = result.authenticationRequired
                    }
                    is FollowRequestsResult.Success -> {
                        page = if (clear) result.page else {
                            val current = page ?: FollowRequestsPage(emptyList(), null)
                            current.copy(
                                requests = (current.requests + result.page.requests).distinctBy(FollowRequest::id),
                                nextCursor = result.page.nextCursor,
                            )
                        }
                        reauthRequired = false
                    }
                }
                loading = false
                loadingMore = false
            }
        }
    }

    fun settle(request: FollowRequest, accept: Boolean) {
        if (pendingId != null) return
        pendingId = request.id
        error = null
        executor.execute {
            val result = repository.settle(request.id, accept)
            Snapshot.withMutableSnapshot {
                result.fold(
                    onSuccess = {
                        page = page?.copy(requests = page!!.requests.filterNot { it.id == request.id })
                        reauthRequired = false
                    },
                    onFailure = { failure ->
                        error = failure.message ?: "Could not update this follow request. Try again."
                        reauthRequired = failure is com.nantty.android.data.FollowRequestsHttpException &&
                            failure.statusCode in setOf(HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN)
                    },
                )
                pendingId = null
            }
        }
    }

    LaunchedEffect(repository, refreshGeneration) { load(clear = true) }

    BoxWithConstraints(modifier.fillMaxSize()) {
        val horizontalPadding = if (maxWidth >= 600.dp) 32.dp else 18.dp
        Column(Modifier.widthIn(max = 720.dp).fillMaxSize().align(Alignment.TopCenter)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = horizontalPadding, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) { Text("Back") }
                Text("Follow requests", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                TextButton(onClick = { refreshGeneration += 1 }, enabled = !loading && !loadingMore) { Text("Refresh") }
            }
            HorizontalDivider()
            error?.let { message ->
                Column(Modifier.fillMaxWidth().padding(horizontal = horizontalPadding, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(message, color = MaterialTheme.colorScheme.error)
                    Button(onClick = if (reauthRequired) onReauthenticate else ({ refreshGeneration += 1 })) {
                        Text(if (reauthRequired) "Sign in again" else "Try again")
                    }
                }
            }
            when {
                loading && page == null -> Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading follow requests" })
                }
                page != null -> LazyColumn(Modifier.fillMaxSize()) {
                    items(page!!.requests, key = FollowRequest::id) { request ->
                        FollowRequestRow(
                            request = request,
                            pending = pendingId == request.id,
                            onAccept = { settle(request, accept = true) },
                            onReject = { settle(request, accept = false) },
                            onOpenProfile = { onOpenProfile(request.requester.id) },
                            horizontalPadding = horizontalPadding,
                        )
                    }
                    item {
                        when {
                            loadingMore -> CircularProgressIndicator(Modifier.padding(20.dp).semantics { contentDescription = "Loading more follow requests" })
                            page?.nextCursor != null -> TextButton(onClick = { load(clear = false) }, modifier = Modifier.fillMaxWidth()) { Text("Load more") }
                            page?.requests.isNullOrEmpty() && error == null -> Text("No pending requests", Modifier.fillMaxWidth().padding(32.dp), color = MaterialTheme.colorScheme.secondary)
                        }
                    }
                }
            }
        }
    }

}

@Composable
private fun FollowRequestRow(
    request: FollowRequest,
    pending: Boolean,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onOpenProfile: () -> Unit,
    horizontalPadding: androidx.compose.ui.unit.Dp,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = horizontalPadding, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onOpenProfile)
                .semantics { contentDescription = "${request.requester.name}, @${request.requester.username}" },
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(request.requester.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text("@${request.requester.username} wants to follow you", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = onAccept,
                enabled = !pending,
                modifier = Modifier.weight(1f).semantics { contentDescription = if (pending) "Saving follow request from ${request.requester.name}" else "Confirm ${request.requester.name}'s follow request" },
            ) { Text(if (pending) "Saving…" else "Confirm") }
            OutlinedButton(
                onClick = onReject,
                enabled = !pending,
                modifier = Modifier.weight(1f).semantics { contentDescription = "Delete ${request.requester.name}'s follow request" },
            ) { Text("Delete") }
        }
    }
    HorizontalDivider()
}

