package com.nantty.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.AdsBalanceRepository
import com.nantty.android.data.AdsBalanceTransport
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.Executor

@RunWith(AndroidJUnit4::class)
class AdsBalanceScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun rendersBalanceHistoryAndServerQuotedWithdrawalBeforeConfirmation() {
        val session = AccountSession("access", "refresh", AccountUser("user-1", "User", "user", "user@example.com", null, emptyList()))
        val repository = AdsBalanceRepository(
            baseUrl = "https://api.nantty.test",
            sessionProvider = { session },
            transport = AdsBalanceTransport { method, path, _, body, _ ->
                when {
                    method == "GET" && path == AdsBalanceRepository.BALANCE_PATH -> balanceJson(withdrawalAvailable = true)
                    method == "GET" && path == AdsBalanceRepository.TRANSACTIONS_PATH -> JSONObject(
                        """{"data":{"data":[{"id":"tx-1","pot":"balance","kind":"top_up","amount":{"amountMinor":10000,"currency":"NGN"},"description":"Balance top-up","createdAt":"2026-11-08T12:00:00Z"}],"nextCursor":null}}""",
                    )
                    method == "POST" && path == AdsBalanceRepository.WITHDRAWAL_QUOTE_PATH -> {
                        val amount = body!!.getJSONObject("amount").getLong("amountMinor")
                        JSONObject("""{"data":{"amount":{"amountMinor":$amount,"currency":"NGN"},"fee":{"amountMinor":150,"currency":"NGN"},"net":{"amountMinor":${amount - 150},"currency":"NGN"},"destination":"wallet","withdrawable":{"amountMinor":30000,"currency":"NGN"}}}""")
                    }
                    else -> error("Unexpected request $method $path")
                }
            },
        )

        compose.setContent {
            MaterialTheme {
                AdsBalanceScreen(repository, Executor { it.run() }, onBack = {}, onReauthenticate = {}, onBalanceChanged = {})
            }
        }

        compose.onNodeWithText("Ad credit & balance").assertIsDisplayed()
        compose.onNodeWithText("Top up ad balance").assertIsDisplayed()
        compose.onNodeWithText("Withdraw ad balance").assertIsDisplayed()
        compose.onNodeWithText("History").assertIsDisplayed()
        compose.onNodeWithText("Top-up").assertIsDisplayed()

        compose.onNodeWithTag("ads-balance-withdraw-amount").performTextInput("100")
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodes(hasTestTag("ads-balance-withdraw-quote")).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("ads-balance-withdraw-quote").assertIsDisplayed()
        compose.onNodeWithText("Payment provider fee:", substring = true).assertIsDisplayed()
        compose.onNodeWithText("You get", substring = true).assertIsDisplayed()
    }

    private fun balanceJson(withdrawalAvailable: Boolean) = JSONObject(
        """{"data":{"accountId":"account-1","balance":{"amountMinor":30000,"currency":"NGN"},"credit":{"amountMinor":20000,"currency":"NGN"},"committed":{"amountMinor":5000,"currency":"NGN"},"spendable":{"amountMinor":45000,"currency":"NGN"},"withdrawable":{"amountMinor":30000,"currency":"NGN"},"pendingSettlement":{"amountMinor":0,"currency":"NGN"},"creditLots":[],"cashback":{"enabled":false,"percent":0},"topUp":{"available":true,"reasonCode":null,"reason":null,"minimum":{"amountMinor":1000,"currency":"NGN"},"maximum":{"amountMinor":500000,"currency":"NGN"},"suggested":[{"amountMinor":1000,"currency":"NGN"}]},"withdrawal":{"available":$withdrawalAvailable,"reasonCode":null,"reason":null,"minimum":{"amountMinor":5000,"currency":"NGN"}}}}""",
    )
}
