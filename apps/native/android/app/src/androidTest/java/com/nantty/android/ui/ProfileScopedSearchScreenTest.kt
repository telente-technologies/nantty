package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SearchTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class ProfileScopedSearchScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun profileContextShowsReactNativeResultTypesAndUsesProfileScopeForRequests() {
        val profileId = "e48546e1-c4e7-4cc1-bdaa-f11a9061bd7d"
        val transport = ProfileSearchTransport()
        var changedScope: Pair<String, String>? = null
        compose.setContent {
            MaterialTheme {
                SearchScreen(
                    repository = SearchRepository("https://api.nantty.com", { null }, transport),
                    executor = Executor { it.run() },
                    initialScope = "profile:$profileId",
                    initialScopeLabel = "@ari",
                    onScopeChanged = { scope, label -> changedScope = scope to label },
                )
            }
        }

        compose.onNodeWithText("In: @ari").assertIsDisplayed()
        compose.onNodeWithText("All").assertIsDisplayed()
        compose.onNodeWithText("Posts").performClick()
        compose.onNode(hasSetTextAction()).performTextInput("outfit")
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()

        compose.onNodeWithText("No results found").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(
                "/api/v1/search?q=outfit&scope=profile%3A$profileId&type=posts&limit=10",
                transport.paths.single(),
            )
            assertEquals(null, transport.tokens.single())
        }

        compose.onNodeWithText("In: @ari").performClick()
        compose.runOnIdle { assertEquals("global" to "Everywhere", changedScope) }
    }

    private class ProfileSearchTransport : SearchTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()

        override fun request(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            check(path.startsWith("/api/v1/search?")) { "Unexpected request: $path" }
            return JSONObject("""{"data":[],"nextCursor":null,"scope":"profile"}""")
        }
    }
}
