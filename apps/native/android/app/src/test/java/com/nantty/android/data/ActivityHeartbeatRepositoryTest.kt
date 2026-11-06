package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ActivityHeartbeatRepositoryTest {
    @Test
    fun postsOnlyTimeZoneToAuthenticatedActivityPath() {
        var captured: Call? = null
        val repository = ActivityHeartbeatRepository(
            sessionProvider = { session("activity-access") },
            transport = { path, accessToken, body ->
                captured = Call(path, accessToken, JSONObject(body.toString()))
                204
            },
        )

        assertTrue(repository.recordCurrentActivity("Africa/Lagos").isSuccess)
        val call = requireNotNull(captured)
        assertEquals(ActivityHeartbeatRepository.ACTIVITY_PATH, call.path)
        assertEquals("activity-access", call.accessToken)
        assertEquals("Africa/Lagos", call.body.getString(ActivityHeartbeatRepository.TIME_ZONE_FIELD))
        assertEquals(1, call.body.length())
        assertFalse(call.body.has("userId"))
        assertFalse(call.body.has("user"))
    }

    @Test
    fun refusesUnauthenticatedHeartbeatWithoutCallingTransport() {
        var transportCalled = false
        val repository = ActivityHeartbeatRepository(
            sessionProvider = { null },
            transport = { _, _, _ -> transportCalled = true; 204 },
        )

        assertTrue(repository.recordCurrentActivity("Africa/Lagos").isFailure)
        assertFalse(transportCalled)
    }

    @Test
    fun rejectsBlankTimeZoneBeforeNetworkRequest() {
        var transportCalled = false
        val repository = ActivityHeartbeatRepository(
            sessionProvider = { session("activity-access") },
            transport = { _, _, _ -> transportCalled = true; 204 },
        )

        assertTrue(repository.recordCurrentActivity(" ").isFailure)
        assertFalse(transportCalled)
    }

    private fun session(accessToken: String) = AccountSession(
        accessToken = accessToken,
        refreshToken = "refresh",
        user = AccountUser("user-private", "Ada", "ada", null, null, emptyList()),
    )

    private data class Call(val path: String, val accessToken: String, val body: JSONObject)
}
