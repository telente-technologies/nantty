package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

class WalletRepositoryTest {
    @Test
    fun requestsOnlyCurrentUsersWalletUsingExistingSessionToken() {
        val transport = RecordingWalletTransport(walletPayload())
        val session = AccountSession("current-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))

        val result = WalletRepository("https://api.nantty.com", { session }, transport).load() as WalletResult.Success

        assertEquals("/api/v1/wallets/me", transport.path)
        assertEquals("current-access", transport.token)
        assertEquals(listOf("Available", "Held in escrow", "Coins"), result.wallet.lines.map(WalletLine::label))
        assertEquals(WalletMoney(123456, "NGN"), result.wallet.available)
        assertEquals(WalletCoins(10, 4), result.wallet.coins)
        assertFalse(result.wallet.verification.withdrawalsUnlocked)
        assertEquals("Verify to withdraw your earnings", result.wallet.verification.message)
    }

    @Test
    fun refusesToRequestWalletWithoutSignedInSession() {
        val transport = RecordingWalletTransport(walletPayload())
        val result = WalletRepository("https://api.nantty.com", { null }, transport).load() as WalletResult.Failure

        assertTrue(result.message.contains("Sign in"))
        assertEquals(null, transport.path)
    }

    @Test
    fun loadsRecentTransactionsFromAuthenticatedCursorPageContract() {
        val payload = JSONObject(
            """{"data":[{"id":"txn-1","kind":"credit","amount":{"amountMinor":12500,"currency":"NGN"},"description":"Order payout","createdAt":"2026-10-31T13:45:00Z","status":"completed"},{"id":"txn-2","kind":"debit","amount":{"amountMinor":500,"currency":"NGN"},"description":"Refund","createdAt":"2026-10-30T09:00:00Z","status":"pending"}],"nextCursor":"cursor-2"}""",
        )
        val transport = RecordingWalletTransport(payload)

        val result = WalletRepository("https://api.nantty.com", ::signedInSession, transport).loadRecentTransactions()

        assertEquals("/api/v1/wallets/me/transactions?limit=20", transport.path)
        assertEquals("current-access", transport.token)
        assertEquals(
            WalletTransactionsResult.Success(
                WalletTransactionPage(listOf(
                    WalletTransaction("txn-1", "credit", WalletMoney(12500, "NGN"), "Order payout", "2026-10-31T13:45:00Z", "completed"),
                    WalletTransaction("txn-2", "debit", WalletMoney(500, "NGN"), "Refund", "2026-10-30T09:00:00Z", "pending"),
                ), "cursor-2"),
            ),
            result,
        )
    }

    @Test
    fun requestsNextWalletTransactionPageWithEncodedCursor() {
        val transport = RecordingWalletTransport(JSONObject("""{"data":[],"nextCursor":null}"""))

        WalletRepository("https://api.nantty.com", ::signedInSession, transport).loadRecentTransactions("cursor / two")

        assertEquals("/api/v1/wallets/me/transactions?limit=20&cursor=cursor%20%2F%20two", transport.path)
        assertEquals("current-access", transport.token)
    }

    @Test
    fun refusesTransactionHistoryWithoutSignedInSession() {
        val transport = RecordingWalletTransport(walletPayload())

        val result = WalletRepository("https://api.nantty.com", { null }, transport).loadRecentTransactions()

        assertTrue((result as WalletTransactionsResult.Failure).message.contains("Sign in"))
        assertEquals(null, transport.path)
    }

    @Test
    fun refusesTransactionHistoryWhenSessionHasNoAccessToken() {
        val transport = RecordingWalletTransport(walletPayload())
        val invalidSession = signedInSession().copy(accessToken = " ")

        val result = WalletRepository("https://api.nantty.com", { invalidSession }, transport).loadRecentTransactions()

        assertTrue((result as WalletTransactionsResult.Failure).message.contains("Sign in"))
        assertEquals(null, transport.path)
    }

    @Test
    fun returnsEmptyHistoryForAnEmptyCursorPage() {
        val result = WalletRepository(
            "https://api.nantty.com",
            ::signedInSession,
            RecordingWalletTransport(JSONObject("""{"data":[],"nextCursor":null}""")),
        ).loadRecentTransactions()

        assertEquals(WalletTransactionsResult.Success(WalletTransactionPage(emptyList(), null)), result)
    }

    @Test
    fun reportsMalformedTransactionPageAsFailure() {
        val result = WalletRepository(
            "https://api.nantty.com",
            ::signedInSession,
            RecordingWalletTransport(JSONObject("{}")),
        ).loadRecentTransactions()

        assertTrue(result is WalletTransactionsResult.Failure)
    }

    @Test
    fun doesNotMislabelUnknownTransactionStatusesAsCompleted() {
        val result = WalletRepository(
            "https://api.nantty.com",
            ::signedInSession,
            RecordingWalletTransport(
                JSONObject("""{"data":[{"id":"txn-unknown","kind":"credit","amount":{"amountMinor":100,"currency":"NGN"},"description":"Unrecognized provider state","createdAt":"2026-10-31T13:45:00Z","status":"settled_elsewhere"}],"nextCursor":null}"""),
            ),
        ).loadRecentTransactions() as WalletTransactionsResult.Success

        assertEquals("unknown", result.page.items.single().status)
    }

    @Test
    fun usesReactNativeAvailablePendingFallbackWhenApiLinesAreEmpty() {
        val payload = walletPayload().put("lines", org.json.JSONArray())
        val wallet = WalletRepository("https://api.nantty.com", { signedInSession() }, RecordingWalletTransport(payload)).load() as WalletResult.Success

        assertEquals(listOf("Available to withdraw", "Pending (escrow)"), wallet.wallet.lines.map(WalletLine::label))
        assertEquals(listOf(123456L, 2345L), wallet.wallet.lines.map { it.amount.amountMinor })
    }

    @Test
    fun formatsMinorUnitsAndCoinsWithoutFloatingPointMoneyMath() {
        assertTrue(formatWalletAmount(WalletMoney(123456, "NGN"), Locale("en", "NG")).contains("1,234.56"))
        assertTrue(formatWalletAmount(WalletMoney(1234567, "KWD"), Locale.US).contains("1,234.567"))
        assertTrue(formatWalletAmount(WalletMoney(1234, "JPY"), Locale.JAPAN).contains("1,234"))
        assertEquals("1,234 coins", formatWalletAmount(WalletMoney(1234, "COIN"), Locale.US))
    }

    private fun walletPayload() = JSONObject(
        """{"available":{"amountMinor":123456,"currency":"NGN"},"pending":{"amountMinor":2345,"currency":"NGN"},"lines":[{"key":"available","label":"Available","description":"Can withdraw","amount":{"amountMinor":123456,"currency":"NGN"}},{"key":"pending","label":"Held in escrow","description":"Held until delivery","amount":{"amountMinor":2345,"currency":"NGN"}},{"key":"coins","label":"Coins","description":"Not cash","amount":{"amountMinor":14,"currency":"COIN"}}],"coins":{"spendable":10,"earned":4},"verification":{"level":1,"withdrawalsUnlocked":false,"waitingForVerification":{"amountMinor":125801,"currency":"NGN"},"nextStep":"identity_check","message":"Verify to withdraw your earnings"}}""",
    )

    private fun signedInSession() = AccountSession("current-access", "refresh", AccountUser("user-1", "Ari", "ari", null, null, emptyList()))

    private class RecordingWalletTransport(private val response: JSONObject) : WalletTransport {
        var path: String? = null
        var token: String? = null
        override fun get(path: String, accessToken: String?): JSONObject {
            this.path = path
            token = accessToken
            return response
        }
    }
}
