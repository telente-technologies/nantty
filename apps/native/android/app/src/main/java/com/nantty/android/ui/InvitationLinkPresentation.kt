package com.nantty.android.ui

import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import java.time.Instant

internal data class InvitationLinkExpiryOption(val hours: Int, val label: String)

internal const val DEFAULT_INVITATION_LINK_EXPIRY_HOURS = 168

internal val invitationLinkExpiryOptions = listOf(
    InvitationLinkExpiryOption(24, "24 hours"),
    InvitationLinkExpiryOption(168, "7 days"),
    InvitationLinkExpiryOption(720, "30 days"),
)

internal enum class InvitationLinkStatus(val label: String) {
    ACTIVE("Active link"),
    EXPIRED("Expired link"),
    REVOKED("Revoked link"),
    UNKNOWN("Expiry unavailable"),
}

@Composable
internal fun InvitationLinkExpiryPicker(
    kind: String,
    selectedHours: Int,
    enabled: Boolean = true,
    onSelect: (Int) -> Unit,
) {
    var expanded by remember(kind) { mutableStateOf(false) }
    val selected = invitationLinkExpiryOptions.first { it.hours == selectedHours }
    TextButton(
        onClick = { expanded = true },
        enabled = enabled,
        modifier = Modifier.semantics { contentDescription = "$kind invite link expiry, ${selected.label}" },
    ) { Text("Link expiry · ${selected.label}") }
    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        invitationLinkExpiryOptions.forEach { option ->
            DropdownMenuItem(
                text = { Text(option.label) },
                onClick = { onSelect(option.hours); expanded = false },
                enabled = enabled,
            )
        }
    }
}

internal fun invitationLinkStatus(expiresAt: String, revokedAt: String?, now: Instant = Instant.now()): InvitationLinkStatus {
    if (revokedAt != null) return InvitationLinkStatus.REVOKED
    val expires = runCatching { Instant.parse(expiresAt) }.getOrNull() ?: return InvitationLinkStatus.UNKNOWN
    return if (expires <= now) InvitationLinkStatus.EXPIRED else InvitationLinkStatus.ACTIVE
}
