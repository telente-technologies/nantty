package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.CurrentProfileTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class CurrentProfileScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun showsOwnProfileWithoutRenderingSensitiveFieldsAndEditsOnlySupportedFields() {
        val transport = CurrentProfileTransportFake()
        val repository = CurrentProfileRepository(
            "https://api.nantty.com",
            transport,
            ::signedInSession,
        )
        compose.setContent {
            MaterialTheme {
                CurrentProfileScreen(repository, Executor { it.run() })
            }
        }

        compose.onNodeWithText("Your profile").assertIsDisplayed()
        compose.onNodeWithText("Ari").assertIsDisplayed()
        compose.onNodeWithText("@ari").assertIsDisplayed()
        compose.onNodeWithText("must-not-be-mapped@example.test").assertDoesNotExist()
        compose.onNodeWithText("admin").assertDoesNotExist()

        compose.onNodeWithText("Edit profile").performClick()
        compose.onNodeWithText("3/50").assertIsDisplayed()
        compose.onNodeWithText("32/160").assertIsDisplayed()
        compose.onNodeWithText("Save changes").performClick()
        compose.runOnIdle {
            assertEquals(1, transport.patchCalls)
            assertEquals(setOf("name", "bio", "isPrivate"), transport.patchFields!!.keys().asSequence().toSet())
            assertEquals("GET", transport.methods.first())
            assertEquals("PATCH", transport.methods.last())
        }
    }

    @Test
    fun opensBusinessToolsFromTheOwnProfile() {
        var openedBusinessTools = false
        val repository = CurrentProfileRepository(
            "https://api.nantty.com",
            CurrentProfileTransportFake(),
            ::signedInSession,
        )
        compose.setContent {
            MaterialTheme {
                CurrentProfileScreen(
                    repository = repository,
                    executor = Executor { it.run() },
                    onOpenBusinessTools = { openedBusinessTools = true },
                )
            }
        }

        compose.onNodeWithText("Seller, creator, brand & ads tools").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals(true, openedBusinessTools) }
    }
}

private class CurrentProfileTransportFake : CurrentProfileTransport {
    val methods = mutableListOf<String>()
    var patchCalls = 0
    var patchFields: JSONObject? = null

    override fun getMe(accessToken: String): JSONObject {
        methods += "GET"
        return payload()
    }

    override fun patchMe(accessToken: String, fields: JSONObject): JSONObject {
        methods += "PATCH"
        patchCalls += 1
        patchFields = fields
        return payload(name = fields.getString("name"), bio = fields.getString("bio"), privateProfile = fields.getBoolean("isPrivate"))
    }
}

private fun signedInSession() = AccountSession(
    accessToken = "session-access-token",
    refreshToken = "session-refresh-token",
    user = AccountUser("account-1", "Ari", "ari", "private@example.test", null, listOf("user")),
)

private fun payload(
    name: String = "Ari",
    bio: String = "A bio for the signed-in profile.",
    privateProfile: Boolean = true,
) = JSONObject().put("data", JSONObject()
    .put("id", "account-1")
    .put("name", name)
    .put("username", "ari")
    .put("bio", bio)
    .put("avatarUrl", JSONObject.NULL)
    .put("bannerUrl", JSONObject.NULL)
    .put("isPrivate", privateProfile)
    .put("verified", false)
    .put("isCreator", false)
    .put("followers", 12)
    .put("following", 4)
    .put("posts", 2)
    .put("email", "must-not-be-mapped@example.test")
    .put("roles", listOf("admin"))
)
