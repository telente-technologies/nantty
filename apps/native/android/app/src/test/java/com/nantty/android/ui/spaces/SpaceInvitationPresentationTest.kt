package com.nantty.android.ui.spaces

import org.junit.Assert.assertEquals
import org.junit.Test

class SpaceInvitationPresentationTest {
    @Test
    fun persistedModeratorAndLegacyCohostRolesBothDisplayAsCohost() {
        assertEquals("Co-host", spaceInvitationRoleLabel("moderator"))
        assertEquals("Co-host", spaceInvitationRoleLabel("cohost"))
        assertEquals("Co-host", spaceInvitationRoleLabel("co-host"))
    }

    @Test
    fun invitationRoleLabelsDoNotMisrepresentUnknownRolesAsListeners() {
        assertEquals("Speaker", spaceInvitationRoleLabel("speaker"))
        assertEquals("Listener", spaceInvitationRoleLabel("listener"))
        assertEquals("Invited participant", spaceInvitationRoleLabel("future_role"))
    }
}
