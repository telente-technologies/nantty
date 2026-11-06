package com.nantty.android.ui.spaces

internal fun spaceInvitationRoleLabel(role: String): String = when (role.lowercase()) {
    "moderator", "cohost", "co-host" -> "Co-host"
    "speaker" -> "Speaker"
    "listener" -> "Listener"
    else -> "Invited participant"
}
