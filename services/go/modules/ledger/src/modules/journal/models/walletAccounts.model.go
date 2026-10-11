package models

import (
	"fmt"
	"strings"
)

const (
	OwnerTypeUserProviderWallet = "userProviderWallet"
	OwnerTypeProviderWallet     = "providerWallet"

	CustodyProviderHeldUserOwned AccountCustody = "providerHeldUserOwned"

	EscrowCustodySellerEscrow    = "sellerEscrow"
	EscrowCustodyBuyerWalletLock = "buyerWalletLock"
)

func userProviderWalletLiability(code, currency, userId string) AccountRef {
	return AccountRef{Code: code, Currency: currency, Kind: AccountKindLiability, OwnerType: OwnerTypeUserProviderWallet, OwnerId: userId}
}

func WalletAvailableAccount(userId, currency string) AccountRef {
	return userProviderWalletLiability(fmt.Sprintf("wallet:%s:available", userId), currency, userId)
}

func WalletDepositHoldAccount(userId, currency string) AccountRef {
	return userProviderWalletLiability(fmt.Sprintf("wallet:%s:depositHold", userId), currency, userId)
}

func WalletReservedPayoutAccount(userId, currency string) AccountRef {
	return userProviderWalletLiability(fmt.Sprintf("wallet:%s:reservedPayout", userId), currency, userId)
}

func WalletEscrowLockedAccount(buyerUserId, escrowId, currency string) AccountRef {
	return userProviderWalletLiability(fmt.Sprintf("wallet:%s:escrowLocked:%s", buyerUserId, escrowId), currency, buyerUserId)
}

func WalletEscrowLockedAccountCodePrefix(buyerUserId string) string {
	return fmt.Sprintf("wallet:%s:escrowLocked:", buyerUserId)
}

func ProviderWalletMirrorAccount(provider, providerAccountRef, currency string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("asset:providerWallet:%s:%s", provider, providerAccountRef), Currency: currency, Kind: AccountKindAsset, OwnerType: OwnerTypeProviderWallet, OwnerId: providerAccountRef}
}

func PlatformProviderPendingAccount(provider, currency string) AccountRef {
	return platformAccount(fmt.Sprintf("asset:providerPending:%s", provider), currency, AccountKindAsset)
}

func PlatformDepositFeeRevenueAccount(currency string) AccountRef {
	return platformAccount("platformRevenue:depositFee", currency, AccountKindRevenue)
}

func EscrowHoldingAccount(custody, sellerUserId, buyerUserId, escrowId, currency string) AccountRef {
	if custody == EscrowCustodyBuyerWalletLock {
		return WalletEscrowLockedAccount(buyerUserId, escrowId, currency)
	}
	return SellerEscrowAccount(sellerUserId, escrowId, currency)
}

type UserCashAccounts struct {
	Available      AccountRef
	ReservedPayout AccountRef
	DepositHold    *AccountRef
}

func UserCashAccountsForProvider(_, userId, currency string) UserCashAccounts {
	hold := WalletDepositHoldAccount(userId, currency)
	return UserCashAccounts{Available: WalletAvailableAccount(userId, currency), ReservedPayout: WalletReservedPayoutAccount(userId, currency), DepositHold: &hold}
}

func WalletAccountCodePrefix(userId string) string {
	return fmt.Sprintf("wallet:%s:", userId)
}

func WalletOutgoingAccount(userId, currency string) AccountRef {
	return userProviderWalletLiability(fmt.Sprintf("wallet:%s:outgoing", userId), currency, userId)
}

func WalletInboundEscrowAccount(buyerUserId, escrowId, currency string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("walletInbound:%s:escrow:%s", buyerUserId, escrowId), Currency: currency, Kind: AccountKindLiability, OwnerType: OwnerTypeUser, OwnerId: buyerUserId}
}

func WalletDebtAccount(userId, currency string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("walletDebt:%s", userId), Currency: currency, Kind: AccountKindAsset, OwnerType: OwnerTypeUser, OwnerId: userId}
}

func DirectSellerPayableAccount(sellerUserId, currency string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("directPayable:%s", sellerUserId), Currency: currency, Kind: AccountKindLiability, OwnerType: OwnerTypeUser, OwnerId: sellerUserId}
}

func PlatformChargebackReceivableAccount(provider, currency string) AccountRef {
	return platformAccount(fmt.Sprintf("asset:chargebackReceivable:%s", provider), currency, AccountKindAsset)
}

func PlatformUnreconciledLossAccount(currency string) AccountRef {
	return platformAccount("expense:unrecoveredLoss", currency, AccountKindExpense)
}

func IsUserProviderWalletAccount(code string) bool {
	return strings.HasPrefix(code, "wallet:")
}

func WalletInboundAccount(userId, subject, currency string) AccountRef {
	return AccountRef{Code: fmt.Sprintf("walletInbound:%s:credit:%s", userId, subject), Currency: currency, Kind: AccountKindLiability, OwnerType: OwnerTypeUser, OwnerId: userId}
}
