package com.nantty.android.ui.clips

import android.view.View
import androidx.annotation.OptIn
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Slider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay

@Composable
@OptIn(markerClass = [UnstableApi::class])
internal fun ClipVideoPlayer(
    videoUrl: String,
    muted: Boolean,
    isActive: Boolean,
    modifier: Modifier = Modifier,
    loop: Boolean = true,
    onPlaybackFinished: () -> Unit = {},
    onPlaybackPosition: (currentSeconds: Double, durationSeconds: Double) -> Unit = { _, _ -> },
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val player = remember(videoUrl) {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = if (loop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
            setMediaItem(MediaItem.fromUri(videoUrl))
            prepare()
        }
    }
    val activePlayer = player
    val latestPlaybackFinished = rememberUpdatedState(onPlaybackFinished)
    val latestPlaybackPosition = rememberUpdatedState(onPlaybackPosition)
    var lifecycleResumed by remember(lifecycleOwner) {
        mutableStateOf(lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
    }
    var playbackProgress by remember(player) { mutableFloatStateOf(0f) }

    DisposableEffect(lifecycleOwner, player) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> lifecycleResumed = true
                Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> lifecycleResumed = false
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            player.release()
        }
    }
    DisposableEffect(player, loop) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (!loop && playbackState == Player.STATE_ENDED) latestPlaybackFinished.value()
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }
    LaunchedEffect(player, muted) { player.volume = if (muted) 0f else 1f }
    LaunchedEffect(player, lifecycleResumed, isActive) {
        if (lifecycleResumed && isActive) player.play() else player.pause()
    }
    LaunchedEffect(player, isActive) {
        if (!isActive) return@LaunchedEffect
        while (true) {
            val duration = player.duration
            val position = player.currentPosition.coerceAtLeast(0L)
            playbackProgress = if (duration > 0L) (position.toFloat() / duration).coerceIn(0f, 1f) else 0f
            if (duration > 0L) latestPlaybackPosition.value(position / 1000.0, duration / 1000.0)
            delay(250)
        }
    }

    Box(modifier) {
        AndroidView(
            factory = { viewContext ->
                PlayerView(viewContext).apply {
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                    keepScreenOn = true
                    this.player = activePlayer
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }
            },
            update = { it.player = player },
            modifier = Modifier.fillMaxSize().testTag("clip-video-player"),
        )
        Slider(
            value = playbackProgress,
            onValueChange = { progress ->
                playbackProgress = progress
                val duration = player.duration
                if (duration > 0L) player.seekTo((duration * progress).toLong())
            },
            modifier = Modifier.align(Alignment.BottomCenter).padding(horizontal = 12.dp).semantics {
                contentDescription = "Clip playback position"
            },
        )
    }
}
