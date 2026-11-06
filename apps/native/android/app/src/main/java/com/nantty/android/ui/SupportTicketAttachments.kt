package com.nantty.android.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.AndroidCreatorSampleCancellation
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.CreatorSampleMediaResult
import java.util.concurrent.Executor

@Composable
internal fun SupportTicketAttachments(
    repository: CreatorSampleMediaRepository?,
    executor: Executor,
    urls: List<String>,
    onUrlsChange: (List<String>) -> Unit,
    enabled: Boolean,
    onUploadingChange: (Boolean) -> Unit,
    onAuthenticationRequired: () -> Unit,
) {
    val context = LocalContext.current.applicationContext
    val latestUrlsChange by rememberUpdatedState(onUrlsChange)
    val latestUploadingChange by rememberUpdatedState(onUploadingChange)
    val latestAuthenticationRequired by rememberUpdatedState(onAuthenticationRequired)
    var uploading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var authenticationRequired by remember { mutableStateOf(false) }
    var cancellation by remember { mutableStateOf<AndroidCreatorSampleCancellation?>(null) }
    val activeCancellation by rememberUpdatedState(cancellation)

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val uploader = repository
        if (uri == null || uploader == null || uploading || urls.size >= MAX_SUPPORT_ATTACHMENTS) return@rememberLauncherForActivityResult
        val requestCancellation = AndroidCreatorSampleCancellation()
        cancellation = requestCancellation
        uploading = true
        error = null
        authenticationRequired = false
        onUploadingChange(true)
        executor.execute {
            val result = uploader.upload(uri, context.contentResolver, context.cacheDir, requestCancellation)
            Snapshot.withMutableSnapshot {
                uploading = false
                cancellation = null
                latestUploadingChange(false)
                when (result) {
                    is CreatorSampleMediaResult.Success -> {
                        error = null
                        latestUrlsChange((urls + result.image.imageUrl).distinct().take(MAX_SUPPORT_ATTACHMENTS))
                    }
                    is CreatorSampleMediaResult.VideoSuccess -> error = "Choose an image for this support attachment."
                    is CreatorSampleMediaResult.Failure -> {
                        error = result.message
                        authenticationRequired = result.authenticationRequired
                        if (result.authenticationRequired) latestAuthenticationRequired()
                    }
                    CreatorSampleMediaResult.Cancelled -> Unit
                }
            }
        }
    }

    DisposableEffect(Unit) { onDispose { activeCancellation?.cancel() } }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            urls.forEachIndexed { index, url ->
                Box(Modifier.size(88.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
                    AsyncImage(
                        model = url,
                        contentDescription = "Support screenshot ${index + 1}",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                    IconButton(
                        onClick = { latestUrlsChange(urls.filterNot { it == url }) },
                        enabled = enabled && !uploading,
                        modifier = Modifier.align(Alignment.TopEnd).size(40.dp)
                            .semantics { contentDescription = "Remove screenshot ${index + 1}" },
                    ) { Icon(Icons.Default.Close, contentDescription = null) }
                }
            }
            if (repository != null && urls.size < MAX_SUPPORT_ATTACHMENTS) {
                OutlinedButton(
                    onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    enabled = enabled && !uploading,
                    modifier = Modifier.size(width = 112.dp, height = 88.dp)
                        .semantics { contentDescription = if (uploading) "Uploading support screenshot" else "Add screenshot" },
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (uploading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Default.PhotoCamera, contentDescription = null)
                        Text(if (uploading) "Uploading…" else "Add screenshot", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
        error?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            if (authenticationRequired) TextButton(onClick = onAuthenticationRequired, enabled = enabled && !uploading) { Text("Sign in again") }
        }
        if (uploading) {
            Text(
                "Keep Nantty open while the screenshot is prepared and uploaded.",
                Modifier.padding(top = 2.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private const val MAX_SUPPORT_ATTACHMENTS = 3
