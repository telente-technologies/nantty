package com.nantty.android.ui.spaces

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CreateSpaceRequest
import com.nantty.android.data.ProductReportReason
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportResult
import com.nantty.android.data.SpaceDetails
import com.nantty.android.data.SpaceDonationReceipt
import com.nantty.android.data.SpaceInviteRole
import com.nantty.android.data.SpaceInvitePerson
import com.nantty.android.data.SpaceInvitation
import com.nantty.android.data.SpaceInvitationPage
import com.nantty.android.data.SpacePage
import com.nantty.android.data.SpaceRole
import com.nantty.android.data.SpaceState
import com.nantty.android.data.SpaceSummary
import com.nantty.android.data.SpaceVisibility
import com.nantty.android.data.SpacesRepository
import com.nantty.android.data.SpacesResult
import java.util.concurrent.Executor

@Composable
internal fun SpacesScreen(
    repository: SpacesRepository,
    accessToken: String?,
    viewerId: String?,
    executor: Executor,
    onSignInRequired: () -> Unit,
    initialSpaceId: String? = null,
    onInitialSpaceHandled: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var page by remember { mutableStateOf<SpacePage?>(null) }
    var invitationPage by remember { mutableStateOf<SpaceInvitationPage?>(null) }
    var loadingInvitations by remember { mutableStateOf(false) }
    var invitationError by remember { mutableStateOf<String?>(null) }
    var invitationActionError by remember { mutableStateOf<String?>(null) }
    var respondingInvitationId by remember { mutableStateOf<String?>(null) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var detail by remember { mutableStateOf<SpaceDetails?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadingDetail by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var showInvite by remember { mutableStateOf(false) }
    var showDonation by remember { mutableStateOf(false) }
    var inviteQuery by remember { mutableStateOf("") }
    var invitePeople by remember { mutableStateOf<List<SpaceInvitePerson>>(emptyList()) }
    var inviteSearchLoading by remember { mutableStateOf(false) }
    var inviteSearchError by remember { mutableStateOf<String?>(null) }
    var inviteSearchNeedsAuth by remember { mutableStateOf(false) }
    var inviteSearchRetry by remember { mutableIntStateOf(0) }
    var donationRequestAmount by remember { mutableStateOf<Long?>(null) }
    var donationRequestKey by remember { mutableStateOf<String?>(null) }
    var donationReceipt by remember { mutableStateOf<SpaceDonationReceipt?>(null) }
    var showReport by remember { mutableStateOf(false) }
    var reportReason by remember { mutableStateOf(ProductReportReason.SPAM) }
    var reportDetails by remember { mutableStateOf("") }
    var reportResult by remember { mutableStateOf<ProductReportResult?>(null) }
    var reporting by remember { mutableStateOf(false) }
    var reportIdempotencyKey by remember { mutableStateOf(java.util.UUID.randomUUID().toString()) }

    fun loadInvitations(cursor: String? = null, append: Boolean = false) {
        if (loadingInvitations) return
        val token = accessToken?.takeIf(String::isNotBlank) ?: run {
            invitationPage = null
            loadingInvitations = false
            invitationError = null
            return
        }
        loadingInvitations = true
        invitationError = null
        executor.execute {
            val result = repository.listInvitations(token, cursor)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is SpacesResult.Success -> {
                        val prior = if (append) invitationPage?.items.orEmpty() else emptyList()
                        invitationPage = result.value.copy(items = prior + result.value.items)
                    }
                    is SpacesResult.Failure -> invitationError = result.message
                }
                loadingInvitations = false
            }
        }
    }

    fun respondToInvitation(invitation: SpaceInvitation, accept: Boolean) {
        val token = accessToken?.takeIf(String::isNotBlank)
        if (token == null) {
            onSignInRequired()
            return
        }
        if (respondingInvitationId != null) return
        respondingInvitationId = invitation.invitationId
        invitationActionError = null
        executor.execute {
            val result = if (accept) {
                repository.acceptInvitation(invitation.spaceId, invitation.invitationId, token)
            } else {
                repository.declineInvitation(invitation.spaceId, invitation.invitationId, token)
            }
            val refreshedInvitations = if (result is SpacesResult.Success) repository.listInvitations(token) else null
            val openedDetail = if (accept && result is SpacesResult.Success) repository.detail(invitation.spaceId, token) else null
            Snapshot.withMutableSnapshot {
                respondingInvitationId = null
                when (result) {
                    is SpacesResult.Failure -> invitationActionError = result.message
                    is SpacesResult.Success -> {
                        invitationPage = (refreshedInvitations as? SpacesResult.Success)?.value
                        if (refreshedInvitations is SpacesResult.Failure) invitationError = refreshedInvitations.message
                        if (accept) {
                            selectedId = invitation.spaceId
                            loadingDetail = false
                            when (openedDetail) {
                                is SpacesResult.Success -> detail = openedDetail.value
                                is SpacesResult.Failure -> error = openedDetail.message
                                null -> Unit
                            }
                        } else {
                            notice = "Invitation declined."
                        }
                    }
                }
            }
        }
    }

    fun loadList() {
        loading = true
        error = null
        executor.execute {
            val result = repository.list(accessToken)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is SpacesResult.Success -> page = result.value
                    is SpacesResult.Failure -> error = result.message
                }
                loading = false
            }
        }
    }

    fun loadDetail(spaceId: String) {
        selectedId = spaceId
        loadingDetail = true
        error = null
        executor.execute {
            val result = repository.detail(spaceId, accessToken)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is SpacesResult.Success -> detail = result.value
                    is SpacesResult.Failure -> error = result.message
                }
                loadingDetail = false
            }
        }
    }

    fun refreshDetail() {
        selectedId?.let(::loadDetail)
    }

    fun perform(action: String, request: (String) -> SpacesResult<*>) {
        val token = accessToken?.takeIf(String::isNotBlank)
        if (token == null) {
            onSignInRequired()
            return
        }
        if (working) return
        val spaceId = selectedId ?: return
        working = true
        error = null
        notice = null
        executor.execute {
            val result = request(token)
            val refreshed = if (result is SpacesResult.Success) repository.detail(spaceId, token) else null
            Snapshot.withMutableSnapshot {
                working = false
                when (result) {
                    is SpacesResult.Failure -> error = result.message
                    is SpacesResult.Success -> {
                        notice = action
                        if (refreshed is SpacesResult.Success) detail = refreshed.value
                        if (refreshed is SpacesResult.Failure) error = refreshed.message
                    }
                }
            }
        }
    }

    fun create(request: CreateSpaceRequest) {
        val token = accessToken?.takeIf(String::isNotBlank)
        if (token == null) {
            onSignInRequired()
            return
        }
        working = true
        error = null
        executor.execute {
            val result = repository.create(request, token)
            val refreshed = if (result is SpacesResult.Success) repository.list(token) else null
            val created = (result as? SpacesResult.Success)?.value
            val loadedDetail = created?.let { repository.detail(it.id, token) }
            Snapshot.withMutableSnapshot {
                working = false
                when (result) {
                    is SpacesResult.Failure -> error = result.message
                    is SpacesResult.Success -> {
                        showCreate = false
                        selectedId = result.value.id
                        page = (refreshed as? SpacesResult.Success)?.value ?: page
                        notice = if (result.value.state == SpaceState.SCHEDULED) "Space scheduled." else "Space created."
                        if (loadedDetail is SpacesResult.Success) detail = loadedDetail.value
                        if (loadedDetail is SpacesResult.Failure) error = loadedDetail.message
                    }
                }
            }
        }
    }

    fun donate(coins: Long) {
        val token = accessToken?.takeIf(String::isNotBlank)
        if (token == null) {
            onSignInRequired()
            return
        }
        val spaceId = selectedId ?: return
        if (working) return
        if (donationRequestAmount != coins || donationRequestKey == null) {
            donationRequestAmount = coins
            donationRequestKey = java.util.UUID.randomUUID().toString()
        }
        val key = donationRequestKey ?: return
        working = true
        error = null
        executor.execute {
            val result = repository.sendCoinDonation(spaceId, coins, token, key)
            val refreshed = if (result is SpacesResult.Success) repository.detail(spaceId, token) else null
            Snapshot.withMutableSnapshot {
                working = false
                when (result) {
                    is SpacesResult.Failure -> error = result.message
                    is SpacesResult.Success -> {
                        showDonation = false
                        donationRequestAmount = null
                        donationRequestKey = null
                        detail = (refreshed as? SpacesResult.Success)?.value ?: detail
                        notice = "You donated ${result.value.totalCoins} Coins. Your balance is ${result.value.senderCoinBalance} Coins."
                        if (refreshed is SpacesResult.Failure) error = refreshed.message
                    }
                }
            }
        }
    }

    fun reportSpace() {
        val token = accessToken?.takeIf(String::isNotBlank)
        if (token == null) {
            onSignInRequired()
            return
        }
        val spaceId = selectedId ?: return
        if (reporting || reportResult is ProductReportResult.Success) return
        reporting = true
        executor.execute {
            val repository = ProductReportRepository(accessTokenProvider = { token })
            val result = repository.submitSpace(spaceId, reportReason, reportDetails, reportIdempotencyKey)
            Snapshot.withMutableSnapshot {
                reportResult = result
                reporting = false
            }
        }
    }

    LaunchedEffect(accessToken) {
        loadList()
        invitationPage = null
        invitationError = null
        invitationActionError = null
        if (accessToken.isNullOrBlank()) {
            loadingInvitations = false
        } else loadInvitations()
    }

    LaunchedEffect(initialSpaceId) {
        initialSpaceId?.takeIf(String::isNotBlank)?.let(::loadDetail)
        if (initialSpaceId != null) onInitialSpaceHandled()
    }

    SpaceInvitationRefreshEffect(
        enabled = !accessToken.isNullOrBlank() && !viewerId.isNullOrBlank() && selectedId == null && !showCreate,
        onRefresh = { loadInvitations() },
    )

    SpaceInviteSearchEffect(
        showInvite = showInvite,
        query = inviteQuery,
        accessToken = accessToken,
        retry = inviteSearchRetry,
        repository = repository,
        executor = executor,
        onReset = {
            invitePeople = emptyList()
            inviteSearchError = null
            inviteSearchNeedsAuth = false
            inviteSearchLoading = false
        },
        onAuthenticationRequired = {
            inviteSearchNeedsAuth = true
            inviteSearchError = "Sign in to search for people to invite."
        },
        onSearchStarted = { inviteSearchLoading = true },
        onSearchCompleted = { result ->
            when (result) {
                is SpacesResult.Success -> invitePeople = result.value
                is SpacesResult.Failure -> {
                    inviteSearchError = result.message
                    inviteSearchNeedsAuth = result.statusCode == 401 || result.statusCode == 403
                }
            }
            inviteSearchLoading = false
        },
    )

    BoxWithConstraints(modifier.fillMaxSize()) {
        val wide = maxWidth >= 840.dp
        Column(Modifier.fillMaxSize().widthIn(max = 1_280.dp).align(Alignment.TopCenter)) {
            SpacesScreenHeader(
                refreshing = loading || loadingInvitations,
                onRefresh = { loadList(); loadInvitations() },
                onCreate = { if (accessToken.isNullOrBlank()) onSignInRequired() else showCreate = true },
            )
            error?.let { Text(it, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), color = MaterialTheme.colorScheme.error) }
            notice?.let { Text(it, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), color = MaterialTheme.colorScheme.primary) }

            if (wide) {
                Row(Modifier.fillMaxSize().padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SpacesListPane(
                        items = page?.items.orEmpty(), selectedId = selectedId, loading = loading,
                        onSelect = ::loadDetail, modifier = Modifier.weight(0.9f),
                        invitations = if (accessToken.isNullOrBlank()) emptyList() else invitationPage?.items.orEmpty(),
                        invitationsVisible = !accessToken.isNullOrBlank(), invitationsLoading = loadingInvitations,
                        invitationsError = invitationError, invitationActionError = invitationActionError,
                        respondingInvitationId = respondingInvitationId,
                        invitationNextCursor = invitationPage?.nextCursor,
                        onOpenInvitation = { loadDetail(it.spaceId) }, onRespondInvitation = ::respondToInvitation,
                        onRetryInvitations = { loadInvitations() }, onLoadMoreInvitations = { loadInvitations(invitationPage?.nextCursor, append = true) },
                    )
                    SpaceDetailPane(
                        details = detail?.takeIf { it.summary.id == selectedId }, loading = loadingDetail,
                        viewerId = viewerId, accessToken = accessToken, working = working,
                        onSignInRequired = onSignInRequired,
                        onJoin = { id -> perform("Joined Space.") { token -> repository.join(id, token) } },
                        onLeave = { id -> perform("Left Space.") { token -> repository.leave(id, token) } },
                        onRequestSpeaker = { id -> perform("Speaker request sent.") { token -> repository.requestSpeaker(id, token) } },
                        onApprove = { id, requestId -> perform("Speaker request approved.") { token -> repository.approveSpeakerRequest(id, requestId, token) } },
                        onDecline = { id, requestId -> perform("Speaker request declined.") { token -> repository.declineSpeakerRequest(id, requestId, token) } },
                        onMute = { id, userId, muted -> perform(if (muted) "Speaker muted." else "Speaker unmuted.") { token -> repository.muteSpeaker(id, userId, muted, token) } },
                        onDemote = { id, userId -> perform("Speaker moved to listener.") { token -> repository.demoteSpeaker(id, userId, token) } },
                        onRemove = { id, userId -> perform("Speaker removed.") { token -> repository.removeSpeaker(id, userId, token) } },
                        onToggleDonations = { id, enabled -> perform("Coin support ${if (enabled) "enabled" else "disabled"}.") { token -> repository.setCoinDonations(id, enabled, token) } },
                        onStart = { id -> perform("Space started.") { token -> repository.start(id, token) } },
                        onEnd = { id -> perform("Space ended.") { token -> repository.end(id, token) } },
                        onCancel = { id -> perform("Space cancelled.") { token -> repository.cancel(id, token) } },
                        onInvite = { showInvite = true }, onDonate = { showDonation = true },
                        onReport = { if (accessToken.isNullOrBlank()) onSignInRequired() else showReport = true },
                        modifier = Modifier.weight(1.1f),
                    )
                }
            } else if (selectedId == null) {
                SpacesListPane(
                    items = page?.items.orEmpty(), selectedId = null, loading = loading, onSelect = ::loadDetail, modifier = Modifier.fillMaxSize(),
                    invitations = if (accessToken.isNullOrBlank()) emptyList() else invitationPage?.items.orEmpty(),
                    invitationsVisible = !accessToken.isNullOrBlank(), invitationsLoading = loadingInvitations,
                    invitationsError = invitationError, invitationActionError = invitationActionError,
                    respondingInvitationId = respondingInvitationId, invitationNextCursor = invitationPage?.nextCursor,
                    onOpenInvitation = { loadDetail(it.spaceId) }, onRespondInvitation = ::respondToInvitation,
                    onRetryInvitations = { loadInvitations() }, onLoadMoreInvitations = { loadInvitations(invitationPage?.nextCursor, append = true) },
                )
            } else {
                SpaceDetailPane(
                    details = detail?.takeIf { it.summary.id == selectedId }, loading = loadingDetail,
                    viewerId = viewerId, accessToken = accessToken, working = working,
                    onBack = { selectedId = null; detail = null }, onSignInRequired = onSignInRequired,
                    onJoin = { id -> perform("Joined Space.") { token -> repository.join(id, token) } },
                    onLeave = { id -> perform("Left Space.") { token -> repository.leave(id, token) } },
                    onRequestSpeaker = { id -> perform("Speaker request sent.") { token -> repository.requestSpeaker(id, token) } },
                    onApprove = { id, requestId -> perform("Speaker request approved.") { token -> repository.approveSpeakerRequest(id, requestId, token) } },
                    onDecline = { id, requestId -> perform("Speaker request declined.") { token -> repository.declineSpeakerRequest(id, requestId, token) } },
                    onMute = { id, userId, muted -> perform(if (muted) "Speaker muted." else "Speaker unmuted.") { token -> repository.muteSpeaker(id, userId, muted, token) } },
                    onDemote = { id, userId -> perform("Speaker moved to listener.") { token -> repository.demoteSpeaker(id, userId, token) } },
                    onRemove = { id, userId -> perform("Speaker removed.") { token -> repository.removeSpeaker(id, userId, token) } },
                    onToggleDonations = { id, enabled -> perform("Coin support ${if (enabled) "enabled" else "disabled"}.") { token -> repository.setCoinDonations(id, enabled, token) } },
                    onStart = { id -> perform("Space started.") { token -> repository.start(id, token) } },
                    onEnd = { id -> perform("Space ended.") { token -> repository.end(id, token) } },
                    onCancel = { id -> perform("Space cancelled.") { token -> repository.cancel(id, token) } },
                    onInvite = { showInvite = true }, onDonate = { showDonation = true },
                    onReport = { if (accessToken.isNullOrBlank()) onSignInRequired() else showReport = true },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }

    if (showCreate) SpacesCreateDialog(working = working, onDismiss = { showCreate = false }, onCreate = ::create)
    if (showInvite) {
        SpaceInviteDialog(
            query = inviteQuery,
            onQueryChange = { inviteQuery = it },
            people = invitePeople,
            searching = inviteSearchLoading,
            searchError = inviteSearchError,
            searchNeedsAuth = inviteSearchNeedsAuth,
            onRetrySearch = { inviteSearchRetry++ },
            onSignInRequired = onSignInRequired,
            working = working,
            onDismiss = {
                showInvite = false
                inviteQuery = ""
                invitePeople = emptyList()
            },
            onInvite = { person, role, title ->
                selectedId?.let { spaceId ->
                    perform("Invitation sent to @${person.username} as ${role.label}.") { token -> repository.invite(spaceId, person.id, token, role = role, title = title) }
                    inviteQuery = ""
                    invitePeople = emptyList()
                    showInvite = false
                }
            },
        )
    }
    if (showDonation) {
        SpaceDonationDialog(
            hostName = detail?.summary?.host?.name ?: "the host",
            working = working,
            onDismiss = { showDonation = false },
            onDonate = ::donate,
        )
    }
    if (showReport) {
        SpaceReportDialog(
            spaceTitle = detail?.summary?.title.orEmpty(),
            selectedReason = reportReason,
            details = reportDetails,
            result = reportResult,
            submitting = reporting,
            onReasonChange = { reason ->
                reportReason = reason
                reportResult = null
                reportIdempotencyKey = java.util.UUID.randomUUID().toString()
            },
            onDetailsChange = { value ->
                reportDetails = value
                reportResult = null
                reportIdempotencyKey = java.util.UUID.randomUUID().toString()
            },
            onSubmit = ::reportSpace,
            onDismiss = {
                showReport = false
                if (reportResult is ProductReportResult.Success) {
                    reportResult = null
                    reportDetails = ""
                    reportReason = ProductReportReason.SPAM
                    reportIdempotencyKey = java.util.UUID.randomUUID().toString()
                }
            },
        )
    }
}
