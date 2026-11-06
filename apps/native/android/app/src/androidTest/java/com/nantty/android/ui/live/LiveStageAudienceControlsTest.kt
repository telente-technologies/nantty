package com.nantty.android.ui.live

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import com.nantty.android.data.LiveStageViewerSnapshot
import com.nantty.android.data.LiveStageUserSummary
import com.nantty.android.data.LiveStageStreamerSummary
import com.nantty.android.ui.theme.NanttyTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class LiveStageAudienceControlsTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun viewerCanRequestStageAndSeesPendingState() {
        val stage = LiveStageViewerSnapshot("live-1", "viewer", null, null)
        compose.setContent {
            NanttyTheme {
                LiveStageAudienceControls(stage, false, false, false, false, null, {}, {}, {}, {})
            }
        }
        compose.onNodeWithTag("live-stage-request").assertIsDisplayed()

        compose.setContent {
            NanttyTheme {
                LiveStageAudienceControls(stage.copy(joinRequestState = "pending"), false, false, false, false, null, {}, {}, {}, {})
            }
        }
        compose.onNodeWithText("Your request to join is waiting for the host.").assertIsDisplayed()
        compose.onNodeWithTag("live-stage-request").assertDoesNotExist()
    }

    @Test
    fun invitedViewerMustExplicitlyAcceptOrDeclineBeforeStageMedia() {
        compose.setContent {
            NanttyTheme {
                LiveStageInvitationDialog("Host", true, true, false, null, {}, {})
            }
        }
        compose.onNodeWithTag("live-stage-accept").assertIsDisplayed()
        compose.onNodeWithTag("live-stage-decline").assertIsDisplayed()
        compose.onNodeWithText("Your camera and microphone will be shared with viewers. You can turn either off or leave the stage at any time.").assertIsDisplayed()
    }

    @Test
    fun hostCanOpenGuestManagementAndSeeSuggestedViewerIdentity() {
        val stage = LiveStageViewerSnapshot("live-1", "host", null, null)
        compose.setContent {
            NanttyTheme {
                LiveStageHostControls(
                    stage = stage,
                    viewers = listOf(LiveStageUserSummary("viewer-1", "Ada Viewer", "ada", null, true)),
                    searchQuery = "ada",
                    searching = false,
                    busy = false,
                    message = null,
                    onSearchChanged = {}, onInvite = {}, onApprove = {}, onDecline = {}, onRemove = {}, onMute = { _, _, _ -> },
                )
            }
        }
        compose.onNodeWithTag("live-stage-manage").performClick()
        compose.onNodeWithText("Ada Viewer").assertIsDisplayed()
        compose.onNodeWithText("@ada").assertIsDisplayed()
        compose.onNodeWithTag("live-stage-invite-viewer-1").assertIsDisplayed()
    }

    @Test
    fun hostMustConfirmBeforeRemovingGuest() {
        val guest = LiveStageUserSummary("guest-1", "Guest One", "guestone", null, false)
        val stage = LiveStageViewerSnapshot(
            liveId = "live-1",
            myRole = "host",
            invitationId = null,
            joinRequestState = null,
            streamers = listOf(LiveStageStreamerSummary("slot-1", guest, "guest", "onStage", false, false)),
        )
        val removed = mutableListOf<String>()
        compose.setContent {
            NanttyTheme {
                LiveStageHostControls(stage, emptyList(), "", false, false, null, {}, {}, {}, {}, { removed += it }, { _, _, _ -> })
            }
        }
        compose.onNodeWithTag("live-stage-manage").performClick()
        compose.onNodeWithText("Remove").performClick()
        compose.onNodeWithText("Remove Guest One from the stage?").assertIsDisplayed()
        compose.onNodeWithTag("live-stage-remove-confirm").performClick()
        assertEquals(listOf("guest-1"), removed)
    }
}
