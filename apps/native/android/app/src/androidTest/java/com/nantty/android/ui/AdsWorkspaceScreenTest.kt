package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.AdsWorkspaceRepository
import com.nantty.android.data.AdsWorkspaceMutationTransport
import com.nantty.android.data.AdsWorkspaceTransport
import com.nantty.android.data.AdsBalanceRepository
import com.nantty.android.data.AdsBalanceTransport
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import java.util.concurrent.Executor
import org.json.JSONObject

@RunWith(AndroidJUnit4::class)
class AdsWorkspaceScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun campaignRowOpensServerBackedDetailsAndDailyReport() {
        val requestedPaths = mutableListOf<String>()
        val repository = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::adsSession,
            transport = AdsWorkspaceTransport { path, _ ->
                requestedPaths += path
                when {
                    path.startsWith("/api/v1/ads/boosts?") -> JSONObject("""{"data":[${boostJson()}],"nextCursor":null}""")
                    path.endsWith("/report") -> reportJson()
                    path == "/api/v1/ads/boosts/balance" -> balanceJson()
                    else -> JSONObject(boostJson())
                }
            },
        )
        compose.setContent {
            MaterialTheme {
                AdsWorkspaceScreen(repository, Executor { it.run() })
            }
        }

        compose.onNode(hasContentDescription("Boosted product, Active", substring = true)).assertIsDisplayed().performClick()
        compose.onNodeWithText("Ad results").assertIsDisplayed()
        compose.onNodeWithText("Daily results").assertIsDisplayed()
        compose.onNodeWithText("Product views").assertIsDisplayed()
        compose.onNodeWithText("23").assertIsDisplayed()
        compose.runOnIdle {
            assertTrue(requestedPaths.any { it == "/api/v1/ads/boosts/$BOOST_ID" })
            assertTrue(requestedPaths.any { it == "/api/v1/ads/boosts/$BOOST_ID/report" })
        }
    }

    @Test
    fun pauseAndResumeActionsUseServerFlagsAndRefreshCanonicalBoost() {
        val requestedMutations = mutableListOf<String>()
        var status = "active"
        val repository = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::adsSession,
            transport = AdsWorkspaceTransport { path, _ ->
                when {
                    path.startsWith("/api/v1/ads/boosts?") -> JSONObject("""{"data":[${boostJson(status)}],"nextCursor":null}""")
                    path.endsWith("/report") -> reportJson()
                    path == "/api/v1/ads/boosts/balance" -> balanceJson()
                    else -> JSONObject(boostJson(status))
                }
            },
            mutationTransport = AdsWorkspaceMutationTransport { path, _, key, _ ->
                assertTrue(key.length >= 8)
                requestedMutations += path
                status = if (path.endsWith("/pause")) "paused" else "active"
                JSONObject(boostJson(status))
            },
        )
        compose.setContent {
            MaterialTheme { AdsWorkspaceScreen(repository, Executor { it.run() }) }
        }

        compose.onNode(hasContentDescription("Boosted product, Active", substring = true)).performClick()
        compose.onNodeWithText("Pause").assertIsDisplayed().performClick()
        compose.onNodeWithText("Resume").assertIsDisplayed()
        compose.onNodeWithText("Paused").assertIsDisplayed()
        compose.onNodeWithText("Resume").performClick()
        compose.onNodeWithText("Pause").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(
                listOf("/api/v1/ads/boosts/$BOOST_ID/pause", "/api/v1/ads/boosts/$BOOST_ID/resume"),
                requestedMutations,
            )
        }
    }

    @Test
    fun balancePanelOpensManageScreenAndLoadsLedgerHistory() {
        val balanceRequests = mutableListOf<String>()
        val fullBalance = AdsBalanceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::adsSession,
            transport = AdsBalanceTransport { method, path, _, _, _ ->
                balanceRequests += "$method $path"
                when (path) {
                    AdsBalanceRepository.BALANCE_PATH -> fullBalanceJson()
                    AdsBalanceRepository.TRANSACTIONS_PATH -> JSONObject("""{"data":{"data":[],"nextCursor":null}}""")
                    else -> error("Unexpected balance route $path")
                }
            },
        )
        val workspace = AdsWorkspaceRepository(
            baseUrl = "https://api.nantty.com",
            sessionProvider = ::adsSession,
            transport = AdsWorkspaceTransport { path, _ ->
                when {
                    path.startsWith("/api/v1/ads/boosts?") -> JSONObject("""{"data":[],"nextCursor":null}""")
                    path == "/api/v1/ads/boosts/balance" -> balanceJson()
                    else -> error("Unexpected workspace route $path")
                }
            },
            balanceRepository = fullBalance,
        )
        compose.setContent { MaterialTheme { AdsWorkspaceScreen(workspace, Executor { it.run() }) } }

        compose.onNodeWithText("Manage balance").assertIsDisplayed().performClick()
        compose.onNodeWithText("Top up ad balance").assertIsDisplayed()
        compose.onNodeWithText("Withdraw ad balance").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(
                listOf("GET ${AdsBalanceRepository.BALANCE_PATH}", "GET ${AdsBalanceRepository.TRANSACTIONS_PATH}"),
                balanceRequests,
            )
        }
    }

    private fun adsSession() = AccountSession(
        accessToken = "ads-access",
        refreshToken = "ads-refresh",
        user = AccountUser("33333333-3333-4333-8333-333333333333", "Ari", "ari", null, null, emptyList()),
    )

    private fun boostJson(status: String = "active"): String {
        val pause = status == "active"
        val resume = status == "paused"
        return """{"id":"$BOOST_ID","postId":"","destinationType":"product","targetId":"44444444-4444-4444-8444-444444444444","status":"$status","goal":"product_visits","budgetType":"total","dailyBudget":{"amountMinor":50000,"currency":"NGN"},"durationDays":10,"totalBudget":{"amountMinor":500000,"currency":"NGN"},"spent":{"amountMinor":125000,"currency":"NGN"},"startsAt":"2026-11-01T00:00:00Z","endsAt":"2026-11-11T00:00:00Z","scheduledStartAt":null,"createdAt":"2026-10-31T12:00:00Z","audience":{"mode":"automatic"},"results":{"impressions":500,"reach":250,"clicks":23,"profileVisits":0,"storeVisits":0,"productVisits":23,"messages":0},"keyResult":{"label":"Product views","value":23},"costPerResult":{"amountMinor":5434,"currency":"NGN"},"rejectionReason":null,"paymentMethod":"ad_balance","actions":{"pause":$pause,"resume":$resume,"stop":true,"changeBudget":true,"resubmit":false}}"""
    }

    private fun reportJson() = JSONObject(
        """{"currency":"NGN","resultLabel":"Product views","totals":{"impressions":500,"reach":250,"clicks":23,"results":23,"spend":{"amountMinor":125000,"currency":"NGN"},"costPerResult":{"amountMinor":5434,"currency":"NGN"}},"series":[{"date":"2026-11-01","impressions":500,"reach":250,"clicks":23,"results":23,"spend":{"amountMinor":125000,"currency":"NGN"}}]}""",
    )

    private fun balanceJson() = JSONObject(
        """{"data":{"balance":{"amountMinor":300000,"currency":"NGN"},"credit":{"amountMinor":150000,"currency":"NGN"},"committed":{"amountMinor":50000,"currency":"NGN"},"spendable":{"amountMinor":400000,"currency":"NGN"},"withdrawable":{"amountMinor":100000,"currency":"NGN"},"pendingSettlement":{"amountMinor":20000,"currency":"NGN"}}}""",
    )

    private fun fullBalanceJson() = JSONObject(
        """{"data":{"accountId":"account-1","balance":{"amountMinor":300000,"currency":"NGN"},"credit":{"amountMinor":150000,"currency":"NGN"},"committed":{"amountMinor":50000,"currency":"NGN"},"spendable":{"amountMinor":400000,"currency":"NGN"},"withdrawable":{"amountMinor":100000,"currency":"NGN"},"pendingSettlement":{"amountMinor":20000,"currency":"NGN"},"creditLots":[],"cashback":{"enabled":false,"percent":0},"topUp":{"available":true,"reasonCode":null,"reason":null,"minimum":{"amountMinor":1000,"currency":"NGN"},"maximum":{"amountMinor":500000,"currency":"NGN"},"suggested":[{"amountMinor":1000,"currency":"NGN"}]},"withdrawal":{"available":true,"reasonCode":null,"reason":null,"minimum":{"amountMinor":5000,"currency":"NGN"}}}}""",
    )

    private companion object { const val BOOST_ID = "11111111-1111-4111-8111-111111111111" }
}
