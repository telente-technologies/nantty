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
import androidx.compose.runtime.rememberCoroutineScope
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
import com.nantty.android.data.SELLER_CATALOG_IMAGE_LIMIT
import com.nantty.android.data.SellerCatalogImage
import com.nantty.android.data.SellerCatalogRepository
import com.nantty.android.data.CreatorSampleMediaResult
import com.nantty.android.data.AndroidCreatorSampleCancellation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun SellerCatalogPhotos(
    repository: SellerCatalogRepository,
    images: List<SellerCatalogImage>,
    enabled: Boolean,
    onImagesChange: (List<SellerCatalogImage>) -> Unit,
    onUploadingChange: (Boolean) -> Unit,
    onAuthenticationRequired: () -> Unit,
) {
    val context = LocalContext.current.applicationContext
    val scope = rememberCoroutineScope()
    val latestImages by rememberUpdatedState(images)
    val latestOnImagesChange by rememberUpdatedState(onImagesChange)
    val latestOnUploadingChange by rememberUpdatedState(onUploadingChange)
    val latestOnAuthenticationRequired by rememberUpdatedState(onAuthenticationRequired)
    var uploading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var activeCancellation by remember { mutableStateOf<AndroidCreatorSampleCancellation?>(null) }
    val currentCancellation by rememberUpdatedState(activeCancellation)
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null || uploading || latestImages.size >= SELLER_CATALOG_IMAGE_LIMIT) return@rememberLauncherForActivityResult
        val cancellation = AndroidCreatorSampleCancellation()
        activeCancellation = cancellation
        uploading = true
        latestOnUploadingChange(true)
        error = null
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                repository.uploadProductImage(uri, context.contentResolver, context.cacheDir, cancellation)
            }
            Snapshot.withMutableSnapshot {
                uploading = false
                activeCancellation = null
                latestOnUploadingChange(false)
                when (result) {
                    is CreatorSampleMediaResult.Success -> {
                        val uploaded = SellerCatalogImage(result.image.mediaId, result.image.imageUrl)
                        if (latestImages.none { it.mediaId == uploaded.mediaId }) latestOnImagesChange(latestImages + uploaded)
                        error = null
                    }
                    is CreatorSampleMediaResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) latestOnAuthenticationRequired()
                    }
                    is CreatorSampleMediaResult.VideoSuccess -> error = "Choose a photo for your product."
                    CreatorSampleMediaResult.Cancelled -> Unit
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose { currentCancellation?.cancel() }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Product photos (${images.size}/$SELLER_CATALOG_IMAGE_LIMIT)", style = MaterialTheme.typography.titleSmall)
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            images.forEachIndexed { index, image ->
                Box(Modifier.size(88.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
                    AsyncImage(
                        model = image.url,
                        contentDescription = "Product photo ${index + 1}",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                    IconButton(
                        onClick = { onImagesChange(images.filterNot { it.mediaId == image.mediaId }) },
                        enabled = enabled && !uploading,
                        modifier = Modifier.align(Alignment.TopEnd).size(40.dp)
                            .semantics { contentDescription = "Remove product photo ${index + 1}" },
                    ) { Icon(Icons.Default.Close, contentDescription = null) }
                }
            }
            if (images.size < SELLER_CATALOG_IMAGE_LIMIT) {
                OutlinedButton(
                    onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    enabled = enabled && !uploading,
                    modifier = Modifier.size(width = 112.dp, height = 88.dp)
                        .semantics { contentDescription = if (uploading) "Uploading product photo" else "Add product photo" },
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (uploading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Default.PhotoCamera, contentDescription = null)
                        Text(if (uploading) "Uploading…" else "Add photo", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
        error?.let { message ->
            Text(message, Modifier.padding(top = 2.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            TextButton(
                onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                enabled = enabled && !uploading && images.size < SELLER_CATALOG_IMAGE_LIMIT,
            ) { Text("Try another photo") }
        }
        if (uploading) Text("Keep Nantty open while the photo is prepared and uploaded.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
