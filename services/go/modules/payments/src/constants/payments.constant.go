package constants

const (
	PurposeOrderCheckout       = "order_checkout"
	PurposeCoinPurchase        = "coin_purchase"
	PurposeWalletTopUp         = "wallet_top_up"
	PurposeCreatorSubscription = "creator_subscription"
	PurposeWithdrawal          = "withdrawal"
	PurposeCreatorEarnings     = "creator_earnings"

	ProviderBachs   = "bachs"
	StoreAppleIap   = "apple_iap"
	StoreGooglePlay = "google_play"

	ConnectedAccountRoleSeller  = "seller"
	ConnectedAccountRoleCreator = "creator"

	CapabilityPayouts          = "payouts"
	CapabilityTransfers        = "transfers"
	CapabilityNairaCardCharges = "ngn_card_collection"
	CapabilityBankTransfers    = "bank_transfer"
	CapabilityVirtualAccounts  = "virtual_accounts"
	CapabilityStatusActive     = "active"
)

var ReferencePrefixByPurpose = map[string]string{
	PurposeOrderCheckout:       "zmpay_",
	PurposeCoinPurchase:        "zmcoin_",
	PurposeWalletTopUp:         "zmtop_",
	PurposeCreatorSubscription: "zmcsub_",
}
