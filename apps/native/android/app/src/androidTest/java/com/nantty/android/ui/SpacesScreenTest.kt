package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.SpacesRepository
import com.nantty.android.data.SpacesTransport
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class SpacesScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun guestCanBrowseDetailsButMustSignInToJoinOrCreate() {
        val transport = FakeSpacesTransport(hostRole = false)
        var signInRequested = false
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = null,
                    viewerId = null,
                    executor = Executor { it.run() },
                    onSignInRequired = { signInRequested = true },
                )
            }
        }

        compose.onNodeWithText("Studio talk").assertIsDisplayed().performClick()
        compose.onNodeWithText("LIVE SPACE").assertIsDisplayed()
        compose.onNodeWithText("Audio").assertIsDisplayed()
        compose.onNodeWithText("Joining and moderation are connected to Nantty. Live audio is not available in this Android build yet.").assertIsDisplayed()
        compose.onNodeWithText("Sign in to join").performClick()
        compose.runOnIdle { assertEquals(true, signInRequested) }
        compose.onNodeWithText("Create").performClick()
        compose.runOnIdle {
            assertEquals(true, signInRequested)
            assertEquals(1, transport.listRequests)
        }
    }

    @Test
    fun initialSpaceLinkOpensTheRequestedSpaceDetail() {
        val transport = FakeSpacesTransport(hostRole = false)
        var initialSpaceHandled = false
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "session-token",
                    viewerId = "viewer-2",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                    initialSpaceId = "space-1",
                    onInitialSpaceHandled = { initialSpaceHandled = true },
                )
            }
        }

        compose.onNodeWithText("LIVE SPACE").assertIsDisplayed()
        compose.onNodeWithText("Studio talk").assertIsDisplayed()
        compose.runOnIdle {
            assertTrue(transport.paths.contains("/api/v1/spaces/space-1"))
            assertTrue(initialSpaceHandled)
        }
    }

    @Test
    fun hostCanStartScheduledSpaceAndToggleCoinSupportThroughApi() {
        val transport = FakeSpacesTransport(hostRole = true, initialState = "scheduled")
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "session-token",
                    viewerId = "host-1",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                )
            }
        }

        compose.onNodeWithText("Studio talk").performClick()
        compose.onNodeWithText("Start Space").assertIsDisplayed().performClick()
        compose.onNodeWithText("End Space").assertIsDisplayed()
        compose.runOnIdle {
            assertTrue(transport.paths.contains("/api/v1/spaces/space-1/start"))
            assertEquals("session-token", transport.lastToken)
        }
    }

    @Test
    fun signedInListenerCanOpenSpaceReportForm() {
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", FakeSpacesTransport(hostRole = false)),
                    accessToken = "session-token",
                    viewerId = "viewer-2",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                )
            }
        }

        compose.onNodeWithText("Studio talk").performClick()
        compose.onNodeWithText("Report this Space").assertIsDisplayed().performClick()
        compose.onNodeWithText("Tell us why you’re reporting", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Scam or fraud").assertIsDisplayed()
        compose.onNodeWithText("Submit report").assertIsDisplayed()
    }

    @Test
    fun hostCanSelectInvitationRoleAndOptionalStageTitle() {
        val transport = FakeSpacesTransport(hostRole = true, inviteOnly = true)
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "session-token",
                    viewerId = "host-1",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                )
            }
        }

        compose.onNodeWithText("Studio talk").performClick()
        compose.onNodeWithText("Invite participant").performClick()
        compose.onNodeWithText("Search people").performTextInput("kai")
        compose.waitUntil(5_000) { transport.searchPeopleRequests > 0 }
        compose.onNodeWithText("Kai Designer").assertIsDisplayed()
        compose.onNodeWithText("@kai · Verified").assertIsDisplayed()
        compose.onNodeWithText("Listener").performClick()
        compose.onNodeWithText("Speaker", useUnmergedTree = true).performClick()
        compose.onNodeWithText("Stage title (optional)").performTextInput("Guest host")
        compose.onNodeWithText("Invite", useUnmergedTree = true).performClick()

        compose.runOnIdle {
            assertTrue(transport.paths.any { it == "/api/v1/search/people?q=kai&limit=20" })
            assertEquals("speaker", transport.lastInviteBody?.getString("role"))
            assertEquals("Guest host", transport.lastInviteBody?.getString("title"))
            assertEquals("candidate-account-9", transport.lastInviteBody?.getString("accountId"))
        }
    }

    @Test
    fun invitePeopleSearchShowsRetryableErrorAndEmptyState() {
        val transport = FakeSpacesTransport(hostRole = true, inviteOnly = true, peopleSearchFailure = true)
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "session-token",
                    viewerId = "host-1",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                )
            }
        }
        compose.onNodeWithText("Studio talk").performClick()
        compose.onNodeWithText("Invite participant").performClick()
        compose.onNodeWithText("Search people").performTextInput("no-match")
        compose.waitUntil(5_000) { transport.searchPeopleRequests > 0 }
        compose.onNodeWithText("people search unavailable").assertIsDisplayed()
        compose.onNodeWithText("Retry search").performClick()
        compose.waitUntil(5_000) { transport.searchPeopleRequests > 1 }
        compose.runOnIdle {
            transport.peopleSearchFailure = false
            transport.emptyPeopleResults = true
        }
        compose.onNodeWithText("Retry search").performClick()
        compose.waitUntil(5_000) { transport.searchPeopleRequests > 2 }
        compose.onNodeWithText("No people found. Try another name or username.").assertIsDisplayed()
    }

    @Test
    fun invitePeopleSearchShowsLoadingUntilPeopleSearchCompletes() {
        val transport = FakeSpacesTransport(hostRole = true, inviteOnly = true)
        val searchStarted = CountDownLatch(1)
        val releaseSearch = CountDownLatch(1)
        transport.searchStarted = searchStarted
        transport.releaseSearch = releaseSearch
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "session-token",
                    viewerId = "host-1",
                    executor = Executor { command -> Thread(command).start() },
                    onSignInRequired = {},
                )
            }
        }
        compose.waitUntil(5_000) { compose.onAllNodes(androidx.compose.ui.test.hasText("Studio talk")).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Studio talk").performClick()
        compose.waitUntil(5_000) { compose.onAllNodes(androidx.compose.ui.test.hasText("Invite participant")).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Invite participant").performClick()
        compose.onNodeWithText("Search people").performTextInput("kai")
        compose.waitUntil(5_000) { searchStarted.count == 0L }
        compose.onNodeWithText("Searching people…").assertIsDisplayed()
        releaseSearch.countDown()
        compose.onNodeWithText("Kai Designer").assertIsDisplayed()
    }

    @Test
    fun recipientCanOpenAndAcceptModeratorInvitationShownAsCohost() {
        val transport = FakeSpacesTransport(hostRole = false, invitationRole = "moderator")
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "recipient-token",
                    viewerId = "recipient-1",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                )
            }
        }

        compose.onNodeWithText("Your invitations").assertIsDisplayed()
        compose.onNodeWithText("Co-host · Guest host", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Open Space details").assertIsDisplayed()
        compose.onNodeWithText("Accept").assertIsDisplayed().performClick()
        compose.runOnIdle {
            assertTrue(transport.paths.contains("/api/v1/spaces/space-1/invites/invitation-1/accept"))
            assertEquals("recipient-token", transport.lastToken)
        }
        compose.onNodeWithText("LIVE SPACE").assertIsDisplayed()
    }

    @Test
    fun legacyCohostInvitationRoleAlsoUsesCohostLabel() {
        val transport = FakeSpacesTransport(hostRole = false, invitationRole = "cohost")
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "recipient-token",
                    viewerId = "recipient-1",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                )
            }
        }
        compose.onNodeWithText("Co-host · Guest host", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Decline").assertIsDisplayed().performClick()
        compose.onNodeWithText("No pending Space invitations").assertIsDisplayed()
        compose.runOnIdle {
            assertTrue(transport.paths.contains("/api/v1/spaces/space-1/invites/invitation-1/decline"))
        }
    }

    @Test
    fun signedInRecipientSeesInvitationEmptyAndRetryableErrorStates() {
        val transport = FakeSpacesTransport(hostRole = false, invitationFailure = true)
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "recipient-token",
                    viewerId = "recipient-1",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                )
            }
        }
        compose.onNodeWithText("invitation service unavailable").assertIsDisplayed()
        compose.onNodeWithText("Retry invitations").performClick()
        compose.runOnIdle { assertTrue(transport.invitationRequests >= 2) }

        transport.invitationFailure = false
        compose.onNodeWithText("Retry invitations").performClick()
        compose.onNodeWithText("No pending Space invitations").assertIsDisplayed()
    }

    @Test
    fun pendingInvitationsRefreshEveryThirtySecondsWhileSpacesIsActive() {
        val transport = FakeSpacesTransport(hostRole = false)
        compose.mainClock.autoAdvance = false
        compose.setContent {
            MaterialTheme {
                com.nantty.android.ui.spaces.SpacesScreen(
                    repository = SpacesRepository("https://api.nantty.test", transport),
                    accessToken = "recipient-token",
                    viewerId = "recipient-1",
                    executor = Executor { it.run() },
                    onSignInRequired = {},
                )
            }
        }

        compose.waitUntil(5_000) { transport.invitationRequests == 1 }
        compose.mainClock.advanceTimeBy(com.nantty.android.ui.spaces.SPACE_INVITATION_REFRESH_INTERVAL_MS + 1L)
        compose.waitUntil(5_000) { transport.invitationRequests >= 2 }
    }
}

private class FakeSpacesTransport(
    hostRole: Boolean,
    initialState: String = "live",
    private val inviteOnly: Boolean = false,
    private val invitationRole: String? = null,
    var invitationFailure: Boolean = false,
    var peopleSearchFailure: Boolean = false,
    var emptyPeopleResults: Boolean = false,
) : SpacesTransport {
    private val isHost = hostRole
    private var state = initialState
    private var coinSupport = true
    var listRequests = 0
    var invitationRequests = 0
    var searchPeopleRequests = 0
    var searchStarted: CountDownLatch? = null
    var releaseSearch: CountDownLatch? = null
    var lastMethod: String? = null
    var lastPath: String? = null
    var lastToken: String? = null
    var lastBody: JSONObject? = null
    var lastInviteBody: JSONObject? = null
    val paths = mutableListOf<String>()
    private var invitationPending = invitationRole != null

    override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, idempotencyKey: String?): JSONObject {
        lastMethod = method
        lastPath = path
        lastToken = accessToken
        lastBody = body
        if (path == "/api/v1/spaces/space-1/invites") lastInviteBody = body
        paths += path
        return when {
            method == "GET" && path.startsWith("/api/v1/search/people?") -> {
                searchPeopleRequests += 1
                searchStarted?.countDown()
                releaseSearch?.await(5, TimeUnit.SECONDS)
                if (peopleSearchFailure) throw com.nantty.android.data.SpacesHttpException(503, "people search unavailable")
                val data = JSONArray()
                if (!emptyPeopleResults) data.put(JSONObject()
                    .put("id", "candidate-account-9")
                    .put("name", "Kai Designer")
                    .put("username", "kai")
                    .put("verified", true))
                JSONObject().put("data", data).put("nextCursor", JSONObject.NULL)
            }
            method == "GET" && path.startsWith("/api/v1/spaces/invitations?") -> {
                invitationRequests += 1
                if (invitationFailure) throw com.nantty.android.data.SpacesHttpException(503, "invitation service unavailable")
                val data = JSONArray()
                if (invitationPending) data.put(JSONObject()
                    .put("spaceId", "space-1")
                    .put("invitationId", "invitation-1")
                    .put("role", invitationRole)
                    .put("title", "Guest host")
                    .put("invitedAt", "2026-11-05T10:00:00Z")
                    .put("inviterId", "host-1")
                    .put("space", summary()))
                JSONObject().put("data", data)
            }
            method == "GET" && path.startsWith("/api/v1/spaces?") -> {
                listRequests += 1
                JSONObject().put("data", JSONObject().put("data", JSONArray().put(summary())))
            }
            method == "GET" -> JSONObject().put("data", detail())
            path.endsWith("/start") -> {
                state = "live"
                JSONObject()
            }
            path.endsWith("/accept") || path.endsWith("/decline") -> {
                invitationPending = false
                JSONObject()
            }
            path.endsWith("/coin-donations") && method == "PATCH" -> {
                coinSupport = body?.optBoolean("enabled", true) ?: true
                JSONObject().put("data", JSONObject().put("giftsEnabled", coinSupport))
            }
            else -> JSONObject()
        }
    }

    private fun summary() = JSONObject()
        .put("id", "space-1")
        .put("title", "Studio talk")
        .put("description", "An open conversation")
        .put("state", state)
        .put("visibility", if (inviteOnly) "invite_only" else "public")
        .put("listenerCount", 4)
        .put("host", JSONObject().put("id", "host-1").put("name", "Host").put("role", "host"))

    private fun detail() = summary()
        .put("giftsEnabled", coinSupport)
        .put("viewerRole", if (isHost) "host" else JSONObject.NULL)
        .put("viewerJoined", isHost)
        .put("speakers", JSONArray())
        .put("pendingSpeakerRequests", JSONArray())
}
