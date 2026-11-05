package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.MartRepository
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SearchTransport
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayInputStream
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class SearchCategoryBackNavigationTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun searchCategoryBackRestoresQueryScopeAndTypeAndReturnsToTheSameResults() {
        val searchPaths = mutableListOf<String>()
        val searchRepository = SearchRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = { null },
            transport = SearchTransport { path, _ ->
                searchPaths += path
                JSONObject("""{"data":[{"type":"category","id":"0192a4f0-0000-7000-8000-000000000001","name":"Clothing"}],"nextCursor":null}""")
            },
        )
        val martRequests = mutableListOf<String>()
        val martRepository = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url ->
                martRequests += url.toString()
                CategoryNavigationConnection(url, responseFor(url))
            },
        )

        compose.setContent {
            MaterialTheme {
                val stateHolder = rememberSaveableStateHolder()
                var showingMart by remember { mutableStateOf(false) }
                var pendingCategoryId by remember { mutableStateOf<String?>(null) }
                var pendingCategoryName by remember { mutableStateOf<String?>(null) }
                if (showingMart) {
                    stateHolder.SaveableStateProvider("Mart") {
                        MartScreen(
                            repository = martRepository,
                            initialCategoryId = pendingCategoryId,
                            initialCategoryName = pendingCategoryName,
                            onInitialCategoryHandled = {
                                pendingCategoryId = null
                                pendingCategoryName = null
                            },
                            onBackFromInitialCategory = { showingMart = false },
                        )
                    }
                } else {
                    stateHolder.SaveableStateProvider("Discover") {
                        SearchScreen(
                            repository = searchRepository,
                            executor = Executor { it.run() },
                            onOpenCategory = { id, name ->
                                pendingCategoryId = id
                                pendingCategoryName = name
                                showingMart = true
                            },
                        )
                    }
                }
            }
        }

        compose.onNode(hasSetTextAction()).performTextInput("clothing")
        compose.mainClock.advanceTimeBy(400)
        compose.waitForIdle()
        compose.onNodeWithContentDescription("Search Mart category Clothing").performClick()
        compose.waitUntil(5_000) { martRequests.any { it.contains("categoryId=0192a4f0-0000-7000-8000-000000000001") } }
        compose.onNodeWithText("Back to Discover").assertIsDisplayed().performClick()

        compose.onNode(hasSetTextAction()).assertTextEquals("clothing")
        compose.onNodeWithText("Everywhere").assertIsSelected()
        compose.onNodeWithText("Top").assertIsSelected()
        compose.waitUntil(5_000) { searchPaths.count { it.contains("q=clothing") } >= 2 }
        compose.onNodeWithContentDescription("Search Mart category Clothing").assertIsDisplayed()
        assertTrue(searchPaths.all { it.contains("scope=global") && it.contains("type=top") })
    }

    private fun responseFor(url: URL): String = when (url.path) {
        "/api/v1/mart/home" -> """{"categories":[]}"""
        "/api/v1/mart/highlights" -> """{"data":[],"nextCursor":null}"""
        "/api/v1/products" -> """{"data":[{"id":"product-1","name":"Silk wrap dress","price":{"amountMinor":125000,"currency":"NGN"},"stock":3}],"nextCursor":null}"""
        else -> error("Unexpected Mart URL: $url")
    }
}

private class CategoryNavigationConnection(url: URL, private val body: String) : HttpURLConnection(url) {
    override fun getResponseCode(): Int = HTTP_OK
    override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
    override fun usingProxy(): Boolean = false
    override fun connect() = Unit
    override fun disconnect() = Unit
}
