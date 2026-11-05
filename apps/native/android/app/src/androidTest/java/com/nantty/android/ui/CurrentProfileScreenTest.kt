package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.CurrentProfileTransport
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfileTransport
import com.nantty.android.data.ProfileImageRepository
import com.nantty.android.data.ProfileImageTransport
import com.nantty.android.data.ProfileImageUploadIntent
import org.json.JSONArray
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

    @Test
    fun ownProfileSearchUsesTheLoadedAccountIdAndUsername() {
        var searchContext: Pair<String, String>? = null
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
                    onSearchProfile = { accountId, username -> searchContext = accountId to username },
                )
            }
        }

        compose.onNodeWithContentDescription("Search @ari's posts").assertIsDisplayed().performClick()
        compose.runOnIdle { assertEquals("account-1" to "ari", searchContext) }
    }

    @Test
    fun creatorOwnProfileLoadsPublicAndSubscriberPostsThroughTheProfileEndpoint() {
        val requestedPaths = mutableListOf<String>()
        val postsRepository = PublicProfileRepository(
            "https://api.nantty.com",
            object : PublicProfileTransport {
                override fun get(path: String, accessToken: String?): JSONObject {
                    requestedPaths += path
                    return if (path.endsWith("visibility=subscribers")) postPage("subscriber-post", "Subscriber post")
                    else postPage("public-post", "Public post")
                }
                override fun post(path: String, accessToken: String) = error("No write expected")
                override fun delete(path: String, accessToken: String) = error("No delete expected")
            },
            ::signedInSession,
        )
        val profileRepository = CurrentProfileRepository(
            "https://api.nantty.com",
            CurrentProfileTransportFake(isCreator = true),
            ::signedInSession,
        )
        compose.setContent {
            MaterialTheme {
                CurrentProfileScreen(
                    repository = profileRepository,
                    executor = Executor { it.run() },
                    publicProfileRepository = postsRepository,
                )
            }
        }

        compose.onNodeWithText("Public post").assertIsDisplayed()
        compose.onNodeWithText("Subscribers").assertIsDisplayed().performClick()
        compose.onNodeWithText("Subscriber post").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(
                listOf(
                    "/api/v1/users/account-1/posts?visibility=public",
                    "/api/v1/users/account-1/posts?visibility=subscribers",
                ),
                requestedPaths,
            )
        }
    }

    @Test
    fun profileEditorExposesAvatarAndBannerPickersWhenUploadContractIsAvailable() {
        val imageRepository = ProfileImageRepository(
            "https://api.nantty.com",
            ::signedInSession,
            object : ProfileImageTransport {
                override fun createIntent(path: String, accessToken: String, body: JSONObject) = error("No upload expected")
                override fun upload(intent: ProfileImageUploadIntent, bytes: ByteArray) = error("No upload expected")
            },
        )
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
                    profileImagesRepository = imageRepository,
                )
            }
        }

        compose.onNodeWithText("Edit profile").performClick()
        compose.onNodeWithContentDescription("Change profile photo").assertIsDisplayed()
        compose.onNodeWithContentDescription("Change banner image").assertIsDisplayed()
    }

    @Test
    fun pullingOwnProfileToRefreshReloadsProfileData() {
        val transport = CurrentProfileTransportFake()
        val repository = CurrentProfileRepository("https://api.nantty.com", transport, ::signedInSession)
        compose.setContent {
            MaterialTheme {
                CurrentProfileScreen(repository, Executor { it.run() })
            }
        }
        compose.onNodeWithText("About").assertIsDisplayed().performTouchInput { swipeDown() }
        compose.runOnIdle { assertEquals(2, transport.methods.count { it == "GET" }) }
    }
}

private class CurrentProfileTransportFake(private val isCreator: Boolean = false) : CurrentProfileTransport {
    val methods = mutableListOf<String>()
    var patchCalls = 0
    var patchFields: JSONObject? = null

    override fun getMe(accessToken: String): JSONObject {
        methods += "GET"
        return payload(isCreator = isCreator)
    }

    override fun patchMe(accessToken: String, fields: JSONObject): JSONObject {
        methods += "PATCH"
        patchCalls += 1
        patchFields = fields
        return payload(name = fields.getString("name"), bio = fields.getString("bio"), privateProfile = fields.getBoolean("isPrivate"), isCreator = isCreator)
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
    isCreator: Boolean = false,
) = JSONObject().put("data", JSONObject()
    .put("id", "account-1")
    .put("name", name)
    .put("username", "ari")
    .put("bio", bio)
    .put("avatarUrl", JSONObject.NULL)
    .put("bannerUrl", JSONObject.NULL)
    .put("isPrivate", privateProfile)
    .put("verified", false)
    .put("isCreator", isCreator)
    .put("followers", 12)
    .put("following", 4)
    .put("posts", 2)
    .put("email", "must-not-be-mapped@example.test")
    .put("roles", listOf("admin"))
)

private fun postPage(id: String, text: String) = JSONObject()
    .put("data", JSONArray().put(JSONObject()
        .put("id", id)
        .put("kind", "post")
        .put("author", JSONObject().put("id", "account-1").put("name", "Ari").put("username", "ari"))
        .put("text", text)
        .put("media", JSONArray())
        .put("likes", 0)
        .put("comments", 0)
        .put("reposts", 0)
        .put("shares", 0)
        .put("createdAt", "2026-11-05T10:00:00Z")))
