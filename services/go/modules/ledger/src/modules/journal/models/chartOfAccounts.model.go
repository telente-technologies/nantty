package models

import "fmt"

type AccountKind string

const (
	AccountKindAsset     AccountKind = "asset"
	AccountKindLiability AccountKind = "liability"
	AccountKindEquity    AccountKind = "equity"
	AccountKindRevenue   AccountKind = "revenue"
	AccountKindExpense   AccountKind = "expense"
)

type Direction string

const (
	Debit  Direction = "debit"
	Credit Direction = "credit"
)

const CoinUnit = "COIN"

func (kind AccountKind) NormalSide() Direction {
	if kind == AccountKindAsset || kind == AccountKindExpense {
		return Debit
	}
	return Credit
}

func (kind AccountKind) IsValid() bool {
	switch kind {
	case AccountKindAsset, AccountKindLiability, AccountKindEquity, AccountKindRevenue, AccountKindExpense:
		return true
	}
	return false
}

type AccountRef struct {
	Code                 string
	Currency             string
	Kind                 AccountKind
	OwnerType            string
	OwnerId              string
	AllowNegativeBalance bool
}

type AccountKey struct {
	Code     string
	Currency string
}

func (account AccountRef) Key() AccountKey {
	return AccountKey{Code: account.Code, Currency: account.Currency}
}

func userOwnedLiability(code, currency, userId string) AccountRef {
	return AccountRef{Code: code, Currency: currency, Kind: AccountKindLiability, OwnerType: "user", OwnerId: userId}
}

func platformAccount(code, currency string, kind AccountKind) AccountRef {
	return AccountRef{Code: code, Currency: currency, Kind: kind, OwnerType: "platform", AllowNegativeBalance: true}
}

func UserSpendableCoinsAccount(userId string) AccountRef {
	return userOwnedLiability(fmt.Sprintf("user:%s:coins", userId), CoinUnit, userId)
}

func CreatorEarnedCoinsAccount(userId string) AccountRef {
	return userOwnedLiability(fmt.Sprintf("creator:%s:earnedCoins", userId), CoinUnit, userId)
}

func BattleHoldingCoinsAccount(battleId, userId string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("live:battle:%s:holding:%s", battleId, userId), Currency: CoinUnit, Kind: AccountKindLiability, OwnerType: "battle", OwnerId: battleId}
}

func PlatformGiftRevenueCoinsAccount() AccountRef {
	return platformAccount("platform:giftRevenue", CoinUnit, AccountKindRevenue)
}

func PlatformCoinTransferFeeRevenueAccount() AccountRef {
	return platformAccount("platform:coinTransferFees", CoinUnit, AccountKindRevenue)
}

func CoinsInCirculationAccount() AccountRef {
	return platformAccount("platform:coinsInCirculation", CoinUnit, AccountKindAsset)
}

func UserWalletAccount(userId, currency string) AccountRef {
	return userOwnedLiability(fmt.Sprintf("user:%s:wallet", userId), currency, userId)
}

func UserPayoutPendingAccount(userId, currency string) AccountRef {
	return userOwnedLiability(fmt.Sprintf("user:%s:payoutPending", userId), currency, userId)
}

func ProviderClearingAccount(provider, currency string) AccountRef {
	return platformAccount(fmt.Sprintf("asset:providerClearing:%s", provider), currency, AccountKindAsset)
}

func EscrowHoldingAccount(escrowId, currency string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("liability:escrow:%s", escrowId), Currency: currency, Kind: AccountKindLiability, OwnerType: "escrow", OwnerId: escrowId}
}

func PlatformCommissionRevenueAccount(currency string) AccountRef {
	return platformAccount("revenue:commission", currency, AccountKindRevenue)
}

func CoinSalesRevenueAccount(currency string) AccountRef {
	return platformAccount("revenue:coinSales", currency, AccountKindRevenue)
}

func CreatorCoinPayoutExpenseAccount(currency string) AccountRef {
	return platformAccount("expense:creatorCoinPayouts", currency, AccountKindExpense)
}

func PaymentsAwaitingApplicationAccount(currency string) AccountRef {
	return platformAccount("liability:paymentsAwaitingApplication", currency, AccountKindLiability)
}

func PaymentProcessingFeeExpenseAccount(currency string) AccountRef {
	return platformAccount("expense:paymentProcessingFees", currency, AccountKindExpense)
}

func RefundsPayableAccount(provider, currency string) AccountRef {
	return platformAccount("liability:refundsPayable:"+provider, currency, AccountKindLiability)
}

func AppStoreFeeExpenseAccount(store, currency string) AccountRef {
	return platformAccount("expense:appStoreFees:"+store, currency, AccountKindExpense)
}

func PayoutsInFlightAccount(provider, currency string) AccountRef {
	return platformAccount("liability:payoutsInFlight:"+provider, currency, AccountKindLiability)
}

func CreatorSubscriptionRevenueAccount(currency string) AccountRef {
	return platformAccount("revenue:creatorSubscriptions", currency, AccountKindRevenue)
}

func UserCoinDebtAccount(userId string) AccountRef {
	return AccountRef{Code: "user:" + userId + ":coinDebt", Currency: CoinUnit, Kind: AccountKindAsset, OwnerType: "user", OwnerId: userId, AllowNegativeBalance: false}
}
