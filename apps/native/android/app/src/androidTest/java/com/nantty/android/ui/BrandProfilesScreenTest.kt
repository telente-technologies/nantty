package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.BrandProfilesRepository
import com.nantty.android.data.BrandProfilesTransport
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class BrandProfilesScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun listsAvailableProfilesAndSwitchesOnlyThroughActingProfileEndpoint() {
        val transport = BrandProfilesScreenTransportFake()
        val repository = BrandProfilesRepository("https://api.nantty.com", transport, ::screenSession)
        compose.setContent { MaterialTheme { BrandProfilesScreen(repository, Executor { it.run() }) } }

        compose.onNodeWithText("Switch profile").assertIsDisplayed()
        compose.onNodeWithText("Ari").assertIsDisplayed()
        compose.onNodeWithText("Studio North").assertIsDisplayed()
        compose.onNodeWithText("Current profile").assertIsDisplayed()
        compose.onNodeWithText("@studio-north · Brand").performClick()
        compose.onNodeWithText("Now acting as Studio North.").assertIsDisplayed()

        compose.runOnIdle {
            assertEquals(1, transport.switchCalls)
            assertEquals("brand-2", transport.lastProfileId)
            assertEquals(listOf("GET ${BrandProfilesRepository.PROFILES_PATH}", "GET ${BrandProfilesRepository.ACTING_PROFILE_PATH}", "PUT ${BrandProfilesRepository.ACTING_PROFILE_PATH}"), transport.calls)
        }
    }

    @Test
    fun showsLoadFailureAndAllowsRetry() {
        val transport = BrandProfilesScreenTransportFake().apply { failListOnce = true }
        val repository = BrandProfilesRepository("https://api.nantty.com", transport, ::screenSession)
        compose.setContent { MaterialTheme { BrandProfilesScreen(repository, Executor { it.run() }) } }

        compose.onNodeWithText("Try again").assertIsDisplayed().performClick()
        compose.onNodeWithText("Studio North").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, transport.listCalls) }
    }
}

private class BrandProfilesScreenTransportFake : BrandProfilesTransport {
    val calls = mutableListOf<String>()
    var listCalls = 0
    var switchCalls = 0
    var lastProfileId: String? = null
    var activeId = "person-1"
    var failListOnce = false

    override fun get(path: String, accessToken: String): JSONObject {
        calls += "GET $path"
        if (path == BrandProfilesRepository.PROFILES_PATH) {
            listCalls += 1
            if (failListOnce) {
                failListOnce = false
                error("Profiles temporarily unavailable.")
            }
            return JSONArray().put(screenProfile("person-1", "person", "Ari")).put(screenProfile("brand-2", "brand", "Studio North", activeId == "brand-2"))
                .let { JSONObject().put("data", it) }
        }
        return JSONObject().put("data", screenProfile(activeId, if (activeId == "person-1") "person" else "brand", if (activeId == "person-1") "Ari" else "Studio North", true))
    }

    override fun put(path: String, accessToken: String, body: JSONObject): JSONObject {
        calls += "PUT $path"
        switchCalls += 1
        lastProfileId = body.getString("profileId")
        activeId = lastProfileId!!
        return JSONObject().put("data", screenProfile(activeId, "brand", "Studio North", true))
    }
}

private fun screenProfile(id: String, kind: String, name: String, active: Boolean = false) = JSONObject()
    .put("id", id)
    .put("kind", kind)
    .put("type", kind)
    .put("name", name)
    .put("handle", if (kind == "person") "ari" else "studio-north")
    .put("avatarUrl", JSONObject.NULL)
    .put("active", active)
    .put("onHold", false)

private fun screenSession() = AccountSession(
    accessToken = "session-access-token",
    refreshToken = "session-refresh-token",
    user = AccountUser("account-1", "Ari", "ari", "private@example.test", null, listOf("user")),
)
