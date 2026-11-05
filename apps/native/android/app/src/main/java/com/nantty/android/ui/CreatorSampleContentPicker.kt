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
import androidx.compose.foundation.layout.width
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
import com.nantty.android.data.CreatorSampleMediaResult
import com.nantty.android.data.CreatorWorkspaceRepository
import java.util.concurrent.Executor

@Composable
internal fun CreatorSampleContentPicker(
    repository: CreatorWorkspaceRepository,
    executor: Executor,
    sampleUrls: List<String>,
    onAddSample: (String) -> Unit,
    onRemoveSample: (String) -> Unit,
    onUploadingChange: (Boolean) -> Unit,
    enabled: Boolean,
    onReauthenticate: () -> Unit,
) {
    val context = LocalContext.current.applicationContext
    val currentOnAddSample by rememberUpdatedState(onAddSample)
    val currentOnUploadingChange by rememberUpdatedState(onUploadingChange)
    var uploading by remember { mutableStateOf(false) }
    var uploadError by remember { mutableStateOf<String?>(null) }
    var authenticationRequired by remember { mutableStateOf(false) }
    var activeCancellation by remember { mutableStateOf<AndroidCreatorSampleCancellation?>(null) }
    val currentCancellation by rememberUpdatedState(activeCancellation)
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null || uploading || sampleUrls.size >= MAXIMUM_SAMPLE_IMAGES) return@rememberLauncherForActivityResult
        val cancellation = AndroidCreatorSampleCancellation()
        activeCancellation = cancellation
        uploading = true
        onUploadingChange(true)
        uploadError = null
        authenticationRequired = false
        executor.execute {
            val result = repository.uploadSampleImage(uri, context.contentResolver, context.cacheDir, cancellation)
            Snapshot.withMutableSnapshot {
                uploading = false
                activeCancellation = null
                when (result) {
                    is CreatorSampleMediaResult.Success -> {
                        uploadError = null
                        authenticationRequired = false
                    }
                    is CreatorSampleMediaResult.Failure -> {
                        uploadError = result.message
                        authenticationRequired = result.authenticationRequired
                    }
                    CreatorSampleMediaResult.Cancelled -> Unit
                }
            }
            currentOnUploadingChange(false)
            if (result is CreatorSampleMediaResult.Success) currentOnAddSample(result.image.imageUrl)
        }
    }

    DisposableEffect(Unit) {
        onDispose { currentCancellation?.cancel() }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Screenshots of your best posts help us review faster.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            sampleUrls.forEachIndexed { index, url ->
                Box(Modifier.size(96.dp).clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
                    AsyncImage(
                        model = url,
                        contentDescription = "Creator sample ${index + 1}",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                    IconButton(
                        onClick = { onRemoveSample(url) },
                        enabled = enabled && !uploading,
                        modifier = Modifier.align(Alignment.TopEnd).size(40.dp)
                            .semantics { contentDescription = "Remove sample ${index + 1}" },
                    ) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface)
                    }
                }
            }
            if (sampleUrls.size < MAXIMUM_SAMPLE_IMAGES) {
                OutlinedButton(
                    onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    enabled = enabled && !uploading,
                    modifier = Modifier.size(width = 112.dp, height = 96.dp)
                        .semantics { contentDescription = if (uploading) "Uploading sample image" else "Add sample" },
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (uploading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Default.PhotoCamera, contentDescription = null)
                        Text(if (uploading) "Uploading…" else "Add sample", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
        uploadError?.let { message ->
            Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(
                    onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    enabled = enabled && !uploading,
                ) { Text("Try another photo") }
                if (authenticationRequired) TextButton(onClick = onReauthenticate, enabled = enabled && !uploading) { Text("Sign in again") }
            }
        }
        if (uploading) Text("Keep Nantty open while the image is prepared and uploaded.", Modifier.padding(top = 2.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private const val MAXIMUM_SAMPLE_IMAGES = 3
