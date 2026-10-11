package models

import "testing"

func TestWalletAccountsAreUserOwnedAndProviderHeld(t *testing.T) {
	for _, account := range []AccountRef{
		WalletAvailableAccount("u1", "NGN"), WalletDepositHoldAccount("u1", "NGN"), WalletReservedPayoutAccount("u1", "NGN"),
		WalletEscrowLockedAccount("u1", "e1", "NGN"), ProviderWalletMirrorAccount("flutterwave", "PSA123", "NGN"),
	} {
		if account.Custody() != CustodyProviderHeldUserOwned || account.AllowNegativeBalance || !account.Kind.IsValid() {
			t.Errorf("%s: custody=%s allowNegative=%v", account.Code, account.Custody(), account.AllowNegativeBalance)
		}
	}
	if got := WalletEscrowLockedAccount("u1", "e1", "NGN").Code; got != "wallet:u1:escrowLocked:e1" {
		t.Errorf("escrow lock code = %s", got)
	}
	if PlatformProviderPendingAccount("flutterwave", "NGN").Custody() != CustodyPlatformOwned {
		t.Error("provider pending must be platform owned")
	}
}

func TestEscrowHoldingAccountKeepsLegacySellerEscrowByDefault(t *testing.T) {
	if got := EscrowHoldingAccount("", "seller", "buyer", "e1", "NGN").Code; got != "seller:seller:escrow:e1" {
		t.Errorf("legacy escrow account = %s", got)
	}
	if got := EscrowHoldingAccount(EscrowCustodyBuyerWalletLock, "seller", "buyer", "e1", "NGN").Code; got != "wallet:buyer:escrowLocked:e1" {
		t.Errorf("buyer lock account = %s", got)
	}
}

func TestUserCashAccountsAreAlwaysTheFlutterwaveWallet(t *testing.T) {
	for _, provider := range []string{"flutterwave", "anything"} {
		cash := UserCashAccountsForProvider(provider, "u1", "NGN")
		if cash.Available.Code != "wallet:u1:available" || cash.DepositHold == nil || cash.DepositHold.Code != "wallet:u1:depositHold" || cash.ReservedPayout.Code != "wallet:u1:reservedPayout" {
			t.Errorf("%s accounts = %+v", provider, cash)
		}
	}
}
