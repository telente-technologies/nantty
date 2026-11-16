package models_test

import (
	"testing"

	"nantty/modules/ledger/src/modules/journal/models"
)

func TestWalletAccountsAreUserOwnedAndProviderHeld(t *testing.T) {
	for _, account := range []models.AccountRef{
		models.WalletAvailableAccount("u1", "NGN"), models.WalletDepositHoldAccount("u1", "NGN"), models.WalletReservedPayoutAccount("u1", "NGN"),
		models.WalletEscrowLockedAccount("u1", "e1", "NGN"), models.ProviderWalletMirrorAccount("flutterwave", "PSA123", "NGN"),
	} {
		if account.Custody() != models.CustodyProviderHeldUserOwned || account.AllowNegativeBalance || !account.Kind.IsValid() {
			t.Errorf("%s: custody=%s allowNegative=%v", account.Code, account.Custody(), account.AllowNegativeBalance)
		}
	}
	if got := models.WalletEscrowLockedAccount("u1", "e1", "NGN").Code; got != "wallet:u1:escrowLocked:e1" {
		t.Errorf("escrow lock code = %s", got)
	}
	if models.PlatformProviderPendingAccount("flutterwave", "NGN").Custody() != models.CustodyPlatformOwned {
		t.Error("provider pending must be platform owned")
	}
}

func TestEscrowHoldingAccountKeepsLegacySellerEscrowByDefault(t *testing.T) {
	if got := models.EscrowHoldingAccount("", "seller", "buyer", "e1", "NGN").Code; got != "seller:seller:escrow:e1" {
		t.Errorf("legacy escrow account = %s", got)
	}
	if got := models.EscrowHoldingAccount(models.EscrowCustodyBuyerWalletLock, "seller", "buyer", "e1", "NGN").Code; got != "wallet:buyer:escrowLocked:e1" {
		t.Errorf("buyer lock account = %s", got)
	}
}

func TestUserCashAccountsAreAlwaysTheFlutterwaveWallet(t *testing.T) {
	for _, provider := range []string{"flutterwave", "anything"} {
		cash := models.UserCashAccountsForProvider(provider, "u1", "NGN")
		if cash.Available.Code != "wallet:u1:available" || cash.DepositHold == nil || cash.DepositHold.Code != "wallet:u1:depositHold" || cash.ReservedPayout.Code != "wallet:u1:reservedPayout" {
			t.Errorf("%s accounts = %+v", provider, cash)
		}
	}
}
