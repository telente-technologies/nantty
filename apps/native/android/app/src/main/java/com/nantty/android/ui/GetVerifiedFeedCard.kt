package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.R

internal enum class GetVerifiedCardKind { OFFER, PENDING, REJECTED }
internal enum class GetVerifiedCheckmarkColor { BLUE, GOLD }

internal data class GetVerifiedFeedCardState(
    val kind: GetVerifiedCardKind,
    val color: GetVerifiedCheckmarkColor,
    val profileName: String,
    val profileAvatarUrl: String?,
    val discountLine: String? = null,
    val rejectionReason: String? = null,
    val hasPersonalOffer: Boolean = false,
)

/** Mirrors the RN feed card using the existing Material theme, avatar treatment, and app icon set. */
@Composable
internal fun GetVerifiedFeedCard(
    state: GetVerifiedFeedCardState,
    onOpenVerification: () -> Unit,
    onDismiss: () -> Unit,
    onNeverShowAgain: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val markName = if (state.color == GetVerifiedCheckmarkColor.BLUE) {
        stringResource(R.string.checkmark_blue_name)
    } else {
        stringResource(R.string.checkmark_gold_name)
    }
    val title = when (state.kind) {
        GetVerifiedCardKind.OFFER -> stringResource(R.string.get_verified_offer_title, markName)
        GetVerifiedCardKind.PENDING -> stringResource(R.string.get_verified_pending_title)
        GetVerifiedCardKind.REJECTED -> stringResource(R.string.get_verified_rejected_title)
    }
    val body = when (state.kind) {
        GetVerifiedCardKind.OFFER -> if (state.color == GetVerifiedCheckmarkColor.BLUE) {
            stringResource(R.string.get_verified_blue_offer_body)
        } else {
            stringResource(R.string.get_verified_gold_offer_body)
        }
        GetVerifiedCardKind.PENDING -> stringResource(R.string.get_verified_pending_body, markName)
        GetVerifiedCardKind.REJECTED -> state.rejectionReason?.takeIf(String::isNotBlank)?.let {
            stringResource(R.string.get_verified_rejected_reason, it)
        } ?: stringResource(R.string.get_verified_rejected_body)
    }
    val primaryAction = when (state.kind) {
        GetVerifiedCardKind.OFFER -> if (state.hasPersonalOffer) stringResource(R.string.get_verified_use_offer) else stringResource(R.string.get_verified_action)
        GetVerifiedCardKind.PENDING -> stringResource(R.string.get_verified_view_status)
        GetVerifiedCardKind.REJECTED -> stringResource(R.string.get_verified_see_what_to_fix)
    }
    val badgeDescription = stringResource(R.string.get_verified_profile_badge, state.profileName, markName)
    val dismissLabel = stringResource(R.string.get_verified_dismiss)

    Card(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).testTag("feed-get-verified-card"),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = CardDefaults.outlinedCardBorder(),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    Modifier.size(44.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center,
                ) {
                    if (!state.profileAvatarUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = state.profileAvatarUrl,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(44.dp).clip(CircleShape),
                        )
                    } else {
                        Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.semantics { contentDescription = badgeDescription },
                    ) {
                        Text(state.profileName, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Icon(Icons.Default.Verified, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                    }
                    Text(
                        if (state.kind == GetVerifiedCardKind.OFFER) stringResource(R.string.get_verified_profile_preview)
                        else stringResource(R.string.get_verified_profile_checkmark, markName),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = onDismiss, modifier = Modifier.semantics { contentDescription = dismissLabel }) {
                    Icon(Icons.Default.Close, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (state.kind == GetVerifiedCardKind.OFFER && !state.discountLine.isNullOrBlank()) {
                Text(state.discountLine, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = onOpenVerification, modifier = Modifier.weight(1f)) { Text(primaryAction) }
                TextButton(onClick = onDismiss) { Text(stringResource(R.string.get_verified_not_now)) }
            }
            if (state.kind == GetVerifiedCardKind.OFFER) {
                TextButton(onClick = onNeverShowAgain, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text(stringResource(R.string.get_verified_never_show_again), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
