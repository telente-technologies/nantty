package com.nantty.android.ui.live

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.LiveCoinTipReceipt
import com.nantty.android.data.LiveCoinTipRepository
import com.nantty.android.data.LiveCoinTipResult
import com.nantty.android.data.LiveMediaGrant
import com.nantty.android.data.LiveSessionSnapshot
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.LiveSessionsResult
import io.livekit.android.compose.local.RoomScope
import io.livekit.android.compose.state.rememberTracks
import io.livekit.android.compose.ui.VideoTrackView
import java.util.UUID
import java.util.concurrent.Executor

/** Authenticated viewer route for an ordinary live; Spaces keep their independent audio-session flow. */
@Composable
internal fun LiveWatchScreen(
    liveId: String,
    sessions: LiveSessionsRepository,
    coinTips: LiveCoinTipRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var session by remember(liveId) { mutableStateOf<LiveSessionSnapshot?>(null) }
    var mediaGrant by remember(liveId) { mutableStateOf<LiveMediaGrant?>(null) }
    var joined by remember(liveId) { mutableStateOf(false) }
    var loading by remember(liveId) { mutableStateOf(true) }
    var working by remember(liveId) { mutableStateOf(false) }
    var error by remember(liveId) { mutableStateOf<String?>(null) }
    var receipt by remember(liveId) { mutableStateOf<LiveCoinTipReceipt?>(null) }
    var selectedCoins by remember(liveId) { mutableStateOf(100L) }

    LaunchedEffect(liveId, sessions) {
        loading = true
        executor.execute {
            when (val result = sessions.load(liveId)) {
                is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    session = result.value
                    error = null
                    loading = false
                    if (result.value.accessAllowed.not()) error = "Follow or subscribe to this host before watching."
                }
                is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    error = result.message
                    loading = false
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
        }
    }

    androidx.compose.runtime.DisposableEffect(liveId, joined, sessions) {
        onDispose {
            if (joined) executor.execute { sessions.leave(liveId) }
        }
    }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp)) {
        TextButton(onClick = onBack) { Text("Back") }
        when {
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            session == null -> LiveLoadError(error = error ?: "This Live could not be loaded.", onRetry = {
                loading = true
                executor.execute {
                    when (val result = sessions.load(liveId)) {
                        is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot { session = result.value; error = null; loading = false }
                        is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot { error = result.message; loading = false; if (result.authenticationRequired) onReauthenticate() }
                    }
                }
            })
            else -> {
                val current = session!!
                Text(current.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text("@${current.host.username} · ${current.viewers} watching", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))

                if (!joined || mediaGrant == null) {
                    Card(Modifier.fillMaxWidth().height(240.dp)) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(if (current.status == "live") "Join to watch this Live" else "This Live is ${current.status}.")
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Button(
                        onClick = {
                            if (!current.accessAllowed) return@Button
                            working = true
                            error = null
                            executor.execute {
                                when (val joinResult = sessions.join(liveId)) {
                                    is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        working = false
                                        error = joinResult.message
                                        if (joinResult.authenticationRequired) onReauthenticate()
                                    }
                                    is LiveSessionsResult.Success -> when (val tokenResult = sessions.issueMediaToken(liveId)) {
                                        is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            joined = true
                                            mediaGrant = tokenResult.value
                                            working = false
                                        }
                                        is LiveSessionsResult.Failure -> {
                                            sessions.leave(liveId)
                                            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                                working = false
                                                error = tokenResult.message
                                                if (tokenResult.authenticationRequired) onReauthenticate()
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        enabled = !working && current.status == "live" && current.accessAllowed,
                        modifier = Modifier.fillMaxWidth().testTag("live-watch-join"),
                    ) {
                        if (working) CircularProgressIndicator() else Text(if (current.accessAllowed) "Join Live" else "Access required")
                    }
                    if (!current.accessAllowed) TextButton(onClick = onBack) { Text("Back to Nantty") }
                } else {
                    mediaGrant?.let { grant ->
                        if (grant.canPublish) {
                            Card(Modifier.fillMaxWidth()) {
                                Text(
                                    "You’re approved to join the stage. Stage camera and microphone controls are not available in this Android Live view yet.",
                                    Modifier.padding(16.dp),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Card(Modifier.fillMaxWidth().height(280.dp).testTag("live-media-stage")) {
                            RoomScope(
                                url = grant.url,
                                token = grant.token,
                                audio = false,
                                video = false,
                                connect = true,
                                disconnectOnDispose = true,
                            ) {
                                val tracks by rememberTracks()
                                if (tracks.isEmpty()) {
                                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                        Text("Connected · waiting for the host’s video", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                } else {
                                    LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        items(tracks.size) { index ->
                                            VideoTrackView(trackReference = tracks[index], modifier = Modifier.fillMaxWidth().height(240.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    if (current.coinSupportEnabled) {
                        Text("Support the host with coins", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 8.dp)) {
                            listOf(100L, 500L, 1_000L).forEach { amount ->
                                if (selectedCoins == amount) Button(onClick = { selectedCoins = amount }) { Text("$amount") }
                                else OutlinedButton(onClick = { selectedCoins = amount }) { Text("$amount") }
                            }
                        }
                        Button(
                            onClick = {
                                working = true
                                error = null
                                receipt = null
                                val key = UUID.randomUUID().toString()
                                executor.execute {
                                    when (val result = coinTips.donate(liveId, selectedCoins, key)) {
                                        is LiveCoinTipResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot { receipt = result.receipt; working = false }
                                        is LiveCoinTipResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            error = result.message
                                            working = false
                                            if (result.authenticationRequired) onReauthenticate()
                                        }
                                    }
                                }
                            },
                            enabled = !working,
                            modifier = Modifier.fillMaxWidth().testTag("live-coin-donation"),
                        ) { Text(if (working) "Sending…" else "Send $selectedCoins coins") }
                        receipt?.let { Text("${it.coins} coins sent · balance ${it.coinBalance}", color = MaterialTheme.colorScheme.primary) }
                    } else {
                        Text("Coin support is turned off by the host.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
                    Text("Live comments and stage invitations are not yet available in this Android view.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 16.dp))
                }
            }
        }
    }
}

@Composable
private fun LiveLoadError(error: String, onRetry: () -> Unit) {
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(error, color = MaterialTheme.colorScheme.error)
        TextButton(onClick = onRetry) { Text("Try again") }
    }
}
