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
	return AccountRef{Code: code, Currency: currency, Kind: AccountKindLiability, OwnerType: OwnerTypeUser, OwnerId: userId}
}

func platformAccount(code, currency string, kind AccountKind) AccountRef {
	return AccountRef{Code: code, Currency: currency, Kind: kind, OwnerType: OwnerTypePlatform, AllowNegativeBalance: true}
}

func UserSpendableCoinsAccount(userId string) AccountRef {
	return userOwnedLiability(fmt.Sprintf("user:%s:coins", userId), CoinUnit, userId)
}

func CreatorEarnedCoinsAccount(userId string) AccountRef {
	return userOwnedLiability(fmt.Sprintf("creator:%s:earnedCoins", userId), CoinUnit, userId)
}

func BattleHoldingCoinsAccountCodePrefix(battleId string) string {
	return fmt.Sprintf("live:battle:%s:holding:", battleId)
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

const (
	OwnerTypePlatform                = "platform"
	OwnerTypeUser                    = "user"
	OwnerTypeProviderHeldSellerFunds = "sellerProviderHeld"
)

type AccountCustody string

const (
	CustodyProviderHeldSellerOwned AccountCustody = "providerHeldSellerOwned"
	CustodyPlatformOwned           AccountCustody = "platformOwned"
)

func (account AccountRef) Custody() AccountCustody {
	if account.OwnerType == OwnerTypeProviderHeldSellerFunds {
		return CustodyProviderHeldSellerOwned
	}
	return CustodyPlatformOwned
}

func providerHeldSellerLiability(code, currency, sellerUserId string) AccountRef {
	return AccountRef{Code: code, Currency: currency, Kind: AccountKindLiability, OwnerType: OwnerTypeProviderHeldSellerFunds, OwnerId: sellerUserId}
}

func SellerProviderHeldFundsAccount(sellerUserId, currency string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("seller:%s:providerHeld", sellerUserId), Currency: currency, Kind: AccountKindAsset, OwnerType: OwnerTypeProviderHeldSellerFunds, OwnerId: sellerUserId, AllowNegativeBalance: true}
}

func SellerProviderHeldFundsAccountCodeSuffix() string { return ":providerHeld" }

func SellerAvailableAccount(userId, currency string) AccountRef {
	return providerHeldSellerLiability(fmt.Sprintf("seller:%s:available", userId), currency, userId)
}

func SellerPendingAccount(userId, currency string) AccountRef {
	return providerHeldSellerLiability(fmt.Sprintf("seller:%s:pending", userId), currency, userId)
}

func SellerReservedPayoutAccount(userId, currency string) AccountRef {
	return providerHeldSellerLiability(fmt.Sprintf("seller:%s:reservedPayout", userId), currency, userId)
}

func SellerSettlingByPaystackAccount(userId, currency string) AccountRef {
	return providerHeldSellerLiability(fmt.Sprintf("seller:%s:settlingByPaystack", userId), currency, userId)
}

func SellerRefundsInFlightAccount(userId, currency string) AccountRef {
	return providerHeldSellerLiability(fmt.Sprintf("seller:%s:refundsInFlight", userId), currency, userId)
}

func SellerDebtAccount(userId, currency string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("seller:%s:debt", userId), Currency: currency, Kind: AccountKindAsset, OwnerType: OwnerTypeProviderHeldSellerFunds, OwnerId: userId}
}

func SellerEscrowAccount(sellerUserId, escrowId, currency string) AccountRef {
	return providerHeldSellerLiability(fmt.Sprintf("seller:%s:escrow:%s", sellerUserId, escrowId), currency, sellerUserId)
}

func SellerEscrowAccountCodePrefix(sellerUserId string) string {
	return fmt.Sprintf("seller:%s:escrow:", sellerUserId)
}

func CreatorEarningsPayableAccount(userId, currency string) AccountRef {
	return userOwnedLiability(fmt.Sprintf("creator:%s:earningsPayable", userId), currency, userId)
}

func CreatorEarningsPayableAccountCodeSuffix() string { return ":earningsPayable" }

func CreatorEarningsDebtAccount(userId, currency string) AccountRef {
	return AccountRef{Code: "creator:" + userId + ":earningsDebt", Currency: currency, Kind: AccountKindAsset, OwnerType: OwnerTypeUser, OwnerId: userId}
}

func PlatformProviderBalanceAccount(provider, currency string) AccountRef {
	return platformAccount(fmt.Sprintf("asset:providerBalance:%s", provider), currency, AccountKindAsset)
}

func PlatformCommissionRevenueAccount(currency string) AccountRef {
	return platformAccount("revenue:commission", currency, AccountKindRevenue)
}

func PlatformEscrowFeeRevenueAccount(currency string) AccountRef {
	return platformAccount("revenue:escrowFees", currency, AccountKindRevenue)
}

func AdvertiserPrepaidBalanceAccount(adAccountId, currency string) AccountRef {
	return AccountRef{Code: "advertiser:" + adAccountId + ":prepaidBalance", Currency: currency, Kind: AccountKindLiability, OwnerType: "advertiser", OwnerId: adAccountId}
}

func PlatformAdRevenueAccount(currency string) AccountRef {
	return platformAccount("revenue:ads", currency, AccountKindRevenue)
}

func PlatformFeesUnearnedAccount(currency string) AccountRef {
	return platformAccount("liability:platformFeesUnearned", currency, AccountKindLiability)
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

func RefundedProcessingFeesExpenseAccount(currency string) AccountRef {
	return platformAccount("expense:refundedProcessingFees", currency, AccountKindExpense)
}

func RefundsPayableAccount(provider, currency string) AccountRef {
	return platformAccount("liability:refundsPayable:"+provider, currency, AccountKindLiability)
}

func AppStoreFeeExpenseAccount(store, currency string) AccountRef {
	return platformAccount("expense:appStoreFees:"+store, currency, AccountKindExpense)
}

func CreatorSubscriptionRevenueAccount(currency string) AccountRef {
	return platformAccount("revenue:creatorSubscriptions", currency, AccountKindRevenue)
}

func PlatformSubscriptionRevenueAccount(currency string) AccountRef {
	return platformAccount("revenue:planSubscriptions", currency, AccountKindRevenue)
}

func UserCoinDebtAccount(userId string) AccountRef {
	return AccountRef{Code: "user:" + userId + ":coinDebt", Currency: CoinUnit, Kind: AccountKindAsset, OwnerType: "user", OwnerId: userId, AllowNegativeBalance: false}
}
