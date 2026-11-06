package com.nantty.android.ui.clips

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.ClipsRepository
import com.nantty.android.data.ClipsTransport
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PostDetailTransport
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfileTransport
import com.nantty.android.ui.theme.NanttyTheme
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class ClipsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun guestCanBrowseForYouAndFollowingRequestsAuthenticationWithoutFetchingPrivateFeed() {
        val requestedPaths = mutableListOf<String>()
        var signInRequested = false
        val clips = ClipsRepository(
            baseUrl = "https://api.nantty.com",
            transport = ClipsTransport { path, _ -> requestedPaths += path; clipPage() },
        )
        compose.setContent {
            NanttyTheme {
                ClipsScreen(
                    repository = clips,
                    postRepository = PostDetailRepository(transport = PostDetailTransport { _, _, _, _ -> JSONObject() }, sessionProvider = { null }),
                    profileRepository = PublicProfileRepository(transport = object : PublicProfileTransport {
                        override fun get(path: String, accessToken: String?) = JSONObject()
                        override fun post(path: String, accessToken: String) = JSONObject()
                        override fun delete(path: String, accessToken: String) = Unit
                    }),
                    executor = Executor { it.run() },
                    isGuest = true,
                    onSignInRequiredWithAction = { signInRequested = true },
                    onReauthenticate = {},
                    onOpenSearch = {},
                    onOpenPost = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithText("A short community clip").assertIsDisplayed()
        compose.onNodeWithTag("clips-tab-following").performClick()
        compose.runOnIdle {
            assertTrue(signInRequested)
            assertEquals(listOf("/api/v1/clips?tab=forYou&limit=10"), requestedPaths)
        }
    }

    @Test
    fun clipsScreenExposesSearchAndVerticalPagerForLoadedItems() {
        var searchOpened = false
        val clips = ClipsRepository(
            baseUrl = "https://api.nantty.com",
            transport = ClipsTransport { _, _ -> clipPage() },
        )
        compose.setContent {
            NanttyTheme {
                ClipsScreen(
                    repository = clips,
                    postRepository = PostDetailRepository(transport = PostDetailTransport { _, _, _, _ -> JSONObject() }, sessionProvider = { null }),
                    profileRepository = PublicProfileRepository(transport = object : PublicProfileTransport {
                        override fun get(path: String, accessToken: String?) = JSONObject()
                        override fun post(path: String, accessToken: String) = JSONObject()
                        override fun delete(path: String, accessToken: String) = Unit
                    }),
                    executor = Executor { it.run() },
                    isGuest = true,
                    onSignInRequiredWithAction = {},
                    onReauthenticate = {},
                    onOpenSearch = { searchOpened = true },
                    onOpenPost = {},
                    onOpenProfile = {},
                )
            }
        }

        compose.onNodeWithTag("clips-pager").assertIsDisplayed()
        compose.onNodeWithContentDescription("Search clips").performClick()
        compose.runOnIdle { assertTrue(searchOpened) }
    }

    @Test
    fun notificationTargetLoadsPagesAndOpensTheRequestedClip() {
        var handled = false
        var requestedNextPage = false
        val clips = ClipsRepository(
            baseUrl = "https://api.nantty.com",
            transport = ClipsTransport { path, _ ->
                if (path.contains("cursor=next")) {
                    requestedNextPage = true
                    JSONObject("""{"data":{"data":[{"id":"target-clip","kind":"clip","text":"Notification target clip","author":{"id":"creator-2","name":"Mina","username":"mina"},"durationSeconds":12,"viewerHasAccess":true,"isFollowingAuthor":false,"likes":3,"comments":1,"media":[]}],"nextCursor":null}}""")
                } else {
                    JSONObject("""{"data":{"data":[{"id":"first-clip","kind":"clip","text":"First clip","author":{"id":"creator-1","name":"Ada","username":"ada"},"durationSeconds":12,"viewerHasAccess":true,"isFollowingAuthor":false,"likes":3,"comments":1,"media":[]}],"nextCursor":"next"}}""")
                }
            },
        )
        compose.setContent {
            NanttyTheme {
                ClipsScreen(
                    repository = clips,
                    postRepository = PostDetailRepository(transport = PostDetailTransport { _, _, _, _ -> JSONObject() }, sessionProvider = { null }),
                    profileRepository = PublicProfileRepository(transport = object : PublicProfileTransport {
                        override fun get(path: String, accessToken: String?) = JSONObject()
                        override fun post(path: String, accessToken: String) = JSONObject()
                        override fun delete(path: String, accessToken: String) = Unit
                    }),
                    executor = Executor { it.run() },
                    isGuest = true,
                    onSignInRequiredWithAction = {},
                    onReauthenticate = {},
                    onOpenSearch = {},
                    onOpenPost = {},
                    onOpenProfile = {},
                    initialClipId = "target-clip",
                    onInitialClipHandled = { handled = true },
                )
            }
        }

        compose.waitUntil(timeoutMillis = 5_000) { handled && requestedNextPage }
        compose.onNodeWithText("Notification target clip").assertIsDisplayed()
    }

    private fun clipPage() = JSONObject(
        """{"data":{"data":[{"id":"clip-1","kind":"clip","text":"A short community clip","author":{"id":"creator-1","name":"Ada","username":"ada"},"durationSeconds":12,"viewerHasAccess":true,"isFollowingAuthor":false,"likes":3,"comments":1,"media":[]}],"nextCursor":null}}""",
    )
}
