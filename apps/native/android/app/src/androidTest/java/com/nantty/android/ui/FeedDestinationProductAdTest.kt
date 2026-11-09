package com.nantty.android.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.MartRepository
import com.nantty.android.data.ProductAdsRepository
import com.nantty.android.data.ProductAdsTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

class FeedDestinationProductAdTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun insertsAtMostOneProductAdAfterEightOrganicPostsAndUsesProductRoute() {
        val transport = FeedProductAdsRecordingTransport()
        val ads = ProductAdsRepository(accessTokenProvider = { "viewer-token" }, transport = transport)
        var openedProductId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedDestinationContent(
                    destination = Destination.Feed,
                    result = FeedResult.Success((1..12).map(::feedPost), nextCursor = "next-page"),
                    loading = false,
                    selectedFeed = FeedType.FOR_YOU,
                    canViewFollowing = true,
                    onSelectFeed = {}, onSignInRequired = {}, onFollowingSignInRequired = {},
                    onRefresh = {}, onCreatePost = {}, modifier = Modifier.fillMaxSize(),
                    onOpenPost = {}, onOpenProfile = {}, onLike = {}, onRepost = {}, onSave = {}, onShare = {},
                    interactionMessage = null, onReauthenticate = {}, savingPostId = null,
                    loadingMore = false, loadMoreError = null, onLoadMore = {}, onOpenSavedPosts = {},
                    currentAccountId = "viewer-1", onOpenProduct = { openedProductId = it }, productAdsRepository = ads,
                )
            }
        }

        composeRule.waitUntil(5_000) { transport.calls.isNotEmpty() }
        composeRule.runOnIdle {
            val request = transport.calls.first()
            assertEquals("feedProduct", request.getJSONObject("slot").getString("kind"))
            assertEquals(8, request.getJSONObject("slot").getInt("slotIndex"))
        }
        composeRule.onNodeWithTag("feed-post-list").performScrollToNode(hasTestTag("feed-product-ad"))
        composeRule.onNodeWithTag("feed-product-ad").assertIsDisplayed()
        composeRule.onNodeWithTag("feed-product-ad-cta").performClick()
        composeRule.runOnIdle { assertEquals("product-1", openedProductId) }
        composeRule.waitUntil(5_000) { transport.calls.size >= 2 }
        composeRule.runOnIdle {
            assertTrue(transport.calls.drop(1).all { it.getJSONArray("events").getJSONObject(0).getString("placement") == "feed" })
        }
    }

    @Test
    fun forYouFeedShowsOrganicProductRecommendationsAndOpensExistingProductRoute() {
        val requestedPaths = java.util.Collections.synchronizedList(mutableListOf<String>())
        val mart = MartRepository(
            baseUrl = "https://api.nantty.com",
            accessTokenProvider = { "viewer-token" },
            openConnection = { url ->
                requestedPaths += url.path
                FeedRecommendationConnection(url, when (url.path) {
                    "/api/v1/mart/recommendations/for-you" -> """{"source":"personalized","products":[{"id":"prd-recommended","name":"Handwoven bag","price":{"amountMinor":125000,"currency":"NGN"},"imageUrl":null,"stock":5}]}"""
                    "/api/v1/users/me/consents" -> """{"data":[{"consentType":"analytics","status":"granted"},{"consentType":"personalization","status":"granted"}]}"""
                    else -> "{}"
                })
            },
        )
        var openedProductId: String? = null
        composeRule.setContent {
            MaterialTheme {
                FeedDestinationContent(
                    destination = Destination.Feed,
                    result = FeedResult.Success((1..20).map(::feedPost), nextCursor = "next-page"),
                    loading = false,
                    selectedFeed = FeedType.FOR_YOU,
                    canViewFollowing = true,
                    onSelectFeed = {}, onSignInRequired = {}, onFollowingSignInRequired = {},
                    onRefresh = {}, onCreatePost = {}, modifier = Modifier.fillMaxSize(),
                    onOpenPost = {}, onOpenProfile = {}, onLike = {}, onRepost = {}, onSave = {}, onShare = {},
                    interactionMessage = null, onReauthenticate = {}, savingPostId = null,
                    loadingMore = false, loadMoreError = null, onLoadMore = {}, onOpenSavedPosts = {},
                    currentAccountId = "viewer-1", onOpenProduct = { openedProductId = it }, martRepository = mart,
                )
            }
        }

        composeRule.waitUntil(5_000) { requestedPaths.contains("/api/v1/mart/recommendations/for-you") }
        composeRule.onNodeWithTag("feed-post-list").performScrollToNode(hasTestTag("mart-recommendations-section"))
        composeRule.onNodeWithTag("mart-recommendations-section").assertIsDisplayed()
        composeRule.onNodeWithText("Handwoven bag").performClick()
        composeRule.runOnIdle { assertEquals("prd-recommended", openedProductId) }
        composeRule.waitUntil(5_000) { requestedPaths.contains("/api/v1/analytics/product-interactions") }
    }

    @Test
    fun followingFeedDoesNotLoadProductRecommendations() {
        val requestedPaths = java.util.Collections.synchronizedList(mutableListOf<String>())
        val mart = MartRepository(
            baseUrl = "https://api.nantty.com",
            openConnection = { url ->
                requestedPaths += url.path
                FeedRecommendationConnection(url, """{"source":"popular","products":[]}""")
            },
        )
        composeRule.setContent {
            MaterialTheme {
                FeedDestinationContent(
                    destination = Destination.Feed,
                    result = FeedResult.Success((1..20).map(::feedPost), nextCursor = null),
                    loading = false,
                    selectedFeed = FeedType.FOLLOWING,
                    canViewFollowing = true,
                    onSelectFeed = {}, onSignInRequired = {}, onFollowingSignInRequired = {},
                    onRefresh = {}, onCreatePost = {}, modifier = Modifier.fillMaxSize(),
                    onOpenPost = {}, onOpenProfile = {}, onLike = {}, onRepost = {}, onSave = {}, onShare = {},
                    interactionMessage = null, onReauthenticate = {}, savingPostId = null,
                    loadingMore = false, loadMoreError = null, onLoadMore = {}, onOpenSavedPosts = {},
                    currentAccountId = "viewer-1", onOpenProduct = {}, martRepository = mart,
                )
            }
        }

        composeRule.waitForIdle()
        assertTrue(requestedPaths.none { it == "/api/v1/mart/recommendations/for-you" })
    }

    private fun feedPost(index: Int) = FeedPost(
        id = "post-$index", authorName = "Maker $index", username = "maker$index", avatarUrl = null,
        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null, postedAsAvatarUrl = null,
        kind = "post", text = "Feed post $index", media = emptyList(), likes = 0, comments = 0,
        reposts = 0, shares = 0, createdAt = "2026-11-07T10:00:00Z", authorId = "author-$index",
    )
}

private class FeedProductAdsRecordingTransport : ProductAdsTransport {
    val calls = java.util.Collections.synchronizedList(mutableListOf<JSONObject>())

    override fun post(path: String, accessToken: String, body: JSONObject, idempotencyKey: String?): JSONObject {
        calls += body
        return if (path == ProductAdsRepository.DECIDE_PATH) JSONObject(
            """{"ad":{"adId":"feed-ad-1","impressionToken":"signed-token-123","expiresAt":"2099-11-07T13:00:00Z","placement":"feed","slotKind":"feedProduct","format":"product","label":"Ad","creative":{"format":"product","media":[{"kind":"image","url":"https://cdn.nantty.test/tote.jpg"}],"headline":"Canvas tote","primaryText":"Woven by hand","callToAction":"shop_now","destination":{"type":"product","targetId":"product-1"},"identity":{"name":"Ada Atelier","handle":"adaatelier","verifiedBusiness":true}}}}""",
        ) else JSONObject()
    }
}

private class FeedRecommendationConnection(url: URL, private val body: String) : HttpURLConnection(url) {
    private val requestBody = ByteArrayOutputStream()
    override fun getResponseCode(): Int = 200
    override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
    override fun getErrorStream() = ByteArrayInputStream(body.toByteArray())
    override fun getOutputStream() = requestBody
    override fun usingProxy(): Boolean = false
    override fun connect() = Unit
    override fun disconnect() = Unit
}
