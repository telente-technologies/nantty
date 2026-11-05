package com.nantty.android.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import android.net.Uri

@Composable
internal fun CurrentProfileImagePicker(
    onAvatarSelected: (Uri) -> Unit,
    onBannerSelected: (Uri) -> Unit,
) {
    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(onAvatarSelected)
    }
    val bannerPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(onBannerSelected)
    }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(
            onClick = { avatarPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            modifier = Modifier.weight(1f).heightIn(min = 48.dp).semantics { contentDescription = "Change profile photo" },
        ) {
            Icon(Icons.Default.PhotoCamera, contentDescription = null)
            Text("Photo", maxLines = 1)
        }
        OutlinedButton(
            onClick = { bannerPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            modifier = Modifier.weight(1f).heightIn(min = 48.dp).semantics { contentDescription = "Change banner image" },
        ) {
            Icon(Icons.Default.PhotoCamera, contentDescription = null)
            Text("Banner", maxLines = 1)
        }
    }
}
