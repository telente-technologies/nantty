package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
class WalletScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun displaysWalletLinesCoinsAndVerificationGuidance() {
        val transport = FakeTransport()
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Available to withdraw").assertIsDisplayed()
        compose.onNodeWithText("Held until delivery").assertIsDisplayed()
        compose.onNodeWithText("Verify to withdraw your earnings").assertIsDisplayed()
        compose.onNodeWithText("Spendable").assertIsDisplayed()
        compose.onNodeWithText("Earned").assertIsDisplayed()
        compose.onNodeWithText("Withdraw").assertDoesNotExist()
        compose.onNodeWithText("Buy coins").assertDoesNotExist()
        compose.onNodeWithText("Recent transactions").assertIsDisplayed()
        compose.onNodeWithText("No transactions yet. Payments, refunds and payouts will appear here.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("No orders are currently held in escrow.").performScrollTo().assertIsDisplayed()
        compose.runOnIdle {
            assertEquals(listOf("/api/v1/wallets/me", "/api/v1/wallets/me/transactions?limit=20", "/api/v1/wallets/me/escrow-holds"), transport.paths)
            assertEquals(listOf("wallet-access", "wallet-access", "wallet-access"), transport.tokens)
        }
    }

    @Test
    fun displaysIndividualEscrowHoldsAndExpectedReleaseDate() {
        val transport = FakeTransport(withEscrowHolds = true)
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Handwoven bag").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("NAN-1042 · On the way · Expected release 8 Nov 2026").assertIsDisplayed()
        compose.onNodeWithText("125.00", substring = true).assertIsDisplayed()
        compose.runOnIdle { assertEquals(1, transport.escrowCalls) }
    }

    @Test
    fun retriesEscrowHoldsAfterRequestFailure() {
        val transport = FakeTransport(failFirstEscrowHolds = true, withEscrowHolds = true)
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Offline").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Try again").performScrollTo().performClick()
        compose.onNodeWithText("Handwoven bag").performScrollTo().assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, transport.escrowCalls) }
    }

    @Test
    fun exposesRetryAfterWalletRequestFailure() {
        val transport = FakeTransport(failFirstWallet = true)
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Offline").assertIsDisplayed()
        compose.onNodeWithText("Try again").performClick()
        compose.onNodeWithText("Available to withdraw").assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, transport.walletCalls) }
    }

    @Test
    fun displaysRecentTransactionsFromApi() {
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, FakeTransport(withTransactions = true)), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Order payout").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Completed").assertIsDisplayed()
        compose.onNode(hasText("125.00", substring = true)).assertIsDisplayed()
    }

    @Test
    fun loadsMoreTransactionsUsingApiCursor() {
        val transport = FakeTransport(withTransactions = true)
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Load more transactions").performScrollTo().performClick()
        compose.onNodeWithText("Refund").assertIsDisplayed()
        compose.runOnIdle {
            assertEquals("/api/v1/wallets/me/transactions?limit=20&cursor=cursor-2", transport.paths.last())
            assertEquals(2, transport.transactionCalls)
        }
    }

    @Test
    fun announcesLoadingStateWhileFetchingNextTransactionPage() {
        val executor = HoldingExecutor()
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, FakeTransport(withTransactions = true)), executor)
            }
        }
        compose.runOnIdle(executor::runAll)

        compose.onNodeWithText("Load more transactions").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Loading more wallet transactions").performScrollTo().assertIsDisplayed()
        compose.runOnIdle(executor::runAll)
        compose.onNodeWithText("Refund").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun retriesFailedTransactionPageWithoutLosingExistingRows() {
        val transport = FakeTransport(withTransactions = true, failCursorPage = true)
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Load more transactions").performScrollTo().performClick()
        compose.onNodeWithText("Couldn't load more. Try again").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Order payout").assertIsDisplayed()
        compose.onNodeWithText("Couldn't load more. Try again").performClick()
        compose.onNodeWithText("Refund").assertIsDisplayed()
        compose.runOnIdle { assertEquals(3, transport.transactionCalls) }
    }

    @Test
    fun transactionFailureCanBeRetried() {
        val transport = FakeTransport(failFirstTransactions = true)
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, transport), Executor { it.run() })
            }
        }

        compose.onNodeWithText("Offline").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Try again").performScrollTo().performClick()
        compose.onNodeWithText("Order payout").performScrollTo().assertIsDisplayed()
        compose.runOnIdle { assertEquals(2, transport.transactionCalls) }
    }

    @Test
    fun showsLoadingStatesUntilWalletAndHistoryRequestsComplete() {
        val executor = HoldingExecutor()
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, FakeTransport()), executor)
            }
        }

        compose.onNodeWithText("Loading wallet…").assertIsDisplayed()
        compose.runOnIdle(executor::runNext)
        compose.onNodeWithText("Loading transactions…").assertIsDisplayed()
        compose.runOnIdle(executor::runAll)
        compose.onNodeWithText("Recent transactions").assertIsDisplayed()
    }

    @Test
    fun refreshActionIsAccessible() {
        compose.setContent {
            MaterialTheme {
                WalletScreen(WalletRepository("https://api.nantty.com", ::signedInSession, FakeTransport()), Executor { it.run() })
            }
        }
        compose.onNodeWithContentDescription("Refresh wallet").assertIsDisplayed()
    }

    private class FakeTransport(
        private val failFirstWallet: Boolean = false,
        private val failFirstTransactions: Boolean = false,
        private val withTransactions: Boolean = false,
        private val failCursorPage: Boolean = false,
        private val withEscrowHolds: Boolean = false,
        private val failFirstEscrowHolds: Boolean = false,
    ) : WalletTransport {
        val paths = mutableListOf<String>()
        val tokens = mutableListOf<String?>()
        var walletCalls = 0
        var transactionCalls = 0
        var escrowCalls = 0
        override fun get(path: String, accessToken: String?): JSONObject {
            paths += path
            tokens += accessToken
            if (path == "/api/v1/wallets/me") {
                walletCalls += 1
                if (failFirstWallet && walletCalls == 1) error("Offline")
                return JSONObject("""{"available":{"amountMinor":10000,"currency":"NGN"},"pending":{"amountMinor":500,"currency":"NGN"},"lines":[{"key":"available","label":"Available to withdraw","description":"Ready","amount":{"amountMinor":10000,"currency":"NGN"}},{"key":"pending","label":"Pending (escrow)","description":"Held until delivery","amount":{"amountMinor":500,"currency":"NGN"}}],"coins":{"spendable":8,"earned":2},"verification":{"withdrawalsUnlocked":false,"message":"Verify to withdraw your earnings"}}""")
            }
            if (path.startsWith("/api/v1/wallets/me/transactions")) {
                transactionCalls += 1
                if (failFirstTransactions && transactionCalls == 1) error("Offline")
                if (path.contains("cursor=cursor-2")) {
                    if (failCursorPage && transactionCalls == 2) error("Offline")
                    return JSONObject("""{"data":[{"id":"txn-2","kind":"debit","amount":{"amountMinor":500,"currency":"NGN"},"description":"Refund","createdAt":"2026-10-30T09:00:00Z","status":"pending"}],"nextCursor":null}""")
                }
                val rows = if (withTransactions) """[{"id":"txn-1","kind":"credit","amount":{"amountMinor":12500,"currency":"NGN"},"description":"Order payout","createdAt":"2026-10-31T13:45:00Z","status":"completed"}]""" else "[]"
                return JSONObject("""{"data":$rows,"nextCursor":${if (withTransactions) "\"cursor-2\"" else "null"}}""")
            }
            if (path == "/api/v1/wallets/me/escrow-holds") {
                escrowCalls += 1
                if (failFirstEscrowHolds && escrowCalls == 1) error("Offline")
                val rows = if (withEscrowHolds) """[{"orderId":"order-1","orderReference":"NAN-1042","productName":"Handwoven bag","amount":{"amountMinor":12500,"currency":"NGN"},"stage":"shipped","expectedReleaseAt":"2026-11-08T12:00:00Z"}]""" else "[]"
                return JSONObject("""{"data":$rows,"nextCursor":null}""")
            }
            error("Unexpected wallet request: $path")
        }
    }

    private class HoldingExecutor : Executor {
        private val tasks = mutableListOf<Runnable>()
        override fun execute(command: Runnable) { tasks += command }
        fun runNext() { if (tasks.isNotEmpty()) tasks.removeAt(0).run() }
        fun runAll() { tasks.toList().forEach { it.run() }; tasks.clear() }
    }

    companion object {
        private fun signedInSession() = AccountSession("wallet-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))
    }
}
