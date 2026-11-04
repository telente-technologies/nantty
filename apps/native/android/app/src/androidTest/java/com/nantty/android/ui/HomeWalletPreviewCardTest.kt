package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.runtime.mutableStateOf
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.WalletRepository
import com.nantty.android.data.WalletTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class HomeWalletPreviewCardTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun hidesForSignedOutViewerWithoutRequestingWallet() {
        val transport = PreviewTransport()
        compose.setContent {
            MaterialTheme {
                HomeWalletPreviewCard(
                    signedIn = false,
                    accountKey = "account-a",
                    repository = repository(transport),
                    executor = Executor { it.run() },
                    onPressWallet = {},
                )
            }
        }

        compose.onNodeWithTag("home-wallet-preview").assertDoesNotExist()
        compose.runOnIdle { assertEquals(emptyList<String>(), transport.paths) }
    }

    @Test
    fun showsLoadingThenOnlyRepositorySummaryAndOpensWalletOnRequest() {
        val transport = PreviewTransport()
        val executor = HoldingExecutor()
        var opened = false
        compose.setContent {
            MaterialTheme {
                HomeWalletPreviewCard(
                    signedIn = true,
                    accountKey = "account-a",
                    repository = repository(transport),
                    executor = executor,
                    onPressWallet = { opened = true },
                )
            }
        }

        compose.onNodeWithText("Loading wallet…").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(emptyList<String>(), transport.paths)
            executor.runAll()
        }
        compose.onNodeWithText("Available").assertIsDisplayed()
        compose.onNodeWithText("In escrow").assertIsDisplayed()
        compose.onNodeWithText("Coins").assertIsDisplayed()
        compose.onNodeWithText("8 coins").assertIsDisplayed()
        compose.onNodeWithText("View wallet").performClick()
        compose.runOnIdle {
            assertEquals(listOf("/api/v1/wallets/me"), transport.paths)
            assertEquals(true, opened)
        }
    }

    @Test
    fun displaysErrorAndRetriesWalletSummaryRequest() {
        val transport = PreviewTransport(failFirstRequest = true)
        compose.setContent {
            MaterialTheme {
                HomeWalletPreviewCard(
                    signedIn = true,
                    accountKey = "account-a",
                    repository = repository(transport),
                    executor = Executor { it.run() },
                    onPressWallet = {},
                )
            }
        }

        compose.onNodeWithText("Wallet summary could not be loaded.").assertIsDisplayed()
        compose.onNodeWithText("Retry").performClick()
        compose.onNodeWithText("Available").assertIsDisplayed()
        compose.onNodeWithText("8 coins").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, transport.paths.size) }
    }

    @Test
    fun accountKeyChangeClearsOldSummaryAndReloadsWithCurrentSession() {
        val transport = PreviewTransport()
        val executor = HoldingExecutor()
        val accountKey = mutableStateOf("account-a")
        val repository = repository(transport)
        compose.setContent {
            MaterialTheme {
                HomeWalletPreviewCard(
                    signedIn = true,
                    accountKey = accountKey.value,
                    repository = repository,
                    executor = executor,
                    onPressWallet = {},
                )
            }
        }

        compose.runOnIdle(executor::runAll)
        compose.onNodeWithText("100.00", substring = true).assertIsDisplayed()

        compose.runOnIdle {
            transport.accessToken = "wallet-access-b"
            accountKey.value = "account-b"
        }
        compose.onNodeWithText("Loading wallet…").assertIsDisplayed()
        compose.onNodeWithText("100.00", substring = true).assertDoesNotExist()

        compose.runOnIdle(executor::runAll)
        compose.onNodeWithText("9,900.00", substring = true).assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(listOf("wallet-access", "wallet-access-b"), transport.tokens)
        }
    }

    private fun repository(transport: PreviewTransport) = WalletRepository(
        baseUrl = "https://api.nantty.com",
        sessionProvider = {
            val userId = if (transport.accessToken == "wallet-access") "user-1" else "user-2"
            AccountSession(transport.accessToken, "refresh", AccountUser(userId, "Ari", "ari", null, null, emptyList()))
        },
        transport = transport,
    )

    private class PreviewTransport(private val failFirstRequest: Boolean = false) : WalletTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()
        var accessToken = "wallet-access"

        override fun get(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            if (failFirstRequest && paths.size == 1) error("Offline")
            check(path == "/api/v1/wallets/me")
            check(accessToken == this.accessToken)
            val available = if (accessToken == "wallet-access") 10_000 else 990_000
            return JSONObject(
                """{"available":{"amountMinor":$available,"currency":"NGN"},"pending":{"amountMinor":500,"currency":"NGN"},"coins":{"spendable":8,"earned":11}}""",
            )
        }
    }

    private class HoldingExecutor : Executor {
        private val pending = mutableListOf<Runnable>()
        override fun execute(command: Runnable) { pending += command }
        fun runAll() { pending.toList().also { pending.clear() }.forEach(Runnable::run) }
    }
}
