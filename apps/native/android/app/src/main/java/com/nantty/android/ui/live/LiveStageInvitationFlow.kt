package com.nantty.android.ui.live

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.nantty.android.data.LiveMediaGrant
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.LiveSessionsResult
import com.nantty.android.data.LiveStageRepository
import com.nantty.android.data.LiveStageViewerSnapshot
import java.util.concurrent.Executor

@Composable
internal fun LiveStageInvitationFlow(
    liveId: String,
    hostName: String,
    joined: Boolean,
    stageSnapshot: LiveStageViewerSnapshot?,
    mediaGrant: LiveMediaGrant?,
    busy: Boolean,
    stage: LiveStageRepository,
    sessions: LiveSessionsRepository,
    executor: Executor,
    onBusyChanged: (Boolean) -> Unit,
    onStageChanged: (LiveStageViewerSnapshot) -> Unit,
    onMediaGrantChanged: (LiveMediaGrant?) -> Unit,
    onPublishingEnabled: (Boolean) -> Unit,
    onError: (String?) -> Unit,
    onReauthenticate: () -> Unit,
) {
    val context = LocalContext.current
    var permissionMessage by remember(liveId) { mutableStateOf<String?>(null) }

    fun enableApprovedStage() {
        onBusyChanged(true)
        executor.execute {
            when (val result = sessions.issueMediaToken(liveId)) {
                is LiveSessionsResult.Success -> if (result.value.canPublish) androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    onMediaGrantChanged(result.value)
                    onPublishingEnabled(true)
                    onError(null)
                    onBusyChanged(false)
                } else androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    onError("Nantty hasn’t enabled stage media for your account yet.")
                    onBusyChanged(false)
                }
                is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    onError(result.message)
                    onBusyChanged(false)
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
        }
    }

    fun respondToInvitation(invitationId: String, accept: Boolean) {
        onBusyChanged(true)
        permissionMessage = null
        executor.execute {
            when (val result = stage.respondToInvitation(liveId, invitationId, accept)) {
                is LiveSessionsResult.Success -> {
                    var grant = result.value.mediaGrant
                    if (accept && grant == null) grant = (sessions.issueMediaToken(liveId) as? LiveSessionsResult.Success)?.value
                    if (accept && grant?.canPublish != true) {
                        stage.leaveStage(liveId)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            onBusyChanged(false)
                            onError("Nantty couldn’t connect your stage media. You’re back in the audience.")
                            onStageChanged(result.value.stage)
                        }
                    } else androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                        onStageChanged(result.value.stage)
                        if (accept) {
                            onMediaGrantChanged(grant)
                            onPublishingEnabled(true)
                        }
                        onBusyChanged(false)
                        onError(null)
                    }
                }
                is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    onBusyChanged(false)
                    onError(result.message)
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        val required = listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        val permissionsGranted = required.all { grants[it] == true }
        val invitationId = stageSnapshot?.invitationId
        if (permissionsGranted && invitationId != null) respondToInvitation(invitationId, accept = true)
        else if (permissionsGranted && stageSnapshot?.myRole == "guest") enableApprovedStage()
        else permissionMessage = "Camera and microphone access are needed to join the stage. You can try again or decline the invitation."
    }

    val invitationId = stageSnapshot?.invitationId
    val invitedByHost = invitationId != null
    val stageJoinApproved = stageSnapshot?.myRole == "guest" && mediaGrant?.canPublish != true
    LiveStageInvitationDialog(
        hostName = hostName,
        invitationRole = stageSnapshot?.invitationRole ?: "speaker",
        invitationTitle = stageSnapshot?.invitationTitle,
        invitedByHost = invitedByHost,
        visible = joined && (invitedByHost || stageJoinApproved),
        busy = busy,
        message = permissionMessage,
        onAccept = {
            val required = listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
            if (required.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) {
                when {
                    invitationId != null -> respondToInvitation(invitationId, accept = true)
                    stageJoinApproved -> enableApprovedStage()
                }
            } else permissionLauncher.launch(required.toTypedArray())
        },
        onDecline = {
            when {
                invitationId != null -> respondToInvitation(invitationId, accept = false)
                stageJoinApproved -> {
                    onBusyChanged(true)
                    executor.execute {
                        when (val result = stage.leaveStage(liveId)) {
                            is LiveSessionsResult.Success -> {
                                val viewerGrant = sessions.issueMediaToken(liveId)
                                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                    onStageChanged(result.value)
                                    onMediaGrantChanged((viewerGrant as? LiveSessionsResult.Success)?.value)
                                    onPublishingEnabled(false)
                                    permissionMessage = null
                                    onError((viewerGrant as? LiveSessionsResult.Failure)?.message)
                                    onBusyChanged(false)
                                }
                            }
                            is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                onError(result.message)
                                onBusyChanged(false)
                            }
                        }
                    }
                }
            }
        },
    )
}
