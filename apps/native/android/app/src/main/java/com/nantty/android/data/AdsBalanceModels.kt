package com.nantty.android.data

data class AdsBalanceCreditLot(
    val id: String,
    val source: String,
    val remaining: AdsWorkspaceMoney,
    val expiresAt: String?,
    val reason: String?,
    val createdAt: String,
)

data class AdsBalanceAvailability(
    val available: Boolean,
    val reasonCode: String?,
    val reason: String?,
    val minimum: AdsWorkspaceMoney,
)

data class AdsBalanceSummary(
    val accountId: String?,
    val balance: AdsWorkspaceMoney,
    val credit: AdsWorkspaceMoney,
    val committed: AdsWorkspaceMoney,
    val spendable: AdsWorkspaceMoney,
    val withdrawable: AdsWorkspaceMoney,
    val pendingSettlement: AdsWorkspaceMoney,
    val creditLots: List<AdsBalanceCreditLot>,
    val cashbackEnabled: Boolean,
    val cashbackPercent: Int,
    val topUpAvailable: Boolean,
    val topUpReasonCode: String?,
    val topUpReason: String?,
    val topUpMinimum: AdsWorkspaceMoney,
    val topUpMaximum: AdsWorkspaceMoney,
    val suggestedTopUps: List<AdsWorkspaceMoney>,
    val withdrawal: AdsBalanceAvailability,
)

data class AdsBalanceTransaction(
    val id: String,
    val pot: String,
    val kind: String,
    val amount: AdsWorkspaceMoney,
    val description: String,
    val createdAt: String,
)

data class AdsBalanceTransactionPage(val items: List<AdsBalanceTransaction>, val nextCursor: String?)

data class AdsBalanceTopUpCheckout(val topUpId: String, val reference: String, val checkoutUrl: String)

data class AdsBalanceWithdrawalQuote(
    val amount: AdsWorkspaceMoney,
    val fee: AdsWorkspaceMoney,
    val net: AdsWorkspaceMoney,
    val destination: String,
    val withdrawable: AdsWorkspaceMoney,
)

data class AdsBalanceWithdrawal(
    val id: String,
    val status: String,
    val amount: AdsWorkspaceMoney,
    val fee: AdsWorkspaceMoney,
    val net: AdsWorkspaceMoney,
    val destination: String,
    val createdAt: String,
)

sealed interface AdsBalanceResult<out T> {
    data class Success<T>(val value: T) : AdsBalanceResult<T>
    data class Failure(
        val message: String,
        val authenticationRequired: Boolean = false,
        val code: String? = null,
    ) : AdsBalanceResult<Nothing>
}

