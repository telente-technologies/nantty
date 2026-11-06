package com.nantty.android.ui.stories

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.contract.ActivityResultContract
import androidx.core.content.FileProvider
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.R
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.CreatorSampleMediaResult
import com.nantty.android.data.NativeImageUploadPurpose
import com.nantty.android.data.SelectableSound
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.SoundsRepository
import com.nantty.android.data.StoryPublishResult
import com.nantty.android.ui.clips.ClipVideoPlayer
import java.util.concurrent.Executor
import java.io.File

@Composable
internal fun StoryPhotoComposer(
    storiesRepository: StoriesRepository,
    soundsRepository: SoundsRepository,
    mediaRepository: CreatorSampleMediaRepository,
    executor: Executor,
    onCancel: () -> Unit,
    onPublished: (String) -> Unit,
    onReauthenticate: () -> Unit,
) {
    val context = LocalContext.current.applicationContext
    val screenHeight = LocalConfiguration.current.screenHeightDp.dp
    var selectedPhoto by remember { mutableStateOf<android.net.Uri?>(null) }
    var selectedVideo by remember { mutableStateOf(false) }
    var capturedPhotoFile by remember { mutableStateOf<File?>(null) }
    var pendingCameraFile by remember { mutableStateOf<File?>(null) }
    var capturedVideoFile by remember { mutableStateOf<File?>(null) }
    var pendingVideoFile by remember { mutableStateOf<File?>(null) }
    var selectedSound by remember { mutableStateOf<SelectableSound?>(null) }
    var selectedLook by remember { mutableStateOf(StoryLookChoice.NONE) }
    var soundPickerVisible by remember { mutableStateOf(false) }
    var isPublishing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            capturedPhotoFile?.delete()
            capturedPhotoFile = null
            capturedVideoFile?.delete()
            capturedVideoFile = null
            selectedPhoto = uri
            selectedVideo = context.contentResolver.getType(uri)?.lowercase()?.startsWith("video/") == true
            errorMessage = null
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val captured = pendingCameraFile
        pendingCameraFile = null
        if (saved && captured?.isFile == true && captured.length() > 0L) {
            capturedPhotoFile?.takeIf { it != captured }?.delete()
            capturedVideoFile?.delete()
            capturedVideoFile = null
            capturedPhotoFile = captured
            selectedPhoto = Uri.fromFile(captured)
            selectedVideo = false
            errorMessage = null
        } else {
            captured?.delete()
            if (saved) errorMessage = context.getString(R.string.story_camera_unavailable)
        }
    }
    val videoCamera = rememberLauncherForActivityResult(StoryVideoCaptureContract()) { result ->
        val captured = pendingVideoFile
        pendingVideoFile = null
        if (result.resultCode == Activity.RESULT_OK && captured?.isFile == true && captured.length() > 0L) {
            capturedPhotoFile?.delete()
            capturedPhotoFile = null
            capturedVideoFile?.takeIf { it != captured }?.delete()
            capturedVideoFile = captured
            selectedPhoto = Uri.fromFile(captured)
            selectedVideo = true
            errorMessage = null
        } else {
            captured?.delete()
            if (result.resultCode == Activity.RESULT_OK) errorMessage = context.getString(R.string.story_camera_unavailable)
        }
    }
    DisposableEffect(Unit) {
        onDispose {
            capturedPhotoFile?.delete()
            pendingCameraFile?.delete()
            capturedVideoFile?.delete()
            pendingVideoFile?.delete()
        }
    }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onCancel, enabled = !isPublishing, modifier = Modifier.semantics { contentDescription = "Back to post composer" }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                }
                Text(stringResource(R.string.story_create_title), modifier = Modifier.testTag("story-create-title"), style = MaterialTheme.typography.titleLarge)
            }
            Text(
                stringResource(R.string.story_create_description),
                modifier = Modifier.widthIn(max = 600.dp).fillMaxWidth().padding(vertical = 12.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            BoxWithConstraints(Modifier.widthIn(max = 520.dp).fillMaxWidth(), contentAlignment = Alignment.Center) {
                val previewHeight = minOf(maxWidth * (16f / 9f), screenHeight * 0.56f).coerceAtLeast(220.dp)
                Surface(
                    Modifier.fillMaxWidth().height(previewHeight).testTag("story-photo-preview"),
                    shape = MaterialTheme.shapes.large,
                    color = MaterialTheme.colorScheme.surfaceVariant,
                ) {
                    if (selectedPhoto == null) {
                        Column(
                            Modifier.fillMaxSize().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Icon(Icons.Default.VideoLibrary, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Text(stringResource(R.string.story_photo_empty), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    } else {
                        Box(Modifier.fillMaxSize()) {
                            if (selectedVideo) {
                                ClipVideoPlayer(
                                    videoUrl = selectedPhoto.toString(),
                                    muted = true,
                                    isActive = true,
                                    modifier = Modifier.fillMaxSize(),
                                    loop = true,
                                )
                            } else {
                                AsyncImage(
                                    model = selectedPhoto,
                                    contentDescription = stringResource(R.string.story_photo_preview_description),
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                                )
                                StoryLookOverlay(selectedLook)
                            }
                        }
                    }
                }
            }
            OutlinedButton(
                onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) },
                enabled = !isPublishing,
                modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth().padding(top = 16.dp).testTag("story-photo-choose"),
            ) {
                Icon(if (selectedVideo) Icons.Default.VideoLibrary else Icons.Default.AddPhotoAlternate, contentDescription = null)
                Text("  ${stringResource(if (selectedPhoto == null) R.string.story_photo_choose else R.string.story_photo_change)}")
            }
            OutlinedButton(
                onClick = {
                    runCatching {
                        val directory = File(context.cacheDir, "story-captures")
                        require(directory.exists() || directory.mkdirs())
                        directory.listFiles().orEmpty()
                            .filter {
                                it.isFile && (it.name.startsWith("story-capture-") || it.name.startsWith("story-video-capture-")) &&
                                    it != capturedPhotoFile && it != pendingCameraFile && it != capturedVideoFile && it != pendingVideoFile
                            }
                            .forEach(File::delete)
                        val output = File.createTempFile("story-capture-", ".jpg", directory)
                        pendingCameraFile?.delete()
                        pendingCameraFile = output
                        val outputUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", output)
                        camera.launch(outputUri)
                    }.onFailure {
                        pendingCameraFile?.delete()
                        pendingCameraFile = null
                        errorMessage = context.getString(R.string.story_camera_unavailable)
                    }
                },
                enabled = !isPublishing,
                modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth().testTag("story-camera-capture"),
            ) {
                Icon(Icons.Default.PhotoCamera, contentDescription = null)
                Text("  ${stringResource(R.string.story_camera_capture)}")
            }
            OutlinedButton(
                onClick = {
                    runCatching {
                        val directory = File(context.cacheDir, "story-captures")
                        require(directory.exists() || directory.mkdirs())
                        directory.listFiles().orEmpty()
                            .filter {
                                it.isFile && (it.name.startsWith("story-capture-") || it.name.startsWith("story-video-capture-")) &&
                                    it != capturedPhotoFile && it != pendingCameraFile && it != capturedVideoFile && it != pendingVideoFile
                            }
                            .forEach(File::delete)
                        val output = File.createTempFile("story-video-capture-", ".mp4", directory)
                        pendingVideoFile?.delete()
                        pendingVideoFile = output
                        val outputUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", output)
                        videoCamera.launch(outputUri)
                    }.onFailure {
                        pendingVideoFile?.delete()
                        pendingVideoFile = null
                        errorMessage = context.getString(R.string.story_camera_unavailable)
                    }
                },
                enabled = !isPublishing,
                modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth().testTag("story-camera-record-video"),
            ) {
                Icon(Icons.Default.Videocam, contentDescription = null)
                Text("  ${stringResource(R.string.story_camera_record_video)}")
            }
            OutlinedButton(
                onClick = { soundPickerVisible = true },
                enabled = !isPublishing,
                modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth().testTag("story-sound-picker"),
            ) {
                Text(
                    selectedSound?.let { if (it.isOriginal) stringResource(R.string.story_sound_original_by, it.ownerUsername) else it.title }
                        ?: stringResource(R.string.story_sound_none),
                )
            }
            selectedSound?.let { sound ->
                Text(
                    stringResource(R.string.story_sound_credit, sound.ownerName, sound.ownerUsername),
                    modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(Modifier.widthIn(max = 520.dp).fillMaxWidth()) {
                Text(stringResource(R.string.story_look_heading), style = MaterialTheme.typography.labelLarge)
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    StoryLookChoice.entries.forEach { look ->
                        FilterChip(
                            selected = selectedLook == look,
                            onClick = { selectedLook = look },
                            label = { Text(stringResource(look.labelResource)) },
                            modifier = Modifier.semantics { contentDescription = context.getString(look.labelResource) },
                        )
                    }
                }
            }
            errorMessage?.let {
                Text(it, modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth().padding(top = 12.dp), color = MaterialTheme.colorScheme.error)
            }
            Button(
                onClick = {
                    val uri = selectedPhoto ?: return@Button
                    val shouldUploadVideo = selectedVideo
                    val soundId = selectedSound?.id
                    val look = selectedLook.value.takeUnless { selectedLook == StoryLookChoice.NONE }
                    isPublishing = true
                    errorMessage = null
                    executor.execute {
                        val result = if (shouldUploadVideo) {
                            mediaRepository.uploadStoryVideo(uri, context.contentResolver, context.cacheDir)
                        } else {
                            mediaRepository.upload(
                                uri = uri,
                                resolver = context.contentResolver,
                                cacheDir = context.cacheDir,
                                purpose = NativeImageUploadPurpose.STORY,
                            )
                        }
                        val outcome = when (result) {
                            is CreatorSampleMediaResult.Success -> storiesRepository.publishStory(
                                result.image.mediaId,
                                soundId = soundId,
                                look = look,
                            )
                            is CreatorSampleMediaResult.VideoSuccess -> storiesRepository.publishStory(
                                result.mediaId,
                                soundId = soundId,
                                look = look,
                            )
                            is CreatorSampleMediaResult.Failure -> StoryPublishResult.Failure(result.message, result.authenticationRequired)
                            CreatorSampleMediaResult.Cancelled -> StoryPublishResult.Failure(context.getString(R.string.story_publish_cancelled))
                        }
                        Snapshot.withMutableSnapshot {
                            isPublishing = false
                            when (outcome) {
                                is StoryPublishResult.Success -> onPublished(outcome.storyId)
                                is StoryPublishResult.Failure -> {
                                    if (outcome.authenticationRequired) onReauthenticate()
                                    errorMessage = outcome.message
                                }
                            }
                        }
                    }
                },
                enabled = selectedPhoto != null && !isPublishing,
                modifier = Modifier.widthIn(max = 520.dp).fillMaxWidth().padding(top = 12.dp).testTag("story-photo-publish"),
            ) {
                if (isPublishing) CircularProgressIndicator()
                else {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                    Text("  ${stringResource(R.string.story_publish_action)}")
                }
            }
            TextButton(onClick = onCancel, enabled = !isPublishing, modifier = Modifier.padding(top = 4.dp)) {
                Text(stringResource(R.string.story_create_cancel))
            }
        }
    }
    StorySoundPicker(
        visible = soundPickerVisible,
        selectedSoundId = selectedSound?.id,
        repository = soundsRepository,
        executor = executor,
        onSelect = { selectedSound = it; soundPickerVisible = false },
        onDismiss = { soundPickerVisible = false },
        onReauthenticate = onReauthenticate,
    )
}

private enum class StoryLookChoice(val value: String, val labelResource: Int, val previewColors: List<Color>) {
    NONE("none", R.string.story_look_none, emptyList()),
    WARM("warm", R.string.story_look_warm, listOf(Color(0x24FFA63C))),
    COOL("cool", R.string.story_look_cool, listOf(Color(0x24468CFF))),
    ROSE("rose", R.string.story_look_rose, listOf(Color(0x24FF6EA0))),
    AQUA("aqua", R.string.story_look_aqua, listOf(Color(0x242DC8BE))),
    SUNSET("sunset", R.string.story_look_sunset, listOf(Color(0x1AFF5A28), Color(0x147828A0))),
}

private class StoryVideoCaptureContract(
    private val maximumDurationSeconds: Int = CreatorSampleMediaRepository.MAX_STORY_VIDEO_DURATION_SECONDS,
) : ActivityResultContract<Uri, androidx.activity.result.ActivityResult>() {
    override fun createIntent(context: android.content.Context, input: Uri): Intent =
        Intent(MediaStore.ACTION_VIDEO_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, input)
            putExtra(MediaStore.EXTRA_DURATION_LIMIT, maximumDurationSeconds)
            putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }

    override fun parseResult(resultCode: Int, intent: Intent?): androidx.activity.result.ActivityResult =
        androidx.activity.result.ActivityResult(resultCode, intent)
}

@Composable
private fun StoryLookOverlay(look: StoryLookChoice) {
    look.previewColors.forEach { color ->
        androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().background(color))
    }
}
